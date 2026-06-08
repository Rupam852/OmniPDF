import admin from 'firebase-admin';

// Load Firebase Admin credentials from environment variables.
// In production, configure FIREBASE_SERVICE_ACCOUNT_JSON as a stringified JSON key file.
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (serviceAccountJson) {
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON environment variable:', error);
    process.exit(1);
  }
} else {
  // Fallback to default application credentials (e.g. local environment or server roles)
  // or print a warning in development mode.
  if (process.env.NODE_ENV === 'production') {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is required in production.');
    process.exit(1);
  } else {
    console.warn(
      'WARNING: Firebase Admin SDK initialized with empty credential stub. Auth validation will fail. Provide FIREBASE_SERVICE_ACCOUNT_JSON to enable full functionality.'
    );
    // Initialize dummy/mock config for testing if no service account is set
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
}

export const firebaseAdmin = admin;
