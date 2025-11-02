/**
 * @Author: Your name
 * @Date:   2025-11-02 21:28:43
 * @Last Modified by:   Your name
 * @Last Modified time: 2025-11-02 21:28:47
 */
// THÊM: Các import cần thiết
const os = require('os');
const { promisify } = require('util');

// THÊM: Class Logger nâng cao
class EnhancedLogger {
    static log(level, message, data = null) {
        const timestamp = new Date().toLocaleString('vi-VN', { 
            timeZone: 'Asia/Ho_Chi_Minh',
            hour12: false 
        });
        
        const emojis = {
            info: '📝',
            success: '✅', 
            warning: '⚠️',
            error: '❌',
            debug: '🐛',
            music: '🎵',
            event: '🎪',
            command: '⚡',
            security: '🔒',
            performance: '🚀'
        };
        
        const emoji = emojis[level] || '📄';
        console.log(`[${timestamp}] ${emoji} [${level.toUpperCase()}] ${message}`);
        
        if (data && process.env.DEBUG === 'true') {
            if (typeof data === 'object') {
                console.log(`[${timestamp}] 🔍 [DEBUG]`, JSON.stringify(data, null, 2));
            } else {
                console.log(`[${timestamp}] 🔍 [DEBUG]`, data);
            }
        }
    }

    // Giữ nguyên các method khác...
}

// THÊM: Health Check System
class HealthMonitor {
    static start() {
        setInterval(() => {
            const memoryUsage = process.memoryUsage();
            const stats = {
                memory: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
                uptime: formatUptime(process.uptime()),
                guilds: client.guilds.cache.size,
                users: client.users.cache.size,
                queues: musicQueues.size
            };
            
            if (memoryUsage.rss > 500 * 1024 * 1024) { // 500MB
                Logger.warning('Memory usage high:', stats);
            }
        }, 30000); // Check mỗi 30 giây
    }
}

// KHỞI CHẠY
client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        if (!process.env.DISCORD_TOKEN) {
            Logger.error('DISCORD_TOKEN không tồn tại trong file .env');
            process.exit(1);
        }
        
        Logger.success(`${client.user.tag} đã sẵn sàng!`);
        HealthMonitor.start();
        setupScheduledMessages();
        loadBirthdayCache();
        
        // Kiểm tra sinh nhật ngay khi khởi động
        setTimeout(checkBirthdays, 10000);
        
    })
    .catch(error => {
        Logger.error('Lỗi đăng nhập:', error);
        process.exit(1);
    });