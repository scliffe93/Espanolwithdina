-- Learning with Dina — learner accounts & cloud progress.
-- Username + password accounts (no email), handled by the `account` Edge Function.
-- Row Level Security is ENABLED with NO policies: the public anon/authenticated
-- roles can never read or write these tables. Only the Edge Function (server-side
-- database connection) can, and it scopes every query to the signed-in learner.

create table if not exists public.lwd_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  username_norm text not null unique,
  first_name text not null check (char_length(first_name) between 1 and 40),
  password_hash text not null,          -- Argon2id (encoded, includes salt + parameters)
  recovery_hash text not null,          -- SHA-256 of a 80-bit random recovery code
  created_at timestamptz not null default now(),
  password_changed_at timestamptz not null default now()
);

create table if not exists public.lwd_sessions (
  token_hash text primary key,          -- SHA-256 of a 256-bit random session token
  user_id uuid not null references public.lwd_users(id) on delete cascade,
  remember boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now()
);
create index if not exists lwd_sessions_user_idx on public.lwd_sessions(user_id);

create table if not exists public.lwd_progress (
  user_id uuid primary key references public.lwd_users(id) on delete cascade,
  data jsonb not null,
  version integer not null default 1,   -- optimistic concurrency: every write must name the version it was based on
  updated_at timestamptz not null default now(),
  updated_by text                        -- random per-device id (not personal data)
);

create table if not exists public.lwd_attempts (
  id bigserial primary key,
  bucket text not null,                 -- e.g. login:user:<username>, login:ip:<ip>
  at timestamptz not null default now()
);
create index if not exists lwd_attempts_bucket_idx on public.lwd_attempts(bucket, at);

alter table public.lwd_users    enable row level security;
alter table public.lwd_sessions enable row level security;
alter table public.lwd_progress enable row level security;
alter table public.lwd_attempts enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.lwd_users, public.lwd_sessions, public.lwd_progress, public.lwd_attempts from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.lwd_users, public.lwd_sessions, public.lwd_progress, public.lwd_attempts from authenticated;
  end if;
end $$;
