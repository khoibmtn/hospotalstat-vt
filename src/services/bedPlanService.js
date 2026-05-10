import {
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION = 'bedPlans';

/**
 * Fetch all bed plans sorted by departmentName
 */
export async function getBedPlans() {
  const q = query(collection(db, COLLECTION), orderBy('departmentName'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Add or update a bed plan
 */
export async function saveBedPlan(id, data) {
  await setDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Delete a bed plan
 */
export async function deleteBedPlan(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Initialize bed plans from departments list (first-time setup)
 */
export async function initBedPlans(departments) {
  const existing = await getBedPlans();
  if (existing.length > 0) return existing;

  for (const dept of departments) {
    const id = `bed_${dept.id}`;
    await setDoc(doc(db, COLLECTION, id), {
      departmentId: dept.id,
      departmentName: dept.name,
      facilityId: dept.facilityId || '',
      beds: 10,
      startDate: '2026-01-01',
      endDate: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return getBedPlans();
}
