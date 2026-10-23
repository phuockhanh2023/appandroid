# Đóng gói thành APK

## Cách A: GitHub tự build (không cần cài Android Studio)
1. Tạo repo mới (private cũng được) trên github.com, upload TOÀN BỘ nội dung thư mục này (nhớ cả thư mục .github).
2. Vào tab Actions > "Build APK" > Run workflow (hoặc nó tự chạy khi bạn upload).
3. Chờ vài phút, mở lần chạy xong > mục Artifacts > tải "app-debug" > giải nén ra app-debug.apk.
4. Chép APK vào điện thoại, mở lên cài (cho phép "cài từ nguồn không xác định").

## Cách B: Build trên máy tính
Cần Node 20+, JDK 21, Android Studio.
    npm install
    npx cap add android
    npx cap sync android
    npx cap open android      # rồi Build > Build APK(s)
