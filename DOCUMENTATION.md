# HospotalStat-VT — Tài liệu Hướng dẫn Sử dụng & Mô tả Hệ thống

> **Phiên bản:** 1.0  
> **Cập nhật lần cuối:** 29/03/2026  
> **Nền tảng:** React (Vite) + Firebase Firestore  
> **Mục đích:** Hệ thống quản lý số liệu nội trú bệnh viện — nhập liệu, tổng hợp, khóa dữ liệu, và quản trị danh mục.

---

## Mục lục

1. [Tổng quan ứng dụng](#1-tổng-quan-ứng-dụng)
2. [Phân quyền & Vai trò người dùng](#2-phân-quyền--vai-trò-người-dùng)
3. [Trang Đăng nhập / Đăng ký](#3-trang-đăng-nhập--đăng-ký)
4. [Dashboard](#4-dashboard)
5. [Nhập số liệu (DataEntryPage)](#5-nhập-số-liệu-dataentrypage)
6. [Bảng tổng hợp (SummaryPage)](#6-bảng-tổng-hợp-summarypage)
7. [Quản lý khóa số liệu (LockManagementPage)](#7-quản-lý-khóa-số-liệu-lockmanagementpage)
8. [Cài đặt (SettingsPage)](#8-cài-đặt-settingspage)
9. [Database Schema — Firestore](#9-database-schema--firestore)
10. [Các công thức tính toán](#10-các-công-thức-tính-toán)
11. [Luồng dữ liệu chính](#11-luồng-dữ-liệu-chính)
12. [Thư viện & Phụ thuộc chính](#12-thư-viện--phụ-thuộc-chính)

---

## 1. Tổng quan ứng dụng

HospotalStat-VT là ứng dụng web quản lý dữ liệu số liệu nội trú (khám chữa bệnh — KCB) cho bệnh viện. Ứng dụng hỗ trợ:

- **Nhập số liệu hàng ngày** theo từng khoa: BN cũ, vào viện, chuyển đến, chuyển đi, ra viện, tử vong, chuyển viện.
- **Tính toán tự động** BN hiện tại dựa trên công thức cascading.
- **Bệnh truyền nhiễm**: Theo dõi ca bệnh truyền nhiễm theo khoa/ngày.
- **Bệnh nhân tử vong**: Ghi nhận chi tiết từng ca tử vong.
- **Tổng hợp & báo cáo**: Dashboard trực quan, bảng tổng hợp KCB, biểu đồ xu hướng.
- **Khóa/mở khóa dữ liệu**: Kiểm soát chỉnh sửa theo ngày/khoa.
- **Quản trị**: Quản lý cơ sở, khoa, người dùng, danh mục bệnh, cấu hình hệ thống.

### Cấu trúc điều hướng

| Đường dẫn | Trang | Quyền truy cập |
|---|---|---|
| `/` | Dashboard | Tất cả user đã duyệt |
| `/data-entry` | Nhập số liệu | Tất cả user đã duyệt |
| `/summary` | Bảng tổng hợp | Tất cả user đã duyệt |
| `/lock-management` | Quản lý khóa | Admin, Kế hoạch |
| `/settings` | Cài đặt | Chỉ Admin |
| `/login` | Đăng nhập | Công khai |
| `/register` | Đăng ký | Công khai |

---

## 2. Phân quyền & Vai trò người dùng

### Vai trò (Roles)

| Vai trò | Mã | Mô tả |
|---|---|---|
| **Quản trị viên** | `admin` | Toàn quyền: cài đặt, quản lý user, xem tất cả khoa |
| **Kế hoạch tổng hợp** | `kehoach` | Xem/nhập tất cả khoa, quản lý khóa dữ liệu |
| **Khoa** | `khoa` | Chỉ nhập/xem khoa được phân công |

### Logic phân quyền truy cập khoa

```
canAccessDepartment(user, departmentId):
  admin / kehoach → truy cập TẤT CẢ khoa
  khoa → chỉ truy cập:
    - primaryDepartmentId (khoa chính)
    - additionalDepartments[] (các khoa phụ được gán)
```

### Cơ chế phê duyệt

- Khi `requireApproval = true` (cài đặt hệ thống): User mới đăng ký sẽ ở trạng thái chờ duyệt (`approved: false`).
- Admin phê duyệt trong tab "Người dùng" của Cài đặt.
- Admin luôn được tự động phê duyệt.

---

## 3. Trang Đăng nhập / Đăng ký

### Đăng nhập (`/login`)

- **Trường nhập**: Nickname, Mật khẩu.
- **Cơ chế**: Nickname được chuyển thành email nội bộ (`nickname@hospitalstat.local`) để xác thực qua Firebase Auth.
- **Xử lý lỗi**: Sai mật khẩu, tài khoản chưa duyệt, tài khoản không tồn tại → thông báo tiếng Việt.

### Đăng ký (`/register`)

- **Trường nhập**:
  - Nickname (≥3 ký tự, chữ thường không dấu, số, dấu chấm)
  - Mật khẩu (≥6 ký tự)
  - Họ tên đầy đủ
  - Chức vụ (dropdown: Lãnh đạo BV, Trưởng khoa/phòng, Phó trưởng khoa/phòng, Nhân viên)
  - Chức danh (dropdown: Bác sĩ, Điều dưỡng/KTV, Khác)
  - Vai trò (Admin / Kế hoạch tổng hợp / Khoa)
  - Khoa phụ trách (khi chọn vai trò "Khoa")
- **Tự động**: Tạo email nội bộ, kiểm tra trùng nickname.

---

## 4. Dashboard

**Đường dẫn:** `/`  
**Quyền truy cập:** Tất cả user đã duyệt

### Các thành phần

#### 4.1 KPI Cards (6 thẻ)

Hiển thị tổng hợp số liệu **hôm nay** cho toàn viện:

| Thẻ | Ý nghĩa |
|---|---|
| 🏥 Tổng BN hiện tại | Tổng bệnh nhân đang nằm viện |
| 📥 Vào viện | Tổng bệnh nhân mới vào viện |
| 📤 Ra viện | Tổng bệnh nhân xuất viện |
| 🔄 Chuyển đến | Tổng BN chuyển đến từ khoa/viện khác |
| ➡️ Chuyển đi | Tổng BN chuyển đi khoa/viện khác |
| ⚫ Tử vong | Tổng ca tử vong |

#### 4.2 Biểu đồ xu hướng (7 ngày gần nhất)

- **Line chart** hiển thị: BN hiện tại, Vào viện, Ra viện.
- Dữ liệu tổng hợp toàn viện theo ngày.

#### 4.3 Biểu đồ cột theo Khoa

- **Horizontal bar chart** hiển thị BN hiện tại theo từng khoa (dữ liệu hôm nay).

#### 4.4 Bảng chi tiết theo Khoa

- Bảng hiển thị tất cả 8 cột số liệu KCB cho mỗi khoa.
- Dòng cuối cùng: **TỔNG CỘNG** (tô xanh nhạt).

---

## 5. Nhập số liệu (DataEntryPage)

**Đường dẫn:** `/data-entry`  
**Quyền truy cập:** Tất cả user đã duyệt (dữ liệu lọc theo khoa được phân quyền)

### 5.1 Điều hướng ngày tháng

Cụm điều hướng ở đầu trang:

| Control | Chức năng |
|---|---|
| ◀ (ChevronLeft) | Lùi về tháng trước |
| 📅 Datepicker | Chọn ngày bất kỳ → load tháng chứa ngày đó |
| ▶ (ChevronRight) | Tiến đến tháng sau |
| ↩ Hôm nay | Quay về ngày hiện tại (disabled khi đã ở ngày hôm nay) |
| 💾 Lưu tất cả | Lưu toàn bộ thay đổi trong tháng |

**Logic hiển thị:**
- **Tháng hiện tại:** Hiển thị từ ngày 1 đến ngày hôm nay.
- **Tháng quá khứ:** Hiển thị toàn bộ ngày trong tháng.
- **Auto-scroll:** Tự động cuộn đến dòng ngày được chọn.

### 5.2 Chọn Khoa

- Dropdown chọn khoa (lọc theo quyền truy cập).
- Hiển thị tên cơ sở → khoa (phân nhóm).

### 5.3 Tab "📋 Số liệu KCB"

Bảng nhập liệu với các cột:

| Cột | Ý nghĩa | Editable? |
|---|---|---|
| **Trạng thái** | Icon: ✓ (đã nhập), ⚠ (chưa/lỗi), 🔒 (đã khóa) | Không |
| **Ngày** | Ngày trong tháng (DD/MM) | Không |
| **Tua trực** | Tên người trực (text input) | Có |
| **BN cũ** | BN còn lại từ ngày trước | Không (tự động) |
| **Vào viện** | BN mới vào viện | Có |
| **Chuyển đến** | BN chuyển đến từ nơi khác | Có |
| **Chuyển đi** | BN chuyển đi nơi khác | Có |
| **Ra viện** | BN xuất viện | Có |
| **Tử vong** | Ca tử vong | Có |
| **Chuyển viện** | BN chuyển viện | Có |
| **BN hiện tại** | Tự động tính | Không (computed) |
| **Thao tác** | Nút Lưu từng dòng | Có |

**Quy tắc nhập liệu:**
- Row bị khóa (`locked`) → chỉ đọc, nền xám, icon 🔒.
- Row đã nhập đầy đủ → icon ✓ xanh.
- Row chưa nhập → icon ⚠ vàng.
- Dòng ngày được chọn → highlight nền xanh nhạt, tự động cuộn.

### 5.4 Tab "🦠 Bệnh truyền nhiễm"

- Nhập số ca bệnh truyền nhiễm theo danh mục đã cấu hình.
- Mỗi bệnh một cột, nhập số ca cho mỗi ngày.
- Danh mục bệnh lấy từ collection `diseaseCatalog`.

### 5.5 Tab "💀 Bệnh nhân tử vong"

- Ghi nhận chi tiết từng ca tử vong cho ngày đang xem.
- Click vào dòng ngày → mở panel chi tiết với:
  - Nút ➕ "Thêm ca tử vong"
  - Bảng liệt kê các ca đã nhập
  - Các cột cấu hình động (từ Settings):
    - Mã KCB, Họ tên, Năm sinh, Ngày giờ vào viện, Ngày giờ tử vong, CĐ vào viện, CĐ tử vong, Diễn biến lâm sàng, Tóm tắt CLS, Ghi chú...
  - Nút xóa (2-step confirmation: nhấn lần 1 → xác nhận, nhấn lần 2 → xóa).
- Background hiển thị trạng thái:
  - 🟢 Xanh nhạt: Đã có ca tử vong được ghi nhận (khớp với số liệu KCB).
  - 🔴 Đỏ nhạt: Số liệu tử vong > 0 nhưng chưa ghi nhận chi tiết.

---

## 6. Bảng tổng hợp (SummaryPage)

**Đường dẫn:** `/summary`  
**Quyền truy cập:** Tất cả user đã duyệt

### 6.1 Bộ lọc (Filter bar)

| Control | Chức năng |
|---|---|
| **Chọn khoa** | Dropdown: "Toàn viện" hoặc chọn khoa cụ thể (phân nhóm theo cơ sở) |
| **Từ ngày** | Datepicker chọn ngày bắt đầu |
| **Đến ngày** | Datepicker chọn ngày kết thúc |
| **Hôm nay** | Preset: chỉ xem hôm nay |
| **7 ngày** | Preset: 7 ngày gần nhất |
| **Tháng này** | Preset: từ đầu tháng đến hôm nay |

### 6.2 Tab "📊 Tổng hợp KCB"

- Bảng tổng hợp các chỉ số KCB theo khoa trong khoảng thời gian.
- Khi chọn "Toàn viện": mỗi dòng = 1 khoa, dữ liệu tổng hợp.
- Khi chọn 1 khoa: 1 dòng dữ liệu tổng hợp.

### 6.3 Tab "📋 Chi tiết KCB"

- Bảng chi tiết từng ngày × từng khoa.
- Hiển thị tất cả 8 cột số liệu nội trú.

### 6.4 Tab "🦠 Bệnh truyền nhiễm"

- Bảng tổng hợp ca bệnh truyền nhiễm theo khoảng thời gian đã chọn.
- Lọc theo khoa hoặc toàn viện.

### 6.5 Tab "☠️ Danh sách tử vong"

- Tổng hợp tất cả ca tử vong trong khoảng thời gian.
- Hiển thị các cột cấu hình từ Settings (`deathReportColumns`).
- Gộp dữ liệu từ trường `deathCases` của tất cả reports khớp bộ lọc.

---

## 7. Quản lý khóa số liệu (LockManagementPage)

**Đường dẫn:** `/lock-management`  
**Quyền truy cập:** Admin, Kế hoạch tổng hợp

### 7.1 Giao diện 2 cột

**Cột trái (Sidebar):**

| Panel | Chức năng |
|---|---|
| **Cài đặt khóa tự động** | Bật/tắt auto-lock, chọn giờ khóa (0-23h) |
| **Khoảng thời gian** | 2 datepicker (từ ngày → đến ngày) + các preset nhanh |
| **Phạm vi** | Treeview chọn khoa: Toàn viện → Cơ sở → Khoa (checkbox) |

**Cột phải:**

| Panel | Chức năng |
|---|---|
| **Summary** | Số khoa × số ngày → tổng báo cáo, đếm mở/khóa |
| **Khóa hàng loạt** | Nút khóa tất cả báo cáo đang mở (với dialog xác nhận) |
| **Mở khóa hàng loạt** | Nút mở khóa tất cả báo cáo đang khóa |
| **Chi tiết** | Tree view: Ngày → danh sách khoa (mỗi khoa có nút khóa/mở khóa riêng) |

### 7.2 Cơ chế khóa tự động

- Khi bật `autoLockEnabled`: Mọi báo cáo của ngày trước khi đạt `autoLockHour` sẽ tự động coi là "khóa".
- Hiển thị "Tự động khóa (chưa nhập)" cho các report ảo (virtual) chưa có document trong Firestore.
- Trạng thái báo cáo:
  - `open`: Đang mở, có thể chỉnh sửa.
  - `locked`: Đã khóa bởi người dùng hoặc tự động.
  - `unlocked`: Đã được mở khóa (từ trạng thái locked).

### 7.3 Dialog xác nhận

Trước khi khóa/mở khóa hàng loạt:
- Hiển thị số lượng báo cáo bị ảnh hưởng.
- Hiển thị danh sách khoa.
- Hiển thị khoảng thời gian.
- Yêu cầu xác nhận trước khi thực hiện.

---

## 8. Cài đặt (SettingsPage)

**Đường dẫn:** `/settings`  
**Quyền truy cập:** Chỉ Admin

### 8.1 Tab "⚙️ Cấu hình chung"

| Cài đặt | Ý nghĩa |
|---|---|
| **Tên bệnh viện** | Tên hiển thị trên giao diện |
| **Khóa tự động** | Bật/tắt cơ chế auto-lock |
| **Giờ khóa** | Giờ trong ngày mà dữ liệu ngày trước sẽ bị khóa tự động |
| **Yêu cầu phê duyệt** | Bật/tắt yêu cầu admin duyệt user mới |

### 8.2 Tab "🏗️ Cơ sở"

- Danh sách các cơ sở (Khu A, Khu B,...).
- Thao tác: Thêm mới, đổi tên, xóa (chỉ khi không còn khoa nào thuộc cơ sở).
- Kéo thả sắp xếp thứ tự.

### 8.3 Tab "🏥 Khoa"

- Danh sách khoa, phân nhóm theo cơ sở.
- Mỗi khoa hiển thị:
  - Tên khoa
  - Biểu tượng khóa (khoa đang hoạt động / bị vô hiệu hóa)

| Nút | Chức năng |
|---|---|
| ✏️ (Pencil) | Đổi tên khoa |
| 🔄 (ArrowRightLeft) | **Điều chuyển khoa** sang cơ sở khác (dropdown chọn cơ sở đích → xác nhận) |
| 🔒 (Lock/Unlock) | Khóa/mở khoa (khoa bị khóa sẽ không hiển thị cho nhập liệu) |
| 🗑️ (Trash) | Xóa khoa (yêu cầu xác nhận, không thể xóa nếu có dữ liệu) |

**Tính năng điều chuyển khoa (Transfer):**
- Mở dropdown chọn cơ sở đích.
- Cập nhật `facilityId` của khoa.
- Dữ liệu lịch sử KHÔNG bị di chuyển (Option C — giữ nguyên dữ liệu tại `facilityId` cũ).
- Khoa được đặt ở cuối danh sách cơ sở mới.

### 8.4 Tab "👥 Người dùng"

Bảng quản lý tất cả user:

| Cột | Ý nghĩa |
|---|---|
| Nickname | Tên đăng nhập |
| Họ tên | Tên đầy đủ |
| Vai trò | Admin / Kế hoạch / Khoa |
| Khoa chính | Khoa được phân công chính |
| Các khoa phụ | Danh sách khoa phụ |
| Trạng thái | Đã duyệt / Chờ duyệt |
| Ẩn Leaderboard | Ẩn/hiện user trên bảng xếp hạng |

**Thao tác:**
- ✅ Phê duyệt user mới
- ✏️ Sửa thông tin (vai trò, khoa, tên,...)
- 🗑️ Xóa user (xóa document Firestore, không xóa Firebase Auth user)
- 🔑 Reset mật khẩu (đánh dấu `passwordResetPending`)

### 8.5 Tab "📋 Danh mục bệnh truyền nhiễm"

| Chức năng | Mô tả |
|---|---|
| Thêm bệnh | Nhập tên, chọn nhóm (A/B/C), chọn màu hiển thị |
| Sửa tên | Inline edit tên bệnh |
| Sửa nhóm | Dropdown đổi nhóm bệnh |
| Đổi màu | Color picker thay đổi màu badge |
| Di chuyển | Nút ↑ ↓ sắp xếp thứ tự |
| Xóa | Xóa bệnh (cảnh báo nếu đang có dữ liệu sử dụng) |
| Sync | Đồng bộ danh mục vào tất cả reports hiện tại |

### 8.6 Tab "💀 Cấu hình cột tử vong"

Cấu hình các cột hiển thị trong Tab "Bệnh nhân tử vong":

| Thuộc tính | Ý nghĩa |
|---|---|
| **isCore** | Cột hệ thống (không thể xóa): Mã KCB, Họ tên, Năm sinh,... |
| **isFixed** | Cột cố định (không thể ẩn bởi user): Mã KCB, Họ tên |
| **type** | Kiểu dữ liệu: `text` hoặc `datetime` |

**Thao tác:**
- Thêm cột tùy chỉnh (custom)
- Sửa tên cột (trừ cột Core)
- Xóa cột tùy chỉnh (2-step delete)
- Di chuyển thứ tự ↑ ↓
- Toggle Required (bắt buộc nhập)

**Cột mặc định:**

| ID | Tên | Kiểu | Core? | Fixed? |
|---|---|---|---|---|
| maKCB | Mã KCB | text | ✅ | ✅ |
| hoTen | Họ tên | text | ✅ | ✅ |
| namSinh | Năm sinh | text | ✅ | ❌ |
| timeVaoVien | Ngày giờ vào viện | datetime | ✅ | ❌ |
| timeTuVong | Ngày giờ tử vong | datetime | ✅ | ❌ |
| chanDoanVao | CĐ vào viện | text | ✅ | ❌ |
| chanDoanTuVong | CĐ tử vong | text | ✅ | ❌ |
| dienBien | Diễn biến lâm sàng | text | ❌ | ❌ |
| tomTatCLS | Tóm tắt CLS | text | ❌ | ❌ |
| ghiChu | Ghi chú | text | ❌ | ❌ |

---

## 9. Database Schema — Firestore

### 9.1 Collection: `dailyReports`

**Document ID:** `{YYYY-MM-DD}_{departmentId}`

Lưu trữ dữ liệu KCB hàng ngày cho mỗi khoa. Đây là collection chính của ứng dụng.

| Field | Type | Mô tả |
|---|---|---|
| `date` | string | Ngày báo cáo (`YYYY-MM-DD`) |
| `departmentId` | string | ID khoa |
| `departmentName` | string | Tên khoa (snapshot tại thời điểm ghi) |
| `facilityId` | string | ID cơ sở |
| `bnCu` | number | BN cũ (từ ngày trước, tự động) |
| `vaoVien` | number | Số BN vào viện |
| `chuyenDen` | number | Số BN chuyển đến |
| `chuyenDi` | number | Số BN chuyển đi |
| `raVien` | number | Số BN ra viện |
| `tuVong` | number | Số ca tử vong |
| `chuyenVien` | number | Số BN chuyển viện |
| `bnHienTai` | number | BN hiện tại (computed, cascading) |
| `tuaTruc` | string | Tên người trực |
| `status` | string | Trạng thái: `open`, `locked`, `unlocked` |
| `lockedBy` | string | Người khóa |
| `lockedAt` | timestamp | Thời điểm khóa |
| `infectiousData` | array | Mảng `[{ diseaseName, count, diseaseId }]` |
| `deathCases` | array | Mảng các object ca tử vong (cấu trúc động theo `deathReportColumns`) |
| `createdAt` | timestamp | Thời điểm tạo |
| `updatedAt` | timestamp | Lần cập nhật cuối |

**Ví dụ document:**

```json
{
  "date": "2026-03-29",
  "departmentId": "noi_tong_hop",
  "departmentName": "Nội tổng hợp",
  "facilityId": "khu_a",
  "bnCu": 45,
  "vaoVien": 5,
  "chuyenDen": 2,
  "chuyenDi": 1,
  "raVien": 3,
  "tuVong": 0,
  "chuyenVien": 1,
  "bnHienTai": 47,
  "tuaTruc": "BS. Nguyễn Văn A",
  "status": "open",
  "infectiousData": [
    { "diseaseName": "Sốt xuất huyết", "count": 1, "diseaseId": "disease_1" }
  ],
  "deathCases": [],
  "createdAt": "2026-03-29T00:00:00Z",
  "updatedAt": "2026-03-29T08:30:00Z"
}
```

---

### 9.2 Collection: `departments`

**Document ID:** Auto-generated hoặc custom ID

Lưu thông tin khoa.

| Field | Type | Mô tả |
|---|---|---|
| `name` | string | Tên khoa |
| `facilityId` | string | ID cơ sở chứa khoa |
| `order` | number | Thứ tự sắp xếp |
| `active` | boolean | Trạng thái hoạt động (false = khoa bị khóa) |
| `createdAt` | timestamp | Thời điểm tạo |

---

### 9.3 Collection: `facilities`

**Document ID:** Auto-generated hoặc custom ID

Lưu thông tin cơ sở (khu, chi nhánh bệnh viện).

| Field | Type | Mô tả |
|---|---|---|
| `name` | string | Tên cơ sở |
| `order` | number | Thứ tự sắp xếp |
| `createdAt` | timestamp | Thời điểm tạo |

---

### 9.4 Collection: `users`

**Document ID:** Firebase Auth UID

Lưu thông tin user.

| Field | Type | Mô tả |
|---|---|---|
| `nickname` | string | Tên đăng nhập (unique) |
| `displayName` | string | Tên hiển thị |
| `fullName` | string | Họ tên đầy đủ |
| `email` | string | Email nội bộ (`nickname@hospitalstat.local`) |
| `role` | string | Vai trò: `admin`, `kehoach`, `khoa` |
| `position` | string | Chức vụ |
| `title` | string | Chức danh (Bác sĩ, ĐD/KTV, Khác) |
| `primaryDepartmentId` | string | ID khoa chính được phân công |
| `additionalDepartments` | array | Danh sách ID các khoa phụ |
| `approved` | boolean | Đã được admin phê duyệt? |
| `hideFromLeaderboard` | boolean | Ẩn khỏi bảng xếp hạng? |
| `passwordResetPending` | boolean | Đang chờ reset mật khẩu? |
| `createdAt` | timestamp | Thời điểm tạo |

---

### 9.5 Collection: `settings`

**Document ID:** `config` (singleton)

Lưu cấu hình toàn cục.

| Field | Type | Mô tả |
|---|---|---|
| `hospitalName` | string | Tên bệnh viện |
| `autoLockEnabled` | boolean | Bật/tắt tự động khóa |
| `autoLockHour` | number | Giờ tự động khóa (0-23) |
| `requireApproval` | boolean | Yêu cầu duyệt user mới? |
| `activeCategories` | array | Danh mục dữ liệu đang bật (mặc định: `['inpatient']`) |
| `deathReportColumns` | array | Cấu hình cột tab tử vong (mảng object `{id, label, type, isFixed, isCore}`) |
| `updatedAt` | timestamp | Lần cập nhật cuối |

---

### 9.6 Collection: `diseaseCatalog`

**Document ID:** `disease_{timestamp}`

Lưu danh mục bệnh truyền nhiễm.

| Field | Type | Mô tả |
|---|---|---|
| `name` | string | Tên bệnh |
| `group` | string | Nhóm bệnh: `A`, `B`, hoặc `C` |
| `color` | string | Mã màu HEX hiển thị |
| `order` | number | Thứ tự sắp xếp |
| `createdAt` | timestamp | Thời điểm tạo |
| `updatedAt` | timestamp | Lần cập nhật cuối |

---

### 9.7 Collection: `auditLogs`

**Document ID:** Auto-generated

Lưu nhật ký thao tác (audit trail).

| Field | Type | Mô tả |
|---|---|---|
| `action` | string | Loại thao tác (save, lock, unlock,...) |
| `userId` | string | UID người thực hiện |
| `userName` | string | Tên người thực hiện |
| `targetId` | string | ID đối tượng bị tác động |
| `details` | object | Chi tiết bổ sung |
| `timestamp` | timestamp | Thời điểm thao tác |

---

## 10. Các công thức tính toán

### BN hiện tại (bnHienTai)

```
bnHienTai = bnCu + vaoVien + chuyenDen - chuyenDi - raVien - tuVong - chuyenVien
```

### BN cũ (bnCu) — Cascading

```
bnCu[ngày N] = bnHienTai[ngày N-1]
```

**Quan trọng:** Khi lưu dữ liệu 1 ngày, hệ thống tự động cập nhật `bnCu` của các ngày tiếp theo trong tháng (cascading update).

### Tổng hợp theo khoảng thời gian

```
aggregateRows(reports[]):
  - Cộng dồn: vaoVien, chuyenDen, chuyenDi, raVien, tuVong, chuyenVien
  - BN cũ: lấy từ ngày đầu tiên
  - BN hiện tại: lấy từ ngày cuối cùng
```

### Auto-lock

```
shouldAutoLock(dateStr, autoLockHour):
  - Nếu dateStr < ngày hôm nay → true (quá khứ)
  - Nếu dateStr == ngày hôm nay && giờ hiện tại ≥ autoLockHour → true
  - Ngược lại → false
```

---

## 11. Luồng dữ liệu chính

### Luồng nhập số liệu KCB

```
User chọn Khoa → Chọn ngày/tháng
  → App load tất cả reports trong tháng cho khoa đó
  → Tính bnCu cascading từ đầu tháng
  → User nhập: vaoVien, chuyenDen, chuyenDi, raVien, tuVong, chuyenVien, tuaTruc
  → App tính bnHienTai realtime
  → User nhấn Lưu (từng dòng hoặc "Lưu tất cả")
  → reportService.saveReport():
    1. Lưu document vào dailyReports
    2. Tính lại bnHienTai
    3. Cascading: cập nhật bnCu + bnHienTai cho tất cả ngày tiếp theo
  → Ghi auditLog
```

### Luồng khóa/mở khóa

```
Admin/Kế hoạch chọn khoảng thời gian + phạm vi khoa
  → Load danh sách reports
  → Chọn Khóa hoặc Mở khóa
  → Dialog xác nhận
  → lockReportsBatch() / unlockReportsBatch()
  → Cập nhật status, lockedBy, lockedAt
```

### Luồng điều chuyển khoa

```
Admin → Settings → Tab Khoa → Nút 🔄 trên khoa X
  → Dropdown chọn cơ sở đích
  → Xác nhận
  → Cập nhật department.facilityId = cơ sở mới
  → Dữ liệu lịch sử giữ nguyên (Option C)
```

---

## 12. Thư viện & Phụ thuộc chính

| Thư viện | Mục đích |
|---|---|
| **React 18** | UI framework |
| **Vite** | Build tool |
| **Firebase** (Auth + Firestore) | Backend-as-a-Service |
| **react-router-dom** | Client-side routing |
| **date-fns** | Xử lý ngày tháng |
| **react-day-picker** | Datepicker component |
| **recharts** | Biểu đồ (Line, Bar) |
| **lucide-react** | Icon library |
| **shadcn/ui** | UI component system (Button, Card, Select, Tabs, Badge, Input, Popover, Switch,...) |
| **tailwindcss** | Utility-first CSS |

---

> **Ghi chú bảo trì:** Khi thêm khoa mới hoặc thay đổi cấu trúc `dailyReports`, cần kiểm tra:
> 1. `initializeDepartmentReportsForMonth` — tạo document cho khoa mới.
> 2. `computeBnHienTai` + cascading logic — đảm bảo tính toán đúng.
> 3. `canAccessDepartment` — đảm bảo phân quyền chính xác.
> 4. Các bảng tổng hợp trong `SummaryPage` — cập nhật nếu thêm loại dữ liệu mới.
