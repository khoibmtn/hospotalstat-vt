import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

const DEFAULT_PASSWORD = '123456';

export const resetPassword = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    // Verify caller is authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Bạn cần đăng nhập.');
    }

    const callerUid = request.auth.uid;
    const targetUid = request.data.uid;

    if (!targetUid) {
      throw new HttpsError('invalid-argument', 'Thiếu UID người dùng.');
    }

    // Verify caller is admin
    const db = getFirestore();
    const callerDoc = await db.collection('users').doc(callerUid).get();

    if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
      throw new HttpsError('permission-denied', 'Chỉ admin mới có quyền reset mật khẩu.');
    }

    // Reset password
    const authAdmin = getAuth();
    await authAdmin.updateUser(targetUid, { password: DEFAULT_PASSWORD });

    return { success: true, message: `Đã reset mật khẩu về ${DEFAULT_PASSWORD}` };
  }
);
