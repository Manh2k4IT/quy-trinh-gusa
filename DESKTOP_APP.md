# Ứng dụng desktop Windows

Ứng dụng desktop mở hệ thống web dùng chung trên cửa sổ riêng. Dữ liệu vẫn được lưu và đồng bộ qua máy chủ; bộ cài không chứa dữ liệu nhân sự hay thông tin bí mật OAuth.

## Chạy thử

```powershell
npm install
npm run desktop
```

Lần đầu mở ứng dụng, nhập URL HTTPS của máy chủ. Nhân viên cần được quản trị viên cung cấp cùng một URL. Có thể đổi URL trong menu **Máy chủ**.

Trên Windows, nút đóng cửa sổ sẽ đưa ứng dụng xuống khay hệ thống và giữ kết nối thông báo. Chọn **Thoát hoàn toàn** trong menu để tắt ứng dụng. Có thể bật **Khởi động cùng Windows** trong menu khay để nhận thông báo sau khi đăng nhập lại máy. Tài khoản quản lý cần đăng nhập và bật quyền thông báo/âm thanh một lần; các quyền đề xuất vẫn do máy chủ kiểm soát.

## Thông báo báo cáo chưa xem

Trong trang **Báo cáo**, chuông đỏ trên từng ô hiển thị số mục mới hoặc cập nhật kể từ lần mở báo cáo gần nhất. Lần đầu sử dụng, các mục hiện có được tính là chưa xem. Mở báo cáo và tải dữ liệu thành công sẽ đánh dấu đã xem cho riêng loại báo cáo đó; mở trang lỗi hoặc để trang chạy nền không xóa thông báo. Trang chọn báo cáo kiểm tra dữ liệu mỗi 15 giây khi đang hiển thị và khi quay lại trang.

Trạng thái đã xem được lưu riêng theo tài khoản trong trình duyệt/ứng dụng trên thiết bị hiện tại, không đồng bộ giữa các thiết bị. Chấm công được đếm theo nhân sự/ngày, đề xuất được đếm theo từng đề xuất; một mục cập nhật nhiều lần vẫn chỉ tính một mục chưa xem. Chỉ các báo cáo mà vai trò có quyền xem mới được trả về.

## Giao diện dùng chung

Mục **Cài đặt** lưu chế độ sáng/tối và màu chủ đạo trên thiết bị hiện tại. Các trang có menu dùng chung đều áp dụng lựa chọn này, kể cả trang chọn chấm công, đề xuất, báo cáo và các màn hình chi tiết. Các tab cùng trình duyệt cập nhật khi cài đặt thay đổi. Màu trạng thái (đã duyệt, từ chối, chờ xử lý), chuông thông báo và bản xem trước tài liệu vẫn giữ màu riêng để bảo toàn ý nghĩa và nội dung tài liệu.

## Tạo bộ cài Windows

```powershell
npm run dist:win
```

Bộ cài NSIS 64-bit được tạo trong thư mục `dist`. Cần Node.js và npm để build. Máy chủ phải được deploy trước khi nhân viên sử dụng; Google OAuth phải cho phép callback URL của máy chủ đó.