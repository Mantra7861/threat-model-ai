
import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  role: UserRole;
  registrationDate?: Timestamp | Date; // Store as Firestore Timestamp, convert to Date object in app
}
