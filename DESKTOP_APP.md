# Ứng dụng desktop Windows

## Biểu tượng ứng dụng

Biểu tượng Windows, Android và iOS lấy từ `motif 2223 green.png`. Chạy `npm run icons:generate` trên Windows để tạo lại các kích thước, giữ nguyên tỷ lệ ảnh và thêm nền trắng; biểu tượng Android adaptive có khoảng an toàn để tránh bị cắt bởi mặt nạ launcher. Windows dùng biểu tượng này cho cửa sổ, khay hệ thống, ứng dụng và bộ cài. Cần build và cài lại bản desktop/APK (hoặc build iOS trên macOS) để thiết bị nhận biểu tượng mới; deploy website không thay được biểu tượng ứng dụng đã cài. Logo bên trong giao diện web không thay đổi.

Website dùng cùng biểu tượng cho tab trình duyệt, Apple touch icon và manifest ghim màn hình chính (192/512 px). Sau khi deploy, biểu tượng ghim cũ có thể vẫn nằm trong bộ nhớ của hệ điều hành; nếu chưa đổi, xóa lối tắt cũ rồi thêm lại từ trình duyệt.

Trình duyệt giữ phiên đăng nhập bằng cookie HttpOnly trong 30 ngày kể từ lần đăng nhập, không lưu mật khẩu Google. Khi mở lại đường dẫn trang chủ/lối tắt trong cùng trình duyệt còn cookie hợp lệ, hệ thống tự mở sơ đồ tổ chức (hoặc trang chờ duyệt đối với tài khoản pending). Đăng xuất hủy phiên phía máy chủ; phiên hết hạn hoặc đã xóa cookie phải đăng nhập lại. Chế độ ẩn danh, trình duyệt xóa cookie khi đóng hoặc cửa sổ web dùng kho cookie riêng không bảo đảm giữ phiên.

Ứng dụng desktop mở hệ thống web dùng chung trên cửa sổ riêng. Dữ liệu vẫn được lưu và đồng bộ qua máy chủ; bộ cài không chứa dữ liệu nhân sự hay thông tin bí mật OAuth.

## Chạy thử

### Chia sẻ vị trí trên Windows

Ứng dụng cho phép quyền vị trí và thông báo chỉ đối với địa chỉ máy chủ đã cấu hình; các quyền và nguồn khác vẫn bị chặn. Nút **Mở Cài đặt** trong biểu mẫu đề xuất mở cài đặt vị trí Windows. Bật **Dịch vụ vị trí** và cho phép **ứng dụng trên máy tính truy cập vị trí**, rồi quay lại nhấn **Chia sẻ vị trí**. Khả năng xác định vị trí và độ chính xác còn phụ thuộc Windows và dịch vụ định vị của máy. Bộ cài desktop cũ cần được cập nhật để có thay đổi quyền này.

Trên Windows, đề xuất và chấm công lấy tọa độ trực tiếp từ dịch vụ vị trí Windows qua `GeoCoordinateWatcher`, không dùng dịch vụ định vị Google của Electron và không cần Google API key. Gusa có thể hiện trong danh sách ứng dụng desktop đang dùng vị trí nhưng không có công tắc riêng như ứng dụng Store. Nên bật Wi-Fi để Windows xác định vị trí; máy không có nguồn định vị vẫn có thể trả về lỗi dù đã cấp quyền. Mỗi lần lấy vị trí chờ tối đa 30 giây. Trình duyệt và điện thoại giữ cơ chế định vị hiện có. Cần cập nhật cả bộ cài desktop và giao diện trên máy chủ để sử dụng luồng mới.

```powershell
npm install
npm run desktop
```

Lần đầu mở ứng dụng, nhập URL HTTPS của máy chủ. Nhân viên cần được quản trị viên cung cấp cùng một URL. Có thể đổi URL trong menu **Máy chủ**.

Trên Windows, nút đóng cửa sổ sẽ đưa ứng dụng xuống khay hệ thống và giữ kết nối thông báo. Chọn **Thoát hoàn toàn** trong menu để tắt ứng dụng. Có thể bật **Khởi động cùng Windows** trong menu khay để nhận thông báo sau khi đăng nhập lại máy. Tài khoản quản lý cần đăng nhập và bật quyền thông báo/âm thanh một lần; các quyền đề xuất vẫn do máy chủ kiểm soát.

## Giới hạn mạng chấm công tại công ty

IPv6 cấp địa chỉ riêng cho từng thiết bị, kể cả khi cùng Wi-Fi. Có thể nhập dải IPv6 công cộng `/64` (ví dụ `2402:800:6370:b5c8::/64`) để cho phép cả mạng đó; các prefix khác không được hỗ trợ nhằm tránh thêm nhầm dải quá rộng. Nút **Thêm mạng đang kết nối** lấy dải `/64` nếu kết nối hiện tại dùng IPv6, hoặc IP đơn nếu dùng IPv4. IP đơn đã lưu không tự chuyển thành dải mạng. Thiết bị đi qua IPv4 cần thêm IP công cộng IPv4 của cùng đường truyền. Dải mạng nhận diện mạng dây/Wi-Fi chung đường truyền, không xác minh SSID; khi nhà mạng đổi prefix IPv6 hoặc IP IPv4 thì phải cập nhật, đây không phải chức năng tự cập nhật IP động.

Dưới hai lựa chọn trên trang **Chấm công**, chỉ Admin/CEO đang hoạt động thấy mục **Mạng công ty được phép chấm công**. Nhập IP Internet công cộng IPv4/IPv6 hoặc dải IPv6 `/64`, mỗi dòng một mục (tối đa 100), hoặc dùng **Thêm mạng đang kết nối** khi đang ở mạng công ty, rồi lưu. Không nhập IP router nội bộ như `192.168.1.1`. Danh sách trống giữ nguyên chấm công không giới hạn mạng.

Khi có danh sách, máy chủ kiểm tra IP cho cả check-in và check-out tại công ty, kể cả khi gọi API trực tiếp. Check-out dùng hình thức làm việc đã lưu khi check-in, không dùng hình thức do client gửi để bỏ qua kiểm tra. Chấm công online không bị giới hạn này. IP Internet không xác minh tên Wi-Fi; mạng dây cùng đường Internet cũng được phép, VPN/đường truyền chung có thể dùng cùng IP. IP động thay đổi thì Admin/CEO phải cập nhật; có thể cần thêm cả IPv4 và IPv6 của mạng.

Cấu hình lưu trong `attendance-network.json` ở thư mục dữ liệu bền vững, không cung cấp qua static và không đưa lên Git. `ATTENDANCE_TRUST_PROXY_HOPS` quy định số proxy tin cậy từ máy chủ ra ngoài: mặc định 0 khi truy cập trực tiếp; trên Render (`RENDER=true`), mặc định 2 khi đi qua Cloudflare rồi Render, hoặc đặt 1 nếu truy cập Render trực tiếp. Máy chủ lấy IP người dùng từ `X-Forwarded-For` sau đúng số hop proxy; vì vậy nút **Thêm IP đang kết nối** phải hiện IP Internet của mạng công ty, không phải IP Cloudflare. Chỉ cấu hình khi toàn bộ truy cập bắt buộc qua các proxy tin cậy; nếu thêm/bớt proxy khác, xác minh số hop và IP hiển thị trước khi lưu. Khi không tin proxy, bỏ qua `X-Forwarded-For`; khi tin proxy nhưng header không hợp lệ hoặc thiếu, không cho chấm công tại công ty với danh sách đã cấu hình.

## Thông báo báo cáo chưa xem

Trong trang **Báo cáo**, chuông đỏ trên từng ô hiển thị số mục mới hoặc cập nhật kể từ lần mở báo cáo gần nhất. Lần đầu sử dụng, các mục hiện có được tính là chưa xem. Mở báo cáo và tải dữ liệu thành công sẽ đánh dấu đã xem cho riêng loại báo cáo đó; mở trang lỗi hoặc để trang chạy nền không xóa thông báo. Trang chọn báo cáo kiểm tra dữ liệu mỗi 15 giây khi đang hiển thị và khi quay lại trang.

Trạng thái đã xem được lưu riêng theo tài khoản trong trình duyệt/ứng dụng trên thiết bị hiện tại, không đồng bộ giữa các thiết bị. Chấm công được đếm theo nhân sự/ngày, đề xuất được đếm theo từng đề xuất; một mục cập nhật nhiều lần vẫn chỉ tính một mục chưa xem. Chỉ các báo cáo mà vai trò có quyền xem mới được trả về.

## Giao diện dùng chung

Mục **Cài đặt** lưu chế độ sáng/tối và màu chủ đạo trên thiết bị hiện tại. Các trang có menu dùng chung đều áp dụng lựa chọn này, kể cả trang chọn chấm công, đề xuất, báo cáo và các màn hình chi tiết. Các tab cùng trình duyệt cập nhật khi cài đặt thay đổi. Màu trạng thái (đã duyệt, từ chối, chờ xử lý), chuông thông báo và bản xem trước tài liệu vẫn giữ màu riêng để bảo toàn ý nghĩa và nội dung tài liệu.

## Đơn nghỉ phép và giờ làm

Trong **Đề xuất → Đề xuất nghỉ phép & giờ làm**, chọn tạo đề xuất để nhập thông tin và xem đơn tự cập nhật. Họ tên được lấy từ tài khoản đăng nhập. Trên trình duyệt, nút **In / Lưu PDF** mở cửa sổ in; chọn **Lưu dưới dạng PDF** để lưu văn bản. Bản desktop dùng nút **Xem bản in / Lưu PDF**: chọn nơi lưu, ứng dụng tạo PDF A4 rồi mở bằng trình đọc PDF mặc định của Windows để xem và in, thay vì hộp thoại in Electron không hỗ trợ xem trước. Luồng này cũng áp dụng cho đơn thanh toán và cần cập nhật cả giao diện máy chủ lẫn bộ cài. Bản này là bản nháp, không thay thế thao tác **Gửi đề xuất** hoặc xác nhận phê duyệt; không tạo file Word và không thay đổi dữ liệu đề xuất. Đề xuất đi trễ vẫn yêu cầu ảnh và vị trí khi gửi.

Mỗi danh mục có mô tả ngắn và hai nút **Tạo đề xuất**, **Xem danh sách**. Mở **Hướng dẫn & lưu ý** trên thẻ để xem đầy đủ hướng dẫn trước khi gửi.

Trên điện thoại, cửa sổ tạo đề xuất mở toàn màn hình với hai tab **Nhập thông tin** và **Xem trước đơn**. Chuyển tab hoặc bấm **Quay lại chỉnh sửa** không làm mất thông tin đã nhập. Máy tính vẫn hiển thị hai cột.

Năm loại đề xuất nghỉ phép/giờ làm và đề xuất thanh toán mới bắt buộc ký tay trong khung dưới ô lý do trước khi gửi. Có thể dùng chuột, bút hoặc ngón tay và bấm **Xóa / Ký lại**. Chữ ký được điền vào bản xem trước/bản in và lưu cùng đề xuất để xem trong danh sách cá nhân và chi tiết báo cáo. Đề xuất cũ không có chữ ký vẫn xem được. Đây là ảnh chữ ký tay, không phải chữ ký số có chứng thư.

Nhập **Họ và tên đầy đủ** dưới bảng ký (bắt buộc, tối đa 150 ký tự). Tên này được đặt dưới chữ ký trên đơn và lưu cùng chữ ký; tên tài khoản vẫn giữ nguyên để xác định người gửi.

Dòng lưu ý **BẢN NHÁP** chỉ hiện trong bản xem trước, không in ra giấy/PDF. Để bỏ tên trang và địa chỉ web ở mép giấy, tắt **Đầu trang và chân trang** trong cài đặt in của trình duyệt; ứng dụng không tự thay đổi tùy chọn này.

Trong **Xem danh sách**, mỗi đề xuất có **Xem lại đơn** và **Tải đơn PDF**. Đơn lấy ngày áp dụng, lý do, chữ ký và họ tên người ký từ dữ liệu đã gửi, không lấy từ biểu mẫu đang nhập. Bản PDF tải trực tiếp có phông tiếng Việt nhúng sẵn, không có địa chỉ web/đầu chân trang trình duyệt hay dòng “BẢN NHÁP”. Đề xuất cũ thiếu chữ ký vẫn tải được với phần ký để trống. Người gửi chỉ truy cập được đơn của mình; Admin/CEO xem được qua chi tiết báo cáo. Kế toán chỉ xem/tải đơn thanh toán thuộc phạm vi báo cáo kế toán hiện có.

Sau khi Admin/CEO duyệt, ảnh xác nhận cố định **Đã_xác_nhận-removebg-preview.png** xuất hiện tại **Người phê duyệt** của đơn nhân sự hoặc **Giám Đốc** của đơn thanh toán, trong cả bản xem lại và PDF. Ảnh do quản trị cung cấp, có tên “Trần Thị Hồng”, được dùng chung theo yêu cầu và không xác minh danh tính/chữ ký số của tài khoản duyệt. Đơn nhân sự cũ đã duyệt cũng hiện ảnh; đơn thanh toán cũ cần có mốc duyệt quản lý và đã chuyển kế toán/hoàn tất. Đơn nháp, chờ quản lý duyệt, bị từ chối/hủy hoặc gửi trực tiếp kế toán không hiện ảnh. Đơn thanh toán hiện ảnh ngay khi Admin/CEO chuyển sang bước kế toán, không cần đợi kế toán xác nhận. Việc duyệt và tài khoản duyệt được lưu bởi máy chủ; người gửi không thể tự gắn ảnh xác nhận qua dữ liệu gửi đề xuất.

## Đơn thanh toán có chữ ký

Trang chọn đề xuất chỉ có một ô **Đề xuất thanh toán**. Bên trong chọn **Gửi CEO / Admin** (CEO/Admin duyệt rồi Kế toán xác nhận) hoặc **Gửi Kế toán** (Kế toán xác nhận trực tiếp). Các đường dẫn cũ có `?flow=ceo`/`?flow=accountant` vẫn chọn đúng luồng. Danh sách cá nhân được lọc theo luồng đang chọn.

Báo cáo thanh toán và chuông chưa xem được lọc theo người nhận: CEO/Admin chỉ nhận các đơn thuộc luồng CEO (kể cả trạng thái sau khi chuyển Kế toán); đơn gửi trực tiếp Kế toán không xuất hiện trong báo cáo hoặc làm chuông CEO/Admin đỏ. Kế toán nhận đơn trực tiếp và đơn luồng CEO đã chuyển sang bước kế toán/hoàn tất. Hàng đợi duyệt, thông báo thời gian thực và push vẫn gửi đúng người phụ trách từng bước. Quyền quản trị xem dữ liệu tổng và truy cập đơn vẫn giữ nguyên.

Đơn thanh toán được dựng theo mẫu **Giấy đề nghị thanh toán 05-TT** người dùng cung cấp: đơn vị, bộ phận, ngày lập, người đề nghị, bảng STT/nội dung/số tiền/chứng từ, tổng tiền, tiền bằng chữ, thông tin chuyển khoản và ba cột ký **Người đề nghị – Kế toán trưởng – Giám Đốc**. Họ tên nhập dưới chữ ký được dùng cho cả người đề nghị ở đầu đơn và tên dưới chữ ký; tài khoản gửi vẫn được lưu riêng để kiểm soát quyền. Giám Đốc có ảnh xác nhận sau khi Admin/CEO duyệt như mô tả trên; Kế toán trưởng vẫn để trống, kể cả sau khi kế toán xác nhận.

Nhập bộ phận và từ 1–50 khoản chi, mỗi khoản có nội dung, số tiền nguyên VNĐ lớn hơn 0 và diễn giải chứng từ (không bắt buộc). Bấm **+ Thêm nội dung thanh toán** để thêm khoản chi, hoặc **Xóa khoản** để bỏ khoản không cần. Bảng xem trước, bản in và PDF chỉ có đúng số dòng khoản chi đã nhập, không bổ sung dòng trống cho đủ 6 dòng. Tổng tiền và số tiền bằng chữ tính tự động; máy chủ tính lại tổng từ các khoản chi, không tin tổng do trình duyệt gửi. Thông tin chuyển khoản tùy chọn, nếu nhập cần đủ chủ tài khoản, tài khoản thụ hưởng và ngân hàng. Số tài khoản giữ nguyên cả số 0 đầu. Ghi chú bổ sung chỉ dùng trong ứng dụng, không in lên mẫu.

Chứng từ đính kèm không bắt buộc, vẫn giới hạn 7 MB nếu tải lên. Mẫu tham khảo và chức năng cập nhật mẫu của quản trị vẫn có trong mục mở rộng. Mobile có hai tab nhập/ký và xem trước; sau khi gửi có thể xem lại hoặc tải PDF trong danh sách. PDF dùng cùng thông tin đã lưu và bố cục mẫu, có phông tiếng Việt, tự sang trang với nhiều khoản chi. Các bước duyệt, từ chối, xác nhận và thông báo theo luồng cũ được giữ nguyên. Đơn thanh toán cũ không có các trường mới vẫn xem/tải được từ hạng mục và số tiền đã lưu.

## Tạo bộ cài Windows

```powershell
npm run dist:win
```

Bộ cài NSIS 64-bit được tạo trong thư mục `dist`. Cần Node.js và npm để build. Máy chủ phải được deploy trước khi nhân viên sử dụng; Google OAuth phải cho phép callback URL của máy chủ đó.