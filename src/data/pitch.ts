// ───────────────────────────────────────────────────────────────
// The sales side: the personalised pitch page (#/pitch?to=Laura&school=Academia%20Sol&city=valencia) and the
// outreach email that links to it. Fill in the sender details once; the page reads them at build time.
// The price list itself is in marketing/pricing.md; keep the two in step.
// ───────────────────────────────────────────────────────────────

export interface Plan {
  id: 'tutor' | 'school';
  name: string;
  /** Who it is for, in a few words. */
  who: string;
  /** £ per active student per month. */
  perStudent: number;
  /** £ per month, whatever the student count. */
  minimum: number;
  /** £ one-off. */
  setup: number;
  lines: string[];
  highlight?: boolean;
}

export const PITCH = {
  /** Who signs the email and the page. */
  senderName: '[Your name]',
  /** Where “Book a walkthrough” goes. A booking link (Calendly, a Google Calendar appointment page…) wins over the email. */
  bookingUrl: '',
  /** Used for the mailto link when there is no booking link. Leave empty to ask the reader to reply to the email instead. */
  senderEmail: '',
  /** How long a new client’s copy takes to go live, as a phrase. */
  setupTime: 'about two weeks',
  plans: [
    {
      id: 'tutor', name: 'Independent tutors', who: 'One teacher and their students', perStudent: 6, minimum: 39, setup: 950,
      lines: ['Your name, colours and your own illustrated character', 'Debriefs, the adaptive week, the games and storylines', 'Analytics, PDF reports, invoices and lesson packages', 'Hosting, updates, the guides and email support'],
    },
    {
      id: 'school', name: 'Language schools', who: 'Several teachers under one roof', perStudent: 5, minimum: 199, setup: 2500, highlight: true,
      lines: ['Everything in the tutor plan', 'Several teachers under one admin seat', 'Your own web address, no platform branding', 'Team onboarding and priority support'],
    },
  ] as Plan[],
};

/** What a plan costs per month for a number of active students. */
export function monthlyPrice(plan: Plan, students: number): number {
  return Math.max(plan.minimum, Math.max(0, Math.round(students)) * plan.perStudent);
}

export const gbp = (n: number) => `£${n.toLocaleString('en-GB')}`;

/**
 * The penalty inside the email: three links, one per verb form, in this fixed order (left post,
 * centre, right post). Each opens the pitch page with `shot=<form>`, and the page shows the result.
 */
export const EMAIL_SHOT = {
  pronoun: 'tú',
  verb: 'hablar',
  en: 'to speak',
  answer: 'hablas',
  options: ['hablo', 'hablas', 'habla'] as const,
};
