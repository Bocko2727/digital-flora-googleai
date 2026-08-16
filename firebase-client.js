import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const firebaseConfig = {
  projectId: "steel-plexus-x1ttq",
  appId: "1:560114298135:web:aaa641d4abb079cfbd5b52",
  apiKey: "AIzaSyBClosp5fjcYIyZ-8fnmLVfy9GhNCVMPgI",
  authDomain: "steel-plexus-x1ttq.firebaseapp.com",
  storageBucket: "steel-plexus-x1ttq.firebasestorage.app",
  messagingSenderId: "560114298135",
  oAuthClientId: "560114298135-mp0bj1b4c3j0a3n7aor11na4b2eqtral.apps.googleusercontent.com"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google Provider with Drive & Picker scopes
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleAuthProvider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');
googleAuthProvider.addScope('https://www.googleapis.com/auth/drive');

// In-memory token management
let cachedAccessToken = null;

export const setCachedAccessToken = (token) => {
  cachedAccessToken = token;
};

export const getCachedAccessToken = () => cachedAccessToken;

export { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged };
