
"use client";

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseUser, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, initializationError, ensureFirebaseInitialized } from '@/lib/firebase/firebase'; // Import auth and initialization status
import { getUserProfile, createUserProfile } from '@/services/userService';
import type { UserProfile } from '@/types/user';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast'; // Import useToast

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  firebaseReady: boolean; // New state to indicate if Firebase is ready
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
  const [firebaseReady, setFirebaseReady] = useState(false); // Track Firebase readiness
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast(); // Get toast function

  useEffect(() => {
    const { initialized, error } = ensureFirebaseInitialized();
    setFirebaseReady(initialized);

    if (!initialized && error) {
      console.error("Auth Provider Error:", error);
      toast({
          title: "Configuration Error",
          description: "Firebase is not configured correctly. Please check environment variables. Some features may be unavailable.",
          variant: "destructive",
          duration: Infinity, // Keep message shown
      });
      setLoading(false); // Stop loading as Firebase won't initialize
      // Optionally redirect to an error page or show a persistent banner
      // For now, we just show a toast and set loading to false.
      return; // Stop further auth checks if Firebase isn't ready
    }

    if (!auth) {
        // This case should theoretically be covered by ensureFirebaseInitialized, but as a safeguard:
        console.error("Auth Provider Error: Firebase Auth instance is null.");
        toast({ title: "Initialization Error", description: "Could not initialize Firebase Authentication.", variant: "destructive" });
        setLoading(false);
        return;
    }


    // Only proceed with onAuthStateChanged if Firebase is initialized
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setCurrentUser(user);
        try {
            let profile = await getUserProfile(user.uid);
            if (!profile) {
              console.log(`No profile found for ${user.uid}, attempting to create one...`);
              // Attempt to create profile
              profile = await createUserProfile(user.uid, user.email, user.displayName, user.photoURL);
               toast({ title: "Profile Created", description: "Your user profile has been set up." });
               console.log(`Profile created for ${user.uid}.`);
            } else {
                 // console.log(`Profile found for ${user.uid}:`, profile);
            }
            setUserProfile(profile);

             // Admin area access check (should only happen *after* profile is confirmed)
             if (pathname.startsWith('/admin') && profile?.role !== 'admin') {
               console.log(`User ${user.uid} (${profile?.role}) attempting to access admin area. Redirecting.`);
               toast({ title: "Access Denied", description: "Admin area requires administrator privileges.", variant: "destructive" });
               router.replace('/');
             }
        } catch (error) {
             // Log the specific error for better debugging
             console.error(`Error fetching or creating user profile for ${user.uid}:`, error);
             // Provide a generic message to the user
             toast({ title: "Profile Error", description: "Could not load or create your user profile. Check console for details.", variant: "destructive" });
             // Decide how to handle this - maybe sign out?
             // For now, set profile to null, preventing potential incorrect role access
             setUserProfile(null);
        }

      } else {
        setCurrentUser(null);
        setUserProfile(null);
        // Logic for redirecting non-authenticated users
        const publicPaths = ['/auth/login', '/auth/signup'];
        const requiresAuth = !publicPaths.includes(pathname) && !pathname.startsWith('/auth');

        // Redirect to login if trying to access a protected route without being logged in
        // Avoid redirecting if already on login/signup or if auth is still loading/initializing
        if (requiresAuth && firebaseReady && !loading) {
            console.log("User not authenticated, redirecting to login from:", pathname);
            router.replace('/auth/login');
        }
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router, pathname, toast, loading, firebaseReady]); // Add loading and firebaseReady to dependencies

  const isAdmin = userProfile?.role === 'admin';
  const isEditor = userProfile?.role === 'editor' || userProfile?.role === 'admin';
  const isViewer = userProfile?.role === 'viewer' || userProfile?.role === 'editor' || userProfile?.role === 'admin';

  const signOut = useCallback(async () => {
    if (!auth) {
        toast({ title: "Sign Out Error", description: "Firebase Auth not available.", variant: "destructive" });
        return;
    }
    try {
      await firebaseSignOut(auth);
      // Clear local state immediately
      setCurrentUser(null);
      setUserProfile(null);
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
      router.push('/auth/login'); // Redirect to login after sign out
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ title: "Sign Out Error", description: `Failed to sign out: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
    }
  }, [router, toast]); // Added toast dependency

  return (
    <AuthContext.Provider value={{
        currentUser,
        userProfile,
        loading,
        firebaseReady, // Expose readiness state
        isAdmin,
        isEditor,
        isViewer,
        setCurrentUser,
        setUserProfile,
        signOut
     }}>
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
