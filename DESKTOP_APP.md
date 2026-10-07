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

## Đơn nghỉ phép và giờ làm

Trong **Đề xuất → Đề xuất nghỉ phép & giờ làm**, chọn tạo đề xuất để nhập thông tin và xem đơn tự cập nhật. Họ tên được lấy từ tài khoản đăng nhập. Nút **In / Lưu PDF** mở cửa sổ in của trình duyệt; chọn **Lưu dưới dạng PDF** để lưu văn bản. Bản này là bản nháp, không thay thế thao tác **Gửi đề xuất** hoặc xác nhận phê duyệt. Tính năng lưu PDF phụ thuộc hỗ trợ in của trình duyệt/thiết bị; không tạo file Word và không thay đổi dữ liệu đề xuất. Đề xuất đi trễ vẫn yêu cầu ảnh và vị trí khi gửi.

Mỗi danh mục có mô tả ngắn và hai nút **Tạo đề xuất**, **Xem danh sách**. Mở **Hướng dẫn & lưu ý** trên thẻ để xem đầy đủ hướng dẫn trước khi gửi.

Trên điện thoại, cửa sổ tạo đề xuất mở toàn màn hình với hai tab **Nhập thông tin** và **Xem trước đơn**. Chuyển tab hoặc bấm **Quay lại chỉnh sửa** không làm mất thông tin đã nhập. Máy tính vẫn hiển thị hai cột.

Năm loại đề xuất nghỉ phép/giờ làm và đề xuất thanh toán mới bắt buộc ký tay trong khung dưới ô lý do trước khi gửi. Có thể dùng chuột, bút hoặc ngón tay và bấm **Xóa / Ký lại**. Chữ ký được điền vào bản xem trước/bản in và lưu cùng đề xuất để xem trong danh sách cá nhân và chi tiết báo cáo. Đề xuất cũ không có chữ ký vẫn xem được. Đây là ảnh chữ ký tay, không phải chữ ký số có chứng thư.

Nhập **Họ và tên đầy đủ** dưới bảng ký (bắt buộc, tối đa 150 ký tự). Tên này được đặt dưới chữ ký trên đơn và lưu cùng chữ ký; tên tài khoản vẫn giữ nguyên để xác định người gửi.

Dòng lưu ý **BẢN NHÁP** chỉ hiện trong bản xem trước, không in ra giấy/PDF. Để bỏ tên trang và địa chỉ web ở mép giấy, tắt **Đầu trang và chân trang** trong cài đặt in của trình duyệt; ứng dụng không tự thay đổi tùy chọn này.

Trong **Xem danh sách**, mỗi đề xuất có **Xem lại đơn** và **Tải đơn PDF**. Đơn lấy ngày áp dụng, lý do, chữ ký và họ tên người ký từ dữ liệu đã gửi, không lấy từ biểu mẫu đang nhập. Bản PDF tải trực tiếp có phông tiếng Việt nhúng sẵn, không có địa chỉ web/đầu chân trang trình duyệt hay dòng “BẢN NHÁP”. Đề xuất cũ thiếu chữ ký vẫn tải được với phần ký để trống. Người gửi chỉ truy cập được đơn của mình; Admin/CEO xem được qua chi tiết báo cáo. Kế toán chỉ xem/tải đơn thanh toán thuộc phạm vi báo cáo kế toán hiện có. Trạng thái duyệt vẫn hiển thị trong danh sách, không tự thêm chữ ký của người duyệt vào đơn.

## Đơn thanh toán có chữ ký

Trang chọn đề xuất chỉ có một ô **Đề xuất thanh toán**. Bên trong chọn **Gửi CEO / Admin** (CEO/Admin duyệt rồi Kế toán xác nhận) hoặc **Gửi Kế toán** (Kế toán xác nhận trực tiếp). Các đường dẫn cũ có `?flow=ceo`/`?flow=accountant` vẫn chọn đúng luồng. Danh sách cá nhân được lọc theo luồng đang chọn.

Báo cáo thanh toán và chuông chưa xem được lọc theo người nhận: CEO/Admin chỉ nhận các đơn thuộc luồng CEO (kể cả trạng thái sau khi chuyển Kế toán); đơn gửi trực tiếp Kế toán không xuất hiện trong báo cáo hoặc làm chuông CEO/Admin đỏ. Kế toán nhận đơn trực tiếp và đơn luồng CEO đã chuyển sang bước kế toán/hoàn tất. Hàng đợi duyệt, thông báo thời gian thực và push vẫn gửi đúng người phụ trách từng bước. Quyền quản trị xem dữ liệu tổng và truy cập đơn vẫn giữ nguyên.

Đơn thanh toán được dựng theo mẫu **Giấy đề nghị thanh toán 05-TT** người dùng cung cấp: đơn vị, bộ phận, ngày lập, người đề nghị, bảng STT/nội dung/số tiền/chứng từ, tổng tiền, tiền bằng chữ, thông tin chuyển khoản và ba cột ký **Người đề nghị – Kế toán trưởng – Giám Đốc**. Họ tên nhập dưới chữ ký được dùng cho cả người đề nghị ở đầu đơn và tên dưới chữ ký; tài khoản gửi vẫn được lưu riêng để kiểm soát quyền. Không tự thêm chữ ký của kế toán hay giám đốc.

Nhập bộ phận và từ 1–50 khoản chi, mỗi khoản có nội dung, số tiền nguyên VNĐ lớn hơn 0 và diễn giải chứng từ (không bắt buộc). Bấm **+ Thêm nội dung thanh toán** để thêm khoản chi, hoặc **Xóa khoản** để bỏ khoản không cần. Bảng xem trước, bản in và PDF chỉ có đúng số dòng khoản chi đã nhập, không bổ sung dòng trống cho đủ 6 dòng. Tổng tiền và số tiền bằng chữ tính tự động; máy chủ tính lại tổng từ các khoản chi, không tin tổng do trình duyệt gửi. Thông tin chuyển khoản tùy chọn, nếu nhập cần đủ chủ tài khoản, tài khoản thụ hưởng và ngân hàng. Số tài khoản giữ nguyên cả số 0 đầu. Ghi chú bổ sung chỉ dùng trong ứng dụng, không in lên mẫu.

Chứng từ đính kèm không bắt buộc, vẫn giới hạn 7 MB nếu tải lên. Mẫu tham khảo và chức năng cập nhật mẫu của quản trị vẫn có trong mục mở rộng. Mobile có hai tab nhập/ký và xem trước; sau khi gửi có thể xem lại hoặc tải PDF trong danh sách. PDF dùng cùng thông tin đã lưu và bố cục mẫu, có phông tiếng Việt, tự sang trang với nhiều khoản chi. Các bước duyệt, từ chối, xác nhận và thông báo theo luồng cũ được giữ nguyên. Đơn thanh toán cũ không có các trường mới vẫn xem/tải được từ hạng mục và số tiền đã lưu.

## Tạo bộ cài Windows

```powershell
npm run dist:win
```

Bộ cài NSIS 64-bit được tạo trong thư mục `dist`. Cần Node.js và npm để build. Máy chủ phải được deploy trước khi nhân viên sử dụng; Google OAuth phải cho phép callback URL của máy chủ đó.