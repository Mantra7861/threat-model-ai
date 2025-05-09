
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

if (!apiKey && typeof window !== 'undefined') { // Check only on client-side to avoid build-time noise if env vars are set differently for client/server
  console.error(
    'Firebase API Key is missing. Please ensure NEXT_PUBLIC_FIREBASE_API_KEY is set in your .env.local file and that the Next.js development server has been restarted after changes to .env files.'
  );
}

const firebaseConfig = {
  apiKey: apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// Ensure Firebase is initialized only on the client side or appropriately for server-side if used there.
// The original logic implies client-side primary usage.
if (typeof window !== 'undefined') {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  // Server-side: If you need Firebase Admin SDK, this setup is different.
  // For client SDK on server (less common for auth/firestore), this might be problematic.
  // This basic init here is a fallback, assuming client SDK might be imported server-side accidentally.
  // Proper server-side Firebase usage typically involves the Admin SDK.
  if (!getApps().length) {
    // Avoid initializing client SDK on server if API key might be missing during build
    if (firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } else {
        // Cannot initialize without API key, stub them to prevent hard crashes if imported server-side without full config.
        // @ts-ignore
        app = null; 
        // @ts-ignore
        auth = null;
        // @ts-ignore
        db = null;
        console.warn("Firebase not initialized on server: API key likely missing or not intended for server-side client SDK usage.");
    }
  } else {
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  }
}

export { app, auth, db };
