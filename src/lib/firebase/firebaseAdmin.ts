
import admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';

let adminDb: Firestore;

if (!admin.apps.length) {
  try {
    const serviceAccountKeyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON;
    if (!serviceAccountKeyJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY_JSON environment variable is not set.');
    }
    const serviceAccount = JSON.parse(serviceAccountKeyJson);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // projectId: serviceAccount.project_id, // Optional: Or read from service account
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error) {
    console.error("Firebase Admin SDK initialization error:", error);
    // Depending on your error handling strategy, you might throw the error,
    // or set adminDb to a state that indicates failure.
    // For now, we'll let it crash if initialization fails, as it's critical.
    throw error;
  }
}

adminDb = admin.firestore();

export { adminDb };
