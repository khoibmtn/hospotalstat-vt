# CODEBASE.md - Báo cáo số liệu KCB

> Last updated: 2026-03-21T23:10:55+07:00

## Project Overview
- **Type:** Vite + React + JavaScript
- **Purpose:** Hospital Data Entry and Reporting Application for tracking daily inpatient statistics.
- **Deployment:** Vercel (Front-end) + Firebase (Auth, Firestore)
- **Tech Stack:** React, Tailwind CSS, Shadcn UI, Firebase SDK, Lucide React, XLSX.

## Key Architecture

### Directory Structure
- `src/components/`: Reusable UI components (including custom Shadcn components) and layout components.
- `src/components/data-entry/`: Specialized components for the data entry feature, including `ImportDataModal.jsx`.
- `src/config/`: Configuration files (Firebase).
- `src/contexts/`: React contexts (AuthContext).
- `src/pages/`: Main application views (Dashboard, DataEntry, Settings, Summary, Login, Register, LockManagement).
- `src/services/`: Firebase data interaction services (auth, department, report, settings).
- `src/utils/`: Utility functions (date formatting, computed columns, excel parsing, constants).

### Key Files
- `src/App.jsx`: Main routing and authentication wrapper.
- `src/pages/DataEntryPage.jsx`: Core page for daily data entry, featuring a large computed data table.
- `src/components/data-entry/ImportDataModal.jsx`: Handles importing data from Excel templates.
- `src/contexts/AuthContext.jsx`: Manages user authentication state and role-based access.

### Key Services/Modules
- **AuthService**: Manages Firebase authentication and user roles.
- **ReportService**: Handles reading and writing daily report data to Firestore.
- **DepartmentService**: Manages hospital facility and department hierarchy.

## Recent Changes
- Overhauled UI/UX with "UI/UX Pro Max" styling, implementing consistent focus-within shading for data tables, better border and hover states for form controls (inputs/selects).
- Refined the Excel Import functionality: removed "Bệnh nhân cũ" from the template and implemented an explicit UI input to establish a baseline for initial data calculations.
- Fixed data locking logic: integrated `shouldAutoLock` function into `DataEntryPage` and `LockManagementPage` to ensure reports are truly locked in the UI after the configured auto-lock hour.
- Cleaned up security console and login UI.

## Known Issues / TODOs
- Ensure thorough testing of the new "Bệnh nhân cũ ban đầu" calculation edge cases in production.

## Environment
- **Firebase Project:** hms-thuy-nguyen
- **Deploy:** Vercel auto-deploy on main branch
