# CODEBASE.md - HospitalStat VT (Bệnh viện Hữu Nghị Việt Tiệp)

> Last updated: 2026-05-10

## Project Overview
- **Type:** Vite + React (JSX) + Firebase
- **Purpose:** Hệ thống báo cáo số liệu KCB (Khám chữa bệnh) nội trú theo ngày cho Bệnh viện Hữu Nghị Việt Tiệp
- **Deployment:** Vercel (auto-deploy on push to main)
- **URL:** https://hospotal-stat-vt.vercel.app
- **Auth:** Firebase Authentication (email/password, role-based)

---

## Key Architecture

### Directory Structure
```
src/
├── components/
│   ├── data-entry/       # ImportDataModal, DeathReportTab, InfectiousEntryTab
│   ├── layout/           # AppShell (navbar + sidebar + account dialog)
│   ├── summary/          # KCBDetailTable, KCBOverviewTable, InfectiousPanel, DeathListPanel, DiseaseBlock
│   └── ui/               # shadcn/ui primitives (button, card, dialog, select, etc.)
├── contexts/
│   └── AuthContext.jsx   # Firebase auth state + role management
├── pages/
│   ├── DashboardPage.jsx # Command center dashboard (main page, TV mode)
│   ├── DataEntryPage.jsx # Daily data entry by department
│   ├── SummaryPage.jsx   # 4-tab summary (overview, detail, infectious, death list)
│   ├── SettingsPage.jsx  # Admin settings (roles, columns, facilities, bed plans, registration toggle)
│   ├── LockManagementPage.jsx # Data lock/unlock management
│   ├── LoginPage.jsx
│   └── RegisterPage.jsx
├── services/
│   ├── reportService.js      # Firestore CRUD for daily reports
│   ├── authService.js        # User management + password change
│   ├── departmentService.js  # Facility/department config
│   ├── diseaseCatalogService.js # Infectious disease catalog
│   ├── bedPlanService.js     # Bed plan (Giường KH) CRUD
│   └── settingsService.js    # App-wide settings (columns, lock status)
├── utils/
│   ├── computedColumns.js    # Derived column calculations (BN còn lại, etc.)
│   ├── constants.js          # Shared constants (INPATIENT_FIELDS, etc.)
│   ├── dateUtils.js          # Date formatting helpers
│   ├── excelUtils.js         # Excel export utilities
│   └── validation.js         # Data validation logic
└── config/
    └── firebase.js           # Firebase project config
```

### Key Files
| File | Role |
|------|------|
| `src/pages/DashboardPage.jsx` | Command center: KPI cards, trend chart, TV snap-scroll layout, facility-grouped data table with resizable columns, GB KH integration |
| `src/pages/DataEntryPage.jsx` | Daily data entry form by department with lock/unlock support |
| `src/pages/SettingsPage.jsx` | Admin config: departments, facilities, bed plans (Giường KH), registration toggle, approval toggle, Excel import |
| `src/components/layout/AppShell.jsx` | Sidebar navigation + account settings dialog (edit name, change password) |
| `src/services/bedPlanService.js` | CRUD for bed plan configurations with date-range validity |
| `src/services/authService.js` | User registration, login, password change (re-auth + updatePassword) |

### Key Services/Modules
- **reportService**: Writes `dailyReports/{docId}` documents. Handles BN cũ = previous day's BN còn lại unless overridden.
- **AuthContext**: Provides `user`, `role`, `facilityId` globally. Roles: `admin`, `kehoach`, `khoa`.
- **computedColumns**: Derives BN còn lại = BN cũ + vào viện + chuyển đến − ra viện − chuyển đi − tử vong.
- **settingsService**: Manages per-column visibility, required status, lock dates, hospital branding, registration/approval toggles.
- **bedPlanService**: Manages planned bed capacity per department with effective date ranges.

---

## File Dependencies

| File | Depends On |
|------|-----------| 
| `DashboardPage.jsx` | `reportService`, `departmentService`, `diseaseCatalogService`, `bedPlanService`, `constants`, `dateUtils`, shadcn/ui, recharts |
| `DataEntryPage.jsx` | `reportService`, `settingsService`, `departmentService`, `computedColumns`, `validation` |
| `AppShell.jsx` | `authService` (logoutUser, updateUser, updateUserPassword), `settingsService`, shadcn/ui Dialog |
| `SummaryPage.jsx` | `reportService`, `departmentService`, `AuthContext`, `constants`, summary components |
| `RegisterPage.jsx` | `authService`, `departmentService`, `settingsService` (allowRegistration check) |
| `LoginPage.jsx` | `authService`, `settingsService` (allowRegistration check for link visibility) |
| `SettingsPage.jsx` | `authService`, `departmentService`, `settingsService`, `bedPlanService` |

---

## Recent Changes (Session 2026-05-10)

### 1. Bed Plan (Giường KH) System
- **New service**: `bedPlanService.js` — CRUD for bed plans with `departmentId`, `beds`, `fromDate`, `toDate`
- **Settings tab**: New "Giường KH" tab in SettingsPage with full list management (search, filter, add, edit, delete)
- **Dashboard integration**: "GB KH" column in KCB table, with togglable "Chênh lệch" (absolute) and "% CL" (percentage) columns
- **Logic**: `getEffectiveBeds()` prioritizes latest valid plan based on report date
- **Formatting**: Positive diff → green (+N), negative → red (-N); percentage shown in parentheses only when paired with absolute

### 2. Dashboard UI Enhancements
- **Column label**: "BN hiện tại" renamed to "BN còn lại"
- **Color-coded columns**: BN còn lại (blue bg), GB KH (amber bg), Vào viện (blue text/bg), Tử vong (red text)
- **High-contrast controls**: Font size, row height, tua trực, GB KH buttons with border-2, larger icons, bold text
- **Resizable columns**: Drag-to-resize on all column headers via mousedown/mousemove handlers

### 3. Account Management
- **Account dialog** in AppShell sidebar (click user name to open)
- **Edit display name**: Updates Firestore `displayName` + `fullName`
- **Change password**: Re-authenticates with current password, then updates via Firebase Auth
- **Nickname**: Shown as read-only, not editable

### 4. Registration Control
- **Settings toggle**: "Cho phép đăng ký tài khoản mới" (default: on)
- **RegisterPage**: When disabled → shows blocked message with ShieldOff icon + link back to login
- **LoginPage**: When disabled → hides "Đăng ký ngay" link, shows "Đăng ký đã bị tạm khóa"
- **Firestore rules**: `settings` collection changed to `allow read: if true` for unauthenticated access

### 5. Summary Page Default Department
- Non-admin users now default to their assigned department (`primaryDepartmentId`)
- Admin/kehoach users still default to "Toàn viện"
- Users can still switch to any other department

### 6. Bug Fixes
- **TDZ crash**: Fixed white page caused by `const` functions defined after JSX that references them in AppShell
- **Register page**: Separated `getSettings()` from `Promise.all` to prevent auth failure from blocking department loading
- **Delete user confirm**: Fixed flashing dialog issue (from earlier session)

---

## Firestore Rules Summary

| Collection | Read | Write |
|---|---|---|
| `facilities` | Public | Admin |
| `departments` | Public | Admin |
| `settings` | **Public** | Admin / Kehoach |
| `users` | Authenticated | Admin / Self |
| `dailyReports` | Authenticated | Admin / Dept owner |
| `auditLogs` | Admin / Kehoach | Authenticated (create) |
| `diseaseCatalog` | Authenticated | Admin |
| `bedPlans` | Authenticated | Admin |

---

## Known Issues / TODOs
- [ ] "Tách khoa/ghép khoa" bed plan logic — deferred until client provides organizational rules
- [ ] Consider memoizing `getEffectiveBeds` if bedPlans dataset grows significantly
- [ ] TV mode table: consider auto font-size scaling if more departments are added
- [ ] Performance: DashboardPage uses real-time listeners (onSnapshot) — monitor for scale

---

## Environment
- **Repo:** GitHub — github.com/khoibmtn/hospotalstat-vt (main = production)
- **Deploy:** Vercel (auto on push to main)
- **Node runtime:** via nvm (v22+)
- **Dev server:** `npm run dev` → localhost:5173
- **TV mode:** `localhost:5173/?mode=tv`
