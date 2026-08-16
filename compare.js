import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = {
  projectId: 'steel-plexus-x1ttq',
  appId: '1:560114298135:web:aaa641d4abb079cfbd5b52',
  apiKey: 'AIzaSyBClosp5fjcYIyZ-8fnmLVfy9GhNCVMPgI',
  authDomain: 'steel-plexus-x1ttq.firebaseapp.com',
  storageBucket: 'steel-plexus-x1ttq.firebasestorage.app',
  messagingSenderId: '560114298135'
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'ai-studio-digitalflora-0865cedb-0aea-47b2-a20b-507bb3df9fcc');

async function run() {
  const snap = await getDocs(collection(db, 'plants'));
  const dbPhotos = new Set();
  snap.forEach(doc => {
     (doc.data().photos || []).forEach(p => dbPhotos.add(p));
  });

  const ghPhotosRaw = fs.readFileSync('github_images.txt', 'utf8').split('\n').filter(Boolean);
  const ghPhotos = new Set(ghPhotosRaw);
  
  const missingInDB = [...ghPhotos].filter(p => !dbPhotos.has(p));
  console.log("Missing in DB:", missingInDB);

  let added = 0;
  for (const fname of missingInDB) {
      if (!fname) continue;
      const pData = {
          commonName: 'Снимка ' + fname,
          latinName: 'Неопределен таксон (Липсва в записите)',
          family: 'Неизвестно',
          photos: [fname],
          confidence: 'Неопределимо (Чака анализ)',
          recognition: 'Възстановена снимка от архива',
          habitat: '-', lookalikes: '-', benefits: '-', risks: '-', uses: '-', funFact: '-',
          createdAt: serverTimestamp()
      };
      await addDoc(collection(db, "plants"), pData);
      added++;
  }
  console.log("Added missing records:", added);
  process.exit(0);
}
run();
