/**
 * Calculate BN hiện tại (currently treated patients)
 * Formula: BN cũ + Vào viện + Chuyển đến - Chuyển đi - Ra viện - Tử vong - Chuyển viện
 */
export function computeBnHienTai(row) {
  const bnCu = Number(row.bnCu) || 0;
  const vaoVien = Number(row.vaoVien) || 0;
  const chuyenDen = Number(row.chuyenDen) || 0;
  const chuyenDi = Number(row.chuyenDi) || 0;
  const raVien = Number(row.raVien) || 0;
  const tuVong = Number(row.tuVong) || 0;
  const chuyenVien = Number(row.chuyenVien) || 0;

  return bnCu + vaoVien + chuyenDen - chuyenDi - raVien - tuVong - chuyenVien;
}

/**
 * Apply all computed columns to a report row
 */
export function applyComputedColumns(row) {
  return {
    ...row,
    bnHienTai: computeBnHienTai(row),
  };
}

/**
 * Aggregate multiple rows (e.g., all days for a department over a period)
 * - bnCu: value from the earliest date row (đầu kỳ)
 * - bnHienTai: value from the latest date row (cuối kỳ)
 * - Flow fields (vào, đến, đi, ra, tử, chuyển): summed
 */
const EMPTY_TOTALS = { bnCu: 0, vaoVien: 0, chuyenDen: 0, chuyenDi: 0, raVien: 0, tuVong: 0, chuyenVien: 0, bnHienTai: 0 };

export function aggregateRows(rows) {
  if (!rows || rows.length === 0) return { ...EMPTY_TOTALS };

  const flowKeys = ['vaoVien', 'chuyenDen', 'chuyenDi', 'raVien', 'tuVong', 'chuyenVien'];
  const totals = {};

  flowKeys.forEach((key) => {
    totals[key] = rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
  });

  // Sort rows by date to find first and last
  const sorted = [...rows].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  totals.bnCu = Number(sorted[0].bnCu) || 0;
  totals.bnHienTai = Number(sorted[sorted.length - 1].bnHienTai) || 0;

  return totals;
}

/**
 * Aggregate same-date reports from multiple departments into one row.
 * All fields are summed (valid because they share the same date).
 */
export function aggregateDeptSummaries(deptRows) {
  if (!deptRows || deptRows.length === 0) return { ...EMPTY_TOTALS };

  const allKeys = ['bnCu', 'vaoVien', 'chuyenDen', 'chuyenDi', 'raVien', 'tuVong', 'chuyenVien', 'bnHienTai'];
  const totals = {};

  allKeys.forEach((key) => {
    totals[key] = deptRows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
  });

  return totals;
}

/**
 * Aggregate raw reports into a grand total across departments AND dates.
 * - bnCu = SUM of all departments' bnCu on the earliest date (đầu kỳ)
 * - bnHienTai = SUM of all departments' bnHienTai on the latest date (cuối kỳ)
 * - Flow fields = SUM across all reports
 */
export function aggregateGrandTotal(rawReports) {
  if (!rawReports || rawReports.length === 0) return { ...EMPTY_TOTALS };

  const flowKeys = ['vaoVien', 'chuyenDen', 'chuyenDi', 'raVien', 'tuVong', 'chuyenVien'];
  const totals = {};

  // Sum flow fields across all reports
  flowKeys.forEach((key) => {
    totals[key] = rawReports.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
  });

  // Find earliest and latest dates
  const dates = [...new Set(rawReports.map((r) => r.date))].sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  // bnCu = sum of all departments on the earliest date
  totals.bnCu = rawReports
    .filter((r) => r.date === firstDate)
    .reduce((sum, r) => sum + (Number(r.bnCu) || 0), 0);

  // bnHienTai = sum of all departments on the latest date
  totals.bnHienTai = rawReports
    .filter((r) => r.date === lastDate)
    .reduce((sum, r) => sum + (Number(r.bnHienTai) || 0), 0);

  return totals;
}
