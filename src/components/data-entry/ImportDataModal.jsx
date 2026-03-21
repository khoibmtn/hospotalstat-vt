import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Upload, Download, AlertCircle, CheckCircle2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parse, isValid, format, subDays } from 'date-fns';
import { getReportsByDepartment } from '../../services/reportService';
import { DEFAULT_INPATIENT_VALUES } from '../../utils/constants';

export default function ImportDataModal({ isOpen, onClose, departments, onImportConfirm }) {
  const [selectedDept, setSelectedDept] = useState('');
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [hasParseError, setHasParseError] = useState(false);
  const [initialBnCu, setInitialBnCu] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setSelectedDept('');
      setFile(null);
      setPreviewData([]);
      setError(null);
      setHasParseError(false);
      setInitialBnCu(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        Ngay: '20260301',
        VaoVien: '5',
        ChuyenDen: '2',
        ChuyenDi: '1',
        RaVien: '3',
        TuVong: '0',
        ChuyenVien: '0'
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MauNhapLieu");
    XLSX.writeFile(wb, "Template_NhapLieuHospitalStat.xlsx");
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      processFile(selectedFile, selectedDept);
    }
  };

  const processFile = async (inputFile, deptId) => {
    if (!deptId) {
      setError('Vui lòng chọn Khoa trước khi tải file.');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setHasParseError(false);

    try {
      const data = await inputFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: 0 });

      if (json.length === 0) {
        throw new Error("File Excel không có dữ liệu.");
      }

      // 1. Parse dates and identify min/max dates
      let minDateStr = '9999-99-99';
      let maxDateStr = '0000-00-00';
      let parseError = false;

      const parsedRows = json.map((row, index) => {
        let rawDate = row.Ngay || row['Ngày'];
        let dateStr = '';
        let isValidDate = false;

        if (rawDate) {
          // Convert Excel serial date or string to YYYYMMDD string format reliably
          let stringDate = rawDate.toString().trim();
          
          if (stringDate.length === 8 && !isNaN(stringDate)) {
             // It's already YYYYMMDD
             const parsed = parse(stringDate, 'yyyyMMdd', new Date());
             if (isValid(parsed)) {
               dateStr = format(parsed, 'yyyy-MM-dd');
               isValidDate = true;
             }
          }
        }

        if (!isValidDate) parseError = true;
        if (isValidDate && dateStr < minDateStr) minDateStr = dateStr;
        if (isValidDate && dateStr > maxDateStr) maxDateStr = dateStr;

        return {
          _index: index + 2, // excel row number (assuming 1 header row)
          date: dateStr,
          rawDate: rawDate,
          isValidDate,
          vaoVien: Number(row.VaoVien || row['Vào viện']) || 0,
          chuyenDen: Number(row.ChuyenDen || row['Chuyển đến']) || 0,
          chuyenDi: Number(row.ChuyenDi || row['Chuyển đi']) || 0,
          raVien: Number(row.RaVien || row['Ra viện']) || 0,
          tuVong: Number(row.TuVong || row['Tử vong']) || 0,
          chuyenVien: Number(row.ChuyenVien || row['Chuyển viện']) || 0
        };
      });

      setHasParseError(parseError);

      if (parseError) {
        setPreviewData(parsedRows);
        setIsProcessing(false);
        return;
      }

      // Sort rows chronologically
      parsedRows.sort((a, b) => a.date.localeCompare(b.date));

      // 2. Fetch DB data to compare and calculate bnCu
      const minDateObj = new Date(minDateStr + 'T00:00:00');
      const minMinus1Str = format(subDays(minDateObj, 1), 'yyyy-MM-dd');
      
      const existingReports = await getReportsByDepartment(deptId, minMinus1Str, maxDateStr);
      const dbMap = new Map();
      existingReports.forEach(r => dbMap.set(r.date, r));

      // 3. Sequential calculate
      let runningBnHienTai = 0;
      let hasPreviousDBRecord = false;

      if (dbMap.has(minMinus1Str)) {
        runningBnHienTai = dbMap.get(minMinus1Str).bnHienTai || 0;
        hasPreviousDBRecord = true;
      }

      const finalPreview = parsedRows.map((row, idx) => {
        let computedBnCu = 0;

        if (idx === 0) {
          if (hasPreviousDBRecord) {
            computedBnCu = runningBnHienTai;
          } else {
            // No DB record before this, use the manually provided initialBnCu
            computedBnCu = Number(initialBnCu) || 0;
          }
        } else {
          computedBnCu = runningBnHienTai;
        }

        const bnHienTai = computedBnCu + row.vaoVien + row.chuyenDen - row.chuyenDi - row.raVien - row.tuVong - row.chuyenVien;
        runningBnHienTai = bnHienTai;

        const existsInDb = dbMap.has(row.date);
        const dbData = existsInDb ? dbMap.get(row.date) : null;

        return {
          ...row,
          bnCu: computedBnCu,
          bnHienTai,
          existsInDb,
          dbData,
          status: existsInDb ? 'Đã tồn tại (Sẽ ghi đè)' : 'Thêm mới'
        };
      });

      setPreviewData(finalPreview);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Lỗi khi đọc file Excel.');
    } finally {
      setIsProcessing(false);
    }
  };

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
        bnHienTai: r.bnHienTai
      }));

      await onImportConfirm(selectedDept, recordsToImport);
    } catch (err) {
      setError(err.message || 'Lỗi lưu dữ liệu.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Import Số Liệu Hàng Ngày</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {/* Controls */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 w-full max-w-xs">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Khoa nhập liệu <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setFile(null);
                  setPreviewData([]);
                  setError(null);
                }}
              >
                <option value="">-- Chọn Khoa --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 w-full max-w-[200px]">
              <label className="block text-sm font-medium text-slate-700 mb-1" title="Chỉ dùng khi hệ thống chưa có dữ liệu của ngày hôm trước trong DB">
                Bệnh nhân cũ ban đầu
              </label>
              <input
                type="number"
                min="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                value={initialBnCu}
                onChange={(e) => {
                  setInitialBnCu(e.target.value);
                  // Reprocess if file already uploaded to reflect changes
                  if (file && selectedDept) {
                    processFile(file, selectedDept);
                  }
                }}
              />
            </div>

            <div className="flex gap-3 items-end">
              <Button variant="outline" onClick={handleDownloadTemplate} icon={Download}>
                Tải File Mẫu
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  disabled={!selectedDept || isProcessing}
                />
                <Button 
                  disabled={!selectedDept || isProcessing}
                  icon={Upload}
                >
                  {isProcessing ? 'Đang xử lý...' : (file ? file.name : 'Chọn File Excel')}
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Lỗi Import</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Guidelines */}
          {previewData.length === 0 && !error && (
            <div className="text-sm text-slate-500 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              <p className="font-semibold text-blue-800 mb-2">Hướng dẫn Import:</p>
              <ul className="list-disc pl-5 space-y-1 text-blue-700">
                <li>Chọn Khoa cần import trước.</li>
                <li>Tải file mẫu về và điền dữ liệu. Cột <strong>Ngày</strong> bắt buộc phải nhập định dạng <strong>YYYYMMDD</strong> (VD: 20260321). File mẫu <strong>KHÔNG CẦN</strong> cột Bệnh nhân cũ vì hệ thống sẽ tự động tính.</li>
                <li>Hệ thống <strong>tự động tính toán</strong> Bệnh nhân Cũ qua từng ngày dựa vào dữ liệu có sẵn. Nếu import ngày đầu tiên mà hệ thống chưa có dữ liệu mốc, nó sẽ sử dụng <strong>Số Bệnh nhân cũ ban đầu</strong> bạn nhập ở ô phía trên.</li>
              </ul>
            </div>
          )}

          {/* Preview Table */}
          {previewData.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-semibold text-slate-700">Bản Xem Trước (Preview)</h3>
                <span className="text-sm text-slate-500">Tìm thấy {previewData.length} dòng dữ liệu hợp lệ</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Dòng Excel</th>
                      <th className="px-3 py-2">Ngày</th>
                      <th className="px-3 py-2 text-right text-slate-600">BN Cũ<br/><span className="text-[10px] font-normal">(Tự tính)</span></th>
                      <th className="px-3 py-2 text-right">Vào</th>
                      <th className="px-3 py-2 text-right">Đến</th>
                      <th className="px-3 py-2 text-right">Đi</th>
                      <th className="px-3 py-2 text-right">Ra</th>
                      <th className="px-3 py-2 text-right">Tử</th>
                      <th className="px-3 py-2 text-right">Chuyển</th>
                      <th className="px-3 py-2 text-right text-teal-600">BN Hiện Tại</th>
                      <th className="px-3 py-2 whitespace-nowrap">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row) => (
                      <tr key={row._index} className={`border-b border-slate-100 hover:bg-slate-50 ${!row.isValidDate ? 'bg-red-50 hover:bg-red-50' : (row.existsInDb ? 'bg-amber-50/30' : '')}`}>
                        <td className="px-3 py-2 text-slate-400">#{row._index}</td>
                        <td className="px-3 py-2 font-medium">
                          {row.isValidDate ? format(new Date(row.date), 'dd/MM/yyyy') : <span className="text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded">Lỗi: {row.rawDate}</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-600 bg-slate-50">{row.bnCu}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.vaoVien}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.chuyenDen}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.chuyenDi}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.raVien}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.tuVong}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.chuyenVien}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-teal-600 bg-teal-50">{row.bnHienTai}</td>
                        <td className={`px-3 py-2 text-xs font-medium whitespace-nowrap ${row.existsInDb ? 'text-amber-600' : 'text-emerald-600'}`}>
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

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Hủy Bỏ
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={previewData.length === 0 || hasParseError || isProcessing}
            isLoading={isProcessing}
            className={hasParseError ? "opacity-50 cursor-not-allowed" : ""}
          >
            {hasParseError ? 'Sửa Lỗi File Excel Trước' : 'Xác Nhận Import'}
          </Button>
        </div>
      </div>
    </div>
  );
}
