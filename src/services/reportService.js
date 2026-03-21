import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  writeBatch,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { REPORT_STATUS, DEFAULT_INPATIENT_VALUES } from '../utils/constants';
import { computeBnHienTai } from '../utils/computedColumns';
import { getReportDocId, formatDate, getDaysInMonthUpTo } from '../utils/dateUtils';
import { subDays } from 'date-fns';

/**
 * Get a single daily report
 */
export async function getReport(dateStr, departmentId) {
  const docId = getReportDocId(dateStr, departmentId);
  const snap = await getDoc(doc(db, 'dailyReports', docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Get all reports for a specific date
 */
export async function getReportsByDate(dateStr) {
  const q = query(
    collection(db, 'dailyReports'),
    where('date', '==', dateStr),
    orderBy('departmentName')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get reports for a date range
 */
export async function getReportsByDateRange(startDate, endDate) {
  const q = query(
    collection(db, 'dailyReports'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get reports for a specific department within date range
 */
export async function getReportsByDepartment(departmentId, startDate, endDate) {
  const q = query(
    collection(db, 'dailyReports'),
    where('departmentId', '==', departmentId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Save or update a daily report with cascading changes
 */
export async function saveReport(dateStr, departmentId, departmentName, facilityId, data, userObj) {
  const docId = getReportDocId(dateStr, departmentId);
  const bnHienTai = computeBnHienTai(data);

  const reportData = {
    date: dateStr,
    departmentId,
    departmentName,
    facilityId,
    reportedBy: userObj.nickname || '',
    ...data,
    bnHienTai,
    updatedAt: serverTimestamp(),
  };

  const existing = await getDoc(doc(db, 'dailyReports', docId));
  let oldBnHienTai = 0;
  let isNew = false;
  let oldData = null;

  const batch = writeBatch(db);

  if (existing.exists()) {
    oldData = existing.data();
    oldBnHienTai = oldData.bnHienTai || 0;
    // Preserve status & lock fields
    batch.set(doc(db, 'dailyReports', docId), reportData, { merge: true });
  } else {
    isNew = true;
    reportData.status = REPORT_STATUS.OPEN;
    reportData.lockedAt = null;
    reportData.lockedBy = null;
    reportData.createdAt = serverTimestamp();
    batch.set(doc(db, 'dailyReports', docId), reportData);
  }

  const diff = bnHienTai - oldBnHienTai;

  // If there's a change in bnHienTai, cascade to subsequent existing days
  if (diff !== 0) {
    const q = query(
      collection(db, 'dailyReports'),
      where('departmentId', '==', departmentId),
      where('date', '>', dateStr),
      orderBy('date', 'asc')
    );
    const snap = await getDocs(q);
    
    snap.docs.forEach((d) => {
      const subsequentData = d.data();
      batch.update(d.ref, {
        bnCu: (subsequentData.bnCu || 0) + diff,
        bnHienTai: (subsequentData.bnHienTai || 0) + diff,
        updatedAt: serverTimestamp(),
      });
    });
  }

  // Create audit log entry
  const logRef = doc(collection(db, 'auditLogs'));
  batch.set(logRef, {
    action: isNew ? 'CREATE_DAILY_REPORT' : 'UPDATE_DAILY_REPORT',
    date: dateStr,
    departmentId,
    departmentName,
    userId: userObj.uid || '',
    nickname: userObj.nickname || '',
    timestamp: serverTimestamp(),
    diff,
    details: {
      old: oldData,
      new: reportData
    }
  });

  await batch.commit();

  return { id: docId, ...reportData };
}

/**
 * Lock reports for a given date (batch)
 */
export async function lockReportsByDate(dateStr, lockedBy = 'system') {
  const reports = await getReportsByDate(dateStr);
  if (reports.length === 0) return;

  const batch = writeBatch(db);
  reports.forEach((report) => {
    if (report.status !== REPORT_STATUS.LOCKED) {
      batch.update(doc(db, 'dailyReports', report.id), {
        status: REPORT_STATUS.LOCKED,
        lockedAt: serverTimestamp(),
        lockedBy,
      });
    }
  });
  await batch.commit();
}

/**
 * Unlock a specific report (by Kế hoạch TH)
 */
export async function unlockReport(reportId) {
  await setDoc(
    doc(db, 'dailyReports', reportId),
    {
      status: REPORT_STATUS.OPEN,
      lockedAt: null,
      lockedBy: null,
    },
    { merge: true }
  );
}

/**
 * Initialize today's reports for all departments that don't have one yet.
 * BN cũ = BN hiện tại from yesterday's report
 */
export async function initializeDailyReports(dateStr, departments) {
  const yesterday = formatDate(subDays(new Date(dateStr + 'T00:00:00'), 1));
  const batch = writeBatch(db);
  let created = 0;

  for (const dept of departments) {
    const docId = getReportDocId(dateStr, dept.id);
    const existing = await getDoc(doc(db, 'dailyReports', docId));

    if (!existing.exists()) {
      // Get yesterday's data for this department
      const yesterdayReport = await getReport(yesterday, dept.id);
      const bnCu = yesterdayReport ? (yesterdayReport.bnHienTai || 0) : 0;

      const reportData = {
        date: dateStr,
        departmentId: dept.id,
        departmentName: dept.name,
        facilityId: dept.facilityId,
        reportedBy: null,
        bnCu,
        ...DEFAULT_INPATIENT_VALUES,
        bnHienTai: bnCu,
        status: REPORT_STATUS.OPEN,
        lockedAt: null,
        lockedBy: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      batch.set(doc(db, 'dailyReports', docId), reportData);
      created++;
    }
  }

  if (created > 0) {
    await batch.commit();
  }
  return created;
}

/**
 * Initialize missing reports for a single department from the 1st of the month up to dateStr.
 * Chains bnCu from day N-1 to day N.
 */
export async function initializeDepartmentReportsForMonth(dateStr, department) {
  const daysInMonth = getDaysInMonthUpTo(dateStr);
  if (daysInMonth.length === 0) return 0;
  
  const batch = writeBatch(db);
  let created = 0;
  
  const existingReports = await getReportsByDepartment(department.id, daysInMonth[0], dateStr);
  const existingMap = new Map();
  existingReports.forEach(r => existingMap.set(r.date, r));
  
  let lastBnHienTai = 0;
  if (!existingMap.has(daysInMonth[0])) {
    const lastDayConv = subDays(new Date(daysInMonth[0] + 'T00:00:00'), 1);
    const lastDayStr = formatDate(lastDayConv);
    const lastReport = await getReport(lastDayStr, department.id);
    if (lastReport) lastBnHienTai = lastReport.bnHienTai || 0;
  }

  for (const day of daysInMonth) {
    if (existingMap.has(day)) {
      lastBnHienTai = existingMap.get(day).bnHienTai || 0;
    } else {
      const docId = getReportDocId(day, department.id);
      const bnCu = lastBnHienTai;
      
      const reportData = {
        date: day,
        departmentId: department.id,
        departmentName: department.name,
        facilityId: department.facilityId,
        reportedBy: null,
        bnCu,
        ...DEFAULT_INPATIENT_VALUES,
        bnHienTai: bnCu,
        status: REPORT_STATUS.OPEN,
        lockedAt: null,
        lockedBy: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      batch.set(doc(db, 'dailyReports', docId), reportData);
      lastBnHienTai = bnCu;
      created++;
    }
  }

  if (created > 0) {
    await batch.commit();
  }
  return created;
}

/**
 * Import multiple reports for a department and handle cascading from the last imported day
 */
export async function importReports(departmentId, departmentName, facilityId, records, userObj) {
  if (!records || records.length === 0) return 0;
  
  // Sort records by date ascending to ensure we know the 'last' day
  const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const lastRecord = sortedRecords[sortedRecords.length - 1];
  
  // 1. Find the old bnHienTai for the last record's date (to calculate cascade diff)
  const lastDocId = getReportDocId(lastRecord.date, departmentId);
  const oldLastSnap = await getDoc(doc(db, 'dailyReports', lastDocId));
  const oldLastBnHienTai = oldLastSnap.exists() ? (oldLastSnap.data().bnHienTai || 0) : 0;
  
  const diff = lastRecord.bnHienTai - oldLastBnHienTai;

  // 2. Write the imported records in a batch
  const importBatch = writeBatch(db);
  
  for (const record of sortedRecords) {
    const docId = getReportDocId(record.date, departmentId);
    
    const reportData = {
      date: record.date,
      departmentId,
      departmentName,
      facilityId,
      reportedBy: userObj.nickname || '',
      bnCu: Number(record.bnCu) || 0,
      vaoVien: Number(record.vaoVien) || 0,
      chuyenDen: Number(record.chuyenDen) || 0,
      chuyenDi: Number(record.chuyenDi) || 0,
      raVien: Number(record.raVien) || 0,
      tuVong: Number(record.tuVong) || 0,
      chuyenVien: Number(record.chuyenVien) || 0,
      bnHienTai: Number(record.bnHienTai) || 0,
      updatedAt: serverTimestamp(),
      updatedBy: userObj.uid,
      updatedByName: userObj.displayName || userObj.email,
    };
    
    // We use merge: true so we don't accidentally overwrite createdAt, lockedAt, or status
    importBatch.set(doc(db, 'dailyReports', docId), reportData, { merge: true });
    
    // Log
    const logRef = doc(collection(db, 'auditLogs'));
    importBatch.set(logRef, {
      action: 'IMPORT_DAILY_REPORT',
      date: record.date,
      departmentId,
      departmentName,
      userId: userObj.uid || '',
      nickname: userObj.nickname || '',
      timestamp: serverTimestamp(),
      details: {
        new: reportData
      }
    });
  }

  await importBatch.commit();

  // 3. If there is a diff on the last day, cascade it forward
  if (diff !== 0) {
    const cascadeBatch = writeBatch(db);
    const q = query(
      collection(db, 'dailyReports'),
      where('departmentId', '==', departmentId),
      where('date', '>', lastRecord.date),
      orderBy('date', 'asc')
    );
    const snap = await getDocs(q);
    
    let hasUpdates = false;
    snap.docs.forEach((d) => {
      hasUpdates = true;
      const subsequentData = d.data();
      cascadeBatch.update(d.ref, {
        bnCu: (subsequentData.bnCu || 0) + diff,
        bnHienTai: (subsequentData.bnHienTai || 0) + diff,
        updatedAt: serverTimestamp(),
      });
    });
    
    if (hasUpdates) {
      await cascadeBatch.commit();
    }
  }

  return sortedRecords.length;
}
