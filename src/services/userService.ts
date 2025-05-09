
import { db } from '@/lib/firebase/firebase';
import type { UserProfile, UserRole } from '@/types/user';
import { collection, doc, getDoc, setDoc, updateDoc, getDocs, serverTimestamp, query, Timestamp } from 'firebase/firestore';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userDocRef = doc(db, 'users', uid);
  const userDocSnap = await getDoc(userDocRef);
  if (userDocSnap.exists()) {
    const data = userDocSnap.data();
    let registrationDate: Date | undefined = undefined;
    if (data.registrationDate) {
      if (data.registrationDate instanceof Timestamp) {
        registrationDate = data.registrationDate.toDate();
      } else if (data.registrationDate instanceof Date) {
        registrationDate = data.registrationDate;
      } else if (typeof data.registrationDate === 'string' || typeof data.registrationDate === 'number') {
        registrationDate = new Date(data.registrationDate);
      }
    }

    return {
        uid: userDocSnap.id,
        email: data.email,
        role: data.role || 'editor', // Default to editor if role somehow missing
        displayName: data.displayName,
        photoURL: data.photoURL,
        registrationDate: registrationDate
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
  // Firestore data structure for new user
  const newUserFirestoreData = {
    email,
    displayName: displayName || email?.split('@')[0] || 'User',
    photoURL: photoURL || `https://picsum.photos/seed/${uid}/40/40`, // data-ai-hint user avatar
    role: 'editor' as UserRole, // Default role for new users
    registrationDate: serverTimestamp(), // Use Firestore server timestamp
  };
  await setDoc(userDocRef, newUserFirestoreData);
  
  // Return UserProfile structure, approximating registrationDate until Firestore write completes
  return { 
    uid, 
    email: newUserFirestoreData.email,
    displayName: newUserFirestoreData.displayName,
    photoURL: newUserFirestoreData.photoURL,
    role: newUserFirestoreData.role,
    registrationDate: new Date() // Client-side approximation
  };
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const usersCollectionRef = collection(db, 'users');
  const q = query(usersCollectionRef); 
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    let registrationDate: Date | undefined = undefined;
    if (data.registrationDate) {
      if (data.registrationDate instanceof Timestamp) {
        registrationDate = data.registrationDate.toDate();
      } else if (data.registrationDate instanceof Date) {
        registrationDate = data.registrationDate;
      } else if (typeof data.registrationDate === 'string' || typeof data.registrationDate === 'number') {
        registrationDate = new Date(data.registrationDate);
      }
    }
    return {
      uid: docSnap.id,
      email: data.email,
      role: data.role,
      displayName: data.displayName,
      photoURL: data.photoURL,
      registrationDate: registrationDate
    } as UserProfile;
  });
}

export async function updateUserRole(uid: string, newRole: UserRole): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, { role: newRole });
}

