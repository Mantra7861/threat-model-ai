
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// --- Configuration ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

const requiredKeys: (keyof typeof firebaseConfig)[] = [
  'apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'
];

function isConfigValid(config: typeof firebaseConfig): { valid: boolean; missingKeys: string[] } {
  const missingKeys: string[] = [];
  for (const key of requiredKeys) {
    if (!config[key]) {
      missingKeys.push(`NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
    }
  }
  return { valid: missingKeys.length === 0, missingKeys };
}

// --- Initialization ---
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let initializationError: string | null = null;

// Perform initialization only on the client-side
if (typeof window !== 'undefined') {
  const { valid, missingKeys } = isConfigValid(firebaseConfig);

  if (!valid) {
    initializationError = `Firebase client configuration is incomplete. Missing environment variables: ${missingKeys.join(', ')}. Check your .env.local file.`;
    console.error(initializationError);
  } else {
    if (!getApps().length) {
      try {
        console.log("Initializing Firebase Client SDK...");
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log(`Firebase Client SDK Initialized. Project ID: "${firebaseConfig.projectId}".`);
      } catch (e) {
        initializationError = `Firebase client initialization failed: ${e instanceof Error ? e.message : String(e)}`;
        console.error(initializationError);
        app = null; // Ensure app is null if init fails
        auth = null;
        db = null;
      }
    } else {
      // App already initialized (e.g., due to HMR)
      app = getApp();
      try {
        auth = getAuth(app);
        db = getFirestore(app);
        // console.log("Firebase Client SDK re-used existing app instance.");
      } catch(e) {
         initializationError = `Error getting Auth/Firestore from existing app: ${e instanceof Error ? e.message : String(e)}`;
         console.error(initializationError);
         auth = null;
         db = null;
      }
    }
  }
} else {
  // console.log("Firebase Client SDK initialization skipped (server-side or build time).");
  // Server-side Firebase (Admin SDK) should be handled separately if needed.
}

// --- Exports ---
// Export potentially null values. Consumers must check for null/error.
export { app, auth, db, initializationError };

// Helper function for components/services to check initialization status
export function ensureFirebaseInitialized(): { initialized: boolean; error: string | null } {
  if (initializationError) {
    return { initialized: false, error: initializationError };
  }
  if (!app || !auth || !db) {
     // This might happen if called server-side where client SDK isn't initialized
     const serverSideError = "Firebase client SDK not initialized. This might occur during server-side rendering or build if client-only code is accessed.";
     // Avoid setting the global initializationError here as it might be a valid server-side scenario
     // console.warn(serverSideError);
     return { initialized: false, error: serverSideError };
  }
  return { initialized: true, error: null };
}
