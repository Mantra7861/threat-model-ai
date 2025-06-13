
import admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';

let adminDb: Firestore;

if (!admin.apps.length) {
  try {
    const serviceAccountKeyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON;
    if (!serviceAccountKeyJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY_JSON environment variable is not set or is empty.');
    }
    
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountKeyJson);
    } catch (parseError) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY_JSON. Ensure it's a valid JSON string. Raw content (first 100 chars):", serviceAccountKeyJson.substring(0, 100));
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY_JSON is not valid JSON. Parsing error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

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
