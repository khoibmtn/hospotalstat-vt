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
 * Aggregate multiple rows (e.g., all departments for a date)
 */
export function aggregateRows(rows) {
  const sumKeys = ['bnCu', 'vaoVien', 'chuyenDen', 'chuyenDi', 'raVien', 'tuVong', 'chuyenVien'];
  const totals = {};

  sumKeys.forEach((key) => {
    totals[key] = rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
  });

  totals.bnHienTai = computeBnHienTai(totals);
  return totals;
}
