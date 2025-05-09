

// Removed Firebase Timestamp import as conversion happens in service layer
// import type { Timestamp } from 'firebase/firestore'; 

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  role: UserRole;
  registrationDate?: Date; // Will be a Date object in the application, converted from Firestore Timestamp
}
