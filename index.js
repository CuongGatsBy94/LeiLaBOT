/**
 * @Author: CuongGatsBy94
 * @Date: 2025-10-05 04:12:42
 * @Last Modified by:   Your name
 * @Last Modified time: 2025-10-21 22:54:30
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
    Collection
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
    }
}

async function loadConfig(fileName, defaultData = {}) {
    try {
        const filePath = path.join(configPath, fileName);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.log(`📁 Tạo file config mới: ${fileName}`);
        await saveConfig(fileName, defaultData);
        return defaultData;
    }
}

async function loadData(fileName, defaultData = {}) {
    try {
        const filePath = path.join(dataPath, fileName);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.log(`📁 Tạo file data mới: ${fileName}`);
        await saveData(fileName, defaultData);
        return defaultData;
    }
}

async function saveConfig(fileName, data) {
    await ensureDir(configPath);
    const filePath = path.join(configPath, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function saveData(fileName, data) {
    await ensureDir(dataPath);
    const filePath = path.join(dataPath, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
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
                    queue.textChannel.send({ embeds: [embed] }).catch(console.error);
                }
                queue.connection.destroy();
            }
            musicQueues.delete(guildId);
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
                console.error('❌ Lỗi play-dl:', playDlError?.message || playDlError);

                try {
                    console.log('🔄 Fallback sang ytdl-core để phát:', song.url);
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
                    console.error('❌ Lỗi ytdl-core fallback:', ytdlErr?.message || ytdlErr);
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
                    
                    queue.textChannel.send({ embeds: [embed] }).catch(console.error);
                }

                queue.player.once(AudioPlayerStatus.Idle, () => {
                    setTimeout(() => {
                        if (!queue.loop) {
                            queue.currentIndex++;
                        }
                        playSong(guildId);
                    }, 1000);
                });

                queue.player.once('error', (error) => {
                    console.error('❌ Lỗi player:', error);
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
            console.error(`❌ Lỗi phát nhạc (Lần thử ${retryCount + 1}/${maxRetries}):`, error);
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

// ==================== HỆ THỐNG TIN NHẮN THEO KHUNG GIỜ VỚI EMBED MỚI ====================

// Biến lưu trữ template embed cho các khung giờ
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

// Hàm tạo embed theo template mới
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

// ==================== HỆ THỐNG GỬI TIN NHẮN TỰ ĐỘNG ====================

async function setupScheduledMessages() {
    try {
        const botConfig = await loadConfig('botConfig.json');

        if (!botConfig.scheduleChannel) {
            console.log('⏰ Chưa cấu hình channel tin nhắn tự động');
            return;
        }

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
                    const channel = client.channels.cache.get(botConfig.scheduleChannel);
                    if (!channel) {
                        console.log(`❌ Không tìm thấy channel: ${botConfig.scheduleChannel}`);
                        return;
                    }

                    const embed = createScheduleEmbed(type);
                    if (embed) {
                        await channel.send({ embeds: [embed] });
                        console.log(`✅ Đã gửi tin nhắn tự động: ${scheduleTemplates[type].title}`);
                    }
                } catch (error) {
                    console.error(`❌ Lỗi gửi tin nhắn tự động ${type}:`, error);
                }
            }, {
                timezone: 'Asia/Ho_Chi_Minh'
            });
        });

        console.log('✅ Đã thiết lập hệ thống tin nhắn tự động');
    } catch (error) {
        console.error('❌ Lỗi thiết lập tin nhắn tự động:', error);
    }
}

// ==================== LỆNH QUẢN LÝ TIN NHẮN VỚI EMBED MỚI ====================

// Thêm vào phần xử lý messageCreate
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const prefixConfig = await loadConfig('prefix.json', { prefix: "$" });
    const prefix = prefixConfig.prefix;

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        // Lệnh test tin nhắn với embed mới
        if (command === 'testschedule' || command === 'testmsg') {
            const type = args[0]?.toLowerCase();
            const validTypes = ['morning', 'noon', 'afternoon', 'evening', 'night'];

            if (!type || !validTypes.includes(type)) {
                const embed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle('❌ Sai cú pháp')
                    .setDescription('**Sử dụng:** `testschedule [loại]`\n\n**Loại có sẵn:**')
                    .addFields(
                        { name: '🌅 Morning', value: '08:00 - Chào buổi sáng', inline: true },
                        { name: '🍱 Noon', value: '12:00 - Giờ ăn trưa', inline: true },
                        { name: '🌤️ Afternoon', value: '17:30 - Buổi chiều', inline: true },
                        { name: '🌃 Evening', value: '20:00 - Buổi tối', inline: true },
                        { name: '🌙 Night', value: '22:00 - Chúc ngủ ngon', inline: true }
                    )
                    .setFooter({ text: 'Ví dụ: testschedule morning' });
                return message.reply({ embeds: [embed] });
            }

            // Tạo embed theo template mới
            const embed = createScheduleEmbed(type);
            
            if (!embed) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle('❌ Lỗi')
                    .setDescription(`Không tìm thấy template cho khung giờ: ${type}`);
                return message.reply({ embeds: [errorEmbed] });
            }

            await message.reply({ embeds: [embed] });
        }

        // Lệnh xem thông tin tất cả template
        if (command === 'scheduletemplates' || command === 'stemplates') {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🎨 TEMPLATE TIN NHẮN THEO KHUNG GIỜ')
                .setDescription('Dưới đây là các template có sẵn:')
                .addFields(
                    { 
                        name: '🌅 08:00 - Morning', 
                        value: `**Mô tả:** ${scheduleTemplates.morning.description}\n**Mẹo:** ${scheduleTemplates.morning.tip}`,
                        inline: false 
                    },
                    { 
                        name: '🍱 12:00 - Noon', 
                        value: `**Mô tả:** ${scheduleTemplates.noon.description}\n**Mẹo:** ${scheduleTemplates.noon.tip}`,
                        inline: false 
                    },
                    { 
                        name: '🌤️ 17:30 - Afternoon', 
                        value: `**Mô tả:** ${scheduleTemplates.afternoon.description}\n**Mẹo:** ${scheduleTemplates.afternoon.tip}`,
                        inline: false 
                    },
                    { 
                        name: '🌃 20:00 - Evening', 
                        value: `**Mô tả:** ${scheduleTemplates.evening.description}\n**Mẹo:** ${scheduleTemplates.evening.tip}`,
                        inline: false 
                    },
                    { 
                        name: '🌙 22:00 - Night', 
                        value: `**Mô tả:** ${scheduleTemplates.night.description}\n**Mẹo:** ${scheduleTemplates.night.tip}`,
                        inline: false 
                    }
                )
                .setFooter({ text: 'Sử dụng testschedule [loại] để xem template đầy đủ' });

            await message.reply({ embeds: [embed] });
        }

        // Lệnh setup channel tin nhắn tự động
        if (command === 'setschedulechannel' || command === 'setmsgchannel') {
            if (!message.member.permissions.has('Administrator')) {
                const embed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle('❌ Thiếu quyền')
                    .setDescription('Bạn cần quyền **Administrator** để sử dụng lệnh này!');
                return message.reply({ embeds: [embed] });
            }

            const channel = message.mentions.channels.first() || message.channel;
            
            const botConfig = await loadConfig('botConfig.json', {});
            botConfig.scheduleChannel = channel.id;
            await saveConfig('botConfig.json', botConfig);

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('✅ Đã thiết lập channel')
                .setDescription(`Đã đặt channel tin nhắn tự động thành: ${channel.toString()}`)
                .addFields(
                    { name: '📝 Các khung giờ', value: '08:00, 12:00, 17:30, 20:00, 22:00', inline: false },
                    { name: '🎨 Template', value: 'Embed được thiết kế sẵn đẹp mắt', inline: false }
                )
                .setFooter({ text: 'Channel này sẽ nhận tin nhắn tự động nếu được kích hoạt' });

            await message.reply({ embeds: [embed] });
        }

        // Lệnh gửi tin nhắn thử tất cả khung giờ
        if (command === 'testallschedules' || command === 'testall') {
            if (!message.member.permissions.has('Administrator')) {
                const embed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle('❌ Thiếu quyền')
                    .setDescription('Bạn cần quyền **Administrator** để sử dụng lệnh này!');
                return message.reply({ embeds: [embed] });
            }

            const types = ['morning', 'noon', 'afternoon', 'evening', 'night'];
            
            for (const type of types) {
                const embed = createScheduleEmbed(type);
                if (embed) {
                    await message.channel.send({ embeds: [embed] });
                    // Delay 1 giây giữa các tin nhắn
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            const summaryEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('✅ Đã gửi tất cả template')
                .setDescription('Đã gửi thành công 5 template tin nhắn theo khung giờ!')
                .setFooter({ text: 'Sử dụng testschedule [loại] để xem từng cái riêng' });

            await message.reply({ embeds: [summaryEmbed] });
        }

        // Lệnh custom tin nhắn với template
        if (command === 'customschedule' || command === 'custommsg') {
            if (!message.member.permissions.has('Administrator')) {
                const embed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle('❌ Thiếu quyền')
                    .setDescription('Bạn cần quyền **Administrator** để sử dụng lệnh này!');
                return message.reply({ embeds: [embed] });
            }

            const type = args[0]?.toLowerCase();
            const customDescription = args.slice(1).join(' ');

            const validTypes = ['morning', 'noon', 'afternoon', 'evening', 'night'];

            if (!type || !validTypes.includes(type)) {
                const embed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle('❌ Loại không hợp lệ')
                    .setDescription('**Loại có sẵn:**\n`morning`, `noon`, `afternoon`, `evening`, `night`\n\n**Ví dụ:** `customschedule morning Chào buổi sáng mọi người!`');
                return message.reply({ embeds: [embed] });
            }

            if (!customDescription) {
                const embed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle('❌ Thiếu mô tả')
                    .setDescription('Vui lòng cung cấp nội dung mô tả mới!\n\n**Ví dụ:** `customschedule morning "Chào buổi sáng cả nhà! Hôm nay thật tuyệt!"`');
                return message.reply({ embeds: [embed] });
            }

            const embed = createScheduleEmbed(type, customDescription);
            
            if (!embed) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle('❌ Lỗi')
                    .setDescription(`Không tìm thấy template cho khung giờ: ${type}`);
                return message.reply({ embeds: [errorEmbed] });
            }

            await message.reply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('❌ Lỗi xử lý lệnh schedule:', error);
        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ Lỗi hệ thống')
            .setDescription('Có lỗi xảy ra khi xử lý lệnh! Vui lòng thử lại.');
        await message.reply({ embeds: [embed] });
    }
});

// ==================== HỆ THỐNG SINH NHẬT ====================

async function checkBirthdays() {
    try {
        const birthdays = await loadData('birthdays.json');
        const today = new Date();
        const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}`;

        for (const [userId, birthday] of Object.entries(birthdays)) {
            if (birthday === todayStr) {
                const user = await client.users.fetch(userId).catch(() => null);
                if (user) {
                    const embed = createEmbed('fun', '🎉 Chúc mừng sinh nhật!', 
                        `Chúc mừng sinh nhật ${user}! 🎂\n\nChúc bạn một ngày thật tuyệt vời với nhiều niềm vui và hạnh phúc! 🎈🎁`)
                        .setThumbnail(user.displayAvatarURL())
                        .addFields(
                            { name: '🎂 Tuổi mới', value: 'Thêm một tuổi mới, thêm nhiều thành công!', inline: true },
                            { name: '🎁 Lời chúc', value: 'Luôn vui vẻ và hạnh phúc nhé!', inline: true }
                        );

                    client.guilds.cache.forEach(guild => {
                        const member = guild.members.cache.get(userId);
                        if (member) {
                            const generalChannel = guild.channels.cache.find(
                                channel => channel.type === 0 && channel.permissionsFor(guild.members.me).has('SendMessages')
                            );
                            if (generalChannel) {
                                generalChannel.send({ 
                                    content: `🎉 ${member.toString()}`, 
                                    embeds: [embed] 
                                }).catch(console.error);
                            }
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error('❌ Lỗi kiểm tra sinh nhật:', error);
    }
}

// ==================== XỬ LÝ SỰ KIỆN CHÍNH ====================

client.on('ready', async () => {
    console.log(`✅ ${client.user.tag} đã sẵn sàng!`);
    console.log(`📊 Đang phục vụ ${client.guilds.cache.size} server`);
    console.log(`👥 Tổng số ${client.users.cache.size} người dùng`);

    // Thiết lập trạng thái
    client.user.setPresence({
        activities: [{
            name: 'LeiLaBOT | $help',
            type: ActivityType.Playing
        }],
        status: 'online'
    });

    // Thiết lập các tính năng tự động
    await setupScheduledMessages();
    
    // Kiểm tra sinh nhật hàng ngày
    setInterval(checkBirthdays, 60 * 60 * 1000);
    checkBirthdays();

    console.log('🚀 Bot đã khởi động thành công!');
});

client.on('guildMemberAdd', async (member) => {
    try {
        const welcomeConfig = await loadConfig('welcomeConfig.json');
        
        if (!welcomeConfig.welcomeChannel || !welcomeConfig.welcomeMessage) {
            return;
        }

        const channel = member.guild.channels.cache.get(welcomeConfig.welcomeChannel);
        if (!channel) return;

        const welcomeMessage = welcomeConfig.welcomeMessage
            .replace('{user}', member.toString())
            .replace('{server}', member.guild.name);

        const embed = createEmbed('success', '👋 Chào mừng thành viên mới!', welcomeMessage)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: '🎉 Thành viên thứ', value: `#${member.guild.memberCount}`, inline: true },
                { name: '📅 Tham gia vào', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: '🏠 Server', value: member.guild.name, inline: true }
            )
            .setImage('https://cdn.discordapp.com/attachments/1045746639303876638/1234567890123456789/welcome-banner.png');

        await channel.send({ 
            content: `🎉 ${member.toString()}`, 
            embeds: [embed] 
        });

        // Thêm role chào mừng
        if (welcomeConfig.welcomeRole) {
            const role = member.guild.roles.cache.get(welcomeConfig.welcomeRole);
            if (role) {
                await member.roles.add(role).catch(console.error);
            }
        }
    } catch (error) {
        console.error('❌ Lỗi chào mừng thành viên mới:', error);
    }
});

client.on('guildMemberRemove', async (member) => {
    try {
        const welcomeConfig = await loadConfig('welcomeConfig.json');
        
        if (!welcomeConfig.goodbyeChannel || !welcomeConfig.goodbyeMessage) {
            return;
        }

        const channel = member.guild.channels.cache.get(welcomeConfig.goodbyeChannel);
        if (!channel) return;

        const goodbyeMessage = welcomeConfig.goodbyeMessage
            .replace('{user}', member.user.tag)
            .replace('{server}', member.guild.name);

        const embed = createEmbed('error', '😢 Tạm biệt thành viên', goodbyeMessage)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: '📊 Tổng thành viên', value: `${member.guild.memberCount}`, inline: true },
                { name: '⏰ Rời đi lúc', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            );

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('❌ Lỗi gửi tin nhắn tạm biệt:', error);
    }
});

// ==================== XỬ LÝ LỆNH ====================

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Xử lý tin nhắn DM
    if (message.channel.type === 1) {
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
            }

            // Log DM
            if (botConfig.dmLogChannel) {
                const logChannel = client.channels.cache.get(botConfig.dmLogChannel);
                if (logChannel) {
                    const embed = createEmbed('info', '📨 Tin nhắn DM mới', 
                        `**Người gửi:** ${message.author.tag} (${message.author.id})\n**Nội dung:** ${message.content}`)
                        .setThumbnail(message.author.displayAvatarURL());

                    await logChannel.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            console.error('❌ Lỗi xử lý DM:', error);
        }
        return;
    }

    // Xử lý lệnh trong server
    const prefixConfig = await loadConfig('prefix.json', { prefix: "$" });
    const prefix = prefixConfig.prefix;

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        // ==================== LỆNH THÔNG TIN ====================
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
                        value: '```setprefix, setwelcome, clear, slowmode```',
                        inline: true
                    },
                    {
                        name: '⏰ Tự động',
                        value: '```setschedule, testschedule, setbirthday```',
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

        if (command === 'info') {
            const embed = createEmbed('info', '🤖 Thông tin LeiLaBOT', 
                'LeiLaBOT - Discord Bot đa năng Việt Nam với giao diện hiện đại và tính năng phong phú!')
                .addFields(
                    { name: '👑 Developer', value: '`CuongGatsBy94`', inline: true },
                    { name: '📚 Thư viện', value: '`Discord.js v14`', inline: true },
                    { name: '⏰ Uptime', value: `\`${formatUptime(process.uptime())}\``, inline: true },
                    { name: '📊 Server', value: `\`${client.guilds.cache.size}\``, inline: true },
                    { name: '👥 Users', value: `\`${client.users.cache.size}\``, inline: true },
                    { name: '🎵 Prefix', value: `\`${prefix}\``, inline: true },
                    { name: '🚀 Phiên bản', value: '`2.0.0`', inline: true },
                    { name: '📅 Ngày tạo', value: '<t:1725502362:R>', inline: true },
                    { name: '💾 Bộ nhớ', value: `\`${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB\``, inline: true }
                )
                .setThumbnail(client.user.displayAvatarURL())
                .setImage('https://cdn.discordapp.com/attachments/1045746639303876638/1234567890123456789/info-banner.png');

            await message.reply({ embeds: [embed] });
        }

        // ==================== LỆNH ÂM NHẠC ====================
        if (command === 'play' || command === 'p') {
            if (!args[0]) {
                const embed = createEmbed('error', '❌ Thiếu thông tin', 
                    'Vui lòng cung cấp URL YouTube hoặc tên bài hát!\n\n**Ví dụ:**\n`$play https://youtube.com/...`\n`$play Shape of You`');
                return message.reply({ embeds: [embed] });
            }

            if (!message.member.voice.channel) {
                const embed = createEmbed('error', '❌ Chưa tham gia voice', 
                    'Bạn cần tham gia voice channel trước khi sử dụng lệnh này!');
                return message.reply({ embeds: [embed] });
            }

            const voiceChannel = message.member.voice.channel;
            const queue = getQueue(message.guild.id);
            queue.textChannel = message.channel;

            // Embed loading
            const loadingEmbed = createEmbed('info', '⏳ Đang xử lý...', 
                'Đang tìm kiếm và tải thông tin bài hát...');
            const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

            try {
                let songInfo;
                let searchQuery = args.join(' ');

                if (playdl.yt_validate(searchQuery) === 'video') {
                    songInfo = await playdl.video_info(searchQuery);
                } else {
                    const searchResults = await playdl.search(searchQuery, { limit: 1 });
                    if (!searchResults || searchResults.length === 0) {
                        const embed = createEmbed('error', '❌ Không tìm thấy', 
                            'Không tìm thấy bài hát phù hợp với từ khóa của bạn!');
                        return loadingMsg.edit({ embeds: [embed] });
                    }
                    songInfo = await playdl.video_info(searchResults[0].url);
                }

                const song = {
                    title: songInfo.video_details.title,
                    url: songInfo.video_details.url,
                    duration: songInfo.video_details.durationRaw,
                    thumbnail: songInfo.video_details.thumbnails[0]?.url || '',
                    channel: songInfo.video_details.channel?.name || 'Unknown',
                    requester: message.author.tag
                };

                // Kết nối voice
                if (!queue.connection) {
                    queue.connection = joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: message.guild.id,
                        adapterCreator: message.guild.voiceAdapterCreator,
                    });

                    queue.player = createAudioPlayer();
                    queue.connection.subscribe(queue.player);
                }

                queue.songs.push(song);

                const embed = createMusicEmbed('success', '✅ Đã thêm vào hàng chờ', song, [
                    { name: '📊 Vị trí', value: `#${queue.songs.length}`, inline: true },
                    { name: '🎵 Trạng thái', value: queue.isPlaying ? 'Đang phát' : 'Sẽ phát', inline: true }
                ]);

                await loadingMsg.edit({ embeds: [embed] });

                // Phát nhạc nếu chưa phát
                if (!queue.isPlaying) {
                    playSong(message.guild.id);
                }

            } catch (error) {
                console.error('❌ Lỗi play command:', error);
                const embed = createEmbed('error', '❌ Lỗi phát nhạc', 
                    'Không thể phát bài hát này! Vui lòng thử lại với URL hoặc từ khóa khác.');
                await loadingMsg.edit({ embeds: [embed] });
            }
        }

        if (command === 'stop') {
            const queue = getQueue(message.guild.id);
            if (queue.connection) {
                queue.connection.destroy();
                musicQueues.delete(message.guild.id);
                
                const embed = createEmbed('success', '⏹️ Đã dừng phát nhạc', 
                    'Đã dừng phát nhạc và xóa toàn bộ hàng chờ!');
                await message.reply({ embeds: [embed] });
            } else {
                const embed = createEmbed('error', '❌ Không có nhạc', 
                    'Không có bài hát nào đang được phát!');
                await message.reply({ embeds: [embed] });
            }
        }

        if (command === 'pause') {
            const queue = getQueue(message.guild.id);
            if (queue.player && queue.isPlaying && !queue.isPaused) {
                queue.player.pause();
                queue.isPaused = true;
                
                const embed = createEmbed('warning', '⏸️ Đã tạm dừng', 
                    'Nhạc đã được tạm dừng. Sử dụng `$resume` để tiếp tục.');
                await message.reply({ embeds: [embed] });
            } else {
                const embed = createEmbed('error', '❌ Lỗi tạm dừng', 
                    'Không có bài hát nào đang phát hoặc nhạc đã được tạm dừng trước đó!');
                await message.reply({ embeds: [embed] });
            }
        }

        if (command === 'resume') {
            const queue = getQueue(message.guild.id);
            if (queue.player && queue.isPaused) {
                queue.player.unpause();
                queue.isPaused = false;
                
                const embed = createEmbed('success', '▶️ Đã tiếp tục', 
                    'Nhạc đã được tiếp tục phát!');
                await message.reply({ embeds: [embed] });
            } else {
                const embed = createEmbed('error', '❌ Lỗi tiếp tục', 
                    'Nhạc không được tạm dừng hoặc không có bài hát nào đang phát!');
                await message.reply({ embeds: [embed] });
            }
        }

        if (command === 'skip') {
            const queue = getQueue(message.guild.id);
            if (queue.player && queue.isPlaying) {
                const skippedSong = queue.songs[queue.currentIndex];
                queue.player.stop();
                
                const embed = createEmbed('success', '⏭️ Đã bỏ qua bài hát', 
                    `Đã bỏ qua: **${skippedSong.title}**`);
                await message.reply({ embeds: [embed] });
            } else {
                const embed = createEmbed('error', '❌ Không có nhạc', 
                    'Không có bài hát nào đang được phát!');
                await message.reply({ embeds: [embed] });
            }
        }

        if (command === 'queue' || command === 'q') {
            const queue = getQueue(message.guild.id);
            
            if (queue.songs.length === 0) {
                const embed = createEmbed('info', '📭 Hàng chờ trống', 
                    'Hiện không có bài hát nào trong hàng chờ!');
                return message.reply({ embeds: [embed] });
            }

            const currentSong = queue.songs[queue.currentIndex];
            const queueList = queue.songs.slice(queue.currentIndex, queue.currentIndex + 10)
                .map((song, index) => 
                    `${queue.currentIndex + index + 1}. **${song.title}** - ${song.requester}`
                )
                .join('\n');

            const totalDuration = queue.songs.reduce((acc, song) => {
                const [min, sec] = song.duration.split(':').map(Number);
                return acc + (min * 60 + sec);
            }, 0);

            const embed = createEmbed('music', '🎵 Hàng chờ nhạc', 
                `**Đang phát:** ${currentSong.title}\n\n**Bài hát tiếp theo:**`)
                .addFields(
                    { name: '📋 Danh sách', value: queueList || 'Không có bài hát nào' },
                    { name: '📊 Thống kê', value: 
                        `• Tổng số bài: ${queue.songs.length}\n` +
                        `• Vị trí hiện tại: ${queue.currentIndex + 1}\n` +
                        `• Tổng thời lượng: ${Math.floor(totalDuration / 60)}:${(totalDuration % 60).toString().padStart(2, '0')}\n` +
                        `• Trạng thái: ${queue.isPlaying ? '🎶 Đang phát' : '⏸️ Tạm dừng'}`
                    }
                )
                .setThumbnail(currentSong.thumbnail);

            await message.reply({ embeds: [embed] });
        }

        if (command === 'nowplaying' || command === 'np') {
            const queue = getQueue(message.guild.id);
            
            if (!queue.isPlaying || !queue.songs[queue.currentIndex]) {
                const embed = createEmbed('error', '❌ Không có nhạc', 
                    'Hiện không có bài hát nào đang được phát!');
                return message.reply({ embeds: [embed] });
            }

            const currentSong = queue.songs[queue.currentIndex];
            const progress = createProgressBar(queue.currentIndex + 1, queue.songs.length, 15);

            const embed = createMusicEmbed('music', '🎶 Đang phát', currentSong, [
                { name: '📊 Vị trí', value: `${queue.currentIndex + 1}/${queue.songs.length}`, inline: true },
                { name: '🔊 Âm lượng', value: `${Math.round(queue.volume * 100)}%`, inline: true },
                { name: '🔄 Lặp lại', value: queue.loop ? '✅ Bật' : '❌ Tắt', inline: true },
                { name: '📈 Tiến độ', value: progress, inline: false }
            ]);

            await message.reply({ embeds: [embed] });
        }

        if (command === 'volume' || command === 'vol') {
            const queue = getQueue(message.guild.id);
            const volume = parseInt(args[0]);

            if (isNaN(volume) || volume < 0 || volume > 200) {
                const embed = createEmbed('error', '❌ Volume không hợp lệ', 
                    'Volume phải là số từ 0 đến 200!');
                return message.reply({ embeds: [embed] });
            }

            queue.volume = volume / 100;
            
            const embed = createEmbed('success', '🔊 Điều chỉnh âm lượng', 
                `Đã đặt âm lượng thành: **${volume}%**`);
            await message.reply({ embeds: [embed] });
        }

        if (command === 'loop') {
            const queue = getQueue(message.guild.id);
            queue.loop = !queue.loop;
            
            const embed = createEmbed('success', '🔄 Chế độ lặp', 
                `Chế độ lặp đã được **${queue.loop ? 'BẬT' : 'TẮT'}**`);
            await message.reply({ embeds: [embed] });
        }

        // ==================== LỆNH QUẢN LÝ ====================
        if (command === 'setprefix') {
            if (!message.member.permissions.has('Administrator')) {
                const embed = createEmbed('error', '❌ Thiếu quyền', 
                    'Bạn cần quyền **Administrator** để sử dụng lệnh này!');
                return message.reply({ embeds: [embed] });
            }

            if (!args[0]) {
                const embed = createEmbed('error', '❌ Thiếu prefix', 
                    'Vui lòng cung cấp prefix mới!\n\n**Ví dụ:** `$setprefix !`');
                return message.reply({ embeds: [embed] });
            }

            const newPrefix = args[0];
            await saveConfig('prefix.json', { prefix: newPrefix });

            const embed = createEmbed('success', '✅ Đã thay đổi prefix', 
                `Prefix mới: \`${newPrefix}\`\n\n**Lưu ý:** Prefix chỉ thay đổi trên server này.`);
            await message.reply({ embeds: [embed] });
        }

        if (command === 'userinfo') {
            const target = message.mentions.users.first() || message.author;
            const member = message.guild.members.cache.get(target.id);

            const embed = createEmbed('info', `👤 Thông tin ${target.username}`, '')
                .setThumbnail(target.displayAvatarURL({ size: 256 }))
                .addFields(
                    { name: '🆔 ID', value: `\`${target.id}\``, inline: true },
                    { name: '📛 Biệt danh', value: member?.nickname || '`Không có`', inline: true },
                    { name: '🤖 Bot', value: target.bot ? '`✅`' : '`❌`', inline: true },
                    { name: '🎂 Tài khoản tạo', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: '📅 Tham gia server', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : '`Không có`', inline: true },
                    { name: '🎭 Roles', value: `\`${member?.roles.cache.size - 1}\``, inline: true }
                )
                .setImage(target.displayAvatarURL({ size: 1024 }));

            await message.reply({ embeds: [embed] });
        }

        if (command === 'serverinfo') {
            const guild = message.guild;

            const embed = createEmbed('info', `🏠 ${guild.name}`, '')
                .setThumbnail(guild.iconURL({ size: 256 }))
                .addFields(
                    { name: '🆔 ID', value: `\`${guild.id}\``, inline: true },
                    { name: '👑 Chủ server', value: `<@${guild.ownerId}>`, inline: true },
                    { name: '📅 Tạo vào', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: '👥 Thành viên', value: `\`${guild.memberCount}\``, inline: true },
                    { name: '🎭 Roles', value: `\`${guild.roles.cache.size}\``, inline: true },
                    { name: '📁 Channels', value: `\`${guild.channels.cache.size}\``, inline: true },
                    { name: '🌍 Khu vực', value: `\`${guild.preferredLocale}\``, inline: true },
                    { name: '🔒 Xác minh', value: guild.verified ? '`✅`' : '`❌`', inline: true },
                    { name: '🚀 Nitro Boost', value: `Level \`${guild.premiumTier}\``, inline: true }
                )
                .setImage(guild.bannerURL({ size: 1024 }) || 'https://cdn.discordapp.com/attachments/1045746639303876638/1234567890123456789/server-banner.png');

            await message.reply({ embeds: [embed] });
        }

        if (command === 'avatar' || command === 'av') {
            const target = message.mentions.users.first() || message.author;
            
            const embed = createEmbed('info', `🖼️ Avatar của ${target.username}`, '')
                .setImage(target.displayAvatarURL({ size: 1024, dynamic: true }))
                .addFields(
                    { name: '🔗 Link avatar', value: `[Tải xuống](${target.displayAvatarURL({ size: 4096, dynamic: true })})`, inline: true }
                );

            await message.reply({ embeds: [embed] });
        }

        // ==================== LỆNH GIẢI TRÍ ====================
        if (command === 'poll') {
            if (args.length < 3) {
                const embed = createEmbed('error', '❌ Sai cú pháp', 
                    '**Sử dụng:** `poll "câu hỏi" "lựa chọn1" "lựa chọn2" ...`\n\n**Ví dụ:**\n`$poll "Món ăn yêu thích?" "Pizza" "Burgers" "Sushi"`');
                return message.reply({ embeds: [embed] });
            }

            const question = args[0].replace(/"/g, '');
            const choices = args.slice(1).map(choice => choice.replace(/"/g, ''));

            if (choices.length > 10) {
                const embed = createEmbed('error', '❌ Quá nhiều lựa chọn', 
                    'Chỉ được tối đa 10 lựa chọn!');
                return message.reply({ embeds: [embed] });
            }

            const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            let description = `**${question}**\n\n`;

            choices.forEach((choice, index) => {
                description += `${emojis[index]} ${choice}\n`;
            });

            const embed = createEmbed('fun', '📊 Bình chọn mới', description)
                .setFooter({ text: `Tạo bởi ${message.author.tag} • Phản ứng để bình chọn!` });

            const pollMessage = await message.reply({ embeds: [embed] });

            // Thêm reactions
            for (let i = 0; i < choices.length; i++) {
                await pollMessage.react(emojis[i]);
            }
        }

        // ==================== LỆNH TIỆN ÍCH ====================
        if (command === 'translate') {
            if (args.length < 2) {
                const embed = createEmbed('error', '❌ Sai cú pháp', 
                    '**Sử dụng:** `translate [ngôn ngữ đích] [văn bản]`\n\n**Ví dụ:**\n`$translate vi Hello world`\n`$translate en Xin chào`');
                return message.reply({ embeds: [embed] });
            }

            const targetLang = args[0];
            const text = args.slice(1).join(' ');

            const loadingEmbed = createEmbed('info', '🌐 Đang dịch...', 
                'Đang xử lý yêu cầu dịch thuật...');
            const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

            try {
                const result = await translate(text, { to: targetLang });
                
                const embed = createEmbed('success', '🌐 Dịch thuật thành công', '')
                    .addFields(
                        { name: '📥 Văn bản gốc', value: text, inline: false },
                        { name: '📤 Văn bản dịch', value: result.text, inline: false },
                        { name: '🌍 Ngôn ngữ', value: `\`${result.from.language.iso}\` → \`${targetLang}\``, inline: true }
                    )
                    .setThumbnail('https://cdn.discordapp.com/emojis/1107540430879342694.webp');

                await loadingMsg.edit({ embeds: [embed] });
            } catch (error) {
                const embed = createEmbed('error', '❌ Lỗi dịch thuật', 
                    'Không thể dịch văn bản! Vui lòng thử lại.');
                await loadingMsg.edit({ embeds: [embed] });
            }
        }

        if (command === 'clear' || command === 'purge') {
            if (!message.member.permissions.has('ManageMessages')) {
                const embed = createEmbed('error', '❌ Thiếu quyền', 
                    'Bạn cần quyền **Quản lý tin nhắn** để sử dụng lệnh này!');
                return message.reply({ embeds: [embed] });
            }

            const amount = parseInt(args[0]);
            if (isNaN(amount) || amount < 1 || amount > 100) {
                const embed = createEmbed('error', '❌ Số lượng không hợp lệ', 
                    'Vui lòng cung cấp số lượng tin nhắn hợp lệ (1-100)!');
                return message.reply({ embeds: [embed] });
            }

            try {
                const messages = await message.channel.bulkDelete(amount + 1, true);
                
                const embed = createEmbed('success', '🧹 Đã dọn dẹp', 
                    `Đã xóa **${messages.size - 1}** tin nhắn thành công!`);
                const reply = await message.channel.send({ embeds: [embed] });
                
                setTimeout(() => reply.delete(), 5000);
            } catch (error) {
                console.error('❌ Lỗi xóa tin nhắn:', error);
                const embed = createEmbed('error', '❌ Lỗi dọn dẹp', 
                    'Không thể xóa tin nhắn! Có thể tin nhắn quá cũ (hơn 14 ngày).');
                await message.reply({ embeds: [embed] });
            }
        }

        // ==================== LỆNH SINH NHẬT ====================
        if (command === 'setbirthday') {
            if (!args[0]) {
                const embed = createEmbed('error', '❌ Thiếu thông tin', 
                    '**Sử dụng:** `setbirthday DD-MM`\n\n**Ví dụ:**\n`$setbirthday 15-10`\n`$setbirthday 03-12`');
                return message.reply({ embeds: [embed] });
            }

            const birthday = args[0];
            const birthdayRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])$/;

            if (!birthdayRegex.test(birthday)) {
                const embed = createEmbed('error', '❌ Định dạng không hợp lệ', 
                    'Định dạng ngày sinh không hợp lệ! Sử dụng **DD-MM** (ví dụ: 15-10)');
                return message.reply({ embeds: [embed] });
            }

            const birthdays = await loadData('birthdays.json');
            birthdays[message.author.id] = birthday;
            await saveData('birthdays.json', birthdays);

            const embed = createEmbed('success', '🎉 Đã đặt ngày sinh nhật!', 
                `Ngày sinh nhật của bạn đã được đặt thành: **${birthday}**\n\nBạn sẽ nhận được lời chúc mừng sinh nhật tự động vào ngày này! 🎂`)
                .setThumbnail('https://cdn.discordapp.com/emojis/1107540430879342694.webp');

            await message.reply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('❌ Lỗi xử lý lệnh:', error);
        const embed = createEmbed('error', '❌ Lỗi hệ thống', 
            'Có lỗi xảy ra khi thực hiện lệnh! Vui lòng thử lại sau.');
        await message.reply({ embeds: [embed] });
    }
});

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

client.on('error', console.error);
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

// ==================== KHỞI CHẠY BOT ====================

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('❌ Lỗi đăng nhập bot:', error);
    process.exit(1);
});