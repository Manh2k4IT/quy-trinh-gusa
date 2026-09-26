# Ứng dụng desktop Windows

Ứng dụng desktop mở hệ thống web dùng chung trên cửa sổ riêng. Dữ liệu vẫn được lưu và đồng bộ qua máy chủ; bộ cài không chứa dữ liệu nhân sự hay thông tin bí mật OAuth.

## Chạy thử

```powershell
npm install
npm run desktop
```

Lần đầu mở ứng dụng, nhập URL HTTPS của máy chủ. Nhân viên cần được quản trị viên cung cấp cùng một URL. Có thể đổi URL trong menu **Máy chủ**.

Trên Windows, nút đóng cửa sổ sẽ đưa ứng dụng xuống khay hệ thống và giữ kết nối thông báo. Chọn **Thoát hoàn toàn** trong menu để tắt ứng dụng. Có thể bật **Khởi động cùng Windows** trong menu khay để nhận thông báo sau khi đăng nhập lại máy. Tài khoản quản lý cần đăng nhập và bật quyền thông báo/âm thanh một lần; các quyền đề xuất vẫn do máy chủ kiểm soát.

## Tạo bộ cài Windows

```powershell
npm run dist:win
```

Bộ cài NSIS 64-bit được tạo trong thư mục `dist`. Cần Node.js và npm để build. Máy chủ phải được deploy trước khi nhân viên sử dụng; Google OAuth phải cho phép callback URL của máy chủ đó.