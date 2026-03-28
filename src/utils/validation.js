import { computeBnHienTai } from './computedColumns';

/**
 * Validate a single report row.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateReportRow(row) {
  const errors = [];
  const flowFields = ['vaoVien', 'chuyenDen', 'chuyenDi', 'raVien', 'tuVong', 'chuyenVien'];

  flowFields.forEach((key) => {
    const val = Number(row[key]);
    if (val < 0) {
      errors.push(`${key} không được âm (hiện tại: ${val})`);
    }
  });

  const bnCu = Number(row.bnCu) || 0;
  if (bnCu < 0) {
    errors.push(`BN cũ không được âm (hiện tại: ${bnCu})`);
  }

  const bnHienTai = computeBnHienTai(row);
  if (bnHienTai < 0) {
    const totalIn = bnCu + (Number(row.vaoVien) || 0) + (Number(row.chuyenDen) || 0);
    const totalOut = (Number(row.chuyenDi) || 0) + (Number(row.raVien) || 0) + (Number(row.tuVong) || 0) + (Number(row.chuyenVien) || 0);
    errors.push(`BN hiện tại âm (${bnHienTai}): tổng xuất (${totalOut}) vượt quá tổng nhập (${totalIn})`);
  }

  return { valid: errors.length === 0, errors, bnHienTai };
}

/**
 * Determines if a death case row has any actual content.
 * RULE: A row is considered "filled" ONLY if it contains at least one of the CORE identifying fields.
 * Supplemental fields (like notes, clinical details) or custom columns do NOT cause a row to be "filled".
 * This is an intentional business rule to prevent accidental empty rows from being saved just because 
 * a user typed a space in a notes column.
 */
export function isFilledRow(row) {
  if (!row) return false;
  const coreFields = ['maKCB', 'hoTen', 'namSinh', 'timeVaoVien', 'timeTuVong', 'chanDoanVao', 'chanDoanTuVong'];
  return coreFields.some(key => {
    const val = row[key];
    return val !== undefined && val !== null && String(val).trim() !== '';
  });
}
