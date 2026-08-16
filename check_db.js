import { db } from './firebase-client.js';
import { collection, getDocs } from "firebase/firestore";

async function check() {
  const q = collection(db, "plants");
  const querySnapshot = await getDocs(q);
  console.log("Count in DB:", querySnapshot.size);
  process.exit(0);
}
check();
