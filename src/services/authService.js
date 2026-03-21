import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { EMAIL_DOMAIN, ROLES } from '../utils/constants';

/**
 * Sanitize nickname: lowercase, keep only a-z, 0-9, dots
 */
export function sanitizeNickname(raw) {
  // First, normalize and remove Vietnamese accents
  const noAccents = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
    
  return noAccents.toLowerCase().replace(/[^a-z0-9.]/g, '').replace(/^\.+|\.+$/g, '');
}

function generateEmail(nickname) {
  const sanitized = nickname.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${sanitized}@${EMAIL_DOMAIN}`;
}

export async function registerUser(nickname, password, { role, departmentId, fullName, position, title }) {
  const cleanNick = nickname.trim();
  if (!cleanNick || cleanNick.length < 3 || !/^[a-z0-9.]+$/.test(cleanNick)) {
    throw new Error('Nickname phải có ít nhất 3 ký tự (chỉ gồm chữ cái thường không dấu, số và dấu chấm, không khoảng trắng).');
  }
  const email = generateEmail(cleanNick);

  // Check if nickname already exists
  const existingQuery = query(
    collection(db, 'users'),
    where('nickname', '==', cleanNick)
  );
  const existing = await getDocs(existingQuery);
  if (!existing.empty) {
    throw new Error('Nickname đã tồn tại. Vui lòng chọn nickname khác.');
  }

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  // Get settings to check if approval is required
  const settingsDoc = await getDoc(doc(db, 'settings', 'config'));
  const requireApproval = settingsDoc.exists()
    ? settingsDoc.data().requireApproval
    : false;

  const userData = {
    nickname: cleanNick,
    displayName: fullName || cleanNick,
    fullName: fullName || '',
    email,
    role,
    position: position || '',
    title: title || '',
    primaryDepartmentId: departmentId,
    additionalDepartments: [],
    approved: role === ROLES.ADMIN ? true : !requireApproval,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'users', uid), userData);
  return { uid, ...userData };
}

export async function loginUser(nickname, password) {
  const cleanNick = nickname.trim();
  const email = generateEmail(cleanNick);

  try {
    // 1. Authenticate first
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    // 2. Fetch user data AFTER successful authentication
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // In case user exists in Auth but not Firestore
      await signOut(auth);
      throw new Error('Dữ liệu tài khoản không tồn tại.');
    }

    const userData = userDoc.data();

    // 3. Verify nickname closely matches (case-insensitive) just to be safe
    if (userData.nickname.toLowerCase() !== cleanNick.toLowerCase()) {
      await signOut(auth);
      throw new Error('Nickname không tồn tại hoặc không chính xác.');
    }

    // 4. Check approval status
    if (!userData.approved) {
      await signOut(auth);
      throw new Error('Tài khoản chưa được phê duyệt. Vui lòng liên hệ quản trị viên.');
    }

    return { uid: userDoc.id, ...userData };
  } catch (error) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
      throw new Error('Tài khoản hoặc mật khẩu không đúng.');
    }
    throw error;
  }
}

export async function logoutUser() {
  await signOut(auth);
}

export async function getUserData(uid) {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) return null;
  return { uid, ...userDoc.data() };
}

export async function getAllUsers() {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function updateUser(uid, updates) {
  await updateDoc(doc(db, 'users', uid), updates);
}

export async function deleteUser(uid) {
  await deleteDoc(doc(db, 'users', uid));
}

export async function resetUserPassword(uid) {
  const targetDoc = await getDoc(doc(db, 'users', uid));
  if (!targetDoc.exists()) throw new Error('User không tồn tại.');

  await updateDoc(doc(db, 'users', uid), { 
    passwordResetPending: true,
    passwordResetAt: serverTimestamp()
  });
  
  return { success: true };
}

/**
 * Check if user can access a given department
 */
export function canAccessDepartment(user, departmentId) {
  if (!user) return false;
  if (user.role === ROLES.ADMIN || user.role === ROLES.KEHOACH) return true;
  if (user.primaryDepartmentId === departmentId) return true;
  if (user.additionalDepartments?.includes(departmentId)) return true;
  return false;
}

/**
 * Get all department IDs a user can access
 */
export function getAccessibleDepartments(user) {
  if (!user) return [];
  if (user.role === ROLES.ADMIN || user.role === ROLES.KEHOACH) return 'all';
  const depts = [user.primaryDepartmentId];
  if (user.additionalDepartments?.length) {
    depts.push(...user.additionalDepartments);
  }
  return depts;
}
