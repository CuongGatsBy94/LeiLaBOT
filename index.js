/**
 * @Author: CuongGatsBy94
 * @Date: 2025-10-05 04:12:42
 * @Last Modified by:   Your name
 * @Last Modified time: 2025-10-25 18:16:05
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
            command: '⚡'
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
client.commands = new Collection();

// Paths cho file config
const configPath = path.join(__dirname, 'config');
const dataPath = path.join(__dirname, 'data');

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

// ==================== HỆ THỐNG ÂM NHẠC ====================

function getQueue(guildId) {
    if (!musicQueues.has(guildId)) {
        musicQueues.set(guildId, {
            songs: [],
            currentIndex: 0,
            isPlaying: false,
            isPaused: false,
            connection: null,
            player: null,
            volume: 1,
            loop: false,
            textChannel: null
        });
    }
    return musicQueues.get(guildId);
}

async function playSong(guildId) {
    const queue = getQueue(guildId);
    
    if (queue.currentIndex >= queue.songs.length) {
        if (queue.loop && queue.songs.length > 0) {
            queue.currentIndex = 0;
        } else {
            if (queue.connection) {
                if (queue.textChannel) {
                    const embed = createEmbed('success', '🎵 Kết thúc hàng chờ', 
                        'Tất cả bài hát trong hàng chờ đã được phát xong!');
                    queue.textChannel.send({ embeds: [embed] }).catch(error => {
                        Logger.error('Lỗi gửi tin nhắn kết thúc hàng chờ:', error);
                    });
                }
                queue.connection.destroy();
            }
            musicQueues.delete(guildId);
            Logger.music(`Đã xóa hàng chờ nhạc cho guild: ${guildId}`);
            return;
        }
    }

    const song = queue.songs[queue.currentIndex];
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
        try {
            queue.isPlaying = true;
            queue.isPaused = false;

            let stream;
            try {
                stream = await playdl.stream(song.url, { 
                    quality: 2,
                    discordPlayerCompatibility: true
                });
            } catch (playDlError) {
                Logger.error('Lỗi play-dl:', playDlError?.message || playDlError);

                try {
                    Logger.debug('Fallback sang ytdl-core để phát:', song.url);
                    const ytStream = ytdl(song.url, {
                        filter: 'audioonly',
                        quality: 'highestaudio',
                        highWaterMark: 1 << 25
                    });
                    stream = {
                        stream: ytStream,
                        type: 'unknown'
                    };
                } catch (ytdlErr) {
                    Logger.error('Lỗi ytdl-core fallback:', ytdlErr?.message || ytdlErr);
                    throw playDlError;
                }
            }

            const resource = createAudioResource(stream.stream, {
                inputType: stream.type,
                inlineVolume: true
            });

            if (resource && queue.player) {
                if (resource.volume) {
                    resource.volume.setVolume(queue.volume);
                }

                queue.player.play(resource);
                
                // Embed thông báo bài hát mới
                if (queue.textChannel) {
                    const progressBar = createProgressBar(queue.currentIndex + 1, queue.songs.length);
                    const embed = createMusicEmbed('music', '🎶 Đang phát nhạc', song, [
                        { name: '📊 Vị trí', value: `${queue.currentIndex + 1}/${queue.songs.length}`, inline: true },
                        { name: '🔊 Âm lượng', value: `${Math.round(queue.volume * 100)}%`, inline: true },
                        { name: '📈 Tiến độ', value: progressBar, inline: false }
                    ]);
                    
                    queue.textChannel.send({ embeds: [embed] }).catch(error => {
                        Logger.error('Lỗi gửi embed bài hát:', error);
                    });
                }

                Logger.music(`Đang phát: ${song.title}`, {
                    guild: guildId,
                    position: queue.currentIndex + 1,
                    total: queue.songs.length
                });

                queue.player.once(AudioPlayerStatus.Idle, () => {
                    setTimeout(() => {
                        if (!queue.loop) {
                            queue.currentIndex++;
                        }
                        playSong(guildId);
                    }, 1000);
                });

                queue.player.once('error', (error) => {
                    Logger.error('Lỗi player:', error);
                    if (queue.textChannel) {
                        const embed = createEmbed('error', '❌ Lỗi phát nhạc', 
                            'Có lỗi xảy ra khi phát nhạc! Đang thử lại...');
                        queue.textChannel.send({ embeds: [embed] }).catch(console.error);
                    }
                    setTimeout(() => playSong(guildId), 5000);
                });

                break;
            }
        } catch (error) {
            Logger.error(`Lỗi phát nhạc (Lần thử ${retryCount + 1}/${maxRetries}):`, error);
            retryCount++;
            
            if (retryCount >= maxRetries) {
                if (queue.textChannel) {
                    const embed = createEmbed('error', '❌ Lỗi nghiêm trọng', 
                        'Không thể phát bài hát sau nhiều lần thử! Đang chuyển sang bài tiếp theo...');
                    queue.textChannel.send({ embeds: [embed] }).catch(console.error);
                }
                queue.currentIndex++;
                setTimeout(() => playSong(guildId), 2000);
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
        }
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
        title: "💨 CÓ NGƯỜI VỪA BAY MẤT",
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

    await setupScheduledMessages();
    setInterval(checkBirthdays, 60 * 60 * 1000);
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

    Logger.command(`Lệnh từ ${message.author.tag} trong #${message.channel.name} (${message.guild.name}): ${message.content}`, {
        user: message.author.tag,
        userId: message.author.id,
        guild: message.guild.name,
        channel: message.channel.name,
        command: command,
        args: args
    });

    try {
        // LỆNH THÔNG TIN
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

        if (command === 'help' || command === 'commands') {
            const embed = createEmbed('primary', '🤖 LeiLaBOT - Hệ thống lệnh', 
                `**Prefix hiện tại:** \`${prefix}\`\nDưới đây là tất cả các lệnh có sẵn:`)
                .addFields(
                    {
                        name: '🎵 Âm nhạc',
                        value: '```play, stop, pause, resume, skip, queue, volume, loop, nowplaying```',
                        inline: true
                    },
                    {
                        name: '🔧 Tiện ích',
                        value: '```ping, help, info, userinfo, serverinfo, avatar```',
                        inline: true
                    },
                    {
                        name: '👥 Quản lý',
                        value: '```setprefix, setwelcome, setgoodbye, setwelcomerole, setdmlog, setschedulechannel, clear, slowmode```',
                        inline: true
                    },
                    {
                        name: '⏰ Tự động',
                        value: '```setschedule, testschedule, testschedulenow, testallschedules, setbirthday, scheduleinfo, toggleschedule```',
                        inline: true
                    },
                    {
                        name: '👋 Chào mừng',
                        value: '```welcometemplates, goodbyetemplates, testwelcome, testgoodbye```',
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
                        .setURL('https://discord.gg/9CFJxJUBj7'),
                    new ButtonBuilder()
                        .setLabel('🌐 Website')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://leilabot.railway.app')
                );

            await message.reply({ embeds: [embed], components: [row] });
        }

        // LỆNH DEBUG VÀ QUẢN LÝ
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

        // LỆNH QUẢN LÝ SERVER
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

        // LỆNH CHÀO MỪNG
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

        // LỆNH SETPREFIX
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

    } catch (error) {
        Logger.error(`Lỗi xử lý lệnh ${command} từ ${message.author.tag}:`, error);
        const embed = createEmbed('error', '❌ Lỗi hệ thống', 
            'Có lỗi xảy ra khi thực hiện lệnh! Vui lòng thử lại sau.');
        await message.reply({ embeds: [embed] });
    }
   // ==================== THÊM LỆNH QUẢN LÝ SINH NHẬT ====================

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
        const dateStr = args[0];
        if (!dateStr || !/^\d{1,2}-\d{1,2}$/.test(dateStr)) {
            const embed = createEmbed('error', '❌ Lỗi', 'Vui lòng nhập ngày sinh theo định dạng: DD-MM (ví dụ: 15-08 cho ngày 15 tháng 8)');
            return message.reply({ embeds: [embed] });
        }

        const [day, month] = dateStr.split('-').map(Number);
        if (day < 1 || day > 31 || month < 1 || month > 12) {
            const embed = createEmbed('error', '❌ Lỗi', 'Ngày hoặc tháng không hợp lệ!');
            return message.reply({ embeds: [embed] });
        }

        const birthdays = await loadData('birthdays.json');
        birthdays[message.author.id] = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
        await saveData('birthdays.json', birthdays);

        const embed = createEmbed('success', '✅ Thành công', 
            `Đã đặt ngày sinh của bạn là **${dateStr}**\n\nBot sẽ thông báo sinh nhật của bạn vào lúc 9:00 và 19:00 trong ngày sinh nhật! 🎉`);
        await message.reply({ embeds: [embed] });
        Logger.info(`Đã đặt ngày sinh cho ${message.author.tag} là ${dateStr}`);
    }

    if (command === 'birthdayinfo') {
        const birthdayConfig = await loadConfig('birthdayConfig.json', {});
        const birthdays = await loadData('birthdays.json');
        
        const channel = birthdayConfig[message.guild.id] ? 
            message.guild.channels.cache.get(birthdayConfig[message.guild.id]) : null;
        
        const userBirthday = birthdays[message.author.id];
        
        const embed = createEmbed('info', '🎉 THÔNG TIN HỆ THỐNG SINH NHẬT')
            .addFields(
                { 
                    name: '📅 Ngày sinh của bạn', 
                    value: userBirthday ? `**${userBirthday}**` : 'Chưa đặt', 
                    inline: true 
                },
                { 
                    name: '📢 Kênh thông báo', 
                    value: channel ? channel.toString() : 'Chưa cấu hình', 
                    inline: true 
                },
                { 
                    name: '⏰ Thời gian thông báo', 
                    value: '9:00 và 19:00 hàng ngày', 
                    inline: true 
                }
            )
            .setFooter({ text: 'Sử dụng setbirthday DD-MM để đặt ngày sinh' });

        await message.reply({ embeds: [embed] });
    }

    if (command === 'checkbirthday') {
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
                { 
                    name: '📅 Ngày hôm nay', 
                    value: todayStr, 
                    inline: true 
                },
                { 
                    name: '👥 Số người sinh nhật', 
                    value: birthdayUsers.length.toString(), 
                    inline: true 
                },
                { 
                    name: '🎂 Danh sách', 
                    value: birthdayUsers.length > 0 ? birthdayUsers.join('\n') : 'Không có ai sinh nhật hôm nay', 
                    inline: false 
                }
            );

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

// ==================== HỆ THỐNG SINH NHẬT ====================

async function checkBirthdays() {
    try {
        const birthdays = await loadData('birthdays.json');
        const birthdayConfig = await loadConfig('birthdayConfig.json', {});
        const today = new Date();
        const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}`;

        Logger.info(`Kiểm tra sinh nhật: ${todayStr}`, {
            totalUsers: Object.keys(birthdays).length,
            birthdayChannels: Object.keys(birthdayConfig).length
        });

        let birthdayCount = 0;

        for (const [userId, birthday] of Object.entries(birthdays)) {
            if (birthday === todayStr) {
                const user = await client.users.fetch(userId).catch(() => null);
                if (user) {
                    birthdayCount++;
                    
                    const embed = createEmbed('fun', '🎉 Chúc mừng sinh nhật!', 
                        `Chúc mừng sinh nhật ${user}! 🎂\n\nChúc bạn một ngày thật tuyệt vời với nhiều niềm vui và hạnh phúc! 🎈🎁`)
                        .setThumbnail(user.displayAvatarURL())
                        .addFields(
                            { name: '🎂 Tuổi mới', value: 'Thêm một tuổi mới, thêm nhiều thành công!', inline: true },
                            { name: '🎁 Lời chúc', value: 'Luôn vui vẻ và hạnh phúc nhé!', inline: true }
                        );

                    // Gửi đến tất cả server có cấu hình kênh sinh nhật
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
                                    Logger.success(`Đã gửi lời chúc sinh nhật cho ${user.tag} trong ${guild.name}`);
                                }
                            }
                        }
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

// ==================== KHỞI CHẠY BOT ====================

client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        Logger.success('Bot đã đăng nhập thành công!');
    })
    .catch(error => {
        Logger.error('Lỗi đăng nhập bot:', error);
        process.exit(1);
    });