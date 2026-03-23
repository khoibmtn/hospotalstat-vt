export const ROLES = {
  ADMIN: 'admin',
  KEHOACH: 'kehoach',
  KHOA: 'khoa',
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Quản trị viên',
  [ROLES.KEHOACH]: 'Kế hoạch tổng hợp',
  [ROLES.KHOA]: 'Khoa',
};

export const POSITIONS = [
  'Lãnh đạo BV',
  'Trưởng khoa/phòng',
  'Phó trưởng khoa/phòng',
  'Nhân viên',
];

export const TITLES = [
  'Bác sĩ',
  'Điều dưỡng/KTV',
  'Khác',
];

export const REPORT_STATUS = {
  OPEN: 'open',
  LOCKED: 'locked',
};

export const EMAIL_DOMAIN = 'hospitalstat.local';

export const INPATIENT_FIELDS = [
  { key: 'bnCu', label: 'BN cũ', editable: false, tooltip: 'Tự động từ ngày trước' },
  { key: 'vaoVien', label: 'Vào viện', editable: true },
  { key: 'chuyenDen', label: 'Chuyển đến', editable: true },
  { key: 'chuyenDi', label: 'Chuyển đi', editable: true },
  { key: 'raVien', label: 'Ra viện', editable: true },
  { key: 'tuVong', label: 'Tử vong', editable: true },
  { key: 'chuyenVien', label: 'Chuyển viện', editable: true },
  { key: 'bnHienTai', label: 'BN hiện tại', editable: false, computed: true },
];

export const DEFAULT_SETTINGS = {
  hospitalName: '',
  autoLockEnabled: true,
  autoLockHour: 8,
  requireApproval: false,
  activeCategories: ['inpatient'],
};

export const DEFAULT_INPATIENT_VALUES = {
  vaoVien: 0,
  chuyenDen: 0,
  chuyenDi: 0,
  raVien: 0,
  tuVong: 0,
  chuyenVien: 0,
};


