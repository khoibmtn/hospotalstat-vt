import * as XLSX from 'xlsx';
import { format, parse, isValid } from 'date-fns';

// ── Sheet Name Helpers ───────────────────────────────────────────────────────

const EXCEL_INVALID_CHARS = /[\\\/\?\*\[\]:]/g;
const MAX_SHEET_NAME_LENGTH = 31;

/**
 * Create a valid Excel sheet name from department ID and name.
 * Format: (dept_id) SanitizedName (max 31 chars total)
 * Uses parentheses instead of brackets since [] are invalid in Excel.
 */
export function toSheetName(deptId, deptName) {
  const prefix = `(${deptId}) `;
  const maxNameLen = MAX_SHEET_NAME_LENGTH - prefix.length;
  if (maxNameLen <= 0) {
    return deptId.substring(0, MAX_SHEET_NAME_LENGTH);
  }
  const sanitized = deptName
    .replace(EXCEL_INVALID_CHARS, '')
    .trim()
    .substring(0, maxNameLen);
  return prefix + sanitized;
}

/**
 * Parse department ID from a sheet name created by toSheetName.
 * Returns null if the sheet name doesn't match the expected format.
 */
export function parseDeptIdFromSheet(sheetName) {
  const match = sheetName.match(/^\(([^)]+)\)/);
  return match ? match[1] : null;
}

// ── Date Formatting ──────────────────────────────────────────────────────────

function formatExcelDate(dateStr) {
  // dateStr is 'yyyy-MM-dd', output 'yyyyMMdd'
  return dateStr.replace(/-/g, '');
}

function parseExcelDate(raw) {
  const str = String(raw).trim();
  if (str.length === 8 && !isNaN(str)) {
    const parsed = parse(str, 'yyyyMMdd', new Date());
    if (isValid(parsed)) {
      return format(parsed, 'yyyy-MM-dd');
    }
  }
  return null;
}

// ── Section Headers ──────────────────────────────────────────────────────────

const SECTION_HEADER_BTN = 'BỆNH TRUYỀN NHIỄM';
const SECTION_HEADER_DEATH = 'DANH SÁCH TỬ VONG';

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Export reports to Excel file and trigger download.
 *
 * @param {Array} reports - Raw report documents from Firestore
 * @param {Array} departments - Department list
 * @param {Object} settings - App settings (includes deathReportColumns)
 * @param {string} fileName - Output file name
 */
export function exportReportsToExcel(reports, departments, settings, fileName) {
  const wb = XLSX.utils.book_new();

  // Group reports by department
  const byDept = {};
  reports.forEach(r => {
    if (!byDept[r.departmentId]) {
      byDept[r.departmentId] = [];
    }
    byDept[r.departmentId].push(r);
  });

  // If no data, create an empty workbook with a placeholder sheet
  if (Object.keys(byDept).length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['Không có dữ liệu trong khoảng thời gian đã chọn']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Trống');
    XLSX.writeFile(wb, fileName);
    return;
  }

  Object.entries(byDept).forEach(([deptId, deptReports]) => {
    const dept = departments.find(d => d.id === deptId);
    const sheetName = toSheetName(deptId, dept?.name || deptId);
    const sortedReports = [...deptReports].sort((a, b) => a.date.localeCompare(b.date));

    const aoa = buildSheetAOA(sortedReports, settings);
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Ngày
      { wch: 15 }, // Tua trực
      { wch: 8 },  // BN cũ
      { wch: 10 }, // Vào viện
      { wch: 11 }, // Chuyển đến
      { wch: 10 }, // Chuyển đi
      { wch: 10 }, // Ra viện
      { wch: 9 },  // Tử vong
      { wch: 12 }, // Chuyển viện
      { wch: 12 }, // BN hiện tại
    ];

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, fileName);
}

/**
 * Build an Array-of-Arrays for one sheet: KCB + BTN + Death sections.
 */
function buildSheetAOA(sortedReports, settings) {
  const rows = [];

  // ── Section 1: KCB ──
  rows.push([
    'Ngày', 'Tua trực', 'BN cũ', 'Vào viện', 'Chuyển đến',
    'Chuyển đi', 'Ra viện', 'Tử vong', 'Chuyển viện', 'BN hiện tại'
  ]);

  sortedReports.forEach(r => {
    rows.push([
      formatExcelDate(r.date),
      r.shiftName || '',
      r.bnCu || 0,
      r.vaoVien || 0,
      r.chuyenDen || 0,
      r.chuyenDi || 0,
      r.raVien || 0,
      r.tuVong || 0,
      r.chuyenVien || 0,
      r.bnHienTai || 0,
    ]);
  });

  // ── Section 2: BTN ──
  const btnRows = [];
  sortedReports.forEach(r => {
    if (r.infectiousData && r.infectiousData.length > 0) {
      r.infectiousData.forEach(d => {
        if (d.diseaseName) {
          btnRows.push([
            formatExcelDate(r.date),
            d.diseaseName,
            d.bnCu || 0,
            d.vaoVien || 0,
            d.chuyenDen || 0,
            d.chuyenDi || 0,
            d.raVien || 0,
            d.tuVong || 0,
            d.chuyenVien || 0,
            d.bnHienTai || 0,
          ]);
        }
      });
    }
  });

  if (btnRows.length > 0) {
    rows.push([]); // empty row
    rows.push([]); // empty row
    rows.push([SECTION_HEADER_BTN]);
    rows.push([
      'Ngày', 'Tên bệnh', 'BN cũ', 'Vào viện', 'Chuyển đến',
      'Chuyển đi', 'Ra viện', 'Tử vong', 'Chuyển viện', 'BN hiện tại'
    ]);
    rows.push(...btnRows);
  }

  // ── Section 3: Death ──
  const deathColumns = settings?.deathReportColumns || [];
  const deathRows = [];
  sortedReports.forEach(r => {
    if (r.deathCases && r.deathCases.length > 0) {
      r.deathCases.forEach(dc => {
        if (!dc || Object.keys(dc).length === 0) return;
        const row = [formatExcelDate(r.date)];
        deathColumns.forEach(col => {
          row.push(dc[col.id] || '');
        });
        deathRows.push(row);
      });
    }
  });

  if (deathRows.length > 0) {
    rows.push([]); // empty row
    rows.push([]); // empty row
    rows.push([SECTION_HEADER_DEATH]);
    const deathHeader = ['Ngày', ...deathColumns.map(c => c.label)];
    rows.push(deathHeader);
    rows.push(...deathRows);
  }

  return rows;
}

// ── Import Parser ────────────────────────────────────────────────────────────

/**
 * Parse a single sheet's raw AOA data into structured records.
 * Detects 3 sections: KCB, BTN, Death.
 *
 * @param {Object} worksheet - XLSX worksheet object
 * @param {Array} deathColumns - Death report column config from settings
 * @returns {{ kcbRecords, btnRecords, deathRecords }}
 */
export function parseImportSheet(worksheet, deathColumns = []) {
  const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  // Find section boundaries
  let btnHeaderRow = -1;
  let deathHeaderRow = -1;

  for (let i = 0; i < aoa.length; i++) {
    const firstCell = String(aoa[i]?.[0] || '').trim();
    if (firstCell === SECTION_HEADER_BTN) {
      btnHeaderRow = i;
    } else if (firstCell === SECTION_HEADER_DEATH) {
      deathHeaderRow = i;
    }
  }

  // Determine section ranges
  const kcbStart = 0; // header at row 0, data from row 1
  const kcbEnd = btnHeaderRow > 0 ? btnHeaderRow : (deathHeaderRow > 0 ? deathHeaderRow : aoa.length);

  const btnStart = btnHeaderRow > 0 ? btnHeaderRow + 1 : -1; // +1 for section title, +2 for column header
  const btnEnd = deathHeaderRow > 0 ? deathHeaderRow : aoa.length;

  const deathStart = deathHeaderRow > 0 ? deathHeaderRow + 1 : -1;
  const deathEnd = aoa.length;

  // Parse KCB
  const kcbRecords = parseKCBSection(aoa, kcbStart, kcbEnd);

  // Parse BTN
  const btnRecords = btnStart > 0 ? parseBTNSection(aoa, btnStart, btnEnd) : [];

  // Parse Death
  const deathRecords = deathStart > 0 ? parseDeathSection(aoa, deathStart, deathEnd, deathColumns) : [];

  return { kcbRecords, btnRecords, deathRecords };
}

/**
 * Parse KCB section. Skips BN cũ and BN hiện tại columns on import.
 */
function parseKCBSection(aoa, startRow, endRow) {
  if (startRow >= endRow || aoa.length <= startRow) return [];

  // Find header row and map column indices
  const headerRow = aoa[startRow];
  if (!headerRow) return [];

  const colMap = mapColumns(headerRow, {
    'Ngày': 'date', 'Ngay': 'date',
    'Tua trực': 'shiftName', 'TuaTruc': 'shiftName',
    'Vào viện': 'vaoVien', 'VaoVien': 'vaoVien',
    'Chuyển đến': 'chuyenDen', 'ChuyenDen': 'chuyenDen',
    'Chuyển đi': 'chuyenDi', 'ChuyenDi': 'chuyenDi',
    'Ra viện': 'raVien', 'RaVien': 'raVien',
    'Tử vong': 'tuVong', 'TuVong': 'tuVong',
    'Chuyển viện': 'chuyenVien', 'ChuyenVien': 'chuyenVien',
  });

  if (!colMap.date && colMap.date !== 0) return [];

  const records = [];
  for (let i = startRow + 1; i < endRow; i++) {
    const row = aoa[i];
    if (!row || isEmptyRow(row)) continue;

    const dateStr = parseExcelDate(row[colMap.date]);
    if (!dateStr) continue;

    records.push({
      date: dateStr,
      shiftName: colMap.shiftName != null ? String(row[colMap.shiftName] || '') : '',
      vaoVien: safeInt(row[colMap.vaoVien]),
      chuyenDen: safeInt(row[colMap.chuyenDen]),
      chuyenDi: safeInt(row[colMap.chuyenDi]),
      raVien: safeInt(row[colMap.raVien]),
      tuVong: safeInt(row[colMap.tuVong]),
      chuyenVien: safeInt(row[colMap.chuyenVien]),
    });
  }

  return records;
}

/**
 * Parse BTN section. Skips BN cũ and BN hiện tại on import.
 */
function parseBTNSection(aoa, sectionTitleRow, endRow) {
  // sectionTitleRow = row with "BỆNH TRUYỀN NHIỄM"
  // Next row = column headers
  const headerRowIdx = sectionTitleRow + 1;
  if (headerRowIdx >= endRow || !aoa[headerRowIdx]) return [];

  const headerRow = aoa[headerRowIdx];
  const colMap = mapColumns(headerRow, {
    'Ngày': 'date', 'Ngay': 'date',
    'Tên bệnh': 'diseaseName', 'TenBenh': 'diseaseName',
    'Vào viện': 'vaoVien', 'VaoVien': 'vaoVien',
    'Chuyển đến': 'chuyenDen', 'ChuyenDen': 'chuyenDen',
    'Chuyển đi': 'chuyenDi', 'ChuyenDi': 'chuyenDi',
    'Ra viện': 'raVien', 'RaVien': 'raVien',
    'Tử vong': 'tuVong', 'TuVong': 'tuVong',
    'Chuyển viện': 'chuyenVien', 'ChuyenVien': 'chuyenVien',
  });

  if (!colMap.date && colMap.date !== 0) return [];

  const records = [];
  for (let i = headerRowIdx + 1; i < endRow; i++) {
    const row = aoa[i];
    if (!row || isEmptyRow(row)) continue;

    const dateStr = parseExcelDate(row[colMap.date]);
    if (!dateStr) continue;

    records.push({
      date: dateStr,
      diseaseName: colMap.diseaseName != null ? String(row[colMap.diseaseName] || '').trim() : '',
      vaoVien: safeInt(row[colMap.vaoVien]),
      chuyenDen: safeInt(row[colMap.chuyenDen]),
      chuyenDi: safeInt(row[colMap.chuyenDi]),
      raVien: safeInt(row[colMap.raVien]),
      tuVong: safeInt(row[colMap.tuVong]),
      chuyenVien: safeInt(row[colMap.chuyenVien]),
    });
  }

  return records;
}

/**
 * Parse Death section. Imports all columns.
 */
function parseDeathSection(aoa, sectionTitleRow, endRow, deathColumns) {
  const headerRowIdx = sectionTitleRow + 1;
  if (headerRowIdx >= endRow || !aoa[headerRowIdx]) return [];

  const headerRow = aoa[headerRowIdx];

  // Map 'Ngày' column
  let dateColIdx = -1;
  for (let j = 0; j < headerRow.length; j++) {
    const h = String(headerRow[j] || '').trim();
    if (h === 'Ngày' || h === 'Ngay') {
      dateColIdx = j;
      break;
    }
  }
  if (dateColIdx < 0) return [];

  // Map death report columns by label
  const deathColMap = {};
  deathColumns.forEach(col => {
    for (let j = 0; j < headerRow.length; j++) {
      if (String(headerRow[j] || '').trim() === col.label) {
        deathColMap[col.id] = j;
        break;
      }
    }
  });

  const records = [];
  for (let i = headerRowIdx + 1; i < endRow; i++) {
    const row = aoa[i];
    if (!row || isEmptyRow(row)) continue;

    const dateStr = parseExcelDate(row[dateColIdx]);
    if (!dateStr) continue;

    const deathCase = {};
    deathColumns.forEach(col => {
      if (deathColMap[col.id] != null) {
        deathCase[col.id] = row[deathColMap[col.id]] || '';
      }
    });

    records.push({ date: dateStr, ...deathCase });
  }

  return records;
}

// ── Utility helpers ──────────────────────────────────────────────────────────

function mapColumns(headerRow, mapping) {
  const result = {};
  for (let j = 0; j < headerRow.length; j++) {
    const header = String(headerRow[j] || '').trim();
    if (mapping[header]) {
      result[mapping[header]] = j;
    }
  }
  return result;
}

function isEmptyRow(row) {
  return row.every(cell => cell === '' || cell === null || cell === undefined);
}

function safeInt(val) {
  if (val === '' || val === null || val === undefined) return 0;
  return parseInt(val, 10) || 0;
}
