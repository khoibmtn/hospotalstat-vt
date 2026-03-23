/**
 * One-time seed script: populates diseaseCatalog collection with default diseases.
 * Run in browser console or import temporarily.
 */
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const DEFAULT_DISEASES = [
  'Sốt xuất huyết Dengue',
  'Sởi',
  'Tay chân miệng',
  'COVID-19',
  'Thủy đậu',
  'Quai bị',
  'Cúm A/B',
  'Sốt rét',
  'Uốn ván',
  'Viêm não Nhật Bản',
  'Viêm màng não mủ',
  'Ho gà',
  'Bạch hầu',
  'Lỵ trực trùng',
  'Dại',
];

export async function seedDiseaseCatalog() {
  const snap = await getDocs(collection(db, 'diseaseCatalog'));
  if (!snap.empty) {
    console.log('diseaseCatalog already has', snap.size, 'entries. Skipping seed.');
    return false;
  }

  for (let i = 0; i < DEFAULT_DISEASES.length; i++) {
    const id = 'disease_default_' + (i + 1);
    await setDoc(doc(db, 'diseaseCatalog', id), {
      name: DEFAULT_DISEASES[i],
      order: i + 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  console.log('Seeded', DEFAULT_DISEASES.length, 'diseases into diseaseCatalog.');
  return true;
}
