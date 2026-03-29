import { useMemo } from 'react';
import { formatDisplayDate } from '@/utils/dateUtils';
import { Loader2, FileX } from 'lucide-react';

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

// Long-text fields that need truncation
const LONG_TEXT_IDS = new Set(['chanDoanVao', 'chanDoanTuVong', 'dienBien', 'tomTatCLS', 'ghiChu']);

export default function DeathListPanel({ reports, loading, columns }) {
  const cols = columns || DEFAULT_COLUMNS;

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
                colSpan={cols.length}
                className="px-3 py-2.5 text-slate-500 text-xs bg-slate-100/95 backdrop-blur"
              >
                {stats.totalDays} ngày · {stats.totalDepts} khoa
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
