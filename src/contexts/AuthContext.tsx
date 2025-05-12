
"use client";

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseUser, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, initializationError, ensureFirebaseInitialized, db } from '@/lib/firebase/firebase'; // Import db
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

  // Effect to check Firebase initialization status
  useEffect(() => {
    const { initialized, error } = ensureFirebaseInitialized();
    setFirebaseReady(initialized);

    if (!initialized && error) {
      console.error("Auth Provider Initialization Error:", error);
      toast({
          title: "Configuration Error",
          description: "Firebase is not configured correctly. Backend features may be unavailable.",
          variant: "destructive",
          duration: 9000, // Show for 9 seconds
      });
      setLoading(false); // Stop loading
    }
     // Ensure auth and db are available after initialization check
    if (initialized && (!auth || !db)) {
         console.error("Auth Provider Error: Firebase Auth or Firestore instance is null after successful initialization check.");
         toast({ title: "Initialization Error", description: "Could not obtain Firebase Auth/DB instance.", variant: "destructive" });
         setLoading(false);
         setFirebaseReady(false); // Mark as not ready if instances are null
    }
  }, [toast]); // Only depends on toast for showing errors

  // Effect to handle authentication state changes and profile fetching
  useEffect(() => {
    if (!firebaseReady || !auth || !db) {
       setLoading(false); // Ensure loading stops if firebase isn't ready
       return; // Don't run auth listener if Firebase isn't ready
    }

    setLoading(true); // Start loading when listener might attach or re-run due to deps

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // It's crucial to manage loading state carefully within the async callback
      setLoading(true); // Set loading true when auth state changes

      if (user) {
        setCurrentUser(user);
        try {
            let profile = await getUserProfile(user.uid);
            if (!profile) {
              console.log(`No profile found for ${user.uid}, attempting to create one...`);
              profile = await createUserProfile(user.uid, user.email, user.displayName, user.photoURL);
              toast({ title: "Profile Created", description: "Your user profile has been set up." });
              console.log(`Profile created for ${user.uid}.`);
            }
            setUserProfile(profile); // Set profile regardless of whether it was fetched or created

             // Admin area access check
             const isAdminUser = profile?.role === 'admin';
             if (pathname.startsWith('/admin') && !isAdminUser) {
               console.log(`User ${user.uid} (${profile?.role}) attempting to access admin area. Redirecting.`);
               toast({ title: "Access Denied", description: "Admin area requires administrator privileges.", variant: "destructive" });
               router.replace('/');
             }
        } catch (error) {
             console.error(`Error fetching or creating user profile for ${user.uid}:`, error);
             toast({ title: "Profile Error", description: "Could not load or create your user profile. Please try refreshing. Check console for details.", variant: "destructive" });
             setUserProfile(null); // Ensure profile is null on error
        } finally {
            setLoading(false); // Stop loading after profile fetch/create attempt
        }
      } else {
        // User is signed out
        setCurrentUser(null);
        setUserProfile(null);

        // Redirect non-authenticated users from protected routes
        const publicPaths = ['/auth/login', '/auth/signup'];
        const isPublicPath = publicPaths.includes(pathname) || pathname.startsWith('/auth');

        if (!isPublicPath && firebaseReady) { // Check firebaseReady here too
            console.log("User not authenticated, redirecting to login from:", pathname);
            router.replace('/auth/login');
        }
        setLoading(false); // Stop loading after handling sign-out
      }
    });

    // Cleanup subscription on unmount
    return () => {
        unsubscribe();
        setLoading(false); // Ensure loading is false on cleanup
    };
  // Rerun this effect if firebase readiness changes, or route changes (for redirection logic)
  // DO NOT include `loading` here to prevent loops.
  }, [firebaseReady, router, pathname, toast]);

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
      // No need to clear local state here, onAuthStateChanged will handle it
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
      router.push('/auth/login'); // Redirect handled by onAuthStateChanged generally, but can force here too
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
        setCurrentUser, // Keep these setters if direct manipulation is needed elsewhere, though unlikely
        setUserProfile, // Keep these setters if direct manipulation is needed elsewhere, though unlikely
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
