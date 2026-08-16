import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  projectId: "steel-plexus-x1ttq",
  appId: "1:560114298135:web:aaa641d4abb079cfbd5b52",
  apiKey: "AIzaSyBClosp5fjcYIyZ-8fnmLVfy9GhNCVMPgI",
  authDomain: "steel-plexus-x1ttq.firebaseapp.com",
  storageBucket: "steel-plexus-x1ttq.firebasestorage.app",
  messagingSenderId: "560114298135"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-digitalflora-0865cedb-0aea-47b2-a20b-507bb3df9fcc");

async function check() {
  const q = collection(db, "plants");
  const querySnapshot = await getDocs(q);
  console.log("Count in DB:", querySnapshot.size);
  let totalPhotos = 0;
  querySnapshot.forEach(doc => {
     totalPhotos += doc.data().photos?.length || 0;
  });
  console.log("Total photos mapped:", totalPhotos);
  process.exit(0);
}
check();
