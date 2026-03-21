/**
 * Initial seed data for 2 facilities + 19 departments
 */
export const SEED_FACILITIES = [
  { id: 'cs1', name: 'Cơ sở 1', order: 1 },
  { id: 'cs2', name: 'Cơ sở 2', order: 2 },
];

export const SEED_DEPARTMENTS = [
  // Cơ sở 1 — 14 departments
  { id: 'noi1', name: 'Nội 1', facilityId: 'cs1', order: 1 },
  { id: 'noi2', name: 'Nội 2', facilityId: 'cs1', order: 2 },
  { id: 'noi3', name: 'Nội 3', facilityId: 'cs1', order: 3 },
  { id: 'ttbvsk_lk', name: 'TTBVSK+LK', facilityId: 'cs1', order: 4 },
  { id: 'noi_cxk', name: 'Nội CXK', facilityId: 'cs1', order: 5 },
  { id: 'than_kinh', name: 'Thần kinh', facilityId: 'cs1', order: 6 },
  { id: 'dot_quy', name: 'Đột quỵ', facilityId: 'cs1', order: 7 },
  { id: 'tim_mach', name: 'Tim mạch', facilityId: 'cs1', order: 8 },
  { id: 'cttm', name: 'CTTM', facilityId: 'cs1', order: 9 },
  { id: 'benh_nhiet_doi', name: 'Bệnh nhiệt đới', facilityId: 'cs1', order: 10 },
  { id: 'da_lieu', name: 'Da Liễu', facilityId: 'cs1', order: 11 },
  { id: 'dong_y', name: 'Đông y', facilityId: 'cs1', order: 12 },
  { id: 'phcn', name: 'PHCN', facilityId: 'cs1', order: 13 },
  { id: 'hoi_suc_noi', name: 'Hồi sức Nội', facilityId: 'cs1', order: 14 },
  // Cơ sở 2 — 5 departments
  { id: 'noi_th_2', name: 'Nội tổng hợp_2', facilityId: 'cs2', order: 1 },
  { id: 'hhmdls', name: 'HHMDLS', facilityId: 'cs2', order: 2 },
  { id: 'hoi_suc_2', name: 'Hồi sức_2', facilityId: 'cs2', order: 3 },
  { id: 'bnd_2', name: 'BNĐ 2', facilityId: 'cs2', order: 4 },
  { id: 'nhi', name: 'Nhi', facilityId: 'cs2', order: 5 },
];
