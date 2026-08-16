import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadString } from "firebase/storage";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const storage = getStorage(app);

const storageRef = ref(storage, 'test.txt');
uploadString(storageRef, 'hello world').then(() => {
  console.log("Success");
  process.exit(0);
}).catch(err => {
  console.error("Storage error:", err);
  process.exit(1);
});
