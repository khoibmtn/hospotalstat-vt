import { useState, useMemo } from 'react';
import { formatDisplayDate } from '@/utils/dateUtils';
import { Loader2, FileX, Eye, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const DEFAULT_COLUMNS = [
  { id: 'maKCB', label: 'Mã KCB', type: 'text' },
  { id: 'hoTen', label: 'Họ tên', type: 'text' },
  { id: 'namSinh', label: 'Năm sinh', type: 'text' },
  { id: 'timeVaoVien', label: 'Ngày giờ vào viện', type: 'datetime' },
  { id: 'timeTuVong', label: 'Ngày giờ tử vong', type: 'datetime' },
  { id: 'chanDoanVao', label: 'CĐ vào viện', type: 'text' },
  { id: 'chanDoanTuVong', label: 'CĐ tử vong', type: 'text' },
  { id: 'dienBien', label: 'Diễn biến lâm sàng', type: 'text' },
  { id: 'tomTatCLS', label: 'Tóm tắt CLS', type: 'text' },
  { id: 'ghiChu', label: 'Ghi chú', type: 'text' },
];

// Long-text fields that need truncation in table and textarea in dialog
const LONG_TEXT_IDS = new Set(['chanDoanVao', 'chanDoanTuVong', 'dienBien', 'tomTatCLS', 'ghiChu']);
const WIDE_TEXT_IDS = new Set(['dienBien', 'tomTatCLS', 'ghiChu']);

export default function DeathListPanel({ reports, loading, columns }) {
  const cols = columns || DEFAULT_COLUMNS;
  const [viewingCase, setViewingCase] = useState(null);

  // Build flat list: filter reports with deathCases, flatten, sort
  const rows = useMemo(() => {
    if (!reports || reports.length === 0) return [];

    const flat = [];
    reports.forEach((r) => {
      if (!r.deathCases || r.deathCases.length === 0) return;
      r.deathCases.forEach((dc, idx) => {
        // Skip empty slots
        const hasData = Object.values(dc).some((v) => v !== '' && v !== undefined && v !== null);
        if (!hasData) return;
        flat.push({
          date: r.date,
          departmentName: r.departmentName || '',
          caseIndex: idx,
          ...dc,
        });
      });
    });

    // Sort: date asc → departmentName → caseIndex
    flat.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.departmentName !== b.departmentName) return a.departmentName.localeCompare(b.departmentName);
      return a.caseIndex - b.caseIndex;
    });

    return flat;
  }, [reports]);

  // Summary stats
  const stats = useMemo(() => {
    const uniqueDates = new Set(rows.map((r) => r.date));
    const uniqueDepts = new Set(rows.map((r) => r.departmentName));
    return {
      totalCases: rows.length,
      totalDays: uniqueDates.size,
      totalDepts: uniqueDepts.size,
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Đang tải dữ liệu...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <FileX className="w-8 h-8 text-slate-400" />
        </div>
        <p className="font-medium text-slate-600">Không có ca tử vong</p>
        <p className="text-sm mt-1">Không có ca tử vong nào trong khoảng thời gian đã chọn.</p>
      </div>
    );
  }

  // Running STT counter
  let stt = 0;

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">
          Danh sách tử vong
        </h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{stats.totalCases} ca</span>
          <span>·</span>
          <span>{stats.totalDays} ngày</span>
          <span>·</span>
          <span>{stats.totalDepts} khoa</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-xs text-slate-600 uppercase bg-slate-50/95 backdrop-blur sticky top-0 z-20 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2.5 font-semibold border-r border-slate-200 text-center w-12 bg-slate-50">STT</th>
              <th className="px-3 py-2.5 font-semibold border-r border-slate-200 min-w-[90px] bg-slate-50">Ngày</th>
              <th className="px-3 py-2.5 font-semibold border-r border-slate-200 min-w-[100px] bg-slate-50">Khoa</th>
              {cols.map((col) => (
                <th
                  key={col.id}
                  className={`px-3 py-2.5 font-semibold border-r border-slate-200 whitespace-nowrap bg-slate-50 ${
                    LONG_TEXT_IDS.has(col.id) ? 'min-w-[140px] max-w-[200px]' : 'min-w-[100px]'
                  }`}
                >
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-2.5 font-semibold border-r border-slate-200 w-14 text-center bg-slate-50 sticky right-0 z-10 border-l" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => {
              stt++;
              return (
                <tr
                  key={`${row.date}-${row.departmentName}-${row.caseIndex}`}
                  className="group bg-white even:bg-slate-50/50 hover:bg-blue-50/50 transition-colors"
                >
                  <td className="px-3 py-2 text-center text-slate-500 font-medium border-r border-slate-200 text-xs">
                    {stt}
                  </td>
                  <td className="px-3 py-2 border-r border-slate-200 text-slate-700 whitespace-nowrap text-xs">
                    {formatDisplayDate(row.date)}
                  </td>
                  <td className="px-3 py-2 border-r border-slate-200 text-slate-700 text-xs whitespace-nowrap">
                    {row.departmentName}
                  </td>
                  {cols.map((col) => {
                    const val = row[col.id] || '';
                    const isLong = LONG_TEXT_IDS.has(col.id);
                    return (
                      <td
                        key={col.id}
                        className={`px-3 py-2 border-r border-slate-100 text-xs ${
                          isLong ? 'max-w-[200px] truncate' : ''
                        }`}
                        title={isLong ? val : undefined}
                      >
                        {val ? (
                          <span className="text-slate-900">{val}</span>
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center bg-white group-hover:bg-blue-50/50 sticky right-0 z-10 border-l border-slate-200">
                    <button
                      onClick={() => setViewingCase(row)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-pointer"
                      title="Xem chi tiết"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Total footer */}
          <tfoot>
            <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300 sticky bottom-0 z-20">
              <td
                colSpan={3}
                className="px-3 py-2.5 text-slate-800 uppercase text-xs bg-slate-100/95 backdrop-blur border-r border-slate-200"
              >
                Tổng cộng: {stats.totalCases} ca
              </td>
              <td
                colSpan={cols.length + 1}
                className="px-3 py-2.5 text-slate-500 text-xs bg-slate-100/95 backdrop-blur"
              >
                {stats.totalDays} ngày · {stats.totalDepts} khoa
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* View Detail Dialog */}
      {viewingCase && (
        <Dialog open={!!viewingCase} onOpenChange={(open) => !open && setViewingCase(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" />
                Chi tiết ca tử vong — {formatDisplayDate(viewingCase.date)}
              </DialogTitle>
              <p className="text-sm text-slate-500 mt-1">
                Khoa: <span className="font-medium text-slate-700">{viewingCase.departmentName}</span>
              </p>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              {cols.map(col => (
                <div key={col.id} className={`space-y-1 ${WIDE_TEXT_IDS.has(col.id) ? 'md:col-span-2' : ''}`}>
                  <Label className="text-sm font-medium text-slate-500">
                    {col.label}
                  </Label>
                  {WIDE_TEXT_IDS.has(col.id) || col.id === 'chanDoanVao' || col.id === 'chanDoanTuVong' ? (
                    <div className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 min-h-[60px] whitespace-pre-wrap">
                      {viewingCase[col.id] || <span className="text-slate-400 italic">Không có dữ liệu</span>}
                    </div>
                  ) : (
                    <Input
                      type={col.type === 'datetime' ? 'datetime-local' : 'text'}
                      value={viewingCase[col.id] || ''}
                      disabled
                      className="w-full bg-slate-50 text-slate-900 disabled:opacity-100 disabled:cursor-default"
                    />
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
