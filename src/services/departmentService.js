import {
  doc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { SEED_FACILITIES, SEED_DEPARTMENTS } from '../utils/seedData';

/**
 * Get all facilities
 */
export async function getFacilities() {
  const q = query(collection(db, 'facilities'), orderBy('order'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get all departments
 */
export async function getDepartments() {
  const q = query(collection(db, 'departments'), orderBy('order'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get departments by facility
 */
export async function getDepartmentsByFacility(facilityId) {
  const all = await getDepartments();
  return all.filter((d) => d.facilityId === facilityId);
}

/**
 * Add or update a facility
 */
export async function saveFacility(id, data) {
  await setDoc(doc(db, 'facilities', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a facility
 */
export async function deleteFacility(id) {
  await deleteDoc(doc(db, 'facilities', id));
}

/**
 * Add or update a department
 */
export async function saveDepartment(id, data) {
  await setDoc(doc(db, 'departments', id), {
    ...data,
    active: data.active !== false,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a department
 */
export async function deleteDepartment(id) {
  await deleteDoc(doc(db, 'departments', id));
}

/**
 * Seed initial data if collections are empty
 */
export async function seedInitialData() {
  const facilitiesSnap = await getDocs(collection(db, 'facilities'));

  if (facilitiesSnap.empty) {
    for (const f of SEED_FACILITIES) {
      await setDoc(doc(db, 'facilities', f.id), {
        name: f.name,
        order: f.order,
        createdAt: serverTimestamp(),
      });
    }

    for (const d of SEED_DEPARTMENTS) {
      await setDoc(doc(db, 'departments', d.id), {
        name: d.name,
        facilityId: d.facilityId,
        order: d.order,
        active: true,
        createdAt: serverTimestamp(),
      });
    }

    return true;
  }
  return false;
}
