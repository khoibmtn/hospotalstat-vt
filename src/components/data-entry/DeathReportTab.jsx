import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Edit2, Trash2, Calendar, FileX, AlertCircle, ChevronDown } from 'lucide-react';
import { formatDisplayDate } from '@/utils/dateUtils';
import { isFilledRow } from '@/utils/validation';

const DEFAULT_DEATH_REPORT_COLUMNS = [
  { id: 'maKCB', label: 'Mã KCB', type: 'text', isFixed: true, isCore: true },
  { id: 'hoTen', label: 'Họ tên', type: 'text', isFixed: true, isCore: true },
  { id: 'namSinh', label: 'Năm sinh', type: 'text', isFixed: false, isCore: true },
  { id: 'timeVaoVien', label: 'Ngày giờ vào viện', type: 'datetime', isFixed: false, isCore: true },
  { id: 'timeTuVong', label: 'Ngày giờ tử vong', type: 'datetime', isFixed: false, isCore: true },
  { id: 'chanDoanVao', label: 'CĐ vào viện', type: 'text', isFixed: false, isCore: true },
  { id: 'chanDoanTuVong', label: 'CĐ tử vong', type: 'text', isFixed: false, isCore: true },
  { id: 'dienBien', label: 'Diễn biến lâm sàng', type: 'text', isFixed: false, isCore: false },
  { id: 'tomTatCLS', label: 'Tóm tắt CLS', type: 'text', isFixed: false, isCore: false },
  { id: 'ghiChu', label: 'Ghi chú', type: 'text', isFixed: false, isCore: false },
];

export default function DeathReportTab({
  monthReports,
  setMonthReports,
  detailDate,
  selectedDeptId,
  settings,
  handleAutoSaveRow
}) {
  const { user } = useAuth();
  const columns = settings?.deathReportColumns || DEFAULT_DEATH_REPORT_COLUMNS;

  const [editingCase, setEditingCase] = useState(null);
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null); // { dateStr, index }

  const activeDays = useMemo(() => {
    if (!monthReports) return [];
    return Object.keys(monthReports).sort().map(dateStr => {
      const rep = monthReports[dateStr];
      const tuVong = rep?.tuVong || 0;
      const deathCases = rep?.deathCases || [];
      const filledRows = deathCases.filter(isFilledRow).length;
      return {
        dateStr,
        tuVong,
        deathCases,
        filledRows,
        isValid: tuVong <= filledRows,
        isActive: tuVong > 0 || filledRows > 0,
        slotCount: Math.max(tuVong, filledRows)
      };
    }).filter(d => d.isActive);
  }, [monthReports]);

  // Auto-expand error days on first render
  useState(() => {
    const errorDays = activeDays.filter(d => !d.isValid).map(d => d.dateStr);
    if (errorDays.length > 0) {
      setExpandedDays(new Set(errorDays));
    }
  });

  const toggleDay = (dateStr) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  const handleEditCase = (dateStr, index, existingData) => {
    setEditingCase({ dateStr, index, data: { ...existingData } });
  };

  const handleSaveModal = () => {
    if (!editingCase) return;
    const { dateStr, index, data } = editingCase;
    
    setMonthReports((prev) => {
      const rep = prev[dateStr] || {};
      const newCases = [...(rep.deathCases || [])];
      while (newCases.length <= index) {
        newCases.push({});
      }
      newCases[index] = data;
      return {
        ...prev,
        [dateStr]: {
          ...rep,
          deathCases: newCases
        }
      };
    });
    
    handleAutoSaveRow(dateStr);
    setEditingCase(null);
  };

  const requestClearRow = (dateStr, index) => {
    setConfirmDelete({ dateStr, index });
  };

  const handleClearRow = () => {
    if (!confirmDelete) return;
    const { dateStr, index } = confirmDelete;
    setMonthReports((prev) => {
      const rep = prev[dateStr] || {};
      const newCases = [...(rep.deathCases || [])];
      if (newCases[index]) {
        newCases[index] = {};
      }
      return {
        ...prev,
        [dateStr]: {
          ...rep,
          deathCases: newCases
        }
      };
    });
    handleAutoSaveRow(dateStr);
    setConfirmDelete(null);
  };

  if (activeDays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 h-full bg-slate-50">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <FileX className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-xl font-semibold text-slate-800 mb-2">Không có ca tử vong</h3>
        <p className="text-slate-500 max-w-sm text-center">Chưa có ngày nào trong tháng này ghi nhận số ca bệnh nhân tử vong (Tử vong &gt; 0) hoặc được nhập liệu danh sách.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 p-4 relative h-full">
      <div className="space-y-4 max-w-7xl mx-auto">
        {activeDays.map(({ dateStr, tuVong, deathCases, filledRows, isValid, slotCount }) => {
          const isOpen = expandedDays.has(dateStr);
          return (
            <div key={dateStr} className={`bg-white border rounded-lg shadow-sm overflow-hidden ${!isValid ? 'border-red-200' : 'border-slate-200'}`}>
              {/* Collapsible header */}
              <button
                type="button"
                onClick={() => toggleDay(dateStr)}
                className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${!isValid ? 'bg-red-50/50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-md ${isValid ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'}`}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-semibold text-base text-slate-800">
                      Ngày {formatDisplayDate(dateStr)}
                    </span>
                    {!isValid && (
                      <span className="text-xs text-red-600 flex items-center font-medium">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Danh sách chưa nhập đủ
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col text-right">
                    <span className="text-sm font-medium text-slate-700">Chỉ tiêu: {tuVong} ca</span>
                    <span className={`text-xs font-semibold ${isValid ? 'text-emerald-600' : 'text-red-500'}`}>Đã nhập: {filledRows} ca</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>
              
              {/* Collapsible content */}
              {isOpen && (
                <div className="border-t">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-600 border-b shadow-sm">
                        <tr>
                          <th className="px-3 py-3 font-semibold w-12 text-center sticky left-0 bg-slate-50 z-10 border-r border-slate-200">STT</th>
                          {columns.map(col => (
                            <th key={col.id} className="px-3 py-3 font-semibold whitespace-nowrap min-w-[120px] max-w-[200px] border-r border-slate-200">
                              {col.label} {col.isCore && <span className="text-red-500" title="Trường Core">*</span>}
                            </th>
                          ))}
                          <th className="px-3 py-3 font-semibold w-24 text-center bg-slate-50 sticky right-0 z-10 border-l border-slate-200">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Array.from({ length: slotCount }).map((_, index) => {
                          const rowData = deathCases[index] || {};
                          const isFilled = isFilledRow(rowData);
                          return (
                            <tr key={index} className={`hover:bg-blue-50/50 transition-colors group ${!isFilled && index < tuVong ? 'bg-red-50/30' : ''}`}>
                              <td className="px-3 py-2 text-center text-slate-500 font-medium sticky left-0 bg-white group-hover:bg-blue-50/50 border-r border-slate-200 z-10">
                                {index + 1}
                              </td>
                              {columns.map(col => (
                                <td key={col.id} className="px-3 py-2 border-r border-slate-100 truncate max-w-[200px]" title={rowData[col.id] || ''}>
                                  {rowData[col.id] ? (
                                    <span className="text-slate-900 line-clamp-2">{rowData[col.id]}</span>
                                  ) : (
                                    <span className="text-slate-300 italic">...</span>
                                  )}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-center bg-white group-hover:bg-blue-50/50 sticky right-0 z-10 border-l border-slate-200">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-700 hover:text-white hover:bg-blue-600" onClick={() => handleEditCase(dateStr, index, rowData)}>
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  {isFilled && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-white hover:bg-red-600" onClick={() => requestClearRow(dateStr, index)}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Entry Modal */}
      {editingCase && (
        <Dialog open={!!editingCase} onOpenChange={(open) => !open && setEditingCase(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">
                Cập nhật CA {editingCase.index + 1} - Ngày {formatDisplayDate(editingCase.dateStr)}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              {columns.map(col => (
                <div key={col.id} className={`space-y-1 ${col.type === 'text' && ['dienBien', 'tomTatCLS', 'ghiChu'].includes(col.id) ? 'md:col-span-2' : ''}`}>
                  <Label className="text-sm font-medium text-slate-700 flex items-center">
                    {col.label} {col.isCore && <span className="text-red-500 ml-1" title="Bắt buộc">*</span>}
                  </Label>
                  {['dienBien', 'tomTatCLS'].includes(col.id) ? (
                    <textarea
                      value={editingCase.data[col.id] || ''}
                      onChange={(e) => {
                        setEditingCase(prev => ({
                          ...prev,
                          data: { ...prev.data, [col.id]: e.target.value }
                        }));
                      }}
                      placeholder={`Nhập ${col.label.toLowerCase()}...`}
                      rows={col.id === 'dienBien' ? 6 : 4}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 resize-y"
                    />
                  ) : (
                    <Input
                      type={col.type === 'datetime' ? 'datetime-local' : 'text'}
                      value={editingCase.data[col.id] || ''}
                      onChange={(e) => {
                        setEditingCase(prev => ({
                          ...prev,
                          data: { ...prev.data, [col.id]: e.target.value }
                        }));
                      }}
                      placeholder={`Nhập ${col.label.toLowerCase()}...`}
                      className="w-full focus-visible:ring-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2 pt-4 border-t border-slate-100">
              <DialogClose asChild>
                <Button variant="outline">Hủy</Button>
              </DialogClose>
              <Button onClick={handleSaveModal} className="bg-blue-600 hover:bg-blue-700 text-white">Lưu & Đóng</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg text-red-700">
                <AlertCircle className="w-5 h-5" />
                Xác nhận xóa dòng
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600 py-2">
              Bạn có chắc muốn <strong>xóa trắng</strong> dòng CA {confirmDelete.index + 1} ngày {formatDisplayDate(confirmDelete.dateStr)}? Lỗ hổng sẽ được tự động lấp khi lưu.
            </p>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>Hủy</Button>
              <Button onClick={handleClearRow} className="bg-red-600 hover:bg-red-700 text-white">Xóa trắng</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
