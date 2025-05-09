
"use client";

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseUser, signOut as firebaseSignOut } from 'firebase/auth';
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
  signOut: () => Promise<void>;
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
          profile = await createUserProfile(user.uid, user.email, user.displayName, user.photoURL);
        }
        setUserProfile(profile);

        if (pathname.startsWith('/admin') && profile?.role !== 'admin') {
          router.replace('/'); 
        }

      } else {
        setCurrentUser(null);
        setUserProfile(null);
        // Only redirect if not on an auth page or public landing page
        const publicPaths = ['/auth/login', '/auth/signup', '/']; // Add any other public paths
        if (!publicPaths.includes(pathname) && !pathname.startsWith('/auth')) {
            // No automatic redirect to login here, pages should handle their own auth checks for non-admin content
            // if a page requires auth, it should use useAuth and redirect if !currentUser and !loading
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]);

  const isAdmin = userProfile?.role === 'admin';
  const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin'; // Admins are also editors
  const isViewer = userProfile?.role === 'viewer' || userProfile?.role === 'editor' || userProfile?.role === 'admin'; // Editors/Admins are also viewers

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      // setUserProfile(null) and setCurrentUser(null) will be handled by onAuthStateChanged
      router.push('/auth/login'); // Redirect to login after sign out
    } catch (error) {
      console.error("Error signing out: ", error);
      // Handle sign out error (e.g., display a toast)
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, isAdmin, isEditor, isViewer, setCurrentUser, setUserProfile, signOut }}>
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

