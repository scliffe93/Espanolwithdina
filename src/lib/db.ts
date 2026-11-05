import { openDB, type IDBPDatabase } from 'idb';
import type { AppState } from '../types';
import { migrate } from './state';

// Local-only persistence. Two stores:
//   kv          → the AppState document (key "state")
//   recordings  → audio Blobs from voice notes and pronunciation practice

const DB_NAME = 'viva';
const DB_VERSION = 1;
let dbp: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        if (!d.objectStoreNames.contains('recordings')) d.createObjectStore('recordings');
      },
    });
  }
  return dbp;
}

export async function loadState(): Promise<AppState> {
  try {
    const raw = await (await db()).get('kv', 'state');
    return migrate(raw);
  } catch (e) {
    console.warn('VIVA: could not open IndexedDB, starting fresh (progress will not persist).', e);
    return migrate(null);
  }
}

export async function saveState(state: AppState): Promise<void> {
  await (await db()).put('kv', state, 'state');
}

export async function saveRecording(id: string, blob: Blob): Promise<void> {
  await (await db()).put('recordings', blob, id);
}

export async function getRecording(id: string): Promise<Blob | undefined> {
  return (await db()).get('recordings', id);
}

export async function deleteRecording(id: string): Promise<void> {
  await (await db()).delete('recordings', id);
}

export async function recordingCount(): Promise<number> {
  return (await db()).count('recordings');
}

/** Deletes everything VIVA stored on this device. */
export async function wipeAll(): Promise<void> {
  const d = await db();
  await d.clear('kv');
  await d.clear('recordings');
}

// ── Export / import ──────────────────────────────────────────────

export interface ExportFile {
  app: 'viva';
  exportedAt: string;
  state: AppState;
  recordings?: Record<string, { type: string; data: string }>;
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = rej;
    r.readAsDataURL(b);
  });
}

export async function exportData(state: AppState, includeRecordings: boolean): Promise<Blob> {
  const out: ExportFile = { app: 'viva', exportedAt: new Date().toISOString(), state };
  if (includeRecordings) {
    const d = await db();
    const keys = await d.getAllKeys('recordings');
    out.recordings = {};
    for (const k of keys) {
      const b = (await d.get('recordings', k)) as Blob | undefined;
      if (b) out.recordings[String(k)] = { type: b.type, data: await blobToBase64(b) };
    }
  }
  return new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
}

export async function importData(text: string): Promise<AppState> {
  const parsed = JSON.parse(text) as Partial<ExportFile>;
  if (parsed.app !== 'viva' || !parsed.state) throw new Error('This file is not a VIVA export.');
  const state = migrate(parsed.state);
  const d = await db();
  if (parsed.recordings) {
    for (const [k, v] of Object.entries(parsed.recordings)) {
      const bytes = Uint8Array.from(atob(v.data), (c) => c.charCodeAt(0));
      await d.put('recordings', new Blob([bytes], { type: v.type }), k);
    }
  }
  await saveState(state);
  return state;
}
