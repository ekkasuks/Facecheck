# 🎓 FaceAttend — ระบบเช็คชื่อนักเรียนด้วยใบหน้า

> ระบบเช็คชื่อนักเรียนอัตโนมัติด้วย Face Recognition  
> รันบน **GitHub Pages** + **Google Workspace** — ข้อมูล 100% จาก Google Sheet  
> สร้างโดย: **อ.เอกศักดิ์ ปรีติประสงค์** | FaceAttend **v2.4.0**

---

## ✨ ฟีเจอร์หลัก

| ฟีเจอร์ | คำอธิบาย |
|--------|----------|
| 📷 Face Recognition | ตรวจจับใบหน้า Real-time ด้วย face-api.js · ไม่ต้องติดตั้งโปรแกรมใด |
| 🔊 Text-to-Speech | อ่านชื่อนักเรียนออกเสียงภาษาไทยเมื่อเช็คชื่อสำเร็จ |
| ✍️ Manual Check | เช็คชื่อแบบ Manual ทีละห้อง บันทึกครั้งเดียวทุกคน |
| 📊 Dashboard | กราฟ Donut + Bar Chart แสดงสถิติแบบ Real-time จาก Sheet |
| 👥 จัดการนักเรียน | เพิ่ม แก้ไข ลบ · ถ่ายรูปใบหน้าผ่านกล้อง · Import/Export CSV |
| 📋 รายงาน | รายวัน · รายห้อง · รายบุคคล · Export PDF (รองรับภาษาไทยสมบูรณ์) |
| ☁️ Google Sheet DB | ข้อมูลทุกอย่างเก็บใน Google Sheet — ไม่มี localStorage เลย |
| 🔒 Role-Based Auth | Admin / Teacher / Viewer · Login ด้วย Google OAuth 2.0 |
| 🌙 Dark / Light Mode | สลับธีมได้ทันที · จำค่าไว้อัตโนมัติ |
| 📱 Responsive | รองรับทุกหน้าจอ ทั้ง Desktop และ Mobile |

---

## 🏗️ สถาปัตยกรรมระบบ

```
┌─────────────────────────────────────────────────┐
│             GitHub Pages (Frontend)              │
│                                                  │
│  index.html      → Login (Google OAuth 2.0)      │
│  dashboard.html  → สถิติ + กราฟ (Chart.js)       │
│  attendance.html → เช็คชื่อ (face-api.js + TTS)  │
│  students.html   → จัดการนักเรียน                │
│  reports.html    → รายงาน (html2canvas + jsPDF)  │
│  settings.html   → ตั้งค่าระบบ                   │
│                                                  │
│  scripts/api.js  → ส่ง POST ไป GAS ทุก action    │
└────────────────────┬────────────────────────────┘
                     │  HTTPS POST (JSON)
                     ▼
┌─────────────────────────────────────────────────┐
│         Google Apps Script (Backend API)         │
│                                                  │
│  Code.gs → handleRequest() → action routing      │
│  Token verification ทุก request                  │
└──────────┬──────────────────────┬───────────────┘
           │                      │
           ▼                      ▼
  ┌────────────────┐    ┌─────────────────┐
  │  Google Sheets │    │  Google Drive   │
  │                │    │                 │
  │  • Students    │    │  • FaceImages/  │
  │  • Attendance  │    │    (รูปใบหน้า)   │
  │  • Users       │    └─────────────────┘
  │  • Settings    │
  │  • AuditLog    │
  └────────────────┘
```

> ⚠️ **สำคัญ:** ข้อมูลทุกอย่าง (นักเรียน, การเช็คชื่อ, ตั้งค่า) อ่าน-เขียนผ่าน Google Sheet เท่านั้น  
> ไม่มีการเก็บข้อมูลใน localStorage หรือ sessionStorage ทั้งสิ้น

---

## 📁 โครงสร้างไฟล์

```
FaceAttend/
├── index.html                  # หน้า Login (Google OAuth + Username/Password)
├── dashboard.html              # แดชบอร์ด (ดึงข้อมูลจาก Sheet แบบ Real-time)
├── attendance.html             # เช็คชื่อด้วย Face Recognition + Manual
├── students.html               # จัดการนักเรียน (CRUD + ถ่ายรูปใบหน้า)
├── reports.html                # รายงาน + Export PDF ภาษาไทย / CSV
├── settings.html               # ตั้งค่าระบบ (บันทึกลง Google Sheet)
├── oauth2callback.html         # Redirect URI สำหรับ Google OAuth popup
│
├── styles/
│   └── main.css                # Stylesheet หลัก (Dark/Light theme)
│
├── scripts/
│   ├── config.js               # ★ ตั้งค่า API_URL, GOOGLE_CLIENT_ID, ROLE_MAP
│   ├── auth.js                 # Session / Theme / Sidebar / Toast
│   ├── api.js                  # API Client → Google Apps Script (100% GAS)
│   ├── faceRecognition.js      # Face Engine (face-api.js wrapper)
│   └── camera.js               # Camera Manager (WebRTC)
│
├── google-apps-script/
│   └── Code.gs                 # ★ Backend API ทั้งหมด
│
└── README.md
```

---

## 🚀 ขั้นตอน Deploy (ทำครั้งเดียว)

### ขั้นที่ 1 — สร้าง Google Sheet

1. เปิด [sheets.google.com](https://sheets.google.com) → สร้าง Spreadsheet ใหม่
2. ตั้งชื่อว่า **FaceAttend Database**
3. คัดลอก **Sheet ID** จาก URL:
   ```
   https://docs.google.com/spreadsheets/d/ ► YOUR_SHEET_ID ◄ /edit
   ```

---

### ขั้นที่ 2 — ตั้งค่า Google Drive Folder

1. เปิด [drive.google.com](https://drive.google.com)
2. สร้างโฟลเดอร์ใหม่ชื่อ **FaceAttend_Images**
3. คัดลอก **Folder ID** จาก URL:
   ```
   https://drive.google.com/drive/folders/ ► YOUR_FOLDER_ID ◄
   ```
4. คลิกขวาโฟลเดอร์ → **Share** → เปลี่ยนเป็น **Anyone with the link can view**

> 💡 หรือใช้ function `createFaceFolder()` ใน Apps Script แทน (ดูขั้นที่ 3)

---

### ขั้นที่ 3 — ติดตั้ง Google Apps Script

1. ใน Google Sheet → **Extensions** → **Apps Script**
2. ลบโค้ดเดิมออกทั้งหมด
3. วางโค้ดจากไฟล์ `google-apps-script/Code.gs`
4. แก้ไขค่าบรรทัดแรก:

```javascript
const SHEET_ID        = 'YOUR_GOOGLE_SHEET_ID';   // ← Sheet ID จากขั้นที่ 1
const DRIVE_FOLDER_ID = 'YOUR_FOLDER_ID';          // ← Folder ID จากขั้นที่ 2
const SECRET_KEY      = 'พิมพ์รหัสลับอะไรก็ได้';  // ← กำหนดเองได้เลย
const ADMIN_EMAIL     = 'your@gmail.com';          // ← Gmail ที่ใช้ Login
const ADMIN_NAME      = 'ชื่อ-สกุล อาจารย์';      // ← ชื่อเจ้าของระบบ
```

5. บันทึก (Ctrl+S) แล้วเลือก function **`setupSheets`** → กด **▶ Run**
6. อนุญาต Permissions ทั้งหมดที่ Google ขอ
7. ดู Log → ควรเห็น `✅ Setup เสร็จสมบูรณ์!`

> 💡 ถ้ายังไม่มี Drive Folder ให้รัน **`createFaceFolder()`** ก่อน แล้วนำ ID ที่ได้ไปใส่ใน `DRIVE_FOLDER_ID`

---

### ขั้นที่ 4 — Deploy Apps Script เป็น Web App

1. กด **Deploy** → **New deployment**
2. กดไอคอนเฟือง → เลือก **Web app**
3. ตั้งค่าดังนี้:

| ฟิลด์ | ค่า |
|-------|-----|
| Description | `FaceAttend API v2.4` |
| Execute as | **Me** |
| Who has access | **Anyone** |

4. กด **Deploy** → คัดลอก **Web app URL**
5. ทดสอบโดยรัน function **`testAPI()`** ใน Script Editor

---

### ขั้นที่ 5 — ตั้งค่า Google OAuth 2.0

1. เปิด [Google Cloud Console](https://console.cloud.google.com/)
2. สร้างโปรเจกต์ใหม่ (หรือเลือกโปรเจกต์ที่มีอยู่)
3. ไปที่ **APIs & Services** → **Credentials**
4. กด **+ CREATE CREDENTIALS** → **OAuth client ID**
5. Application type: **Web application**
6. เพิ่ม **Authorized JavaScript origins**:
   ```
   http://localhost
   https://YOUR_USERNAME.github.io
   ```
7. เพิ่ม **Authorized redirect URIs**:
   ```
   http://localhost/oauth2callback.html
   https://YOUR_USERNAME.github.io/face-attendance/oauth2callback.html
   ```
8. คัดลอก **Client ID** (รูปแบบ `xxxxxxxxx.apps.googleusercontent.com`)

---

### ขั้นที่ 6 — แก้ไข scripts/config.js

เปิดไฟล์ `scripts/config.js` แก้ไข 3 จุดนี้:

```javascript
const CONFIG = {

  // ★ 1) Web App URL จากขั้นที่ 4
  API_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',

  // ★ 2) Google OAuth Client ID จากขั้นที่ 5
  GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID.apps.googleusercontent.com',

  // ★ 3) กำหนด Role ของแต่ละ Gmail
  //    email ที่ไม่ได้ระบุ → ได้ role "viewer" อัตโนมัติ
  ROLE_MAP: {
    'your_admin@gmail.com':   'admin',    // เข้าถึงได้ทุกอย่าง
    'teacher1@gmail.com':     'teacher',  // เช็คชื่อ + ดูรายงาน
    'viewer1@gmail.com':      'viewer',   // ดู Dashboard อย่างเดียว
  },

  SCHOOL_NAME:  'โรงเรียนของคุณ',
  SCHOOL_SHORT: 'ชื่อย่อ',
};
```

---

### ขั้นที่ 7 — Deploy บน GitHub Pages

```bash
git init
git add .
git commit -m "FaceAttend v2.4.0 — Google Sheet 100%"
git remote add origin https://github.com/YOUR_USERNAME/face-attendance.git
git push -u origin main
```

จากนั้นใน GitHub:
1. **Settings** → **Pages**
2. Source: **Deploy from a branch** → Branch: **main** / **root**
3. กด **Save** → รอ 2–3 นาที
4. URL: `https://YOUR_USERNAME.github.io/face-attendance/`

---

## 📊 โครงสร้าง Google Sheet (5 Sheets)

### Students
| Column | Type | ตัวอย่าง |
|--------|------|---------|
| studentId | String | S001 |
| prefix | String | ด.ช. / ด.ญ. / นาย / น.ส. |
| firstName | String | ธนกฤต |
| lastName | String | มั่นคง |
| classLevel | String | ม.1 / ป.3 |
| room | String | 1, 2, 3 |
| number | Number | 1 |
| gender | String | ชาย / หญิง |
| faceImageUrl | String | https://drive.google.com/... |
| faceDescriptorJson | JSON | [0.123, -0.456, ...] (128 ค่า) |
| activeStatus | String | active / inactive |
| createdAt | DateTime | ISO 8601 |

### Attendance
| Column | Type | ตัวอย่าง |
|--------|------|---------|
| attendanceId | String | A1714052341234 |
| date | String | 2025-04-25 |
| time | String | 08:15 |
| studentId | String | S001 |
| studentName | String | ด.ช.ธนกฤต มั่นคง |
| classLevel | String | ม.1 |
| room | String | 1 |
| status | Enum | present / late / absent / leave |
| method | Enum | face / manual |
| deviceId | String | WEB-DEVICE |
| note | String | หมายเหตุ (ถ้ามี) |
| createdAt | DateTime | ISO 8601 |

### Users
| Column | ตัวอย่าง |
|--------|---------|
| email | admin@gmail.com |
| name | อ.เอกศักดิ์ ปรีติประสงค์ |
| role | admin / teacher / viewer |
| allowedClassRoom | all / ม.1/1 |
| passwordHash | SHA-256 (สำหรับ login แบบ password) |

### Settings
| key | ค่าเริ่มต้น | คำอธิบาย |
|-----|-----------|---------|
| schoolName | โรงเรียนบ้านใหม่ | ชื่อโรงเรียน |
| schoolShort | ร.ร.บ้านใหม่ | ชื่อย่อ |
| lateTime | 08:30 | เวลาที่ถือว่าสาย |
| absentTime | 10:00 | เวลาที่ถือว่าขาด |
| checkDuplicateMinutes | 10 | ป้องกันเช็คซ้ำใน X นาที |
| faceThreshold | 0.5 | ความแม่นยำ Face Match (0.1–0.9) |

### AuditLog
บันทึกทุก action อัตโนมัติ: LOGIN, ADD_STUDENT, CHECKIN, UPDATE_STATUS ฯลฯ

---

## 🔌 API Actions (Google Apps Script)

| Action | Auth | คำอธิบาย |
|--------|------|---------|
| `ping` | ❌ | ทดสอบการเชื่อมต่อ |
| `loginGoogle` | ❌ | Login ด้วย Google token |
| `login` | ❌ | Login ด้วย email/password |
| `getStudents` | ✅ | ดึงรายชื่อนักเรียน (filter: classLevel, room) |
| `addStudent` | ✅ | เพิ่มนักเรียนใหม่ |
| `updateStudent` | ✅ | แก้ไขข้อมูลนักเรียน |
| `deleteStudent` | ✅ | ลบนักเรียน |
| `checkAttendance` | ✅ | เช็คชื่อ (face/manual, รองรับ overrideStatus) |
| `getAttendance` | ✅ | ดึงข้อมูลเช็คชื่อ (filter: date, studentId, dateFrom, dateTo, classLevel, room) |
| `updateAttendanceStatus` | ✅ | แก้ไขสถานะ (สร้าง record ใหม่ถ้าไม่มี) |
| `uploadFaceImage` | ✅ | อัปโหลดรูปใบหน้าไปยัง Google Drive |
| `saveFaceDescriptor` | ✅ | บันทึก Face Descriptor 128 มิติ |
| `getDashboard` | ✅ | สถิติรวม (range: today/week/month) |
| `getSettings` | ✅ | ดึงการตั้งค่าทั้งหมด |
| `saveSetting` | ✅ | บันทึกการตั้งค่า |

---

## 🔒 Security

| ระดับ | มาตรการ |
|------|---------|
| Token | Base64-encoded JSON + expiry 24h ทุก request |
| Role-based | Admin / Teacher / Viewer แยก permission |
| HTTPS | GitHub Pages บังคับ HTTPS ทุก request |
| Face Data | เก็บใน Google Drive (Private folder) |
| Audit Log | บันทึกทุก action ใน AuditLog sheet |
| Anti-duplicate | ป้องกันเช็คชื่อซ้ำใน X นาที (กำหนดได้ใน Settings) |

### บทบาทและสิทธิ์

| สิทธิ์ | Admin 👑 | Teacher 👨‍🏫 | Viewer 👁️ |
|-------|:-------:|:----------:|:--------:|
| เช็คชื่อ (Face/Manual) | ✅ | ✅ | ❌ |
| ดู Dashboard | ✅ | ✅ | ✅ |
| จัดการนักเรียน (CRUD) | ✅ | ❌ | ❌ |
| Export รายงาน | ✅ | ✅ | ❌ |
| แก้ไขสถานะเช็คชื่อ | ✅ | ✅ | ❌ |
| เข้าหน้าตั้งค่า | ✅ | ❌ | ❌ |

---

## 📄 Export PDF (ภาษาไทยสมบูรณ์)

ระบบใช้ **html2canvas + jsPDF** ในการสร้าง PDF โดย:
1. สร้าง HTML template ที่มี font IBM Plex Sans Thai
2. ใช้ `html2canvas` render เป็น Canvas (ภาษาไทยแสดงผลถูกต้อง 100%)
3. แปลง Canvas เป็น Image → ฝังใน PDF ด้วย jsPDF

รองรับ PDF 4 ประเภท:
- **รายวัน** — รายชื่อนักเรียนทุกคนพร้อมสถานะ
- **รายห้องเรียน** — สรุปรายบุคคลพร้อม % การมาเรียน
- **รายบุคคล** — ประวัติการมาเรียนย้อนหลังทั้งหมด
- **สรุปรวม** — อันดับห้องเรียนตามช่วงเวลา

---

## ⚙️ Performance

| รายการ | เวลา |
|--------|------|
| Face detection (1 คน) | < 700ms |
| Face matching (500 คน) | < 200ms |
| AI Model โหลดครั้งแรก | ~8–12 วินาที |
| AI Model ครั้งต่อไป | ~1 วินาที (browser cache) |
| Dashboard load | < 3 วินาที |
| API response (GAS) | 1–3 วินาที |

---

## 📱 Browser Support

| Browser | Version | Face API | Camera | PDF |
|---------|---------|:--------:|:------:|:---:|
| Chrome | 80+ | ✅ | ✅ | ✅ |
| Edge | 80+ | ✅ | ✅ | ✅ |
| Firefox | 75+ | ✅ | ✅ | ✅ |
| Safari | 14+ | ✅ | ✅ | ✅ |
| Mobile Chrome | 80+ | ✅ | ✅ | ✅ |

> ⚠️ **ต้องใช้ HTTPS** — Camera API และ Face API ไม่ทำงานบน HTTP  
> GitHub Pages ใช้ HTTPS อยู่แล้ว ไม่ต้องทำอะไรเพิ่ม

---

## 🛠️ Utility Functions ใน Code.gs

| Function | วิธีใช้ | คำอธิบาย |
|----------|---------|---------|
| `setupSheets()` | รันครั้งแรก | สร้าง Sheet ทุกอัน + Admin user + Default settings |
| `createFaceFolder()` | รันก่อน setup | สร้าง Drive folder + คืน Folder ID |
| `testAPI()` | รันเพื่อ debug | ทดสอบ ping / auth / Drive folder |
| `insertSampleStudents()` | Optional | เพิ่มนักเรียนตัวอย่าง 10 คน สำหรับทดสอบ |

---

## ❓ แก้ปัญหาที่พบบ่อย

**Login ด้วย Google แล้วได้ role = viewer**
→ Gmail ที่ใช้ login ไม่ตรงกับที่ระบุใน `ROLE_MAP` ใน `scripts/config.js`  
→ ระบบจะแสดง banner บอก email จริงให้คัดลอกไปใส่

**กล้องไม่เปิด**
→ ตรวจสอบว่าเปิดผ่าน HTTPS และกด Allow Camera ใน Browser

**AI Model โหลดไม่ขึ้น**
→ ตรวจสอบ Internet connection (โหลดจาก jsDelivr CDN ~15MB)

**เช็คชื่อแล้วไม่บันทึกลง Sheet**
→ ตรวจสอบ `API_URL` ใน `config.js` และรัน `testAPI()` ใน Script Editor

**PDF ภาษาไทยแสดงเป็นตัวแทน □□□**
→ รอ font โหลดให้เสร็จก่อน (1–2 วินาที) แล้วกด Export อีกครั้ง

**GAS แจ้ง DRIVE_FOLDER_ID ไม่ถูกต้อง**
→ รัน `createFaceFolder()` ใน Script Editor จะได้ Folder ID ใหม่

---

## 🔮 Roadmap

- [ ] QR Code check-in (สำรองเมื่อกล้องเสีย)
- [ ] LINE Notify แจ้งผู้ปกครองอัตโนมัติ
- [ ] PWA Offline mode (IndexedDB sync)
- [ ] Multi-school / Multi-branch support
- [ ] Export Excel (.xlsx) พร้อม Chart
- [ ] Realtime dashboard ด้วย Server-Sent Events

---

## 📞 ติดต่อ / ขอบคุณ

สร้างและพัฒนาโดย **อ.เอกศักดิ์ ปรีติประสงค์**  
FaceAttend **v2.4.0** | MIT License

> _"ระบบนี้สร้างขึ้นเพื่อลดภาระงานครู และส่งเสริมการใช้เทคโนโลยีในห้องเรียนไทย"_
