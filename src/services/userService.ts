
import { db } from '@/lib/firebase/firebase';
import type { UserProfile, UserRole } from '@/types/user';
import { collection, doc, getDoc, setDoc, updateDoc, getDocs, serverTimestamp, query } from 'firebase/firestore';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userDocRef = doc(db, 'users', uid);
  const userDocSnap = await getDoc(userDocRef);
  if (userDocSnap.exists()) {
    const data = userDocSnap.data();
    return {
        uid: userDocSnap.id,
        email: data.email,
        role: data.role || 'viewer', // Default to viewer if role somehow missing
        displayName: data.displayName,
        photoURL: data.photoURL,
        // Firestore Timestamps need to be converted to Date objects if used directly
        registrationDate: data.registrationDate?.toDate ? data.registrationDate.toDate() : new Date(data.registrationDate || Date.now())
    } as UserProfile;
  }
  return null;
}

export async function createUserProfile(
  uid: string,
  email: string | null,
  displayName?: string | null,
  photoURL?: string | null
): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', uid);
  const newUserProfile: Omit<UserProfile, 'uid' | 'registrationDate'> & { registrationDate: any } = {
    email,
    displayName: displayName || email?.split('@')[0] || 'User',
    photoURL: photoURL || `https://picsum.photos/seed/${uid}/40/40`,
    role: 'editor', // Default role for new users
    registrationDate: serverTimestamp(),
  };
  await setDoc(userDocRef, newUserProfile);
  return { 
    uid, 
    ...newUserProfile,
    registrationDate: new Date() // Approximate, serverTimestamp will be accurate in DB
  } as UserProfile;
}

export async function getAllUsers(): Promise<UserProfile[]> {
  // This function should only be callable by an admin, enforced by Firestore rules and/or server-side checks.
  const usersCollectionRef = collection(db, 'users');
  const q = query(usersCollectionRef); // Add ordering if desired, e.g., orderBy('registrationDate')
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      uid: docSnap.id,
      email: data.email,
      role: data.role,
      displayName: data.displayName,
      photoURL: data.photoURL,
      registrationDate: data.registrationDate?.toDate ? data.registrationDate.toDate() : new Date(data.registrationDate || Date.now())
    } as UserProfile;
  });
}

export async function updateUserRole(uid: string, newRole: UserRole): Promise<void> {
  // This function should only be callable by an admin.
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, { role: newRole });
}
