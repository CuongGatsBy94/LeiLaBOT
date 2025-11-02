/**
 * @Author: CuongGatsBy94
 * @Date: 2025-10-05 04:12:42
 * @Last Modified by:   Your name
 * @Last Modified time: 2025-11-02 21:57:34
 */

require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActivityType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Collection,
    PermissionsBitField
} = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    entersState, 
    VoiceConnectionStatus 
} = require('@discordjs/voice');
const playdl = require('play-dl');
const ytdl = require('ytdl-core');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const translate = require('@vitalets/google-translate-api');

// ==================== HỆ THỐNG LOGGING CHUYÊN NGHIỆP ====================

class Logger {
    static log(level, message, data = null) {
        const timestamp = new Date().toLocaleString('vi-VN', { 
            timeZone: 'Asia/Ho_Chi_Minh',
            hour12: false 
        });
        const emoji = {
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
        }[level] || '📄';

        console.log(`[${timestamp}] ${emoji} [${level.toUpperCase()}] ${message}`);
        
        if (data && process.env.DEBUG === 'true') {
            console.log(`[${timestamp}] 🔍 [DEBUG]`, data);
        }
    }

    static info(message, data = null) {
        this.log('info', message, data);
    }

    static success(message, data = null) {
        this.log('success', message, data);
    }

    static warn(message, data = null) {
        this.log('warning', message, data);
    }

    static error(message, data = null) {
        this.log('error', message, data);
    }

    static debug(message, data = null) {
        this.log('debug', message, data);
    }

    static music(message, data = null) {
        this.log('music', message, data);
    }

    static event(message, data = null) {
        this.log('event', message, data);
    }

    static command(message, data = null) {
        this.log('command', message, data);
    }
}

// Khởi tạo Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration,
    ]
});

// Biến toàn cục
const musicQueues = new Map();
const userCooldowns = new Map();
client.commands = new Collection();

// Paths cho file config
const configPath = path.join(__dirname, 'config');
const dataPath = path.join(__dirname, 'data');

// ==================== CLASS MUSICQUEUE NÂNG CAO ====================

class MusicQueue {
    constructor(guildId) {
        this.guildId = guildId;
        this.songs = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.connection = null;
        this.player = null;
        this.volume = 0.5;
        this.loop = false;
        this.textChannel = null;
        this.timeout = null;
        this.nowPlayingMessage = null;
        this.lastUpdate = Date.now();
    }

    // Cập nhật thời gian
    update() {
        this.lastUpdate = Date.now();
    }

    // Hủy queue
    destroy() {
        if (this.timeout) clearTimeout(this.timeout);
        if (this.connection) this.connection.destroy();
        if (this.player) this.player.stop();
        if (this.nowPlayingMessage) {
            this.nowPlayingMessage.delete().catch(() => {});
        }
    }

    // Lấy bài hát hiện tại
    getCurrentSong() {
        return this.songs[this.currentIndex];
    }

    // Lấy tổng số bài
    getTotalSongs() {
        return this.songs.length;
    }

    // Kiểm tra có bài hát không
    hasSongs() {
        return this.songs.length > 0 && this.currentIndex < this.songs.length;
    }
}

// ==================== HỆ THỐNG RATE LIMITING ====================

function checkRateLimit(userId, command, cooldown = 2000) {
    const key = `${userId}-${command}`;
    const now = Date.now();
    const lastUsed = userCooldowns.get(key) || 0;
    
    if (now - lastUsed < cooldown) {
        return false;
    }
    
    userCooldowns.set(key, now);
    return true;
}

// Dọn dẹp cache cũ
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of userCooldowns.entries()) {
        if (now - timestamp > 60000) { // 1 phút
            userCooldowns.delete(key);
        }
    }
}, 30000);

// ==================== HỆ THỐNG EMBED & STYLING ====================

// Hệ thống màu sắc
const colors = {
    primary: 0x5865F2,    // Discord Blurple
    success: 0x57F287,    // Discord Green
    warning: 0xFEE75C,    // Discord Yellow
    error: 0xED4245,      // Discord Red
    music: 0xEB459E,      // Pink cho âm nhạc
    info: 0x5865F2,       // Blue cho thông tin
    fun: 0xFF69B4,        // Pink cho giải trí
    utility: 0x99AAB5     // Gray cho tiện ích
};

// Hàm tạo embed cơ bản
function createEmbed(type, title, description, fields = [], thumbnail = null) {
    const embed = new EmbedBuilder()
        .setColor(colors[type] || colors.primary)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ 
            text: 'LeiLaBOT • Trao gửi yêu thương', 
            iconURL: client.user?.displayAvatarURL() 
        });

    if (fields.length > 0) {
        embed.addFields(...fields);
    }

    if (thumbnail) {
        embed.setThumbnail(thumbnail);
    }

    return embed;
}

// Hàm tạo embed âm nhạc
function createMusicEmbed(type, title, song = null, additionalFields = []) {
    const embed = createEmbed('music', title, song ? `**[${song.title}](${song.url})**` : '');

    if (song) {
        const fields = [
            { name: '📺 Kênh', value: song.channel, inline: true },
            { name: '⏱️ Thời lượng', value: song.duration, inline: true },
            { name: '👤 Yêu cầu bởi', value: song.requester, inline: true },
            ...additionalFields
        ];
        embed.addFields(fields);
        
        if (song.thumbnail) {
            embed.setThumbnail(song.thumbnail);
        }
    }

    return embed;
}

// Hàm tạo progress bar
function createProgressBar(current, total, length = 20) {
    const percentage = current / total;
    const progress = Math.round(length * percentage);
    const empty = length - progress;
    
    return '▰'.repeat(progress) + '▱'.repeat(empty) + ` ${Math.round(percentage * 100)}%`;
}

// ==================== EMBED ĐANG PHÁT VÀ NÚT ĐIỀU KHIỂN ====================

// Hàm tạo embed đang phát với nút
async function createNowPlayingEmbed(guildId) {
    const queue = getQueue(guildId);
    if (!queue.hasSongs()) return null;

    const song = queue.getCurrentSong();
    const progressBar = createProgressBar(queue.currentIndex + 1, queue.songs.length);
    
    const embed = createMusicEmbed('music', `${queue.isPaused ? '⏸️' : '🎶'} Đang phát`, song, [
        { name: '📊 Vị trí', value: `${queue.currentIndex + 1}/${queue.songs.length}`, inline: true },
        { name: '🔊 Âm lượng', value: `${Math.round(queue.volume * 100)}%`, inline: true },
        { name: '🔁 Lặp lại', value: queue.loop ? '✅ Bật' : '❌ Tắt', inline: true },
        { name: '📈 Tiến độ', value: progressBar, inline: false }
    ]);

    // Tạo các nút điều khiển
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('music_previous')
                .setEmoji('⏮️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(queue.currentIndex === 0),
            new ButtonBuilder()
                .setCustomId('music_pause_resume')
                .setEmoji(queue.isPaused ? '▶️' : '⏸️')
                .setStyle(queue.isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('music_skip')
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_stop')
                .setEmoji('⏹️')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('music_loop')
                .setEmoji('🔁')
                .setStyle(queue.loop ? ButtonStyle.Success : ButtonStyle.Secondary)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('music_volume_down')
                .setEmoji('🔉')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_shuffle')
                .setEmoji('🔀')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_queue')
                .setEmoji('📋')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_volume_up')
                .setEmoji('🔊')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_refresh')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary)
        );

    return { embeds: [embed], components: [row1, row2] };
}

// Hàm cập nhật embed đang phát
async function updateNowPlayingEmbed(guildId) {
    const queue = getQueue(guildId);
    if (!queue.nowPlayingMessage || !queue.hasSongs()) return;

    try {
        const messageData = await createNowPlayingEmbed(guildId);
        if (messageData) {
            await queue.nowPlayingMessage.edit(messageData);
            queue.update();
        }
    } catch (error) {
        Logger.error('Lỗi cập nhật embed đang phát:', error);
    }
}

// ==================== HỆ THỐNG FILE & CONFIG ====================

async function ensureDir(dirPath) {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
        Logger.info(`Đã tạo thư mục: ${dirPath}`);
    }
}

async function loadConfig(fileName, defaultData = {}) {
    try {
        const filePath = path.join(configPath, fileName);
        
        // ĐỌC FILE TRỰC TIẾP MỖI LẦN - KHÔNG DÙNG CACHE
        const data = await fs.readFile(filePath, 'utf8');
        const config = JSON.parse(data);
        
        Logger.debug(`Đã tải config: ${fileName}`, config);
        return config;
    } catch (error) {
        Logger.info(`Tạo file config mới: ${fileName}`, defaultData);
        await saveConfig(fileName, defaultData);
        return defaultData;
    }
}

async function loadData(fileName, defaultData = {}) {
    try {
        const filePath = path.join(dataPath, fileName);
        const data = await fs.readFile(filePath, 'utf8');
        Logger.info(`Đã tải data: ${fileName}`);
        return JSON.parse(data);
    } catch (error) {
        Logger.info(`Tạo file data mới: ${fileName}`, defaultData);
        await saveData(fileName, defaultData);
        return defaultData;
    }
}

async function saveConfig(fileName, data) {
    await ensureDir(configPath);
    const filePath = path.join(configPath, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    Logger.info(`Đã lưu config: ${fileName}`);
}

async function saveData(fileName, data) {
    await ensureDir(dataPath);
    const filePath = path.join(dataPath, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    Logger.info(`Đã lưu data: ${fileName}`);
}

// ==================== HỆ THỐNG SINH NHẬT NÂNG CẤP ====================

// Biến để theo dõi đã gửi chúc mừng sinh nhật trong ngày
let birthdayCache = {
    lastCheck: null,
    sentToday: new Set()
};

// Load cache từ file khi khởi động
async function loadBirthdayCache() {
    try {
        const cacheData = await loadData('birthdayCache.json', { lastCheck: null, sentToday: [] });
        birthdayCache.lastCheck = cacheData.lastCheck;
        birthdayCache.sentToday = new Set(cacheData.sentToday || []);
        Logger.info('Đã tải birthday cache từ file', { 
            lastCheck: birthdayCache.lastCheck, 
            sentToday: birthdayCache.sentToday.size 
        });
    } catch (error) {
        Logger.error('Lỗi tải birthday cache:', error);
    }
}

// Lưu cache vào file
async function saveBirthdayCache() {
    try {
        const cacheData = {
            lastCheck: birthdayCache.lastCheck,
            sentToday: Array.from(birthdayCache.sentToday)
        };
        await saveData('birthdayCache.json', cacheData);
    } catch (error) {
        Logger.error('Lỗi lưu birthday cache:', error);
    }
}

async function checkBirthdays() {
    try {
        const now = new Date();
        const todayStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        // Reset cache nếu đã qua ngày mới
        if (!birthdayCache.lastCheck || birthdayCache.lastCheck !== todayStr) {
            birthdayCache.lastCheck = todayStr;
            birthdayCache.sentToday.clear();
            await saveBirthdayCache();
            Logger.info(`Đã reset cache sinh nhật cho ngày ${todayStr}`);
        }

        const birthdays = await loadData('birthdays.json');
        const birthdayConfig = await loadConfig('birthdayConfig.json', {});

        Logger.info(`Kiểm tra sinh nhật: ${todayStr}`, {
            totalUsers: Object.keys(birthdays).length,
            birthdayChannels: Object.keys(birthdayConfig).length,
            sentToday: birthdayCache.sentToday.size
        });

        let birthdayCount = 0;

        for (const [userId, birthday] of Object.entries(birthdays)) {
            if (birthday === todayStr && !birthdayCache.sentToday.has(userId)) {
                const user = await client.users.fetch(userId).catch(() => null);
                if (user) {
                    birthdayCount++;
                    birthdayCache.sentToday.add(userId);
                    await saveBirthdayCache();
                    
                    const embed = createEmbed('fun', '🎉 Chúc mừng sinh nhật!', 
                        `Chúc mừng sinh nhật ${user}! 🎂\n\nChúc bạn một ngày thật tuyệt vời với nhiều niềm vui và hạnh phúc! 🎈🎁`)
                        .setThumbnail(user.displayAvatarURL())
                        .addFields(
                            { name: '🎂 Tuổi mới', value: 'Thêm một tuổi mới, thêm nhiều thành công!', inline: true },
                            { name: '🎁 Lời chúc', value: 'Luôn vui vẻ và hạnh phúc nhé!', inline: true }
                        );

                    // Gửi đến tất cả server có cấu hình kênh sinh nhật
                    let sentToGuilds = 0;
                    for (const [guildId, channelId] of Object.entries(birthdayConfig)) {
                        const guild = client.guilds.cache.get(guildId);
                        if (guild) {
                            const channel = guild.channels.cache.get(channelId);
                            if (channel) {
                                const member = guild.members.cache.get(userId);
                                if (member) {
                                    await channel.send({ 
                                        content: `🎉 ${member.toString()}`,
                                        embeds: [embed] 
                                    }).catch(error => {
                                        Logger.error(`Lỗi gửi tin nhắn sinh nhật trong ${guild.name}:`, error);
                                    });
                                    sentToGuilds++;
                                    Logger.success(`Đã gửi lời chúc sinh nhật cho ${user.tag} trong ${guild.name}`);
                                }
                            }
                        }
                    }
                    
                    if (sentToGuilds > 0) {
                        Logger.success(`Đã gửi lời chúc sinh nhật cho ${user.tag} đến ${sentToGuilds} server`);
                    }
                }
            }
        }

        if (birthdayCount > 0) {
            Logger.success(`Đã chúc mừng sinh nhật ${birthdayCount} người dùng`);
        }
    } catch (error) {
        Logger.error('Lỗi kiểm tra sinh nhật:', error);
    }
}

// ==================== TIN NHẮN CHÀO MỪNG & TẠM BIỆT ====================

const welcomeMessages = [
    {
        title: "🎉 CHÀO MỪNG THÀNH VIÊN MỚI!",
        description: "Chào mừng {user} đến với {server}! 🎊",
        content: "Chúng tôi rất vui khi có bạn tham gia cộng đồng! Hãy giới thiệu đôi chút về bản thân nhé! 💫",
        color: 0x57F287,
        image: "https://cdn.discordapp.com/attachments/1045746639303876638/1234567890123456789/welcome-1.png"
    },
    {
        title: "🌟 XIN CHÀO!",
        description: "Ồ! {user} vừa gia nhập {server}! ✨",
        content: "Cánh cửa thần kỳ vừa mở ra và một thành viên mới đã xuất hiện! Hãy chào đón nào! 🎇",
        color: 0xFEE75C,
        image: "https://cdn.discordapp.com/attachments/1045746639303876638/1234567890123456789/welcome-2.png"
    },
    {
        title: "🤗 WELCOME ABOARD!",
        description: "Xin chào {user}! Cộng đồng {server} chào đón bạn! 🎈",
        content: "Bạn là thành viên thứ {memberCount} của chúng tôi! Hãy cùng xây dựng một cộng đồng tuyệt vời nhé! 🏰",
        color: 0xEB459E,
        image: "https://cdn.discordapp.com/attachments/1045746639303876638/1234567890123456789/welcome-3.png"
    },
    {
        title: "🚀 PHÁT HIỆN THÀNH VIÊN MỚI!",
        description: "Chào mừng {user} đã hạ cánh tại {server}! 🌠",
        content: "Chuyến phiêu lưu mới của bạn tại {server} sắp bắt đầu! Hãy sẵn sàng cho những trải nghiệm tuyệt vời! 🎮",
        color: 0x5865F2,
        image: "https://cdn.discordapp.com/attachments/1045746639303876638/1234567890123456789/welcome-4.png"
    },
    {
        title: "💫 CÓ THÀNH VIÊN MỚI!",
        description: "Hey {user}! Bạn đã tìm thấy {server} - ngôi nhà mới của bạn! 🏡",
        content: "Thế giới {server} chào đón bạn! Hãy khám phá và kết nối với mọi người nhé! 🌈",
        color: 0x99AAB5,
        image: "https://cdn.discordapp.com/attachments/1045746639303876638/1234567890123456789/welcome-5.png"
    }
];

const goodbyeMessages = [
    {
        title: "😢 TẠM BIỆT!",
        description: "{user} đã rời khỏi {server}...",
        content: "Chúc bạn may mắn trên hành trình tiếp theo! Hy vọng sẽ gặp lại bạn một ngày không xa! 🌙",
        color: 0xED4245,
        image: "https://cdn.discordapp.com/attachments/1045746639303876638/1234567890123456789/goodbye-1.png"
    },
    {
        title: "👋 ĐÃ CÓ NGƯỜI RỜI ĐI",
        description: "{user} vừa nói lời tạm biệt với {server}...",
        content: "Cánh cửa đóng lại, nhưng kỷ niệm vẫn còn đây. Hẹn gặp lại! 💔",
        color: 0xFEE75C,
        image: "https://cdn.discordapp.com/attachments/1045746639303876638/1234567890123456789/goodbye-2.png"
    },
    {
        title: "🚪 THÀNH VIÊN RỜI SERVER",
        description: "Tạm biệt {user}! Cảm ơn bạn đã đồng hành cùng {server}!",
        content: "Dù bạn đi đâu, chúng tôi vẫn sẽ nhớ về khoảng thời gian bạn ở đây! 📸",
        color: 0x99AAB5,
        image: "https://cdn.discordapp.com/attachments/1045746639303876638/1234567890123456789/goodbye-3.png"
    },
    {
        title: "🌅 KẾT THÚC HÀNH TRÌNH",
        description: "{user} đã kết thúc hành trình tại {server}...",
        content: "Mọi cuộc gặp gỡ rồi sẽ có lúc chia ly. Chúc bạn tìm thấy nơi mình thuộc về! 🏞️",
        color: 0x5865F2,
        image: "https://cdn.discordapp.com/attachments/1045746639303876638/1234567890123456789/goodbye-4.png"
    },
    {
        title: "💨 CÓ NGƯỜI VỜI BAY MẤT",
        description: "{user} đã biến mất khỏi {server} như một cơn gió...",
        content: "Thời gian của bạn ở đây có thể ngắn ngủi, nhưng vẫn đáng để trân trọng! 🍃",
        color: 0xEB459E,
        image: "https://cdn.discordapp.com/attachments/1045746639303876638/1234567890123456789/goodbye-5.png"
    }
];

// ==================== HỆ THỐNG TIN NHẮN TỰ ĐỘNG ====================

const scheduleTemplates = {
    morning: {
        title: "🌅 CHÀO BUỔI SÁNG - 08:00",
        description: "Hãy bắt đầu ngày mới với năng lượng tích cực và tràn đầy cảm hứng! 🌞",
        tip: "💡 Mẹo: Uống một ly nước ấm để khởi động hệ tiêu hóa",
        tomorrow: "Chúc bạn một ngày làm việc hiệu quả và nhiều thành công! 💼",
        footer: "Have a wonderful day! 🌈"
    },
    noon: {
        title: "🍱 GIỜ ĂN TRƯA - 12:00",
        description: "Đã đến giờ nghỉ ngơi và nạp năng lượng cho buổi chiều! 🍽️",
        tip: "💡 Mẹo: Ăn chậm nhai kỹ giúp tiêu hóa tốt hơn",
        tomorrow: "Buổi chiều làm việc hiệu quả và tràn đầy năng lượng! 📊",
        footer: "Enjoy your meal! 😋"
    },
    afternoon: {
        title: "🌤️ BUỔI CHIỀU - 17:30", 
        description: "Cố lên, chỉ còn một chút nữa là hoàn thành ngày làm việc! 💪",
        tip: "💡 Mẹo: Đứng dậy vươn vai sau mỗi 30 phút làm việc",
        tomorrow: "Hẹn gặp lại bạn vào ngày mai với nhiều điều thú vị! 🌇",
        footer: "You're doing great! 🎯"
    },
    evening: {
        title: "🌃 BUỔI TỐI - 20:00",
        description: "Thời gian thư giãn và tận hưởng không khí gia đình ấm áp! 🛋️",
        tip: "💡 Mẹo: Tắt các thiết bị điện tử 1 giờ trước khi ngủ",
        tomorrow: "Ngày mai sẽ mang đến những cơ hội mới tuyệt vời! ✨",
        footer: "Relax and recharge! 🎮"
    },
    night: {
        title: "🌙 CHÚC NGỦ NGON - 22:00",
        description: "Đêm đã khuya! Hãy tắt máy và nghỉ ngơi thôi nào! 🛌",
        tip: "💡 Mẹo: Giữ phòng ngủ mát mẻ và thoáng khí",
        tomorrow: "Hẹn gặp lại vào buổi sáng! 🌅",
        footer: "Sweet dreams! 💫"
    }
};

function createScheduleEmbed(type, customDescription = null) {
    const template = scheduleTemplates[type];
    if (!template) return null;

    const colors = {
        morning: 0xFFD700,    // Vàng
        noon: 0x32CD32,       // Xanh lá
        afternoon: 0xFFA500,  // Cam
        evening: 0x8A2BE2,    // Tím
        night: 0x000080       // Xanh đêm
    };

    const embed = new EmbedBuilder()
        .setColor(colors[type])
        .setTitle(template.title)
        .setDescription(customDescription || template.description)
        .addFields(
            { 
                name: '🌟 ' + (type === 'morning' ? 'Mẹo buổi sáng' : 
                              type === 'noon' ? 'Mẹo ăn uống' :
                              type === 'afternoon' ? 'Mẹo làm việc' :
                              type === 'evening' ? 'Mẹo thư giãn' : 'Mẹo ngủ ngon'), 
                value: template.tip, 
                inline: false 
            },
            { 
                name: '📅 ' + (type === 'night' ? 'Ngày mai' : 'Tiếp theo'), 
                value: template.tomorrow, 
                inline: false 
            }
        )
        .setFooter({ text: template.footer })
        .setTimestamp();

    return embed;
}

// ==================== HỆ THỐNG ÂM NHẠC NÂNG CẤP ====================

function getQueue(guildId) {
    if (!musicQueues.has(guildId)) {
        musicQueues.set(guildId, new MusicQueue(guildId));
    }
    return musicQueues.get(guildId);
}

// Hàm đảm bảo kết nối voice
async function ensureVoiceConnection(guildId, voiceChannel, textChannel) {
    const queue = getQueue(guildId);
    
    if (!queue.connection) {
        try {
            queue.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guildId,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            });

            queue.player = createAudioPlayer();
            queue.connection.subscribe(queue.player);

            // Xử lý sự kiện kết nối
            queue.connection.on(VoiceConnectionStatus.Ready, () => {
                Logger.music(`Đã kết nối voice channel: ${voiceChannel.name}`);
            });

            queue.connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(queue.connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(queue.connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                } catch (error) {
                    queue.connection.destroy();
                    musicQueues.delete(guildId);
                    Logger.music(`Đã ngắt kết nối voice channel: ${voiceChannel.name}`);
                }
            });

        } catch (error) {
            Logger.error('Lỗi kết nối voice:', error);
            throw error;
        }
    }
    
    queue.textChannel = textChannel;
}

// Hàm phát nhạc nâng cao với embed
async function playSong(guildId, retryCount = 0) {
    const queue = getQueue(guildId);
    
    if (retryCount > 3) {
        Logger.error(`Quá nhiều lần thử lại cho guild ${guildId}`);
        if (queue.textChannel) {
            const embed = createEmbed('error', '❌ Lỗi phát nhạc', 
                'Không thể phát nhạc sau nhiều lần thử. Vui lòng thử lại sau.');
            queue.textChannel.send({ embeds: [embed] }).catch(() => {});
        }
        queue.destroy();
        musicQueues.delete(guildId);
        return;
    }

    if (queue.currentIndex >= queue.songs.length) {
        if (queue.loop && queue.songs.length > 0) {
            queue.currentIndex = 0;
        } else {
            // End of queue
            if (queue.connection) {
                if (queue.textChannel) {
                    const embed = createEmbed('success', '🎵 Kết thúc hàng chờ', 
                        'Tất cả bài hát trong hàng chờ đã được phát xong!');
                    queue.textChannel.send({ embeds: [embed] }).catch(console.error);
                }
                
                // Xóa embed đang phát
                if (queue.nowPlayingMessage) {
                    queue.nowPlayingMessage.delete().catch(() => {});
                }
                
                queue.connection.destroy();
            }
            musicQueues.delete(guildId);
            return;
        }
    }

    const song = queue.songs[queue.currentIndex];
    
    try {
        queue.isPlaying = true;
        queue.isPaused = false;

        // Tạo và gửi embed đang phát
        if (queue.textChannel && !queue.nowPlayingMessage) {
            const messageData = await createNowPlayingEmbed(guildId);
            if (messageData) {
                queue.nowPlayingMessage = await queue.textChannel.send(messageData);
                Logger.music(`Đã tạo embed đang phát cho: ${song.title}`);
            }
        }

        // THỬ play-dl TRƯỚC
        let stream;
        try {
            Logger.debug(`Thử play-dl cho: ${song.title}`, { url: song.url });
            
            let videoUrl = song.url;
            if (!playdl.yt_validate(videoUrl)) {
                const searchResults = await playdl.search(song.title, { limit: 1 });
                if (searchResults && searchResults.length > 0) {
                    videoUrl = searchResults[0].url;
                    Logger.debug(`Đã tìm thấy URL thay thế: ${videoUrl}`);
                }
            }
            
            stream = await playdl.stream(videoUrl, { 
                quality: 2,
                discordPlayerCompatibility: true
            });
            Logger.success(`play-dl thành công cho: ${song.title}`);
        } catch (playDlError) {
            Logger.warn(`play-dl thất bại, thử ytdl-core: ${playDlError.message}`);
            
            // FALLBACK: sử dụng ytdl-core
            try {
                stream = {
                    stream: ytdl(song.url, {
                        filter: 'audioonly',
                        quality: 'lowestaudio',
                        highWaterMark: 1 << 25
                    }),
                    type: 'opus'
                };
                Logger.success(`ytdl-core fallback thành công cho: ${song.title}`);
            } catch (ytdlError) {
                Logger.error(`Cả hai phương thức đều thất bại:`, ytdlError);
                throw new Error(`Không thể tạo stream: ${ytdlError.message}`);
            }
        }

        if (!stream) {
            throw new Error('Không thể tạo audio stream');
        }

        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
            inlineVolume: true
        });

        if (!resource) {
            throw new Error('Không thể tạo audio resource');
        }

        if (resource.volume) {
            resource.volume.setVolume(queue.volume || 0.5);
        }

        // Xóa listener cũ trước khi thêm mới
        queue.player.removeAllListeners();

        queue.player.play(resource);
        
        // Cập nhật embed
        await updateNowPlayingEmbed(guildId);

        Logger.music(`Đang phát: ${song.title}`, {
            guild: guildId,
            position: queue.currentIndex + 1,
            total: queue.songs.length
        });

        // Xử lý khi bài hát kết thúc
        queue.player.once(AudioPlayerStatus.Idle, () => {
            Logger.debug(`Bài hát kết thúc: ${song.title}`);
            setTimeout(() => {
                if (!queue.loop) {
                    queue.currentIndex++;
                }
                playSong(guildId);
            }, 1000);
        });

        // Xử lý lỗi player
        queue.player.on('error', (error) => {
            Logger.error('Lỗi AudioPlayer:', error);
            if (queue.textChannel) {
                const embed = createEmbed('error', '❌ Lỗi phát nhạc', 
                    `Không thể phát: **${song.title}**\nĐang chuyển sang bài tiếp theo...`);
                queue.textChannel.send({ embeds: [embed] }).catch(console.error);
            }
            queue.currentIndex++;
            setTimeout(() => playSong(guildId, retryCount + 1), 2000);
        });

    } catch (error) {
        Logger.error(`Lỗi phát nhạc:`, error);
        
        if (queue.textChannel) {
            const embed = createEmbed('error', '❌ Lỗi nghiêm trọng', 
                `Không thể phát: **${song.title}**\nĐang chuyển sang bài tiếp theo...`);
            queue.textChannel.send({ embeds: [embed] }).catch(console.error);
        }
        queue.currentIndex++;
        setTimeout(() => playSong(guildId, retryCount + 1), 2000);
    }
}

// ==================== HEALTH MONITORING SYSTEM ====================

class HealthMonitor {
    static start() {
        setInterval(() => {
            const memoryUsage = process.memoryUsage();
            const stats = {
                memory: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
                uptime: formatUptime(process.uptime()),
                guilds: client.guilds.cache.size,
                users: client.users.cache.size,
                queues: musicQueues.size,
                activePlayers: Array.from(musicQueues.values()).filter(q => q.isPlaying).length
            };
            
            // Log cảnh báo nếu sử dụng bộ nhớ cao
            if (memoryUsage.rss > 500 * 1024 * 1024) {
                Logger.warning('Memory usage high:', stats);
            }
            
            // Dọn dẹp queue không hoạt động
            const now = Date.now();
            for (const [guildId, queue] of musicQueues.entries()) {
                if (now - queue.lastUpdate > 300000 && !queue.isPlaying) { // 5 phút
                    queue.destroy();
                    musicQueues.delete(guildId);
                    Logger.info(`Đã dọn dẹp queue không hoạt động: ${guildId}`);
                }
            }
        }, 60000); // Check mỗi 1 phút
    }
}

// ==================== XỬ LÝ TƯƠNG TÁC NÚT ====================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const [type, action] = interaction.customId.split('_');
    if (type !== 'music') return;

    await interaction.deferReply({ ephemeral: true });

    const queue = getQueue(interaction.guildId);
    const member = interaction.guild.members.cache.get(interaction.user.id);
    
    // Kiểm tra người dùng có trong voice channel không
    if (!member.voice.channel) {
        await interaction.editReply({
            content: '❌ Bạn cần tham gia kênh voice để sử dụng nút này!'
        });
        return;
    }

    // Kiểm tra bot có trong voice channel không
    if (!queue.connection) {
        await interaction.editReply({
            content: '❌ Bot không đang phát nhạc!'
        });
        return;
    }

    try {
        switch (action) {
            case 'pause_resume':
                if (queue.isPaused) {
                    queue.player.unpause();
                    queue.isPaused = false;
                    await interaction.editReply({
                        content: '▶️ Đã tiếp tục phát nhạc!'
                    });
                } else {
                    queue.player.pause();
                    queue.isPaused = true;
                    await interaction.editReply({
                        content: '⏸️ Đã tạm dừng nhạc!'
                    });
                }
                break;

            case 'skip':
                if (queue.songs.length <= queue.currentIndex + 1) {
                    await interaction.editReply({
                        content: '❌ Không có bài hát nào tiếp theo!'
                    });
                    return;
                }
                queue.currentIndex++;
                queue.player.stop();
                await interaction.editReply({
                    content: '⏭️ Đã chuyển bài hát!'
                });
                break;

            case 'stop':
                queue.destroy();
                musicQueues.delete(interaction.guildId);
                await interaction.editReply({
                    content: '⏹️ Đã dừng phát nhạc!'
                });
                return;

            case 'loop':
                queue.loop = !queue.loop;
                await interaction.editReply({
                    content: `🔁 Chế độ lặp: **${queue.loop ? 'BẬT' : 'TẮT'}**`
                });
                break;

            case 'volume_down':
                queue.volume = Math.max(0.1, queue.volume - 0.1);
                if (queue.player.state.resource?.volume) {
                    queue.player.state.resource.volume.setVolume(queue.volume);
                }
                await interaction.editReply({
                    content: `🔉 Âm lượng: **${Math.round(queue.volume * 100)}%**`
                });
                break;

            case 'volume_up':
                queue.volume = Math.min(2.0, queue.volume + 0.1);
                if (queue.player.state.resource?.volume) {
                    queue.player.state.resource.volume.setVolume(queue.volume);
                }
                await interaction.editReply({
                    content: `🔊 Âm lượng: **${Math.round(queue.volume * 100)}%**`
                });
                break;

            case 'shuffle':
                if (queue.songs.length > 1) {
                    const currentSong = queue.songs[queue.currentIndex];
                    const remainingSongs = queue.songs.slice(queue.currentIndex + 1);
                    
                    // Xáo trộn bài hát còn lại
                    for (let i = remainingSongs.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [remainingSongs[i], remainingSongs[j]] = [remainingSongs[j], remainingSongs[i]];
                    }
                    
                    queue.songs = [currentSong, ...remainingSongs];
                    queue.currentIndex = 0;
                    
                    await interaction.editReply({
                        content: '🔀 Đã xáo trộn hàng chờ!'
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ Không đủ bài hát để xáo trộn!'
                    });
                }
                break;

            case 'queue':
                const queueList = queue.songs.slice(queue.currentIndex, queue.currentIndex + 10)
                    .map((song, index) => 
                        `${queue.currentIndex + index === queue.currentIndex ? '🎶 **Đang phát:**' : `${queue.currentIndex + index + 1}.`} ${song.title}`
                    )
                    .join('\n');

                const queueEmbed = createEmbed('music', '📋 Hàng chờ nhạc', 
                    queueList || 'Không có bài hát trong hàng chờ')
                    .addFields(
                        { name: '📊 Tổng số bài', value: `${queue.songs.length}`, inline: true },
                        { name: '🎵 Đang phát', value: `#${queue.currentIndex + 1}`, inline: true }
                    );

                await interaction.editReply({ embeds: [queueEmbed] });
                return;

            case 'refresh':
                await interaction.editReply({
                    content: '🔄 Đã làm mới!'
                });
                break;

            case 'previous':
                if (queue.currentIndex > 0) {
                    queue.currentIndex--;
                    queue.player.stop();
                    await interaction.editReply({
                        content: '⏮️ Đã quay lại bài trước!'
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ Không có bài hát trước đó!'
                    });
                }
                break;
        }

        // Cập nhật embed sau mỗi tương tác
        await updateNowPlayingEmbed(interaction.guildId);

    } catch (error) {
        Logger.error(`Lỗi xử lý nút ${action}:`, error);
        await interaction.editReply({
            content: '❌ Đã xảy ra lỗi khi xử lý yêu cầu!'
        });
    }
});

// ==================== XỬ LÝ SỰ KIỆN CHÍNH ====================

client.on('ready', async () => {
    Logger.success(`${client.user.tag} đã sẵn sàng!`);
    Logger.info(`Đang phục vụ ${client.guilds.cache.size} server`);
    Logger.info(`Tổng số ${client.users.cache.size} người dùng`);

    client.user.setPresence({
        activities: [{
            name: 'LeiLaBOT | $help',
            type: ActivityType.Playing
        }],
        status: 'online'
    });

    await loadBirthdayCache();
    await setupScheduledMessages();
    
    // Khởi động Health Monitor
    HealthMonitor.start();
    
    // Kiểm tra sinh nhật mỗi 6 tiếng
    setInterval(checkBirthdays, 6 * 60 * 60 * 1000);
    // Lưu cache mỗi 5 phút
    setInterval(saveBirthdayCache, 5 * 60 * 1000);
    
    // Ngăn bot tự tắt tiếng
    client.ws.on('VOICE_STATE_UPDATE', (data) => {
        if (data.user_id === client.user.id && data.self_mute !== undefined) {
            // Bot bị mute/unmute - log để debug
            Logger.debug(`Trạng thái voice của bot thay đổi: ${data.self_mute ? 'muted' : 'unmuted'}`);
        }
    });
    
    checkBirthdays();

    Logger.success('Bot đã khởi động thành công!');
});

client.on('guildMemberAdd', async (member) => {
    Logger.event(`Thành viên mới: ${member.user.tag} (${member.id}) trong ${member.guild.name}`);
    
    try {
        const welcomeConfig = await loadConfig('welcomeConfig.json');
        
        if (!welcomeConfig.welcomeChannel) {
            Logger.warn(`Chưa cấu hình welcome channel trong ${member.guild.name}`);
            return;
        }

        const channel = member.guild.channels.cache.get(welcomeConfig.welcomeChannel);
        if (!channel) {
            Logger.error(`Không tìm thấy welcome channel ${welcomeConfig.welcomeChannel} trong ${member.guild.name}`);
            return;
        }

        const randomWelcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
        
        const welcomeDescription = randomWelcome.description
            .replace('{user}', member.toString())
            .replace('{server}', member.guild.name);

        const embed = new EmbedBuilder()
            .setColor(randomWelcome.color)
            .setTitle(randomWelcome.title)
            .setDescription(welcomeDescription)
            .addFields(
                { name: '🎉 Thành viên thứ', value: `#${member.guild.memberCount}`, inline: true },
                { name: '📅 Tham gia vào', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: '🏠 Server', value: member.guild.name, inline: true }
            )
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .setImage(randomWelcome.image)
            .setFooter({ 
                text: 'LeiLaBOT • Trao gửi yêu thương', 
                iconURL: client.user?.displayAvatarURL() 
            })
            .setTimestamp();

        if (welcomeConfig.welcomeMessage) {
            const customMessage = welcomeConfig.welcomeMessage
                .replace('{user}', member.toString())
                .replace('{server}', member.guild.name)
                .replace('{memberCount}', member.guild.memberCount.toString());
            
            embed.addFields({
                name: '💬 Lời chào từ server',
                value: customMessage,
                inline: false
            });
        }

        await channel.send({ 
            content: `🎉 ${member.toString()}`, 
            embeds: [embed] 
        });

        Logger.success(`Đã chào mừng thành viên ${member.user.tag} trong ${channel.name}`);

        if (welcomeConfig.welcomeRole) {
            const role = member.guild.roles.cache.get(welcomeConfig.welcomeRole);
            if (role) {
                await member.roles.add(role).catch(error => {
                    Logger.error(`Không thể thêm role cho ${member.user.tag}:`, error);
                });
                Logger.success(`Đã thêm role ${role.name} cho ${member.user.tag}`);
            }
        }
    } catch (error) {
        Logger.error(`Lỗi chào mừng thành viên mới ${member.user.tag}:`, error);
    }
});

client.on('guildMemberRemove', async (member) => {
    Logger.event(`Thành viên rời đi: ${member.user.tag} (${member.id}) từ ${member.guild.name}`);
    
    try {
        const welcomeConfig = await loadConfig('welcomeConfig.json');
        
        if (!welcomeConfig.goodbyeChannel) {
            Logger.warn(`Chưa cấu hình goodbye channel trong ${member.guild.name}`);
            return;
        }

        const channel = member.guild.channels.cache.get(welcomeConfig.goodbyeChannel);
        if (!channel) {
            Logger.error(`Không tìm thấy goodbye channel ${welcomeConfig.goodbyeChannel} trong ${member.guild.name}`);
            return;
        }

        const randomGoodbye = goodbyeMessages[Math.floor(Math.random() * goodbyeMessages.length)];
        
        const goodbyeDescription = randomGoodbye.description
            .replace('{user}', member.user.tag)
            .replace('{server}', member.guild.name);

        const embed = new EmbedBuilder()
            .setColor(randomGoodbye.color)
            .setTitle(randomGoodbye.title)
            .setDescription(goodbyeDescription)
            .addFields(
                { name: '📊 Tổng thành viên', value: `${member.guild.memberCount}`, inline: true },
                { name: '⏰ Rời đi lúc', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: '👤 Tài khoản tạo', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .setImage(randomGoodbye.image)
            .setFooter({ 
                text: 'LeiLaBOT • Hẹn gặp lại!', 
                iconURL: client.user?.displayAvatarURL() 
            })
            .setTimestamp();

        if (welcomeConfig.goodbyeMessage) {
            const customMessage = welcomeConfig.goodbyeMessage
                .replace('{user}', member.user.tag)
                .replace('{server}', member.guild.name);
            
            embed.addFields({
                name: '💬 Lời nhắn từ server',
                value: customMessage,
                inline: false
            });
        }

        await channel.send({ embeds: [embed] });
        Logger.success(`Đã gửi tin nhắn tạm biệt cho ${member.user.tag} trong ${channel.name}`);
    } catch (error) {
        Logger.error(`Lỗi gửi tin nhắn tạm biệt cho ${member.user.tag}:`, error);
    }
});

// ==================== XỬ LÝ LỆNH ====================

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const prefixConfig = await loadConfig('prefix.json', { prefix: "$" });
    const prefix = prefixConfig.prefix;

    if (message.channel.type === 1) {
        Logger.command(`DM từ ${message.author.tag}: ${message.content}`);
        
        try {
            const botConfig = await loadConfig('botConfig.json');
            
            if (botConfig.autoReply) {
                const responses = [
                    "Xin chào! Tôi là LeiLaBOT. Bạn cần hỗ trợ gì ạ? 💫",
                    "Hi! Tôi có thể giúp gì cho bạn? 🤖",
                    "Chào bạn! Gõ `$help` để xem danh sách lệnh nhé! 📚",
                    "Xin chào! Cần trợ giúp gì không? 🌟",
                    "Hello! Bạn có thể tham gia server hỗ trợ của chúng tôi để được giúp đỡ tốt hơn! 🎯"
                ];
                
                const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                const embed = createEmbed('primary', '💬 LeiLaBOT Support', randomResponse)
                    .addFields(
                        { name: '🔗 Server hỗ trợ', value: '[Tham gia ngay](https://discord.gg/9CFJxJUBj7)', inline: true },
                        { name: '📚 Lệnh', value: 'Gõ `$help`', inline: true }
                    );

                await message.reply({ embeds: [embed] });
                Logger.info(`Đã phản hồi DM từ ${message.author.tag}`);
            }

            if (botConfig.dmLogChannel) {
                const logChannel = client.channels.cache.get(botConfig.dmLogChannel);
                if (logChannel) {
                    const embed = createEmbed('info', '📨 Tin nhắn DM mới', 
                        `**Người gửi:** ${message.author.tag} (${message.author.id})\n**Nội dung:** ${message.content}`)
                        .setThumbnail(message.author.displayAvatarURL());

                    await logChannel.send({ embeds: [embed] });
                    Logger.info(`Đã log DM từ ${message.author.tag} đến kênh ${logChannel.name}`);
                }
            }
        } catch (error) {
            Logger.error(`Lỗi xử lý DM từ ${message.author.tag}:`, error);
        }
        return;
    }

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Kiểm tra rate limiting
    if (!checkRateLimit(message.author.id, command, 1000)) {
        const embed = createEmbed('warning', '⏳ Đợi một chút!', 
            'Bạn đang sử dụng lệnh quá nhanh. Vui lòng chờ 1-2 giây.');
        return message.reply({ embeds: [embed] }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 3000);
        });
    }

    Logger.command(`Lệnh từ ${message.author.tag} trong #${message.channel.name} (${message.guild.name}): ${message.content}`, {
        user: message.author.tag,
        userId: message.author.id,
        guild: message.guild.name,
        channel: message.channel.name,
        command: command,
        args: args
    });

    try {
        // ==================== LỆNH THÔNG TIN & DEBUG ====================
        if (command === 'ping') {
            const processingEmbed = createEmbed('info', '⏳ Đang xử lý...', 'Đang tính toán độ trễ...');
            const msg = await message.reply({ embeds: [processingEmbed] });
            
            const ping = msg.createdTimestamp - message.createdTimestamp;
            const embed = createEmbed('success', '🏓 Pong!', 'Độ trễ hệ thống:')
                .addFields(
                    { name: '📡 Độ trễ tin nhắn', value: `\`${ping}ms\``, inline: true },
                    { name: '💓 Độ trễ API', value: `\`${Math.round(client.ws.ping)}ms\``, inline: true },
                    { name: '⏰ Uptime', value: `\`${formatUptime(process.uptime())}\``, inline: true }
                )
                .setThumbnail('https://cdn.discordapp.com/emojis/1107540430879342694.webp');

            await msg.edit({ embeds: [embed] });
        }

        if (command === 'stats') {
            const embed = createEmbed('info', '📊 THỐNG KÊ BOT')
                .addFields(
                    { name: '🏠 Servers', value: `\`${client.guilds.cache.size}\``, inline: true },
                    { name: '👥 Users', value: `\`${client.users.cache.size}\``, inline: true },
                    { name: '📈 Channels', value: `\`${client.channels.cache.size}\``, inline: true },
                    { name: '🎵 Music Queues', value: `\`${musicQueues.size}\``, inline: true },
                    { name: '💾 Memory', value: `\`${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB\``, inline: true },
                    { name: '⏰ Uptime', value: `\`${formatUptime(process.uptime())}\``, inline: true }
                )
                .setFooter({ text: `LeiLaBOT • Shard ${client.shard?.ids || '0'}` });

            await message.reply({ embeds: [embed] });
        }

        // ==================== LỆNH DEBUG VOICE MỚI ====================
        if (command === 'voiceinfo') {
            const voiceChannel = message.member.voice.channel;
            if (!voiceChannel) {
                const embed = createEmbed('error', '❌ Lỗi', 'Bạn cần tham gia kênh voice trước!');
                return message.reply({ embeds: [embed] });
            }

            const permissions = voiceChannel.permissionsFor(client.user);
            const embed = createEmbed('info', '🔊 Thông tin Voice Channel')
                .addFields(
                    { name: '🎤 Kênh', value: voiceChannel.name, inline: true },
                    { name: '🔗 Kết nối', value: permissions.has('Connect') ? '✅' : '❌', inline: true },
                    { name: '🗣️ Nói', value: permissions.has('Speak') ? '✅' : '❌', inline: true },
                    { name: '👀 Xem kênh', value: permissions.has('ViewChannel') ? '✅' : '❌', inline: true },
                    { name: '🔊 Âm lượng', value: `${Math.round((getQueue(message.guild.id).volume || 0.5) * 100)}%`, inline: true }
                );

            await message.reply({ embeds: [embed] });
        }

        if (command === 'fixvoice') {
            if (!message.member.voice.channel) {
                const embed = createEmbed('error', '❌ Lỗi', 'Bạn cần tham gia kênh voice trước!');
                return message.reply({ embeds: [embed] });
            }

            try {
                const queue = getQueue(message.guild.id);
                if (queue.connection) {
                    queue.connection.destroy();
                    musicQueues.delete(message.guild.id);
                }

                await ensureVoiceConnection(message.guild.id, message.member.voice.channel, message.channel);
                
                const embed = createEmbed('success', '✅ Đã sửa kết nối voice', 'Đã reset kết nối voice. Thử phát nhạc lại!');
                await message.reply({ embeds: [embed] });
            } catch (error) {
                const embed = createEmbed('error', '❌ Lỗi', `Không thể sửa kết nối: ${error.message}`);
                await message.reply({ embeds: [embed] });
            }
        }

        if (command === 'help' || command === 'commands') {
            const embed = createEmbed('primary', '🤖 LeiLaBOT - Hệ thống lệnh', 
                `**Prefix hiện tại:** \`${prefix}\`\nDưới đây là tất cả các lệnh có sẵn:`)
                .addFields(
                    {
                        name: '🎵 Âm nhạc',
                        value: '```play, stop, pause, resume, skip, queue, volume, loop, nowplaying, voiceinfo, fixvoice```',
                        inline: true
                    },
                    {
                        name: '🔧 Tiện ích',
                        value: '```ping, stats, help, info, userinfo, serverinfo, avatar```',
                        inline: true
                    },
                    {
                        name: '👥 Quản lý',
                        value: '```setprefix, setwelcome, setgoodbye, setwelcomerole, setdmlog, setschedulechannel, clear, slowmode```',
                        inline: true
                    },
                    {
                        name: '🎉 Sinh nhật',
                        value: '```setbirthday, setbirthdaychannel, checkbirthday, listbirthdays, findbirthday, debugbirthday```',
                        inline: true
                    },
                    {
                        name: '⏰ Tự động',
                        value: '```setschedule, testschedule, testschedulenow, scheduleinfo, toggleschedule```',
                        inline: true
                    },
                    {
                        name: '👋 Chào mừng',
                        value: '```testwelcome, testgoodbye, welcometemplates, goodbyetemplates```',
                        inline: true
                    },
                    {
                        name: '🎮 Giải trí',
                        value: '```poll, guess, quiz, lottery, remindme```',
                        inline: true
                    },
                    {
                        name: '🌐 Tiện ích',
                        value: '```translate, weather, covid```',
                        inline: true
                    },
                    {
                        name: '🔧 Quản trị',
                        value: '```debugconfig, reloadconfig, debugschedule, resetbirthdaycache```',
                        inline: true
                    }
                )
                .setImage('https://cdn.discordapp.com/attachments/1045746639303876638/1234567890123456789/help-banner.png');

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('📥 Mời Bot')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://discord.com/oauth2/authorize?client_id=1421716299947708436'),
                    new ButtonBuilder()
                        .setLabel('🆘 Hỗ trợ')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://discord.gg/cuonggatsby94'),
                    new ButtonBuilder()
                        .setLabel('🌐 Website')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://leilabot.netlify.app/')
                );

            await message.reply({ embeds: [embed], components: [row] });
        }

        // ==================== LỆNH DEBUG VÀ QUẢN LÝ ====================
        if (command === 'debugconfig') {
            const botConfig = await loadConfig('botConfig.json');
            
            const embed = createEmbed('info', '🔧 Debug Config')
                .addFields(
                    { name: '📁 Schedule Channel ID', value: `\`${botConfig.scheduleChannel}\``, inline: true },
                    { name: '📝 DM Log Channel ID', value: `\`${botConfig.dmLogChannel}\``, inline: true },
                    { name: '⚙️ Schedule Enabled', value: botConfig.scheduleEnabled !== false ? '✅' : '❌', inline: true }
                )
                .setFooter({ text: `Config được load lúc: ${new Date().toLocaleString('vi-VN')}` });

            await message.reply({ embeds: [embed] });
        }

        if (command === 'reloadconfig') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                const embed = createEmbed('error', '❌ Lỗi', 'Bạn cần quyền Administrator để sử dụng lệnh này.');
                return message.reply({ embeds: [embed] });
            }

            const embed = createEmbed('success', '✅ Thành công', 'Đã reload config thành công!');
            await message.reply({ embeds: [embed] });
            Logger.info(`Đã reload config bởi ${message.author.tag}`);
        }

        if (command === 'debugschedule') {
            const botConfig = await loadConfig('botConfig.json');
            
            const embed = createEmbed('info', '🔧 Debug Schedule System')
                .addFields(
                    { name: '📁 Schedule Channel ID', value: `\`${botConfig.scheduleChannel}\``, inline: true },
                    { name: '🔍 Channel Found', value: client.channels.cache.has(botConfig.scheduleChannel) ? '✅' : '❌', inline: true },
                    { name: '⚙️ Schedule Enabled', value: botConfig.scheduleEnabled !== false ? '✅' : '❌', inline: true }
                );

            if (client.channels.cache.has(botConfig.scheduleChannel)) {
                const channel = client.channels.cache.get(botConfig.scheduleChannel);
                embed.addFields(
                    { name: '📝 Channel Name', value: channel.name, inline: true },
                    { name: '🏠 Guild', value: channel.guild.name, inline: true },
                    { name: '🔐 Permissions', value: channel.permissionsFor(client.user).has('SendMessages') ? '✅ Có quyền' : '❌ Không có quyền', inline: true }
                );
            }

            await message.reply({ embeds: [embed] });
        }

        if (command === 'testschedulenow') {
            const type = args[0] || 'morning';
            
            if (!['morning', 'noon', 'afternoon', 'evening', 'night'].includes(type)) {
                const embed = createEmbed('error', '❌ Lỗi', 'Loại schedule không hợp lệ. Các loại: morning, noon, afternoon, evening, night');
                return message.reply({ embeds: [embed] });
            }

            try {
                const botConfig = await loadConfig('botConfig.json');
                
                if (!botConfig.scheduleChannel) {
                    const embed = createEmbed('error', '❌ Lỗi', 'Chưa cấu hình schedule channel!');
                    return message.reply({ embeds: [embed] });
                }

                const channel = await client.channels.fetch(botConfig.scheduleChannel).catch(() => null);
                if (!channel) {
                    const embed = createEmbed('error', '❌ Lỗi', `Không tìm thấy kênh: ${botConfig.scheduleChannel}`);
                    return message.reply({ embeds: [embed] });
                }

                const embed = createScheduleEmbed(type);
                if (embed) {
                    await channel.send({ 
                        content: `🧪 **TEST SCHEDULE** - ${type.toUpperCase()}`,
                        embeds: [embed] 
                    });
                    
                    const successEmbed = createEmbed('success', '✅ Thành công', 
                        `Đã gửi tin nhắn test schedule **${type}** đến kênh ${channel.toString()}`);
                    await message.reply({ embeds: [successEmbed] });
                    
                    Logger.success(`Đã test schedule ${type} trong kênh ${channel.name}`);
                }
            } catch (error) {
                Logger.error(`Lỗi test schedule ${type}:`, error);
                const embed = createEmbed('error', '❌ Lỗi', `Lỗi khi test schedule: ${error.message}`);
                await message.reply({ embeds: [embed] });
            }
        }

        // ==================== LỆNH QUẢN LÝ SERVER ====================
        if (command === 'setschedulechannel') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                const embed = createEmbed('error', '❌ Lỗi', 'Bạn cần quyền Administrator để sử dụng lệnh này.');
                return message.reply({ embeds: [embed] });
            }

            const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
            if (!channel) {
                const embed = createEmbed('error', '❌ Lỗi', 'Vui lòng đề cập đến một kênh hợp lệ!');
                return message.reply({ embeds: [embed] });
            }

            const botConfig = await loadConfig('botConfig.json');
            botConfig.scheduleChannel = channel.id;
            await saveConfig('botConfig.json', botConfig);

            const embed = createEmbed('success', '✅ Thành công', 
                `Đã đặt kênh tin nhắn tự động thành ${channel.toString()}`);
            await message.reply({ embeds: [embed] });
            Logger.info(`Đã đặt schedule channel thành ${channel.name} bởi ${message.author.tag}`);
        }

        if (command === 'toggleschedule') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                const embed = createEmbed('error', '❌ Lỗi', 'Bạn cần quyền Administrator để sử dụng lệnh này.');
                return message.reply({ embeds: [embed] });
            }

            const botConfig = await loadConfig('botConfig.json');
            botConfig.scheduleEnabled = !botConfig.scheduleEnabled;
            await saveConfig('botConfig.json', botConfig);

            const embed = createEmbed('success', '✅ Thành công', 
                `Tin nhắn tự động đã được ${botConfig.scheduleEnabled ? '**bật**' : '**tắt**'}`);
            await message.reply({ embeds: [embed] });
            Logger.info(`Đã ${botConfig.scheduleEnabled ? 'bật' : 'tắt'} schedule bởi ${message.author.tag}`);
        }

        if (command === 'scheduleinfo') {
            const botConfig = await loadConfig('botConfig.json');
            const channel = botConfig.scheduleChannel ? client.channels.cache.get(botConfig.scheduleChannel) : null;

            let scheduleText = '';
            const scheduleTimes = [
                { time: '08:00', type: 'morning' },
                { time: '12:00', type: 'noon' },
                { time: '17:30', type: 'afternoon' },
                { time: '20:00', type: 'evening' },
                { time: '22:00', type: 'night' }
            ];

            scheduleTimes.forEach(({ time, type }) => {
                const template = scheduleTemplates[type];
                scheduleText += `**${time} - ${template.title.split(' - ')[0]}**\n${template.description}\n\n`;
            });

            const embed = createEmbed('info', '✅ THÔNG TIN TIN NHẮN TỰ ĐỘNG', 
                `**Kênh tin nhắn tự động:** ${channel ? channel.toString() : 'Chưa cấu hình'}\n\n${scheduleText}`)
                .addFields(
                    { name: '🌐 Múi giờ', value: 'Asia/Ho_Chi_Minh (GMT+7)', inline: true },
                    { name: '📊 Trạng thái', value: botConfig.scheduleEnabled !== false ? '✅ Đang hoạt động' : '❌ Đã tắt', inline: true },
                    { name: '🎨 Định dạng', value: 'Embed', inline: true }
                )
                .setFooter({ text: 'Sử dụng testschedule [loại] để xem mẫu tin nhắn' });

            await message.reply({ embeds: [embed] });
        }

        // ==================== LỆNH CHÀO MỪNG ====================
        if (command === 'testwelcome') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                const embed = createEmbed('error', '❌ Lỗi', 'Bạn cần quyền Administrator để sử dụng lệnh này.');
                return message.reply({ embeds: [embed] });
            }

            const welcomeConfig = await loadConfig('welcomeConfig.json');
            if (!welcomeConfig.welcomeChannel) {
                const embed = createEmbed('error', '❌ Lỗi', 'Chưa cấu hình kênh chào mừng!');
                return message.reply({ embeds: [embed] });
            }

            const channel = message.guild.channels.cache.get(welcomeConfig.welcomeChannel);
            if (!channel) {
                const embed = createEmbed('error', '❌ Lỗi', 'Không tìm thấy kênh chào mừng!');
                return message.reply({ embeds: [embed] });
            }

            const randomWelcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
            
            const welcomeDescription = randomWelcome.description
                .replace('{user}', message.author.toString())
                .replace('{server}', message.guild.name);

            const embed = new EmbedBuilder()
                .setColor(randomWelcome.color)
                .setTitle('🧪 TEST: ' + randomWelcome.title)
                .setDescription(welcomeDescription)
                .addFields(
                    { name: '🎉 Thành viên thứ', value: `#${message.guild.memberCount}`, inline: true },
                    { name: '📅 Tham gia vào', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                    { name: '🏠 Server', value: message.guild.name, inline: true }
                )
                .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
                .setImage(randomWelcome.image)
                .setFooter({ 
                    text: 'LeiLaBOT • Trao gửi yêu thương', 
                    iconURL: client.user?.displayAvatarURL() 
                })
                .setTimestamp();

            await channel.send({ 
                content: `🎉 ${message.author.toString()} (TEST)`, 
                embeds: [embed] 
            });

            const successEmbed = createEmbed('success', '✅ Thành công', 
                `Đã gửi tin nhắn test chào mừng đến ${channel.toString()}`);
            await message.reply({ embeds: [successEmbed] });
        }

        // ==================== LỆNH SETPREFIX ====================
        if (command === 'setprefix') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                const embed = createEmbed('error', '❌ Lỗi', 'Bạn cần quyền Administrator để sử dụng lệnh này.');
                return message.reply({ embeds: [embed] });
            }

            const newPrefix = args[0];
            if (!newPrefix || newPrefix.length > 3) {
                const embed = createEmbed('error', '❌ Lỗi', 'Prefix phải có từ 1-3 ký tự!');
                return message.reply({ embeds: [embed] });
            }

            await saveConfig('prefix.json', { prefix: newPrefix });
            const embed = createEmbed('success', '✅ Thành công', 
                `Prefix đã được đổi thành: \`${newPrefix}\``);
            await message.reply({ embeds: [embed] });
            Logger.info(`Đã đổi prefix thành ${newPrefix} bởi ${message.author.tag}`);
        }

        // ==================== LỆNH QUẢN LÝ SINH NHẬT ====================
        if (command === 'setbirthdaychannel') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                const embed = createEmbed('error', '❌ Lỗi', 'Bạn cần quyền Administrator để sử dụng lệnh này.');
                return message.reply({ embeds: [embed] });
            }

            const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
            if (!channel) {
                const embed = createEmbed('error', '❌ Lỗi', 'Vui lòng đề cập đến một kênh hợp lệ!');
                return message.reply({ embeds: [embed] });
            }

            const birthdayConfig = await loadConfig('birthdayConfig.json', {});
            birthdayConfig[message.guild.id] = channel.id;
            await saveConfig('birthdayConfig.json', birthdayConfig);

            const embed = createEmbed('success', '✅ Thành công', 
                `Đã đặt kênh thông báo sinh nhật thành ${channel.toString()}\n\nThông báo sẽ được gửi vào lúc **9:00** và **19:00** hàng ngày.`);
            await message.reply({ embeds: [embed] });
            Logger.info(`Đã đặt birthday channel thành ${channel.name} trong ${message.guild.name} bởi ${message.author.tag}`);
        }

        if (command === 'setbirthday') {
            let targetUser = message.author;
            let dateStr = args[0];

            // Kiểm tra nếu có mention user (set cho người khác)
            if (message.mentions.users.first()) {
                if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    const embed = createEmbed('error', '❌ Lỗi', 'Bạn cần quyền Administrator để đặt sinh nhật cho người khác.');
                    return message.reply({ embeds: [embed] });
                }
                targetUser = message.mentions.users.first();
                dateStr = args[1];
            }

            if (!dateStr || !/^\d{1,2}-\d{1,2}$/.test(dateStr)) {
                const embed = createEmbed('error', '❌ Lỗi', 
                    'Vui lòng nhập ngày sinh theo định dạng: DD-MM\n' +
                    '**Cách sử dụng:**\n' +
                    '`$setbirthday DD-MM` - Đặt sinh nhật cho bản thân\n' +
                    '`$setbirthday @user DD-MM` - Đặt sinh nhật cho người khác (Admin)');
                return message.reply({ embeds: [embed] });
            }

            const [day, month] = dateStr.split('-').map(Number);
            
            // Validation ngày tháng
            if (day < 1 || day > 31 || month < 1 || month > 12) {
                const embed = createEmbed('error', '❌ Lỗi', 'Ngày hoặc tháng không hợp lệ! Ngày phải từ 1-31, tháng từ 1-12.');
                return message.reply({ embeds: [embed] });
            }

            const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            if (day > daysInMonth[month - 1]) {
                const embed = createEmbed('error', '❌ Lỗi', `Tháng ${month} chỉ có ${daysInMonth[month - 1]} ngày!`);
                return message.reply({ embeds: [embed] });
            }

            const birthdays = await loadData('birthdays.json');
            birthdays[targetUser.id] = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
            await saveData('birthdays.json', birthdays);

            birthdayCache.sentToday.delete(targetUser.id);
            await saveBirthdayCache();

            const embed = createEmbed('success', '✅ Thành công', 
                `Đã đặt ngày sinh của ${targetUser.toString()} là **${dateStr}**\n\n` +
                `Bot sẽ thông báo sinh nhật vào lúc **9:00** và **19:00** trong ngày sinh nhật! 🎉`)
                .addFields(
                    { name: '👤 Người dùng', value: `${targetUser.tag}`, inline: true },
                    { name: '📅 Ngày sinh', value: dateStr, inline: true },
                    { name: '🎉 Thông báo', value: '9:00 & 19:00', inline: true }
                );

            await message.reply({ embeds: [embed] });
            Logger.info(`Đã đặt ngày sinh cho ${targetUser.tag} là ${dateStr} bởi ${message.author.tag}`);
        }

        if (command === 'checkbirthday') {
            Logger.command(`Lệnh checkbirthday được gọi bởi ${message.author.tag}`);
            
            const birthdays = await loadData('birthdays.json');
            const today = new Date();
            const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            
            let birthdayUsers = [];
            for (const [userId, birthday] of Object.entries(birthdays)) {
                if (birthday === todayStr) {
                    const user = await client.users.fetch(userId).catch(() => null);
                    if (user) {
                        birthdayUsers.push(user.tag);
                    }
                }
            }
            
            const embed = createEmbed('info', '🎉 KIỂM TRA SINH NHẬT HÔM NAY')
                .addFields(
                    { name: '📅 Ngày hôm nay', value: todayStr, inline: true },
                    { name: '👥 Số người sinh nhật', value: birthdayUsers.length.toString(), inline: true },
                    { name: '🎂 Danh sách', value: birthdayUsers.length > 0 ? birthdayUsers.join('\n') : 'Không có ai sinh nhật hôm nay', inline: false }
                );

            await message.reply({ embeds: [embed] });
            Logger.info(`Đã kiểm tra sinh nhật hôm nay: ${birthdayUsers.length} người`);
        }

        if (command === 'debugbirthday') {
            Logger.command(`Lệnh debugbirthday được gọi bởi ${message.author.tag}`);
            
            const today = new Date();
            const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            
            const embed = createEmbed('info', '🔧 Debug Hệ Thống Sinh Nhật')
                .addFields(
                    { name: '📅 Ngày hôm nay', value: todayStr, inline: true },
                    { name: '🕒 Lần check cuối', value: birthdayCache.lastCheck || 'Chưa có', inline: true },
                    { name: '👤 Đã gửi hôm nay', value: birthdayCache.sentToday.size.toString(), inline: true },
                    { name: '📊 Cache sentToday', value: Array.from(birthdayCache.sentToday).join(', ') || 'Không có', inline: false }
                );
            
            await message.reply({ embeds: [embed] });
            Logger.info(`Đã debug hệ thống sinh nhật bởi ${message.author.tag}`);
        }

        if (command === 'resetbirthdaycache') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                const embed = createEmbed('error', '❌ Lỗi', 'Bạn cần quyền Administrator để sử dụng lệnh này.');
                return message.reply({ embeds: [embed] });
            }
            
            birthdayCache.sentToday.clear();
            birthdayCache.lastCheck = null;
            await saveBirthdayCache();
            
            const embed = createEmbed('success', '✅ Thành công', 'Đã reset cache sinh nhật!');
            await message.reply({ embeds: [embed] });
            Logger.info(`Đã reset cache sinh nhật bởi ${message.author.tag}`);
        }

        if (command === 'listbirthdays') {
            const birthdays = await loadData('birthdays.json');
            const page = parseInt(args[0]) || 1;
            const itemsPerPage = 10;
            const totalPages = Math.ceil(Object.keys(birthdays).length / itemsPerPage);

            if (page < 1 || page > totalPages) {
                const embed = createEmbed('error', '❌ Lỗi', `Trang không hợp lệ! Chỉ có ${totalPages} trang.`);
                return message.reply({ embeds: [embed] });
            }

            const startIndex = (page - 1) * itemsPerPage;
            const birthdayEntries = Object.entries(birthdays).slice(startIndex, startIndex + itemsPerPage);

            let description = '';
            for (const [userId, birthday] of birthdayEntries) {
                try {
                    const user = await client.users.fetch(userId);
                    description += `• **${user.tag}** (${userId}) - ${birthday}\n`;
                } catch {
                    description += `• **Unknown User** (${userId}) - ${birthday}\n`;
                }
            }

            const embed = createEmbed('info', '🎉 DANH SÁCH SINH NHẬT', 
                description || 'Chưa có dữ liệu sinh nhật.')
                .addFields(
                    { name: '📊 Tổng số', value: Object.keys(birthdays).length.toString(), inline: true },
                    { name: '📄 Trang', value: `${page}/${totalPages}`, inline: true }
                )
                .setFooter({ text: 'Sử dụng listbirthdays <số_trang> để xem trang tiếp theo' });

            await message.reply({ embeds: [embed] });
        }

        if (command === 'findbirthday') {
            const searchTerm = args.join(' ').toLowerCase();
            if (!searchTerm) {
                const embed = createEmbed('error', '❌ Lỗi', 'Vui lòng nhập từ khóa tìm kiếm (tên hoặc user ID)!');
                return message.reply({ embeds: [embed] });
            }

            const birthdays = await loadData('birthdays.json');
            const results = [];

            for (const [userId, birthday] of Object.entries(birthdays)) {
                try {
                    const user = await client.users.fetch(userId);
                    if (user.tag.toLowerCase().includes(searchTerm) || userId.includes(searchTerm)) {
                        results.push({ user: user.tag, userId, birthday });
                    }
                } catch {
                    if (userId.includes(searchTerm)) {
                        results.push({ user: 'Unknown User', userId, birthday });
                    }
                }
            }

            if (results.length === 0) {
                const embed = createEmbed('error', '❌ Không tìm thấy', `Không tìm thấy kết quả cho "${searchTerm}"`);
                return message.reply({ embeds: [embed] });
            }

            let description = '';
            results.slice(0, 10).forEach((result, index) => {
                description += `• **${result.user}** (${result.userId}) - ${result.birthday}\n`;
            });

            const embed = createEmbed('success', '🔍 KẾT QUẢ TÌM KIẾM', description)
                .addFields(
                    { name: '📊 Tìm thấy', value: `${results.length} kết quả`, inline: true },
                    { name: '💡 Hiển thị', value: `${Math.min(results.length, 10)}/${results.length}`, inline: true }
                );

            if (results.length > 10) {
                embed.setFooter({ text: 'Chỉ hiển thị 10 kết quả đầu tiên. Sử dụng từ khóa cụ thể hơn.' });
            }

            await message.reply({ embeds: [embed] });
        }

        // ==================== LỆNH ADMIN SINH NHẬT ====================
        if (command === 'admin_setbirthday') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                const embed = createEmbed('error', '❌ Lỗi', 'Bạn cần quyền Administrator để sử dụng lệnh này.');
                return message.reply({ embeds: [embed] });
            }

            if (args.length < 2) {
                const embed = createEmbed('error', '❌ Lỗi', 
                    '**Cách sử dụng:** `$admin_setbirthday <user_id> DD-MM`\n' +
                    'Ví dụ: `$admin_setbirthday 123456789012345678 15-08`');
                return message.reply({ embeds: [embed] });
            }

            const userId = args[0];
            const dateStr = args[1];

            // Validation user ID
            if (!/^\d{17,20}$/.test(userId)) {
                const embed = createEmbed('error', '❌ Lỗi', 'User ID không hợp lệ!');
                return message.reply({ embeds: [embed] });
            }

            // Validation ngày tháng
            if (!dateStr || !/^\d{1,2}-\d{1,2}$/.test(dateStr)) {
                const embed = createEmbed('error', '❌ Lỗi', 'Định dạng ngày không hợp lệ! Sử dụng: DD-MM');
                return message.reply({ embeds: [embed] });
            }

            const [day, month] = dateStr.split('-').map(Number);
            const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            
            if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
                const embed = createEmbed('error', '❌ Lỗi', 'Ngày hoặc tháng không hợp lệ!');
                return message.reply({ embeds: [embed] });
            }

            const birthdays = await loadData('birthdays.json');
            birthdays[userId] = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
            await saveData('birthdays.json', birthdays);

            // Xóa cache
            birthdayCache.sentToday.delete(userId);
            await saveBirthdayCache();

            const embed = createEmbed('success', '✅ Thành công', 
                `Đã đặt ngày sinh cho user ID \`${userId}\` là **${dateStr}**`)
                .addFields(
                    { name: '🆔 User ID', value: userId, inline: true },
                    { name: '📅 Ngày sinh', value: dateStr, inline: true },
                    { name: '🗑️ Để xóa', value: `$admin_removebirthday ${userId}`, inline: true }
                );

            await message.reply({ embeds: [embed] });
            Logger.info(`Admin ${message.author.tag} đã đặt ngày sinh cho ${userId} là ${dateStr}`);
        }

        if (command === 'removebirthday') {
            let targetUser = message.author;

            if (message.mentions.users.first()) {
                if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    const embed = createEmbed('error', '❌ Lỗi', 'Bạn cần quyền Administrator để xóa sinh nhật của người khác.');
                    return message.reply({ embeds: [embed] });
                }
                targetUser = message.mentions.users.first();
            }

            const birthdays = await loadData('birthdays.json');
            
            if (!birthdays[targetUser.id]) {
                const embed = createEmbed('error', '❌ Lỗi', `${targetUser.toString()} chưa đặt ngày sinh.`);
                return message.reply({ embeds: [embed] });
            }

            const removedDate = birthdays[targetUser.id];
            delete birthdays[targetUser.id];
            await saveData('birthdays.json', birthdays);

            // Xóa cache
            birthdayCache.sentToday.delete(targetUser.id);
            await saveBirthdayCache();

            const embed = createEmbed('success', '✅ Thành công', 
                `Đã xóa ngày sinh **${removedDate}** của ${targetUser.toString()}`);
            await message.reply({ embeds: [embed] });
            Logger.info(`Đã xóa ngày sinh của ${targetUser.tag} bởi ${message.author.tag}`);
        }

        if (command === 'admin_removebirthday') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                const embed = createEmbed('error', '❌ Lỗi', 'Bạn cần quyền Administrator để sử dụng lệnh này.');
                return message.reply({ embeds: [embed] });
            }

            const userId = args[0];
            if (!userId) {
                const embed = createEmbed('error', '❌ Lỗi', 'Vui lòng cung cấp User ID!');
                return message.reply({ embeds: [embed] });
            }

            const birthdays = await loadData('birthdays.json');
            
            if (!birthdays[userId]) {
                const embed = createEmbed('error', '❌ Lỗi', `User ID \`${userId}\` chưa đặt ngày sinh.`);
                return message.reply({ embeds: [embed] });
            }

            const removedDate = birthdays[userId];
            delete birthdays[userId];
            await saveData('birthdays.json', birthdays);

            // Xóa cache
            birthdayCache.sentToday.delete(userId);
            await saveBirthdayCache();

            const embed = createEmbed('success', '✅ Thành công', 
                `Đã xóa ngày sinh **${removedDate}** của user ID \`${userId}\``);
            await message.reply({ embeds: [embed] });
            Logger.info(`Admin ${message.author.tag} đã xóa ngày sinh của ${userId}`);
        }

        // ==================== LỆNH ÂM NHẠC NÂNG CẤP ====================

        if (command === 'play' || command === 'p') {
            if (!args.length) {
                const embed = createEmbed('error', '❌ Lỗi', 'Vui lòng cung cấp URL hoặc tên bài hát!');
                return message.reply({ embeds: [embed] });
            }

            if (!message.member.voice.channel) {
                const embed = createEmbed('error', '❌ Lỗi', 'Bạn cần tham gia kênh voice trước!');
                return message.reply({ embeds: [embed] });
            }

            try {
                const query = args.join(' ');
                let songInfo;

                // Hiển thị thông báo đang xử lý
                const processingEmbed = createEmbed('info', '⏳ Đang xử lý...', 'Đang tìm kiếm bài hát...');
                const processingMsg = await message.reply({ embeds: [processingEmbed] });

                // KIỂM TRA VÀ XỬ LÝ PLAYLIST
                const isPlaylist = playdl.yt_validate(query) === 'playlist';
                const isVideo = playdl.yt_validate(query) === 'video';
                
                if (isPlaylist) {
                    // Xử lý playlist
                    try {
                        const playlist = await playdl.playlist_info(query, { incomplete: true });
                        const videos = await playlist.all_videos();
                        
                        if (!videos.length) {
                            await processingMsg.delete().catch(() => {});
                            const embed = createEmbed('error', '❌ Lỗi', 'Playlist trống hoặc không thể truy cập!');
                            return message.reply({ embeds: [embed] });
                        }

                        // Thêm tất cả video từ playlist vào hàng chờ
                        const queue = getQueue(message.guild.id);
                        let addedCount = 0;

                        for (const video of videos.slice(0, 50)) { // Giới hạn 50 bài để tránh spam
                            const song = {
                                title: video.title,
                                url: video.url,
                                duration: video.durationRaw || 'Unknown',
                                channel: video.channel?.name || 'Unknown',
                                thumbnail: video.thumbnails[0]?.url,
                                requester: message.author.toString()
                            };
                            queue.songs.push(song);
                            addedCount++;
                        }

                        queue.textChannel = message.channel;

                        // Xóa thông báo đang xử lý
                        await processingMsg.delete().catch(() => {});

                        const embed = createEmbed('success', '🎵 Đã thêm playlist vào hàng chờ', 
                            `Đã thêm **${addedCount}** bài hát từ playlist: **${playlist.title}**`)
                            .addFields(
                                { name: '📊 Tổng số bài', value: `${queue.songs.length} bài`, inline: true },
                                { name: '👤 Thêm bởi', value: message.author.toString(), inline: true }
                            );

                        if (playlist.thumbnail) {
                            embed.setThumbnail(playlist.thumbnail);
                        }

                        await message.reply({ embeds: [embed] });

                        // Kết nối và phát nhạc
                        await ensureVoiceConnection(message.guild.id, message.member.voice.channel, message.channel);
                        
                        if (!queue.isPlaying) {
                            playSong(message.guild.id);
                        }

                        return;

                    } catch (playlistError) {
                        Logger.error('Lỗi xử lý playlist:', playlistError);
                        await processingMsg.delete().catch(() => {});
                        const embed = createEmbed('error', '❌ Lỗi', 'Không thể tải playlist! Vui lòng thử lại.');
                        return message.reply({ embeds: [embed] });
                    }
                }

                // XỬ LÝ VIDEO ĐƠN HOẶC TÌM KIẾM
                try {
                    if (isVideo) {
                        // Nếu là video URL
                        songInfo = await playdl.video_info(query);
                    } else {
                        // Tìm kiếm trên YouTube với xử lý lỗi tốt hơn
                        Logger.debug(`Đang tìm kiếm: ${query}`);
                        
                        const searchResults = await playdl.search(query, { 
                            limit: 5,
                            source: { youtube: "video" }
                        }).catch(searchError => {
                            Logger.error('Lỗi tìm kiếm:', searchError);
                            throw new Error('Không thể kết nối đến dịch vụ tìm kiếm');
                        });

                        if (!searchResults || !searchResults.length) {
                            await processingMsg.delete().catch(() => {});
                            const embed = createEmbed('error', '❌ Lỗi', 
                                `Không tìm thấy bài hát cho: "${query}"\nVui lòng thử từ khóa khác!`);
                            return message.reply({ embeds: [embed] });
                        }

                        // Ưu tiên kết quả có thời lượng hợp lệ (không quá dài)
                        const validResult = searchResults.find(result => 
                            result.durationInSec && result.durationInSec < 3600 // Dưới 1 giờ
                        ) || searchResults[0];

                        Logger.debug(`Đã chọn kết quả: ${validResult.title}`, {
                            duration: validResult.durationInSec,
                            url: validResult.url
                        });

                        songInfo = await playdl.video_info(validResult.url);
                    }

                    const song = {
                        title: songInfo.video_details.title,
                        url: songInfo.video_details.url,
                        duration: songInfo.video_details.durationRaw || 'Unknown',
                        channel: songInfo.video_details.channel?.name || 'Unknown',
                        thumbnail: songInfo.video_details.thumbnails[0]?.url,
                        requester: message.author.toString()
                    };

                    const queue = getQueue(message.guild.id);
                    queue.songs.push(song);
                    queue.textChannel = message.channel;

                    // Xóa thông báo đang xử lý
                    await processingMsg.delete().catch(() => {});

                    const embed = createMusicEmbed('success', '✅ Đã thêm vào hàng chờ', song, [
                        { name: '📊 Vị trí', value: `#${queue.songs.length}`, inline: true }
                    ]);

                    await message.reply({ embeds: [embed] });

                    // Kết nối và phát nhạc
                    await ensureVoiceConnection(message.guild.id, message.member.voice.channel, message.channel);
                    
                    if (!queue.isPlaying) {
                        playSong(message.guild.id);
                    }

                } catch (videoError) {
                    Logger.error('Lỗi xử lý video:', videoError);
                    await processingMsg.delete().catch(() => {});
                    
                    let errorMessage = 'Không thể phát bài hát này! ';
                    if (videoError.message.includes('Sign in to confirm')) {
                        errorMessage += 'Video có thể bị giới hạn tuổi hoặc cần đăng nhập.';
                    } else if (videoError.message.includes('Not found')) {
                        errorMessage += 'Video không tồn tại hoặc không thể truy cập.';
                    } else {
                        errorMessage += 'Vui lòng thử URL hoặc tên bài hát khác.';
                    }
                    
                    const embed = createEmbed('error', '❌ Lỗi', errorMessage);
                    await message.reply({ embeds: [embed] });
                }

            } catch (error) {
                Logger.error('Lỗi phát nhạc:', error);
                const embed = createEmbed('error', '❌ Lỗi', 'Đã xảy ra lỗi khi xử lý yêu cầu! Vui lòng thử lại.');
                await message.reply({ embeds: [embed] });
            }
        }

        if (command === 'skip') {
            const queue = getQueue(message.guild.id);
            
            if (!queue.songs.length || queue.currentIndex >= queue.songs.length) {
                const embed = createEmbed('error', '❌ Lỗi', 'Không có bài hát nào trong hàng chờ!');
                return message.reply({ embeds: [embed] });
            }

            const skippedSong = queue.songs[queue.currentIndex];
            queue.currentIndex++;
            
            if (queue.player) {
                queue.player.stop();
            }

            const embed = createEmbed('success', '⏭️ Đã bỏ qua bài hát', `Đã bỏ qua: **${skippedSong.title}**`);
            await message.reply({ embeds: [embed] });
        }

        if (command === 'stop') {
            const queue = getQueue(message.guild.id);
            
            if (queue.connection) {
                queue.connection.destroy();
                musicQueues.delete(message.guild.id);
                
                const embed = createEmbed('success', '⏹️ Đã dừng phát nhạc', 'Đã dừng phát và xóa hàng chờ.');
                await message.reply({ embeds: [embed] });
            } else {
                const embed = createEmbed('error', '❌ Lỗi', 'Không có bài hát nào đang phát!');
                await message.reply({ embeds: [embed] });
            }
        }

        if (command === 'pause') {
            const queue = getQueue(message.guild.id);
            
            if (queue.player && queue.isPlaying && !queue.isPaused) {
                queue.player.pause();
                queue.isPaused = true;
                
                const embed = createEmbed('success', '⏸️ Đã tạm dừng', 'Bài hát đã được tạm dừng.');
                await message.reply({ embeds: [embed] });
            } else {
                const embed = createEmbed('error', '❌ Lỗi', 'Không có bài hát nào đang phát hoặc bài hát đã được tạm dừng!');
                await message.reply({ embeds: [embed] });
            }
        }

        if (command === 'resume') {
            const queue = getQueue(message.guild.id);
            
            if (queue.player && queue.isPaused) {
                queue.player.unpause();
                queue.isPaused = false;
                
                const embed = createEmbed('success', '▶️ Đã tiếp tục phát', 'Bài hát đã được tiếp tục.');
                await message.reply({ embeds: [embed] });
            } else {
                const embed = createEmbed('error', '❌ Lỗi', 'Bài hát không được tạm dừng!');
                await message.reply({ embeds: [embed] });
            }
        }

        if (command === 'queue' || command === 'q') {
            const queue = getQueue(message.guild.id);
            
            if (!queue.songs.length || queue.currentIndex >= queue.songs.length) {
                const embed = createEmbed('error', '❌ Lỗi', 'Hàng chờ trống!');
                return message.reply({ embeds: [embed] });
            }

            const currentSong = queue.songs[queue.currentIndex];
            const queueList = queue.songs.slice(queue.currentIndex, queue.currentIndex + 10)
                .map((song, index) => 
                    `${queue.currentIndex + index === queue.currentIndex ? '🎶 **Đang phát:**' : `${queue.currentIndex + index + 1}.`} **${song.title}** - ${song.requester}`
                )
                .join('\n');

            const embed = createEmbed('music', '🎵 Hàng chờ nhạc')
                .addFields(
                    { name: '📋 Danh sách phát', value: queueList || 'Không có bài hát', inline: false }
                )
                .addFields(
                    { name: '📊 Tổng số bài', value: `${queue.songs.length} bài`, inline: true },
                    { name: '🔊 Âm lượng', value: `${Math.round(queue.volume * 100)}%`, inline: true },
                    { name: '🔁 Lặp lại', value: queue.loop ? '✅ Bật' : '❌ Tắt', inline: true }
                );

            await message.reply({ embeds: [embed] });
        }

        if (command === 'volume' || command === 'vol') {
            const queue = getQueue(message.guild.id);
            const volume = parseInt(args[0]);
            
            if (!volume || volume < 1 || volume > 200) {
                const embed = createEmbed('info', '🔊 Âm lượng hiện tại', `Âm lượng hiện tại: **${Math.round(queue.volume * 100)}%**\n\nSử dụng: \`${prefix}volume 1-200\``);
                return message.reply({ embeds: [embed] });
            }

            queue.volume = volume / 100;
            if (queue.player) {
                const resource = queue.player.state.resource;
                if (resource && resource.volume) {
                    resource.volume.setVolume(queue.volume);
                }
            }

            const embed = createEmbed('success', '✅ Đã thay đổi âm lượng', `Âm lượng đã được đặt thành: **${volume}%**`);
            await message.reply({ embeds: [embed] });
        }

        if (command === 'nowplaying' || command === 'np') {
            if (!checkRateLimit(message.author.id, 'nowplaying', 3000)) {
                const embed = createEmbed('warning', '⏳ Đợi một chút!', 
                    'Bạn đang sử dụng lệnh quá nhanh. Vui lòng chờ 3 giây.');
                return message.reply({ embeds: [embed] }).then(msg => {
                    setTimeout(() => msg.delete().catch(() => {}), 3000);
                });
            }

            const queue = getQueue(message.guild.id);
            
            if (!queue.hasSongs()) {
                const embed = createEmbed('error', '❌ Lỗi', 'Không có bài hát nào đang phát!');
                return message.reply({ embeds: [embed] });
            }

            // Cập nhật embed hiện tại hoặc tạo mới
            await updateNowPlayingEmbed(message.guild.id);
            
            const embed = createEmbed('success', '🎵 Embed Đang Phát', 
                'Đã cập nhật embed đang phát với các nút điều khiển!');
            
            await message.reply({ embeds: [embed] }).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 3000);
            });
        }

        if (command === 'loop') {
            const queue = getQueue(message.guild.id);
            queue.loop = !queue.loop;
            
            const embed = createEmbed('success', '🔁 Chế độ lặp', 
                `Chế độ lặp đã được **${queue.loop ? 'bật' : 'tắt'}**`);
            await message.reply({ embeds: [embed] });
        }

    } catch (error) {
        Logger.error(`Lỗi xử lý lệnh ${command} từ ${message.author.tag}:`, error);
        const embed = createEmbed('error', '❌ Lỗi hệ thống', 
            'Có lỗi xảy ra khi thực hiện lệnh! Vui lòng thử lại sau.');
        await message.reply({ embeds: [embed] });
    }
});

// ==================== HỆ THỐNG TIN NHẮN TỰ ĐỘNG ====================

async function setupScheduledMessages() {
    try {
        const scheduleTimes = [
            { time: '0 8 * * *', type: 'morning' },
            { time: '0 12 * * *', type: 'noon' },
            { time: '30 17 * * *', type: 'afternoon' },
            { time: '0 20 * * *', type: 'evening' },
            { time: '0 22 * * *', type: 'night' }
        ];

        scheduleTimes.forEach(({ time, type }) => {
            cron.schedule(time, async () => {
                try {
                    // QUAN TRỌNG: Load config MỚI mỗi lần cron chạy
                    const botConfig = await loadConfig('botConfig.json');
                    
                    if (!botConfig.scheduleChannel) {
                        Logger.error(`[Cron ${type}] Chưa cấu hình scheduleChannel`);
                        return;
                    }

                    if (botConfig.scheduleEnabled === false) {
                        Logger.info(`[Cron ${type}] Tin nhắn tự động đã bị tắt`);
                        return;
                    }

                    // Load channel MỚI từ config mới nhất
                    const channel = await client.channels.fetch(botConfig.scheduleChannel).catch(() => null);
                    if (!channel) {
                        Logger.error(`[Cron ${type}] Không tìm thấy kênh: ${botConfig.scheduleChannel}`);
                        return;
                    }

                    // Kiểm tra quyền
                    if (!channel.permissionsFor(client.user)?.has(['SendMessages', 'ViewChannel'])) {
                        Logger.error(`[Cron ${type}] Không đủ quyền trong kênh: ${channel.name}`);
                        return;
                    }

                    const embed = createScheduleEmbed(type);
                    if (embed) {
                        await channel.send({ embeds: [embed] });
                        Logger.success(`[Cron ${type}] Đã gửi tin nhắn tự động trong kênh: ${channel.name}`, {
                            channelId: channel.id,
                            channelName: channel.name,
                            type: type,
                            time: new Date().toLocaleString('vi-VN')
                        });
                    }
                } catch (error) {
                    Logger.error(`[Cron ${type}] Lỗi gửi tin nhắn tự động:`, error);
                }
            }, {
                timezone: 'Asia/Ho_Chi_Minh'
            });
        });

        Logger.success('Đã thiết lập hệ thống tin nhắn tự động');
    } catch (error) {
        Logger.error('Lỗi thiết lập tin nhắn tự động:', error);
    }
}

// ==================== HÀM TIỆN ÍCH ====================

function formatUptime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days} ngày`);
    if (hours > 0) parts.push(`${hours} giờ`);
    if (minutes > 0) parts.push(`${minutes} phút`);
    if (secs > 0) parts.push(`${secs} giây`);

    return parts.join(' ');
}

// ==================== XỬ LÝ LỖI ====================

client.on('error', (error) => {
    Logger.error('Lỗi Discord Client:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    Logger.error('Unhandled Rejection tại:', { promise, reason });
});

process.on('uncaughtException', (error) => {
    Logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('SIGTERM', () => {
    Logger.info('Nhận tín hiệu SIGTERM, đang tắt bot...');
    client.destroy();
    process.exit(0);
});

// ==================== KHỞI CHẠY BOT ====================

client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        if (!process.env.DISCORD_TOKEN) {
            Logger.error('Không tìm thấy DISCORD_TOKEN trong file .env');
            process.exit(1);
        }
        Logger.success('Bot đã đăng nhập thành công!');
    })
    .catch(error => {
        Logger.error('Lỗi đăng nhập bot:', error);
        process.exit(1);
    });