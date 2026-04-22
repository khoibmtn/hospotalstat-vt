# CODEBASE.md - HospitalStat VT (TTYT Thủy Nguyên)

> Last updated: 2026-04-22

## Project Overview
- **Type:** Vite + React (JSX) + Firebase
- **Purpose:** Hệ thống báo cáo số liệu KCB (Khám chữa bệnh) nội trú theo ngày cho TTYT Thủy Nguyên
- **Deployment:** Firebase Hosting (auto-deploy on push to main)
- **URL:** Hosted on Firebase
- **Auth:** Firebase Authentication (email/password, role-based)

---

## Key Architecture

### Directory Structure
```
src/
├── components/
│   ├── data-entry/       # ImportDataModal, DeathReportTab, InfectiousEntryTab
│   ├── layout/           # AppShell (navbar + sidebar)
│   ├── summary/          # KCBDetailTable, KCBOverviewTable, InfectiousPanel, DeathListPanel, DiseaseBlock
│   └── ui/               # shadcn/ui primitives (button, card, dialog, select, etc.)
├── contexts/
│   └── AuthContext.jsx   # Firebase auth state + role management
├── pages/
│   ├── DashboardPage.jsx # Command center dashboard (main page, TV mode)
│   ├── DataEntryPage.jsx # Daily data entry by department
│   ├── SummaryPage.jsx   # 3-tab summary (overview, detail, death list)
│   ├── SettingsPage.jsx  # Admin settings (roles, columns, facilities)
│   ├── LockManagementPage.jsx # Data lock/unlock management
│   ├── LoginPage.jsx
│   └── RegisterPage.jsx
├── services/
│   ├── reportService.js      # Firestore CRUD for daily reports
│   ├── authService.js        # User management
│   ├── departmentService.js  # Facility/department config
│   ├── diseaseCatalogService.js # Infectious disease catalog
│   └── settingsService.js    # App-wide settings (columns, lock status)
├── utils/
│   ├── computedColumns.js    # Derived column calculations (BN hiện tại, etc.)
│   ├── constants.js          # Shared constants (INPATIENT_FIELDS, etc.)
│   ├── dateUtils.js          # Date formatting helpers
│   └── validation.js         # Data validation logic
└── config/
    └── firebase.js           # Firebase project config
```

### Key Files
| File | Role |
|------|------|
| `src/pages/DashboardPage.jsx` | Command center: KPI cards, trend chart (collapsible), TV snap-scroll layout, facility-grouped data table |
| `src/pages/DataEntryPage.jsx` | Daily data entry form by department with lock/unlock support |
| `src/components/data-entry/ImportDataModal.jsx` | Multi-sheet Excel import with sheet detection, dropdown selection, and continuous import workflow |
| `src/services/reportService.js` | Core Firestore service: read/write daily reports, BN cũ carry-forward logic |
| `src/utils/constants.js` | `INPATIENT_FIELDS` array defines table columns across the app |

### Key Services/Modules
- **reportService**: Writes `reports/{date}/{deptId}` documents. Handles BN cũ = previous day's BN hiện tại unless overridden.
- **AuthContext**: Provides `user`, `role`, `facilityId` globally. Roles: `admin`, `khth`, `khoa`.
- **computedColumns**: Derives BN hiện tại = BN cũ + vào viện + chuyển đến − ra viện − chuyển đi − tử vong.
- **settingsService**: Manages per-column visibility, required status, and lock dates.

---

## File Dependencies

| File | Depends On |
|------|-----------|
| `DashboardPage.jsx` | `reportService`, `departmentService`, `diseaseCatalogService`, `constants`, `dateUtils`, shadcn/ui, recharts |
| `DataEntryPage.jsx` | `reportService`, `settingsService`, `departmentService`, `computedColumns`, `validation` |
| `ImportDataModal.jsx` | `reportService`, `departmentService`, xlsx (SheetJS) |
| `SummaryPage.jsx` | `reportService`, `departmentService`, `KCBDetailTable`, `KCBOverviewTable`, `DeathListPanel` |

---

## Recent Changes (Session 2026-04-17)

### 1. Excel Import — Multi-sheet Workflow (`ImportDataModal.jsx`)
- Detects valid sheets in uploaded Excel file (checks for required column headers)
- Shows sheet selection dropdown + department picker
- After successful import, returns to selection screen for continuous multi-import
- Handles BN cũ: uses previous day's BN hiện tại from Firestore, or user-specified override

### 2. Trend Chart Time Ranges (`DashboardPage.jsx`)
- Added `TREND_RANGES`: 1 tuần (7d), 2 tuần (14d), 1 tháng (30d), 1 quý (90d)
- Dynamic Firestore query start date based on selected range
- Adaptive chart rendering: dots visible for ≤14 days, hidden for longer ranges; x-axis tick interval adjusts

### 3. TV Mode Layout — Scroll-Snap 2-page (`DashboardPage.jsx`)
- **Page 1**: KPI cards + trend chart (auto-collapsed when entering TV mode)
- **Page 2**: Full-viewport table (scroll-snap to fill entire screen)
- Table uses `w-auto` — no full-width stretching, columns sized by fixed widths
- Column widths in TV mode: Khoa 120px, data cols 72px each, Trạng thái 60px

### 4. Visual Hierarchy (`DashboardPage.jsx`)
- Zero values → `text-slate-400` (muted gray)
- Tử vong > 0 → `text-red-600 font-bold`
- Facility subtotal rows (Tổng Cơ sở 1/2) → `bg-orange-50 border-orange-200 text-orange-700`
- Header margin → `mb-2` in TV mode (compact)

---

## Known Issues / TODOs
- [ ] Normal mode (non-TV) layout may need review — currently the Section 1/2 wrapper divs render with empty className in normal mode
- [ ] TV mode table: consider auto font-size scaling if more departments are added
- [ ] Consider adding "scroll indicator" dots for TV mode snap pages
- [ ] Performance: Firestore real-time listeners not yet implemented on DashboardPage (uses one-shot fetch)

---

## Environment
- **Repo:** GitHub (main branch = production)
- **Deploy:** Firebase Hosting (auto on push to main)
- **Node runtime:** via nvm (v22+)
- **Dev server:** `npm run dev` → localhost:5173
- **TV mode:** `localhost:5173/?mode=tv`
