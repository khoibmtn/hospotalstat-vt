import {
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION = 'diseaseCatalog';

/**
 * Fetch all diseases from the catalog, sorted by order
 */
export async function getDiseaseCatalog() {
  const q = query(collection(db, COLLECTION), orderBy('order'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Add a new disease to the catalog
 */
export async function addDisease(name, color = '', group = 'B') {
  const existing = await getDiseaseCatalog();
  const id = 'disease_' + Date.now();
  const data = {
    name: name.trim(),
    group,
    order: existing.length + 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (color) data.color = color;
  await setDoc(doc(db, COLLECTION, id), data);
  return id;
}

export async function updateDiseaseGroup(id, group) {
  await setDoc(
    doc(db, COLLECTION, id),
    { group, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function swapDiseaseOrder(idA, orderA, idB, orderB) {
  const ts = serverTimestamp();
  await setDoc(doc(db, COLLECTION, idA), { order: orderB, updatedAt: ts }, { merge: true });
  await setDoc(doc(db, COLLECTION, idB), { order: orderA, updatedAt: ts }, { merge: true });
}

/**
 * Update only the label (name) of an existing disease
 */
export async function updateDiseaseName(id, newName) {
  await setDoc(
    doc(db, COLLECTION, id),
    { name: newName.trim(), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function updateDiseaseColor(id, color) {
  await setDoc(
    doc(db, COLLECTION, id),
    { color, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * Delete a disease from the catalog.
 * Caller should check isDiseaseUsedInReports() first.
 */
export async function deleteDisease(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Check if a disease name is referenced in any dailyReport's infectiousData.
 * We query reports where infectiousData array contains the disease name.
 * Firestore doesn't support array-contains on nested object fields directly,
 * so we fetch a small batch and scan client-side.
 */
export async function isDiseaseUsedInReports(diseaseName) {
  // Fetch a limited number of reports that have infectiousData
  const q = query(
    collection(db, 'dailyReports'),
    orderBy('date', 'desc'),
    limit(500)
  );
  const snap = await getDocs(q);

  for (const d of snap.docs) {
    const data = d.data();
    const infectious = data.infectiousData || [];
    if (infectious.some((item) => item.diseaseName === diseaseName)) {
      return true;
    }
  }
  return false;
}
