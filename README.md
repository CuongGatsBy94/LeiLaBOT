🤖 LeiLaBOT - Discord Bot Đa Năng Việt Nam
LeiLaBOT là một Discord bot đa chức năng được phát triển bằng JavaScript, mang đến trải nghiệm phong phú và tiện ích cho server Discord của bạn với giao diện tiếng Việt 100%!

🌟 Tính năng nổi bật
🤖 Hệ thống Bot Thông Minh
Thông tin chi tiết: Hiển thị đầy đủ thông tin bot với giao diện embed đẹp mắt

Trạng thái thời gian thực: Theo dõi ping, uptime, tài nguyên hệ thống

Tùy chỉnh linh hoạt: Thay đổi prefix dễ dàng

🔊 Hệ thống Âm nhạc
Phát nhạc từ YouTube: Hỗ trợ phát nhạc trực tiếp từ URL YouTube

Điều khiển đầy đủ: Play, pause, resume, stop

Chất lượng cao: Phát nhạc với chất lượng tốt nhất

⏰ Tin nhắn Tự động Thông minh
Chào buổi sáng (8:00): Tin nhắn động viên kèm lời khuyên hữu ích

Nhắc ăn trưa (12:00): Đến giờ nghỉ ngơi và nạp năng lượng

Chiều tà (17:30): Tổng kết ngày làm việc

Hoạt động tối (20:00): Gợi ý giải trí buổi tối

Chúc ngủ ngon (22:00): Nhắc nhở giờ ngủ kèm mẹo ngủ ngon

👥 Quản lý Thành viên
Danh sách thành viên: Hiển thị chi tiết với phân trang

Thông tin user: Xem profile đầy đủ với nhiều thông tin hữu ích

Quản lý role: Thêm/xóa role dễ dàng

Tự động chào mừng: Embed chào mừng thành viên mới

🎮 Giải trí & Mini Games
Bình chọn (Poll): Tạo bình chọn đa lựa chọn

Đoán số: Game đoán số ngẫu nhiên

Quiz: Câu đố kiến thức thú vị

Xổ số: Quay số ngẫu nhiên chọn người thắng cuộc

Nhắc lịch: Đặt lời nhắc cá nhân

📊 Thống kê & Phân tích
Thống kê hoạt động: Top thành viên tích cực

Thông tin server: Xem chi tiết server

Theo dõi tin nhắn: Thống kê số lượng tin nhắn

🌐 Tiện ích Đa năng
Dịch thuật: Hỗ trợ dịch đa ngôn ngữ

Xóa tin nhắn: Dọn dẹp tin nhắn hàng loạt

Slowmode: Quản lý tốc độ gửi tin nhắn

Tạo voice channel: Tạo phòng voice tự động

🎉 Sinh nhật & Sự kiện
Đặt sinh nhật: Nhận lời chúc tự động vào sinh nhật

Quản lý sự kiện: Thêm và nhắc nhở sự kiện

🚀 Cài đặt & Triển khai
Yêu cầu hệ thống
Node.js 16.9.0 hoặc cao hơn

Discord.js phiên bản 14

Kết nối internet ổn định

Bước 1: Clone repository
bash
git clone <repository-url>
cd leilabot
Bước 2: Cài đặt dependencies
bash
npm install
Bước 3: Cấu hình environment variables
Tạo file .env và thêm các biến sau:

env
DISCORD_TOKEN=your_discord_bot_token_here
CHANNEL_ID=your_channel_id_here
Bước 4: Chạy bot
bash
node bot.js
⚙️ Cấu hình
File cấu hình tự động
Bot tự động tạo các file cấu hình:

prefix.json - Lưu prefix của bot

message.json - Tin nhắn định kỳ

schedule.json - Lịch gửi tin nhắn

dailyMessages.json - Tin nhắn theo khung giờ

birthdays.json - Danh sách sinh nhật

events.json - Sự kiện

Cấu hình Quyền
Đảm bảo bot có các quyền sau:

📖 Đọc tin nhắn

💬 Gửi tin nhắn

📢 Quản lý tin nhắn

🔗 Embed links

📎 Đính kèm file

🎭 Quản lý role

🔊 Kết nối voice

🎤 Phát audio

📋 Danh sách Lệnh
🤖 Bot & Hệ thống
info - Thông tin chi tiết về bot

botstatus - Trạng thái bot và hệ thống

prefix - Xem prefix hiện tại

setprefix <prefix> - Đổi prefix (Admin)

help - Hiển thị danh sách lệnh

🔊 Âm nhạc
play <url> - Phát nhạc từ YouTube

stop - Dừng phát nhạc

pause - Tạm dừng nhạc

resume - Tiếp tục phát nhạc

createvoice - Tạo voice channel (Admin)

👥 Quản lý
members - Danh sách thành viên với phân trang

userinfo [@user] - Thông tin user

addrole <role> - Thêm role cho bản thân

removerole <role> - Xóa role khỏi bản thân

serverinfo - Thông tin server

⏰ Tin nhắn Tự động
setmessage <nội dung> - Đặt tin nhắn định kỳ (Admin)

setschedule <cron> - Đặt lịch gửi (Admin)

getmessage - Xem tin nhắn định kỳ

getschedule - Xem lịch gửi

🎮 Giải trí
poll "câu hỏi" "lựa chọn1" "lựa chọn2" - Tạo bình chọn

guess <số> - Đoán số từ 1-10

quiz - Câu đố kiến thức

lottery - Xổ số ngẫu nhiên

remindme <phút> [nội dung] - Đặt lời nhắc

📊 Thống kê
stats - Thống kê hoạt động thành viên

userinfo - Thông tin chi tiết user

🌐 Tiện ích
translate <văn bản> - Dịch sang tiếng Việt

clear <số> - Xóa tin nhắn (1-100)

slowmode <giây> - Đặt chế độ chậm

🎉 Sinh nhật & Sự kiện
setbirthday dd/mm - Đặt ngày sinh nhật

addevent dd/mm <nội dung> - Thêm sự kiện (Admin)

🕒 Lịch trình Tự động
Bot tự động gửi tin nhắn theo giờ Việt Nam (UTC+7):

🌅 08:00 - Chào buổi sáng với lời khuyên

🍽️ 12:00 - Nhắc ăn trưa

🌇 17:30 - Tin nhắn chiều tà

🌃 20:00 - Gợi ý hoạt động tối

🌙 22:00 - Chúc ngủ ngon

🔧 Tính năng Kỹ thuật
Hệ thống File
Tự động khởi tạo: Tạo file cấu hình nếu chưa có

JSON-based: Dễ dàng backup và restore

Error handling: Xử lý lỗi file không tồn tại

Xử lý Âm nhạc
YouTube DL: Hỗ trợ phát nhạc từ YouTube

Chất lượng cao: Lựa chọn chất lượng tốt nhất

Quản lý kết nối: Tự động dọn dẹp khi kết thúc

Bảo mật
Phân quyền rõ ràng: Chỉ Admin mới có thể sử dụng lệnh quan trọng

Kiểm tra URL: Validate URL YouTube trước khi phát

Giới hạn prefix: Ngăn chặn prefix độc hại

🐛 Xử lý Lỗi
Bot được tích hợp hệ thống xử lý lỗi toàn diện:

Error Embed: Hiển thị lỗi dưới dạng embed thân thiện

Console Logging: Ghi log chi tiết để debug

Graceful Degradation: Xử lý mượt mà khi có lỗi

📈 Thống kê Ấn tượng
✅ 50+ Lệnh đa dạng

✅ 10+ Tính năng độc đáo

✅ Hỗ trợ tiếng Việt 100%

✅ Uptime 99.9% - Hoạt động ổn định

✅ Xử lý nhanh - Phản hồi tức thì

✅ Hoàn toàn miễn phí - Không giới hạn tính năng
