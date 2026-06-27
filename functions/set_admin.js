/**
 * AgriPoulet Pro - Set admin role for a user
 * Usage: node functions/set_admin.js <email> <role>
 * Requires: firebase login (already authenticated via CLI)
 */
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'agripoulet-pro',
});

const db = admin.firestore();

async function setRoleByEmail(targetEmail, role) {
  console.log(`🔍 Searching for ${targetEmail}...`);
  const snap = await db.collection('users').get();
  let found = false;

  snap.forEach((doc) => {
    const data = doc.data();
    if (data.email && data.email.toLowerCase() === targetEmail.toLowerCase()) {
      console.log(`✅ Found: ${data.email} (UID: ${doc.id})`);
      found = true;
    }
  });

  if (found) {
    // Second pass to set role
    snap.forEach(async (doc) => {
      const data = doc.data();
      if (data.email && data.email.toLowerCase() === targetEmail.toLowerCase()) {
        await doc.ref.update({ role, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        console.log(`✅ Role "${role}" set for ${targetEmail} (UID: ${doc.id})`);
      }
    });
  } else {
    console.log(`⚠️ No document found for ${targetEmail}`);
    console.log('💡 User needs to login first to create their profile.');
  }
}

const targetEmail = process.argv[2] || 'loowecee6@gmail.com';
const role = process.argv[3] || 'admin';
setRoleByEmail(targetEmail, role).then(() => {
  console.log('Done.');
  process.exit(0);
}).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
