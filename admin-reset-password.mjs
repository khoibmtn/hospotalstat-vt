#!/usr/bin/env node
/**
 * Admin utility: reset user password
 * Usage: node admin-reset-password.mjs <nickname>
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_PASSWORD = '123456';

// Initialize with Application Default Credentials (from gcloud/firebase login)
const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'hospotalstat-vt',
});

const authAdmin = getAuth(app);
const db = getFirestore(app);

const nickname = process.argv[2];

if (!nickname) {
  // If no nickname, list all users and reset all pending
  const snapshot = await db.collection('users').where('passwordResetPending', '==', true).get();
  
  if (snapshot.empty) {
    console.log('Không có user nào cần reset mật khẩu.');
    console.log('\nCách dùng: node admin-reset-password.mjs <nickname>');
    process.exit(0);
  }

  for (const userDoc of snapshot.docs) {
    const data = userDoc.data();
    try {
      await authAdmin.updateUser(userDoc.id, { password: DEFAULT_PASSWORD });
      await db.collection('users').doc(userDoc.id).update({ 
        passwordResetPending: false 
      });
      console.log(`✅ Đã reset mật khẩu cho "${data.nickname}" → ${DEFAULT_PASSWORD}`);
    } catch (err) {
      console.error(`❌ Lỗi reset "${data.nickname}":`, err.message);
    }
  }
} else {
  // Reset specific user by nickname
  const snapshot = await db.collection('users').where('nickname', '==', nickname.toLowerCase()).get();
  
  if (snapshot.empty) {
    console.error(`❌ Không tìm thấy user với nickname "${nickname}"`);
    process.exit(1);
  }

  const userDoc = snapshot.docs[0];
  try {
    await authAdmin.updateUser(userDoc.id, { password: DEFAULT_PASSWORD });
    await db.collection('users').doc(userDoc.id).update({ 
      passwordResetPending: false 
    });
    console.log(`✅ Đã reset mật khẩu cho "${nickname}" → ${DEFAULT_PASSWORD}`);
  } catch (err) {
    console.error(`❌ Lỗi:`, err.message);
  }
}

process.exit(0);
