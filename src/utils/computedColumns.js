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
export function aggregateRows(rows) {
  if (!rows || rows.length === 0) return {};

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
 * Aggregate already-summarized department rows into a grand total.
 * All fields are summed directly (each dept already has correct bnCu/bnHienTai).
 */
export function aggregateDeptSummaries(deptRows) {
  if (!deptRows || deptRows.length === 0) return {};

  const allKeys = ['bnCu', 'vaoVien', 'chuyenDen', 'chuyenDi', 'raVien', 'tuVong', 'chuyenVien', 'bnHienTai'];
  const totals = {};

  allKeys.forEach((key) => {
    totals[key] = deptRows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
  });

  return totals;
}
