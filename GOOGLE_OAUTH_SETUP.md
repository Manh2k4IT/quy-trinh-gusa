# Cấu hình đăng nhập Google

> Đăng nhập Google OAuth cơ bản không cần cấu hình Billing. Nếu Google Cloud hiện lỗi `OR_BACR2_59` ở bước thanh toán, hãy đóng thông báo đó và tiếp tục trong `APIs & Services > OAuth consent screen`; không cần bật Billing cho luồng này.

1. Mở Google Cloud Console và tạo hoặc chọn một project.
2. Vào `APIs & Services > OAuth consent screen`, cấu hình ứng dụng và thêm email test nếu ứng dụng đang ở chế độ Testing.
3. Vào `APIs & Services > Credentials > Create credentials > OAuth client ID`.
4. Chọn loại ứng dụng `Web application`.
5. Thêm Authorized redirect URI:

   `http://localhost:5500/auth/callback`

6. Tạo file `.env` cạnh `server.js` dựa trên `.env.example`:

```env
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5500/auth/callback
SESSION_SECRET=mot-chuoi-ngau-nhien-dai
PORT=5500
```

7. Chạy lại ứng dụng:

```powershell
npm start
```

Sau đó mở `http://localhost:5500`. Nút đăng nhập và nút thêm tài khoản trong Quản lý user sẽ đi qua Google OAuth. Server sẽ lấy email, tên và ảnh đại diện từ Google rồi lưu user trong phiên chạy hiện tại.

Khi đưa lên Render, server tự dùng `RENDER_EXTERNAL_URL` để tạo callback HTTPS. Sau khi deploy, thêm URI `https://<domain-render>/auth/callback` vào Authorized redirect URIs của OAuth client. Không đưa `GOOGLE_CLIENT_SECRET` lên Git hoặc frontend.

## Deploy dùng chung trên Render

1. Đưa repository lên GitHub và tạo một Blueprint mới trong Render trỏ tới repository đó. Render sẽ đọc cấu hình ở `render.yaml`.
2. Khi Render yêu cầu giá trị bí mật, nhập `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` từ OAuth client loại Web application. `SESSION_SECRET` được Render tự tạo; ổ đĩa bền vững được gắn tại `/var/data` để giữ dữ liệu JSON qua các lần khởi động.
3. Sau khi deploy xong, lấy domain HTTPS của service và thêm `https://<domain-render>/auth/callback` vào Authorized redirect URIs trong Google Cloud Console.
4. Nhập domain đó vào ứng dụng desktop trên máy của từng nhân viên. Mọi người cần dùng cùng một domain để chia sẻ dữ liệu.
