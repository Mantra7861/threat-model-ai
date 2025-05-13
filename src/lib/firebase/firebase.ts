
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
// Modify Firestore imports to include initializeFirestore and memoryLocalCache
import { getFirestore, initializeFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore';

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

const { valid, missingKeys } = isConfigValid(firebaseConfig);

if (!valid) {
  initializationError = `Firebase client configuration is incomplete. Missing environment variables: ${missingKeys.join(', ')}. Check your .env.local file.`;
  console.error(initializationError);
} else {
  if (!getApps().length) {
    try {
      console.log("Initializing Firebase App SDK...");
      app = initializeApp(firebaseConfig);
      console.log(`Firebase App SDK Initialized. Project ID: "${firebaseConfig.projectId}".`);
    } catch (e) {
      initializationError = `Firebase app initialization failed: ${e instanceof Error ? e.message : String(e)}`;
      console.error(initializationError);
      // app remains null
    }
  } else {
    app = getApp();
    // console.log("Firebase App SDK re-used existing app instance.");
  }

  if (app) {
    try {
      auth = getAuth(app);
      if (typeof window === 'undefined') {
        // Server environment (e.g., Server Action, RSC rendering)
        // Use Firestore with memory cache to avoid IndexedDB issues on server
        console.log("Initializing Firestore with memory cache for server environment.");
        db = initializeFirestore(app, { localCache: memoryLocalCache() });
      } else {
        // Client environment
        console.log("Initializing Firestore for client environment.");
        db = getFirestore(app);
      }
      console.log("Firebase Auth and Firestore services initialized.");
    } catch (e) {
      const serviceInitError = `Error initializing Firebase services (Auth/Firestore): ${e instanceof Error ? e.message : String(e)}`;
      console.error(serviceInitError);
      // If app initialized but services failed, this is a partial failure.
      // initializationError might already be set if app init failed.
      if (!initializationError) initializationError = serviceInitError;
      auth = null;
      db = null;
    }
  } else if (!initializationError) {
    // If app is null (meaning init failed above) and no specific error was set for app init,
    // set a generic one. This case should ideally be covered by the app init catch block.
    initializationError = "Firebase app could not be initialized, and no specific error was caught during app initialization.";
    console.error(initializationError);
  }
}


// --- Exports ---
// Export potentially null values. Consumers must check for null/error.
export { app, auth, db, initializationError };

// Helper function for components/services to check initialization status
export function ensureFirebaseInitialized(): { initialized: boolean; error: string | null } {
  if (initializationError) {
    return { initialized: false, error: initializationError };
  }
  // Check if app, auth, and db are all successfully initialized
  if (!app || !auth || !db) {
     // This state means either the initial validation failed, app init failed, or service init (auth/db) failed.
     // The `initializationError` should ideally capture the root cause.
     // If `initializationError` is somehow still null here, it means an unexpected state.
     const currentError = initializationError || "Firebase components (app, auth, or db) are not available. Initialization may have failed silently or incompletely.";
     // console.warn("ensureFirebaseInitialized: Firebase not fully initialized.", currentError); // More context for debugging
     return { initialized: false, error: currentError };
  }
  return { initialized: true, error: null };
}
