/**
 * Disease catalog seed data following MOH classification.
 * Order matches user's specified MOH list exactly.
 */
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const DEFAULT_DISEASES = [
  // ──── Nhóm A: Bệnh truyền nhiễm đặc biệt nguy hiểm (10 bệnh) ────
  { name: 'Bệnh bại liệt', group: 'A', color: '#ef4444' },
  { name: 'Bệnh cúm A-H5N1', group: 'A', color: '#ef4444' },
  { name: 'Bệnh sốt xuất huyết do virus Ebola', group: 'A', color: '#ef4444' },
  { name: 'Bệnh sốt Tây sông Nin (Nile)', group: 'A', color: '#ef4444' },
  { name: 'Bệnh sốt vàng', group: 'A', color: '#f43f5e' },
  { name: 'Bệnh tả', group: 'A', color: '#f43f5e' },
  { name: 'Bệnh viêm đường hô hấp cấp nặng do virus', group: 'A', color: '#f43f5e' },
  { name: 'Bệnh do virus cúm A(H5N6)', group: 'A', color: '#f97316' },
  { name: 'Bệnh do virus cúm A(H9N2)', group: 'A', color: '#f97316' },
  { name: 'Bệnh do virus Nipah', group: 'A', color: '#f97316' },

  // ──── Nhóm B: Bệnh truyền nhiễm nguy hiểm (35 bệnh) ────
  { name: 'Bệnh do virus Adeno', group: 'B', color: '#3b82f6' },
  { name: 'HIV/AIDS', group: 'B', color: '#6366f1' },
  { name: 'Bệnh bạch hầu', group: 'B', color: '#8b5cf6' },
  { name: 'Bệnh cúm', group: 'B', color: '#06b6d4' },
  { name: 'Bệnh dại', group: 'B', color: '#a855f7' },
  { name: 'Bệnh ho gà', group: 'B', color: '#14b8a6' },
  { name: 'Bệnh lao phổi', group: 'B', color: '#78716c' },
  { name: 'Bệnh do liên cầu lợn ở người', group: 'B', color: '#ec4899' },
  { name: 'Bệnh lỵ Amibe', group: 'B', color: '#22c55e' },
  { name: 'Bệnh lỵ trực trùng', group: 'B', color: '#84cc16' },
  { name: 'Bệnh quai bị', group: 'B', color: '#eab308' },
  { name: 'Sốt xuất huyết Dengue', group: 'B', color: '#f59e0b' },
  { name: 'Bệnh sốt rét', group: 'B', color: '#06b6d4' },
  { name: 'Bệnh sốt phát ban', group: 'B', color: '#3b82f6' },
  { name: 'Bệnh sởi', group: 'B', color: '#6366f1' },
  { name: 'Bệnh tay-chân-miệng', group: 'B', color: '#ec4899' },
  { name: 'Bệnh thủy đậu', group: 'B', color: '#14b8a6' },
  { name: 'Bệnh thương hàn', group: 'B', color: '#8b5cf6' },
  { name: 'Bệnh uốn ván', group: 'B', color: '#78716c' },
  { name: 'Bệnh Rubella', group: 'B', color: '#a855f7' },
  { name: 'Bệnh viêm gan virus', group: 'B', color: '#eab308' },
  { name: 'Bệnh viêm màng não do não mô cầu', group: 'B', color: '#f59e0b' },
  { name: 'Bệnh viêm não virus', group: 'B', color: '#3b82f6' },
  { name: 'Bệnh xoắn khuẩn vàng da', group: 'B', color: '#84cc16' },
  { name: 'Bệnh tiêu chảy do virus Rota', group: 'B', color: '#22c55e' },
  { name: 'Bệnh do Haemophilus influenzae týp b', group: 'B', color: '#06b6d4' },
  { name: 'Bệnh do phế cầu', group: 'B', color: '#14b8a6' },
  { name: 'Bệnh viêm đường hô hấp do virus hợp bào (RSV)', group: 'B', color: '#6366f1' },
  { name: 'Bệnh viêm phổi do vi khuẩn Legionella pneumophila', group: 'B', color: '#8b5cf6' },
  { name: 'Bệnh do virus HPV', group: 'B', color: '#ec4899' },
  { name: 'Bệnh do Whitmore', group: 'B', color: '#78716c' },
  { name: 'Bệnh do virus Chikungunya', group: 'B', color: '#f59e0b' },
  { name: 'Bệnh ngộ độc thịt do Clostridium botulinum', group: 'B', color: '#eab308' },
  { name: 'Bệnh do Listeria monocytogenes', group: 'B', color: '#84cc16' },
  { name: 'COVID-19', group: 'B', color: '#ef4444' },
];

export { DEFAULT_DISEASES };

export async function seedDiseaseCatalog() {
  const snap = await getDocs(collection(db, 'diseaseCatalog'));
  if (!snap.empty) {
    console.log('diseaseCatalog already has', snap.size, 'entries. Skipping seed.');
    return false;
  }

  for (let i = 0; i < DEFAULT_DISEASES.length; i++) {
    const { name, group, color } = DEFAULT_DISEASES[i];
    const id = 'disease_default_' + (i + 1);
    await setDoc(doc(db, 'diseaseCatalog', id), {
      name,
      group,
      color,
      order: i + 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  console.log('Seeded', DEFAULT_DISEASES.length, 'diseases into diseaseCatalog.');
  return true;
}

/**
 * Sync missing diseases from DEFAULT_DISEASES into existing catalog.
 * Also re-orders ALL diseases to match the canonical MOH order.
 * Existing diseases not in default list keep their relative order at the end.
 */
export async function syncDiseaseCatalog() {
  const snap = await getDocs(collection(db, 'diseaseCatalog'));
  const existing = {};
  snap.docs.forEach(d => {
    const data = d.data();
    existing[data.name] = { id: d.id, ...data };
  });

  let added = 0;
  let updated = 0;

  // Build the canonical order: default list first, then any extras
  const canonicalNames = DEFAULT_DISEASES.map(d => d.name);
  const extraNames = Object.keys(existing).filter(n => !canonicalNames.includes(n));
  const finalOrder = [...canonicalNames, ...extraNames];

  for (let i = 0; i < DEFAULT_DISEASES.length; i++) {
    const { name, group, color } = DEFAULT_DISEASES[i];
    const newOrder = i + 1;
    if (existing[name]) {
      const ex = existing[name];
      const patch = { updatedAt: serverTimestamp(), order: newOrder };
      if (!ex.group) patch.group = group;
      if (!ex.color) patch.color = color;
      await setDoc(doc(db, 'diseaseCatalog', ex.id), patch, { merge: true });
      updated++;
    } else {
      const id = 'disease_sync_' + Date.now() + '_' + i;
      await setDoc(doc(db, 'diseaseCatalog', id), {
        name,
        group,
        color,
        order: newOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      added++;
    }
  }

  // Re-order extras to come after default list
  for (let j = 0; j < extraNames.length; j++) {
    const ex = existing[extraNames[j]];
    await setDoc(doc(db, 'diseaseCatalog', ex.id), {
      order: DEFAULT_DISEASES.length + j + 1,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  console.log(`Sync complete: ${added} added, ${updated} updated.`);
  return { added, updated };
}
