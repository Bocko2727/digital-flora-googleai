import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  projectId: "steel-plexus-x1ttq",
  appId: "1:560114298135:web:aaa641d4abb079cfbd5b52",
  apiKey: "AIzaSyBClosp5fjcYIyZ-8fnmLVfy9GhNCVMPgI",
  authDomain: "steel-plexus-x1ttq.firebaseapp.com",
  storageBucket: "steel-plexus-x1ttq.firebasestorage.app",
  messagingSenderId: "560114298135"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
}, "ai-studio-digitalflora-0865cedb-0aea-47b2-a20b-507bb3df9fcc");
export const auth = getAuth(app);
export { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged };
