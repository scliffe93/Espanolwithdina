import type { Session } from '../cloud';
import type { PlatformBackend } from './backend';
import { PlatformError } from './backend';
import type { Person } from './types';

// Placeholder: replaced by the real cloud implementation (teacher/student
// endpoints on the account Edge Function). Until then, platform features
// are only available in the local demo.
export function createCloudBackend(_session: Session, me: Person): PlatformBackend {
  const nope = async (): Promise<never> => { throw new PlatformError('offline', 'The online teaching platform isn’t configured for this copy of the app yet.'); };
  return {
    kind: 'cloud', actor: me,
    people: nope, studentProgress: nope, bookings: nope, createBooking: nope, updateBooking: nope, cancelBooking: nope,
    homework: nope, assignHomework: nope, updateHomework: nope, deleteHomework: nope, submitHomework: nope, reviewHomework: nope,
    feedback: nope, addFeedback: nope, deleteFeedback: nope, activity: nope, logActivity: async () => undefined,
  };
}
