import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Upload, Download, AlertCircle, CheckCircle2, X, FileSpreadsheet, ChevronRight, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parse, isValid, format, subDays } from 'date-fns';
import { getReportsByDepartment } from '../../services/reportService';

// --- Helpers ---

/** Check if a parsed JSON row has the minimum required columns */
function rowIsValid(row) {
  const hasDate = !!(row.Ngay || row['Ngày']);
  const hasAnyNumeric = (
    row.VaoVien !== undefined || row['Vào viện'] !== undefined ||
    row.ChuyenDen !== undefined || row['Chuyển đến'] !== undefined
  );
  return hasDate && hasAnyNumeric;
}

/** Parse a single sheet's JSON into typed rows */
function parseSheetRows(json) {
  return json.map((row, index) => {
    let rawDate = row.Ngay || row['Ngày'];
    let dateStr = '';
    let isValidDate = false;

    if (rawDate) {
      const stringDate = rawDate.toString().trim();
      if (stringDate.length === 8 && !isNaN(stringDate)) {
        const parsed = parse(stringDate, 'yyyyMMdd', new Date());
        if (isValid(parsed)) {
          dateStr = format(parsed, 'yyyy-MM-dd');
          isValidDate = true;
        }
      }
    }

    return {
      _index: index + 2,
      date: dateStr,
      rawDate,
      isValidDate,
      vaoVien: Number(row.VaoVien || row['Vào viện']) || 0,
      chuyenDen: Number(row.ChuyenDen || row['Chuyển đến']) || 0,
      chuyenDi: Number(row.ChuyenDi || row['Chuyển đi']) || 0,
      raVien: Number(row.RaVien || row['Ra viện']) || 0,
      tuVong: Number(row.TuVong || row['Tử vong']) || 0,
      chuyenVien: Number(row.ChuyenVien || row['Chuyển viện']) || 0,
    };
  });
}

// --- Component ---

export default function ImportDataModal({ isOpen, onClose, departments, onImportConfirm }) {
  // File & sheet state
  const [file, setFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [validSheets, setValidSheets] = useState([]); // [{ name, rowCount }]
  const [selectedSheet, setSelectedSheet] = useState('');

  // Import config state
  const [selectedDept, setSelectedDept] = useState('');
  const [initialBnCu, setInitialBnCu] = useState(0);

  // Preview state
  const [previewData, setPreviewData] = useState([]);
  const [hasParseError, setHasParseError] = useState(false);
  const [hasNegativeError, setHasNegativeError] = useState(false);

  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [successCount, setSuccessCount] = useState(0); // sheets imported this session

  const hasPreviousDBRecordRef = useRef(false);

  // Reset all state on close
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setWorkbook(null);
      setValidSheets([]);
      setSelectedSheet('');
      setSelectedDept('');
      setInitialBnCu(0);
      setPreviewData([]);
      setHasParseError(false);
      setHasNegativeError(false);
      setError(null);
      setSuccessCount(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Step 1: File upload → detect valid sheets ──────────────────────────────

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Reset preview when new file is loaded
    setPreviewData([]);
    setSelectedSheet('');
    setSelectedDept('');
    setError(null);
    setSuccessCount(0);
    setFile(selectedFile);

    setIsProcessing(true);
    try {
      const data = await selectedFile.arrayBuffer();
      const wb = XLSX.read(data);
      setWorkbook(wb);

      const valid = wb.SheetNames.reduce((acc, name) => {
        const ws = wb.Sheets[name];
        const json = XLSX.utils.sheet_to_json(ws, { defval: 0 });
        const validRows = json.filter(rowIsValid);
        if (validRows.length > 0) {
          acc.push({ name, rowCount: validRows.length });
        }
        return acc;
      }, []);

      setValidSheets(valid);

      if (valid.length === 0) {
        setError('Không tìm thấy sheet nào có dữ liệu hợp lệ (cần cột Ngày + VaoVien).');
      } else if (valid.length === 1) {
        setSelectedSheet(valid[0].name); // auto-select if only one
      }
    } catch (err) {
      setError(err.message || 'Lỗi đọc file Excel.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Step 2: Generate preview for selected sheet + dept ─────────────────────

  const handlePreview = async () => {
    if (!workbook || !selectedSheet || !selectedDept) return;

    setIsProcessing(true);
    setError(null);
    setHasParseError(false);
    setHasNegativeError(false);
    setPreviewData([]);

    try {
      const ws = workbook.Sheets[selectedSheet];
      const json = XLSX.utils.sheet_to_json(ws, { defval: 0 });

      if (json.length === 0) throw new Error('Sheet này không có dữ liệu.');

      const parsedRows = parseSheetRows(json);
      const parseError = parsedRows.some(r => !r.isValidDate);
      setHasParseError(parseError);

      if (parseError) {
        setPreviewData(parsedRows);
        return;
      }

      parsedRows.sort((a, b) => a.date.localeCompare(b.date));

      // Get date range
      const minDateStr = parsedRows[0].date;
      const maxDateStr = parsedRows[parsedRows.length - 1].date;
      const minMinus1Str = format(subDays(new Date(minDateStr + 'T00:00:00'), 1), 'yyyy-MM-dd');

      // Fetch DB records around the date range
      const existingReports = await getReportsByDepartment(selectedDept, minMinus1Str, maxDateStr);
      const dbMap = new Map(existingReports.map(r => [r.date, r]));

      // Determine seed BN cũ
      let runningBnHienTai = 0;
      let hasPreviousDBRecord = false;

      if (dbMap.has(minMinus1Str)) {
        runningBnHienTai = dbMap.get(minMinus1Str).bnHienTai || 0;
        hasPreviousDBRecord = true;
      }

      hasPreviousDBRecordRef.current = hasPreviousDBRecord;

      const finalPreview = parsedRows.map((row, idx) => {
        const computedBnCu = idx === 0
          ? (hasPreviousDBRecord ? runningBnHienTai : Number(initialBnCu) || 0)
          : runningBnHienTai;

        const bnHienTai = computedBnCu + row.vaoVien + row.chuyenDen
          - row.chuyenDi - row.raVien - row.tuVong - row.chuyenVien;

        runningBnHienTai = bnHienTai;

        const existsInDb = dbMap.has(row.date);
        return {
          ...row,
          bnCu: computedBnCu,
          bnHienTai,
          hasNegative: bnHienTai < 0,
          existsInDb,
          status: bnHienTai < 0
            ? 'Lỗi: BN hiện tại âm'
            : existsInDb ? 'Đã tồn tại (Sẽ ghi đè)' : 'Thêm mới',
        };
      });

      setHasNegativeError(finalPreview.some(r => r.hasNegative));
      setPreviewData(finalPreview);
    } catch (err) {
      setError(err.message || 'Lỗi khi xử lý sheet.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Live-recalculate BN cũ when user changes initialBnCu (no DB re-fetch)
  const handleInitialBnCuChange = (newVal) => {
    setInitialBnCu(newVal);
    if (previewData.length > 0 && !hasPreviousDBRecordRef.current) {
      let running = 0;
      const updated = previewData.map((row, idx) => {
        const computedBnCu = idx === 0 ? (Number(newVal) || 0) : running;
        const bnHienTai = computedBnCu + row.vaoVien + row.chuyenDen
          - row.chuyenDi - row.raVien - row.tuVong - row.chuyenVien;
        running = bnHienTai;
        return {
          ...row,
          bnCu: computedBnCu,
          bnHienTai,
          hasNegative: bnHienTai < 0,
          status: bnHienTai < 0 ? 'Lỗi: BN hiện tại âm' : (row.existsInDb ? 'Đã tồn tại (Sẽ ghi đè)' : 'Thêm mới'),
        };
      });
      setHasNegativeError(updated.some(r => r.hasNegative));
      setPreviewData(updated);
    }
  };

  // ── Step 3: Confirm import ─────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (hasParseError || previewData.length === 0 || isProcessing) return;

    setIsProcessing(true);
    try {
      const recordsToImport = previewData.map(r => ({
        date: r.date,
        bnCu: r.bnCu,
        vaoVien: r.vaoVien,
        chuyenDen: r.chuyenDen,
        chuyenDi: r.chuyenDi,
        raVien: r.raVien,
        tuVong: r.tuVong,
        chuyenVien: r.chuyenVien,
        bnHienTai: r.bnHienTai,
      }));

      await onImportConfirm(selectedDept, recordsToImport);

      // ✅ Success → reset to selection state (keep file + workbook)
      setSuccessCount(c => c + 1);
      setSelectedDept('');
      setSelectedSheet(validSheets.length === 1 ? validSheets[0].name : '');
      setInitialBnCu(0);
      setPreviewData([]);
      setHasParseError(false);
      setHasNegativeError(false);
      setError(null);
    } catch (err) {
      setError(err.message || 'Lỗi lưu dữ liệu.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Step helpers (back to config from preview) ─────────────────────────────

  const handleBackToConfig = () => {
    setPreviewData([]);
    setHasParseError(false);
    setHasNegativeError(false);
    setError(null);
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      Ngay: '20260301', VaoVien: '5', ChuyenDen: '2',
      ChuyenDi: '1', RaVien: '3', TuVong: '0', ChuyenVien: '0',
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MauNhapLieu');
    XLSX.writeFile(wb, 'Template_NhapLieuHospitalStat.xlsx');
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const isInPreview = previewData.length > 0;
  const canPreview = !!selectedSheet && !!selectedDept && !!workbook && !isProcessing;
  const selectedSheetInfo = validSheets.find(s => s.name === selectedSheet);
  const dbSeeded = hasPreviousDBRecordRef.current && isInPreview;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-800">Import Số Liệu Hàng Ngày</h2>
          </div>
          <div className="flex items-center gap-3">
            {successCount > 0 && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium bg-emerald-50 px-3 py-1 rounded-full">
                <CheckCircle2 className="w-4 h-4" />
                Đã import {successCount} sheet
              </span>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">

          {/* ── STEP 1: File upload zone (always visible) ── */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              {file ? (
                <div className="flex items-center gap-2 text-slate-700">
                  <FileSpreadsheet className="w-4 h-4 text-teal-600 flex-shrink-0" />
                  <span className="font-medium text-sm truncate">{file.name}</span>
                  {validSheets.length > 0 && (
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {validSheets.length} sheet hợp lệ
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Chưa chọn file. Tải file Excel (.xlsx) để bắt đầu.</p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" onClick={handleDownloadTemplate} size="sm">
                <Download className="w-4 h-4 mr-1.5" /> Tải File Mẫu
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isProcessing}
                />
                <Button size="sm" disabled={isProcessing}>
                  <Upload className="w-4 h-4 mr-1.5" />
                  {isProcessing && !workbook ? 'Đang đọc...' : (file ? 'Đổi File' : 'Chọn File')}
                </Button>
              </div>
            </div>
          </div>

          {/* ── STEP 2: Config (sheet + khoa) — shown once file is loaded ── */}
          {workbook && validSheets.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cấu hình Import</span>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">

                {/* Sheet selector */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Sheet dữ liệu <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                    value={selectedSheet}
                    onChange={e => {
                      setSelectedSheet(e.target.value);
                      setPreviewData([]);
                      setError(null);
                    }}
                    disabled={isInPreview}
                  >
                    <option value="">-- Chọn Sheet --</option>
                    {validSheets.map(s => (
                      <option key={s.name} value={s.name}>
                        {s.name} ({s.rowCount} dòng)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Khoa selector */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Khoa nhập liệu <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                    value={selectedDept}
                    onChange={e => {
                      setSelectedDept(e.target.value);
                      setPreviewData([]);
                      setError(null);
                    }}
                    disabled={isInPreview}
                  >
                    <option value="">-- Chọn Khoa --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* BN cũ ban đầu */}
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    title="Chỉ dùng khi hệ thống chưa có dữ liệu của ngày trước ngày đầu tiên trong file"
                  >
                    <span className={dbSeeded ? 'text-slate-400 line-through' : 'text-slate-700'}>
                      BN cũ ban đầu
                    </span>
                    {dbSeeded && (
                      <span className="ml-2 text-xs text-teal-600 font-normal no-underline" style={{textDecoration:'none'}}>
                        (lấy từ DB tự động)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${
                      dbSeeded ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-200 bg-white'
                    }`}
                    value={initialBnCu}
                    onChange={e => handleInitialBnCuChange(e.target.value)}
                    disabled={dbSeeded}
                  />
                </div>
              </div>

              {/* Preview trigger */}
              {!isInPreview && (
                <div className="px-4 pb-4">
                  <Button
                    onClick={handlePreview}
                    disabled={!canPreview}
                    isLoading={isProcessing}
                    className="w-full sm:w-auto"
                  >
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Xem trước dữ liệu
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* No valid sheets warning */}
          {workbook && validSheets.length === 0 && !isProcessing && (
            <div className="p-4 bg-amber-50 border border-amber-100 text-amber-700 rounded-lg flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Không có sheet hợp lệ</p>
                <p>File Excel phải có cột <strong>Ngày</strong> (định dạng YYYYMMDD) và ít nhất 1 cột số liệu.</p>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-lg flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Lỗi</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Hướng dẫn khi chưa có file */}
          {!file && !error && (
            <div className="text-sm text-blue-700 bg-blue-50/60 p-4 rounded-lg border border-blue-100">
              <p className="font-semibold text-blue-800 mb-2">Hướng dẫn Import:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Tải file mẫu, điền dữ liệu. Cột <strong>Ngày</strong> bắt buộc định dạng <strong>YYYYMMDD</strong> (VD: 20260321).</li>
                <li>File <strong>KHÔNG CẦN</strong> cột BN cũ — hệ thống tự tính theo mốc DB hoặc giá trị bạn khai báo.</li>
                <li>Hệ thống tự nhận diện các sheet có dữ liệu hợp lệ để bạn chọn.</li>
                <li>Sau mỗi lần import, bạn có thể tiếp tục import sheet/khoa khác mà không cần tải lại file.</li>
              </ul>
            </div>
          )}

          {/* ── STEP 3: Preview table ── */}
          {isInPreview && (
            <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBackToConfig}
                    className="text-slate-500 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors"
                    title="Quay lại chọn sheet/khoa"
                  >
                    <RotateCcw size={15} />
                  </button>
                  <h3 className="font-semibold text-slate-700 text-sm">
                    Xem trước — Sheet: <span className="text-teal-700">{selectedSheet}</span>
                    {' · '}
                    Khoa: <span className="text-teal-700">{departments.find(d => d.id === selectedDept)?.name}</span>
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  {hasNegativeError && (
                    <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {previewData.filter(r => r.hasNegative).length} dòng BN âm
                    </span>
                  )}
                  <span className="text-xs text-slate-500">{previewData.length} dòng dữ liệu</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Dòng</th>
                      <th className="px-3 py-2">Ngày</th>
                      <th className="px-3 py-2 text-right text-slate-600">
                        BN Cũ<br /><span className="text-[10px] font-normal normal-case">(Tự tính)</span>
                      </th>
                      <th className="px-3 py-2 text-right">Vào</th>
                      <th className="px-3 py-2 text-right">Đến</th>
                      <th className="px-3 py-2 text-right">Đi</th>
                      <th className="px-3 py-2 text-right">Ra</th>
                      <th className="px-3 py-2 text-right">Tử</th>
                      <th className="px-3 py-2 text-right">Chuyển</th>
                      <th className="px-3 py-2 text-right text-teal-600">BN Hiện Tại</th>
                      <th className="px-3 py-2">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map(row => (
                      <tr
                        key={row._index}
                        className={`border-b border-slate-100 hover:bg-slate-50 ${
                          !row.isValidDate ? 'bg-red-50 hover:bg-red-50'
                            : row.hasNegative ? 'bg-red-50 hover:bg-red-100'
                            : row.existsInDb ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-slate-400 text-xs">#{row._index}</td>
                        <td className="px-3 py-2 font-medium text-xs">
                          {row.isValidDate
                            ? format(new Date(row.date), 'dd/MM/yyyy')
                            : <span className="text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded">Lỗi: {row.rawDate}</span>
                          }
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-600 bg-slate-50 text-xs">{row.bnCu}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{row.vaoVien}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{row.chuyenDen}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{row.chuyenDi}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{row.raVien}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{row.tuVong}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{row.chuyenVien}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-bold text-xs ${
                          row.hasNegative ? 'text-red-600 bg-red-100' : 'text-teal-600 bg-teal-50'
                        }`}>
                          {row.bnHienTai}{row.hasNegative && ' ⚠️'}
                        </td>
                        <td className={`px-3 py-2 text-xs font-medium whitespace-nowrap ${
                          row.hasNegative ? 'text-red-600'
                            : row.existsInDb ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {row.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-3 rounded-b-xl">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Đóng
          </Button>
          {isInPreview && (
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleBackToConfig} disabled={isProcessing}>
                <RotateCcw className="w-4 h-4 mr-1.5" /> Quay lại
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={hasParseError || hasNegativeError || isProcessing}
                isLoading={isProcessing}
              >
                {hasParseError ? 'Sửa Lỗi File Excel Trước'
                  : hasNegativeError ? 'Sửa Dữ Liệu Âm Trước'
                  : 'Xác Nhận Import'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
