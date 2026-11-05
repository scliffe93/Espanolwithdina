import type { Activity, Difficulty, Interest, LearnerProfile, Reason } from '../types';
import { uniformLevels } from '../lib/assessmentScore';

export const PROFICIENCY: { value: LearnerProfile['proficiencySelf']; label: string; hint: string }[] = [
  { value: 'none', label: 'None yet', hint: 'Starting fresh' },
  { value: 'few-words', label: 'A few words', hint: 'Hola, gracias, cerveza…' },
  { value: 'basic', label: 'Basic', hint: 'I can introduce myself' },
  { value: 'conversational', label: 'Conversational', hint: 'I get by, with effort' },
  { value: 'advanced', label: 'Advanced', hint: 'I want polish and nuance' },
];

export const RELOCATION: { value: LearnerProfile['relocation']; label: string }[] = [
  { value: 'moving-soon', label: 'Moving in the next few months' },
  { value: 'within-year', label: 'Within a year' },
  { value: 'someday', label: 'Someday — it\'s the dream' },
  { value: 'already-there', label: 'I already live there' },
  { value: 'not-moving', label: 'Not moving, just love Spanish' },
];

export const REASONS: { value: Reason; label: string }[] = [
  { value: 'relocation', label: 'Moving abroad' },
  { value: 'career', label: 'Work & career' },
  { value: 'partner', label: 'My partner or their family' },
  { value: 'friends', label: 'Making friends' },
  { value: 'travel', label: 'Travel' },
  { value: 'heritage', label: 'Family heritage' },
  { value: 'challenge', label: 'The challenge itself' },
];

export const INTERESTS: { value: Interest; label: string }[] = [
  { value: 'food', label: 'Food & cooking' },
  { value: 'football', label: 'Football' },
  { value: 'fitness', label: 'Gym & running' },
  { value: 'music', label: 'Live music' },
  { value: 'art', label: 'Art & museums' },
  { value: 'tech', label: 'Tech' },
  { value: 'travel', label: 'Travel' },
  { value: 'nightlife', label: 'Nightlife' },
  { value: 'reading', label: 'Books' },
  { value: 'cinema', label: 'Film & TV' },
  { value: 'nature', label: 'Hiking & nature' },
];

export const SOCIAL: { value: LearnerProfile['socialGoals'][number]; label: string }[] = [
  { value: 'friends', label: 'Making friends' },
  { value: 'dating', label: 'Dating' },
  { value: 'colleagues', label: 'Colleagues' },
  { value: 'neighbours', label: 'Neighbours & community' },
  { value: 'family', label: 'Partner\'s family' },
];

export const MINUTES = [5, 10, 15, 20, 30];

export const ACTIVITIES: { value: Activity; label: string }[] = [
  { value: 'stories', label: 'Stories & conversations' },
  { value: 'games', label: 'Games & quick drills' },
  { value: 'audio', label: 'Listening' },
  { value: 'speaking', label: 'Speaking aloud' },
  { value: 'writing', label: 'Writing & typing' },
  { value: 'visual', label: 'Pictures & visual cues' },
];

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'verbs', label: 'Verb conjugations' },
  { value: 'ser-estar', label: 'Ser vs estar' },
  { value: 'listening', label: 'Understanding fast speech' },
  { value: 'speaking', label: 'Speaking without freezing' },
  { value: 'pronunciation', label: 'Pronunciation' },
  { value: 'vocabulary', label: 'Remembering words' },
  { value: 'genders', label: 'Masculine / feminine' },
  { value: 'confidence', label: 'Confidence' },
];

export const GENDER: { value: LearnerProfile['gender']; label: string; hint: string }[] = [
  { value: 'f', label: 'Feminine', hint: 'Estoy cansada' },
  { value: 'm', label: 'Masculine', hint: 'Estoy cansado' },
  { value: 'x', label: 'Show me both', hint: 'Estoy cansado/a' },
];

export function blankProfile(): LearnerProfile {
  return {
    name: '',
    gender: 'x',
    proficiencySelf: 'none',
    destinationCountry: 'Spain',
    destinationCity: 'Madrid',
    relocation: 'someday',
    interests: [],
    career: '',
    socialGoals: [],
    reasons: [],
    dailyMinutes: 10,
    activities: [],
    difficulties: [],
    hasTeacher: false,
    region: 'spain',
    city: 'madrid',
    citiesVisited: [],
    notes: {},
    voiceNotes: [],
    levels: uniformLevels('A1'),
    levelSource: 'zero',
    levelOverridden: false,
    createdAt: Date.now(),
  };
}

export const labelOf = <T extends string>(list: { value: T; label: string }[], v: T) => list.find((x) => x.value === v)?.label ?? v;
