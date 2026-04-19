# 🎓 FaceAttend — ระบบเช็คชื่อนักเรียนด้วยใบหน้า

> ระบบเช็คชื่อนักเรียนอัตโนมัติด้วย Face Recognition รันบน GitHub Pages + Google Workspace  
> สร้างโดย: อ.เอกศักดิ์ ปรีติประสงค์ | FaceAttend v2.1.0

---

## ✨ ฟีเจอร์หลัก

| ฟีเจอร์ | คำอธิบาย |
|--------|----------|
| 📷 Face Recognition | ตรวจจับใบหน้าแบบ Real-time ด้วย face-api.js |
| 🔊 Text-to-Speech | อ่านชื่อนักเรียนออกเสียงเมื่อเช็คชื่อสำเร็จ |
| 📊 Dashboard | แสดงสถิติการมาเรียน กราฟ Donut + Bar Chart |
| 👥 จัดการนักเรียน | เพิ่ม แก้ไข ลบ พร้อมถ่ายรูปผ่านกล้อง |
| 📋 รายงาน | รายวัน รายห้อง รายบุคคล Export PDF/CSV |
| ✍️ Manual Check | เช็คชื่อแบบ Manual กรณีกล้องเสีย |
| 🌙 Dark/Light Mode | สลับธีมได้ทันที |
| 📱 Responsive | รองรับทุกหน้าจอ |

---

## 🏗️ Architecture

```
GitHub Pages (Frontend)
    ├── face-api.js (Client-side Face Recognition)
    ├── Web Camera API
    ├── Web Speech API (TTS)
    └── Chart.js (Dashboard)
         ↓ REST API
Google Apps Script (Backend)
    ├── Google Sheets (Database)
    │   ├── Students
    │   ├── Attendance
    │   ├── Users
    │   └── Settings
    └── Google Drive (Face Images)
```

---

## 📁 โครงสร้างไฟล์

```
face-attendance/
├── index.html              # หน้า Login
├── dashboard.html          # แดชบอร์ด
├── attendance.html         # เช็คชื่อด้วย Face
├── students.html           # จัดการนักเรียน
├── reports.html            # รายงาน + Export PDF
├── settings.html           # ตั้งค่าระบบ
├── styles/
│   └── main.css            # Stylesheet หลัก
├── scripts/
│   ├── config.js           # Config + Mock Data
│   ├── auth.js             # Auth + Shared Utils
│   ├── api.js              # API Client
│   ├── faceRecognition.js  # Face Engine
│   └── camera.js           # Camera Manager
├── google-apps-script/
│   └── Code.gs             # Apps Script Backend
└── README.md
```

---

## 🚀 วิธี Deploy บน GitHub Pages

### ขั้นตอนที่ 1: สร้าง Repository

```bash
# สร้าง repo ใหม่บน GitHub ชื่อ face-attendance
git init
git add .
git commit -m "Initial commit — FaceAttend v2.1.0"
git remote add origin https://github.com/YOUR_USERNAME/face-attendance.git
git push -u origin main
```

### ขั้นตอนที่ 2: เปิด GitHub Pages

1. ไปที่ Repository → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / **root**
4. กด **Save**
5. รอ 2-3 นาที → URL จะเป็น `https://YOUR_USERNAME.github.io/face-attendance/`

---

## 🔧 วิธีตั้งค่า Google Sheet + Apps Script

### ขั้นตอนที่ 1: สร้าง Google Sheet

1. ไปที่ [Google Sheets](https://sheets.google.com) → สร้าง Spreadsheet ใหม่
2. ตั้งชื่อว่า **FaceAttend Database**
3. คัดลอก **Sheet ID** จาก URL:  
   `https://docs.google.com/spreadsheets/d/`**`YOUR_SHEET_ID`**`/edit`

### ขั้นตอนที่ 2: สร้าง Google Apps Script

1. ใน Google Sheet → **Extensions** → **Apps Script**
2. ลบโค้ดเดิมทิ้ง
3. วางโค้ดจากไฟล์ `google-apps-script/Code.gs`
4. แก้ไขค่าต่อไปนี้:

```javascript
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';     // ← ใส่ Sheet ID
const DRIVE_FOLDER_ID = 'YOUR_FOLDER_ID';    // ← ใส่ Drive Folder ID
const SECRET_KEY = 'ใส่รหัสลับอะไรก็ได้';   // ← ใส่ Secret Key
```

### ขั้นตอนที่ 3: รัน Setup

1. เลือก function **setupSheets**
2. กด **▶ Run**
3. อนุญาต permissions ทั้งหมด
4. รอจนเสร็จ (จะสร้าง Sheets อัตโนมัติ)

### ขั้นตอนที่ 4: Deploy เป็น Web App

1. กด **Deploy** → **New deployment**
2. Type: **Web app**
3. Description: `FaceAttend API v1`
4. Execute as: **Me**
5. Who has access: **Anyone** (หรือ Anyone with Google Account)
6. กด **Deploy** → Copy **Web app URL**

### ขั้นตอนที่ 5: อัปเดต config.js

เปิดไฟล์ `scripts/config.js` แล้วแก้ไข:

```javascript
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/YOUR_NEW_SCRIPT_ID/exec',
  // ...
};
```

---

## 📊 โครงสร้าง Google Sheet

### Sheet: Students
| Column | Type | Description |
|--------|------|-------------|
| studentId | String | รหัสนักเรียน (S001) |
| prefix | String | คำนำหน้า (ด.ช., ด.ญ.) |
| firstName | String | ชื่อ |
| lastName | String | นามสกุล |
| classLevel | String | ชั้น (ม.1, ป.3) |
| room | String | ห้อง (1, 2, 3) |
| number | Number | เลขที่ |
| gender | String | เพศ |
| faceImageUrl | String | URL รูปภาพจาก Drive |
| faceDescriptorJson | JSON | Array[128] ข้อมูล face descriptor |
| activeStatus | String | active / inactive |

### Sheet: Attendance
| Column | Type | Description |
|--------|------|-------------|
| attendanceId | String | รหัสการเช็คชื่อ |
| date | Date | วันที่ (YYYY-MM-DD) |
| time | Time | เวลา (HH:MM) |
| studentId | String | รหัสนักเรียน |
| studentName | String | ชื่อ-สกุล |
| classLevel | String | ชั้น |
| room | String | ห้อง |
| status | Enum | present/late/absent/leave |
| method | Enum | face/manual |
| deviceId | String | รหัสเครื่อง |
| note | String | หมายเหตุ |

---

## 🔒 Security

| ระดับ | มาตรการ |
|------|---------|
| Apps Script | Token verification ทุก request |
| Role-based | Admin / Teacher / Viewer |
| HTTPS | GitHub Pages บังคับ HTTPS |
| Face Data | เก็บใน Google Drive (Private) |

**Demo Accounts:**
```
Admin:   admin@school.ac.th   / admin1234
Teacher: teacher@school.ac.th / teacher1234
Viewer:  viewer@school.ac.th  / viewer1234
```

---

## 📱 Browser Support

| Browser | Version | Face API | Camera |
|---------|---------|----------|--------|
| Chrome | 80+ | ✅ | ✅ |
| Edge | 80+ | ✅ | ✅ |
| Firefox | 75+ | ✅ | ✅ |
| Safari | 14+ | ✅ | ✅ |
| Mobile Chrome | 80+ | ✅ | ✅ |

> ⚠️ **ต้องใช้ HTTPS** สำหรับ Camera API (GitHub Pages ใช้ HTTPS อยู่แล้ว)

---

## ⚙️ Performance

- Face detection: **< 1 วินาที** (บน CPU ทั่วไป)
- Face matching: **< 500ms** (สำหรับ 500 คน)
- Model load: **~8 วินาที** (ครั้งแรก, cached หลังจากนั้น)
- Dashboard load: **< 2 วินาที**

---

## 🔮 Future Roadmap

- [ ] QR Code check-in
- [ ] LINE Notify แจ้งผู้ปกครอง
- [ ] Multi-school support
- [ ] Mobile App (PWA)
- [ ] AI-powered behavior scoring
- [ ] Offline mode (PWA + IndexedDB)

---

## 📞 ติดต่อ

สร้างโดย **อ.เอกศักดิ์ ปรีติประสงค์**  
FaceAttend v2.1.0 | MIT License
