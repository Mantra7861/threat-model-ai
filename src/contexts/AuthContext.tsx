
"use client";

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useEffect, useState} from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase';
import { getUserProfile, createUserProfile } from '@/services/userService';
import type { UserProfile } from '@/types/user';
import { usePathname, useRouter } from 'next/navigation';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
  setCurrentUser: Dispatch<SetStateAction<FirebaseUser | null>>;
  setUserProfile: Dispatch<SetStateAction<UserProfile | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setCurrentUser(user);
        let profile = await getUserProfile(user.uid);
        if (!profile) {
          // If profile doesn't exist, create it with default 'editor' role
          profile = await createUserProfile(user.uid, user.email, user.displayName, user.photoURL);
        }
        setUserProfile(profile);

        // Redirect if trying to access admin routes without admin role
        if (pathname.startsWith('/admin') && profile?.role !== 'admin') {
          router.replace('/'); // Or a specific access-denied page
        }

      } else {
        setCurrentUser(null);
        setUserProfile(null);
        // If trying to access protected routes while not logged in (except auth pages)
        if (!pathname.startsWith('/auth') && pathname !== '/') { // Adjust if you have public pages other than '/'
          // For now, let pages handle their own auth checks if they are not admin
          // router.replace('/auth/login'); // Or your login page
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]);

  const isAdmin = userProfile?.role === 'admin';
  const isEditor = userProfile?.role === 'editor';
  const isViewer = userProfile?.role === 'viewer';

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, isAdmin, isEditor, isViewer, setCurrentUser, setUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
