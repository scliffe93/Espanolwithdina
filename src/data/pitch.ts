// ───────────────────────────────────────────────────────────────
// The sales side: the personalised pitch page (#/pitch?to=Laura&school=Academia%20Sol&city=valencia)
// that the outreach email links to, and the one penalty the email itself asks the reader to take.
// Fill in the sender details once; the page reads them at build time.
// ───────────────────────────────────────────────────────────────

export const PITCH = {
  /** Who signs the email and the page. */
  senderName: '[Your name]',
  /** Where “Book a walkthrough” goes. A booking link (Calendly, a Google Calendar appointment page…) wins over the email. */
  bookingUrl: '',
  /** Used for the mailto link when there is no booking link. Leave empty to ask the reader to reply to the email instead. */
  senderEmail: '',
  /** How long a new client’s copy takes to go live, as a phrase. */
  setupTime: 'about two weeks',
  /** Recommended prices; change them here and the page follows. */
  setupFee: '£950',
  tiers: [
    { name: 'Starter', price: '£49', per: 'per month', lines: ['Up to 10 students', 'Debriefs and the adaptive week', 'Analytics, reports, invoices, packages'], popular: false },
    { name: 'Studio', price: '£99', per: 'per month', lines: ['Up to 30 students', 'Your own web address', 'Priority support'], popular: true },
    { name: 'Academy', price: '£199', per: 'per month', lines: ['Unlimited students', 'Several tutors under one admin', 'No platform branding'], popular: false },
  ],
};

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
