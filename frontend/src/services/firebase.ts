import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider 
} from 'firebase/auth';

// Firebase Project Web Configuration credentials.
// Configure these variables in your Vercel frontend environment settings.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth Export
export const auth = getAuth(app);

// Authentication Provider Instances
export const googleProvider = new GoogleAuthProvider();

/**
 * Helper to fetch the current user's Firebase ID Token.
 * This token must be attached as a Bearer token in the 'Authorization' header
 * for all secure backend API calls.
 */
export async function getFirebaseAuthToken(): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  return await currentUser.getIdToken();
}
