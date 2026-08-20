import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const uid = process.argv[2];

if (!uid) {
  console.error('Usage: node scripts/admin/set-admin-claim.js <firebase-uid>');
  process.exit(1);
}

initializeApp({
  credential: applicationDefault(),
  projectId: 'steel-plexus-x1ttq'
});

await getAuth().setCustomUserClaims(uid, { admin: true });
console.log(`Admin claim set for UID: ${uid}`);
