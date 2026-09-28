# Instagram Semi-Automated Outreach CRM & Google Lead Grabber

Hệ thống CRM quản lý tiếp cận khách hàng tiềm năng (Outreach) bán tự động chuẩn thuật toán Meta/Instagram, tích hợp Google X-Ray Lead Discovery & Chrome Extension tự động quét tài khoản thực tế.

---

## 🚀 Tính năng nổi bật

1. **Google X-Ray Lead Discovery & Grabber**:
   - Quét và bóc tách tự động tài khoản Instagram của nhà sáng tạo, agency, founder từ kết quả tìm kiếm Google (`site:instagram.com`).
   - Tự động cuộn trang liên tục (Auto-scroll & Deep Scan) để nạp 30–50+ leads thật.
   - Bóc tách chính xác username, họ tên, bio, và số người theo dõi thật (loại trừ tài khoản rác / cá nhân dưới 1,000 follower).

2. **Chrome Extension (IG Safe Outreach Assistant)**:
   - Floating widget hiển thị trực quan ngay trên trang tìm kiếm Google và Instagram Explore.
   - Live inspection: Tự động soi số follower thực tế khi mở profile Instagram và cảnh báo nếu tài khoản < 1,000 follower.
   - Dispatch 1-click: Mở profile, tự động điền tin nhắn đã sinh bởi AI và chuẩn bị sẵn gửi DM an toàn.

3. **CRM Dashboard (localhost:3000)**:
   - Quản lý danh sách leads với bộ lọc đa tầng: Follower Tiers (Micro 1K–15K, Mid 15K–75K, Macro 75K+), trạng thái chiến dịch, tìm kiếm từ khóa.
   - Tích hợp Gemini AI sinh tin nhắn cá nhân hóa theo từng niche, phong cách (tone of voice), và dịch vụ outreach.
   - Bộ đếm giới hạn an toàn (Anti-spam quota) tuân thủ giới hạn gửi DM theo giai đoạn warm-up tài khoản Meta.

---

## 📁 Cấu trúc thư mục

```text
├── backend/
│   ├── src/
│   │   ├── database/db.js           # Quản lý SQLite database (node:sqlite)
│   │   ├── services/
│   │   │   ├── aiService.js         # Gemini AI draft generator
│   │   │   ├── leadFinderService.js # Google X-Ray & keyword search shortcuts
│   │   │   └── quotaService.js      # Kiểm soát quota an toàn hàng ngày
│   │   └── server.js                # REST API backend & static file server
│   └── package.json
├── extension/
│   ├── manifest.json                # Manifest V3 configuration
│   ├── background.js                # Extension service worker
│   ├── content.js                   # DOM scanner & widget cho Google / Instagram
│   └── popup/                       # Popup interface tiện ích
├── frontend/
│   ├── index.html                   # CRM Dashboard UI
│   ├── style.css                    # Modern Dark Cyberpunk theme
│   └── app.js                       # Frontend logic & API binding
├── LESSONS_LEARNED.md               # Cẩm nang quy tắc an toàn Meta & anti-ban
└── README.md
```

---

## 🛠️ Hướng dẫn cài đặt & khởi chạy

### 1. Khởi chạy Backend & CRM Dashboard

```bash
cd backend
npm start
```

Dashboard CRM sẽ sẵn sàng tại: `http://localhost:3000`

### 2. Cài đặt Chrome Extension

1. Mở trình duyệt Google Chrome, truy cập: `chrome://extensions/`
2. Bật công tắc **Developer mode (Chế độ dành cho nhà phát triển)** ở góc trên bên phải.
3. Bấm **Load unpacked (Tải tiện ích đã giải nén)**.
4. Chọn thư mục `extension/` trong dự án này.
5. Tiện ích **IG Safe Outreach Assistant** sẽ xuất hiện và tự động kích hoạt khi bạn tìm kiếm trên Google hoặc Instagram.

---

## 📄 Bản quyền & Giấy phép

Phát triển phục vụ mục đích tự động hóa outreach an toàn, tôn trọng chính sách cộng đồng và thuật toán nền tảng Meta.
MIT License.
