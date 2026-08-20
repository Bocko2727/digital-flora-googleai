// Локален еднократен helper — НЕ съдържа credentials.
// Изисква локално инсталиран firebase-admin (npm i firebase-admin) и
// service-account JSON, чийто път се подава чрез env променлива.
//
// Изпълнение (само локално, никога в CI/CD):
//   FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json \
//     node scripts/admin/set-admin-claim.js <firebase-uid>

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_PATH environment variable.');
  process.exit(1);
}

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/admin/set-admin-claim.js <firebase-uid>');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });

await getAuth().setCustomUserClaims(uid, { admin: true });
console.log(`Admin claim set for UID: ${uid}`);
