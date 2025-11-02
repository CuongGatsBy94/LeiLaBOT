/**
 * @Author: Your name
 * @Date:   2025-11-02 22:04:41
 * @Last Modified by:   Your name
 * @Last Modified time: 2025-11-02 22:04:49
 */
const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔧 Đang thiết lập LeiLaBOT...');

try {
    // Xóa node_modules cũ nếu tồn tại
    if (fs.existsSync('node_modules')) {
        console.log('🗑️ Đang xóa node_modules cũ...');
        fs.rmSync('node_modules', { recursive: true, force: true });
    }

    // Xóa package-lock.json nếu tồn tại
    if (fs.existsSync('package-lock.json')) {
        fs.unlinkSync('package-lock.json');
    }

    console.log('📦 Đang cài đặt dependencies...');
    
    // Cài đặt các package với flags cụ thể
    execSync('npm install --legacy-peer-deps --production=false', { 
        stdio: 'inherit',
        cwd: process.cwd()
    });

    console.log('✅ Thiết lập thành công!');
    console.log('🚀 Khởi chạy bot với: npm start');

} catch (error) {
    console.error('❌ Lỗi thiết lập:', error.message);
    process.exit(1);
}