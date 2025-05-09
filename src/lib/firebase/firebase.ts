
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Ensure this file is only processed on the client-side where process.env.NEXT_PUBLIC_* variables are available.
// For server-side Firebase (e.g., Admin SDK), a different initialization approach is typically used.

let app: FirebaseApp | null = null; // Initialize with null
let auth: Auth | null = null;       // Initialize with null
let db: Firestore | null = null;    // Initialize with null

const firebaseConfigBase = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

const requiredKeys: (keyof typeof firebaseConfigBase)[] = [
  'apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'
];

function checkConfig(config: typeof firebaseConfigBase, context: string): { valid: boolean, problems: string[] } {
  const problems: string[] = [];
  let valid = true;
  for (const key of requiredKeys) {
    if (!config[key]) { // Checks for undefined, null, empty string
      valid = false;
      problems.push(`${key} (env: NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()})`);
    }
  }
  if (!valid) {
    console.error(
      `Firebase ${context} configuration is INCOMPLETE. The following required NEXT_PUBLIC_FIREBASE_ environment variables are missing or empty: ${problems.join(', ')}. ` +
      `Please ensure all are correctly set in your .env.local file and the Next.js development server has been restarted. ` +
      `Firebase SDK will not be initialized for ${context}.`
    );
  }
  return { valid, problems };
}

if (typeof window !== 'undefined') { // Client-side
  const clientConfigStatus = checkConfig(firebaseConfigBase, 'client');
  if (clientConfigStatus.valid) {
    if (!getApps().length) {
      try {
        app = initializeApp(firebaseConfigBase);
        auth = getAuth(app);
        db = getFirestore(app);
        // console.log(`Firebase SDK (CLIENT) initialized. Project ID: "${firebaseConfigBase.projectId}".`);
      } catch (e) {
        console.error("Firebase client initialization failed:", e);
      }
    } else {
      app = getApp();
      auth = getAuth(app);
      db = getFirestore(app);
    }
  }
} else { // Server-side or build-time context
  const serverConfigStatus = checkConfig(firebaseConfigBase, 'server-stub');
  if (!getApps().length) {
    if (serverConfigStatus.valid) {
      try {
        // Attempt to initialize with full config if all vars are present (e.g., during build if NEXT_PUBLIC vars are exposed)
        app = initializeApp(firebaseConfigBase);
        auth = getAuth(app);
        db = getFirestore(app);
        // console.log(`Firebase SDK (SERVER-STUB) initialized. Project ID: "${firebaseConfigBase.projectId}".`);
      } catch (e) {
        console.error("Firebase server-stub initialization failed:", e);
      }
    } else {
      // console.warn(
      //  `Firebase server-stub initialization SKIPPED due to missing/empty NEXT_PUBLIC_FIREBASE_ env vars in this server/build context. This is often normal if client SDK isn't fully used server-side.`
      // );
    }
  } else { // An app already exists
    app = getApp();
    // It's possible the existing app was initialized by the client part, so re-assign auth/db safely
    if (app) {
        try {
            auth = getAuth(app);
            db = getFirestore(app);
        } catch (e) {
            console.error("Error getting Auth/Firestore from existing server-side app instance:", e);
        }
    }
  }
}

// Export possibly null values, consumers must check.
export { app, auth, db };
