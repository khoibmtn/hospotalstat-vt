import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { DEFAULT_SETTINGS } from '../utils/constants';

function settingsRef() {
  return doc(db, 'settings', 'config');
}

export async function getSettings() {
  if (!db) return { ...DEFAULT_SETTINGS };
  const snap = await getDoc(settingsRef());
  if (!snap.exists()) {
    return { ...DEFAULT_SETTINGS };
  }
  return { ...DEFAULT_SETTINGS, ...snap.data() };
}

export async function updateSettings(updates) {
  if (!db) return;
  await setDoc(
    settingsRef(),
    { ...updates, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

