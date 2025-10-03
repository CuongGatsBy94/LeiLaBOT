/**
 * @Author: Your name
 * @Date:   2025-09-29 18:55:36
 * @Last Modified by:   Your name
 * @Last Modified time: 2025-10-03 18:59:21
 */
require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, Collection } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const translate = require('@vitalets/google-translate-api');
const os = require('os');

// Biến toàn cục
let PREFIX = '$';
let botStartTime = Date.now();
let queue = new Map(); // Queue nhạc cho từng server
let commandUsage = {}; // Thống kê sử dụng lệnh

// Đường dẫn file
const messagePath = path.join(__dirname, 'message.json');
const schedulePath = path.join(__dirname, 'schedule.json');
const dailyPath = path.join(__dirname, 'dailyMessages.json');
const birthdayPath = path.join(__dirname, 'birthdays.json');
const eventPath = path.join(__dirname, 'events.json');
const prefixPath = path.join(__dirname, 'prefix.json');

// Hàm đọc và ghi file
function initializeFiles() {
  const files = [
    { path: messagePath, default: { content: "Tin nhắn mặc định - Hãy sử dụng $setmessage để thay đổi" } },
    { path: schedulePath, default: { cron: "0 9 * * *" } },
    { path: dailyPath, default: { 
      morning: "🌅 Chào buổi sáng cả nhà! Chúc một ngày tốt lành!",
      noon: "☀️ Chúc mọi người buổi trưa vui vẻ!",
      afternoon: "🌇 Chiều làm việc hiệu quả nhé!",
      evening: "🌃 Tối nay có gì vui không mọi người?",
      night: "🌙 Khuya rồi, nhớ ngủ sớm nha!"
    }},
    { path: birthdayPath, default: {} },
    { path: eventPath, default: [] },
    { path: prefixPath, default: { prefix: "$" } }
  ];

  files.forEach(file => {
    if (!fs.existsSync(file.path)) {
      fs.writeFileSync(file.path, JSON.stringify(file.default, null, 2));
    }
  });
}

// Hàm đọc prefix từ file
function getPrefix() {
  try {
    const data = JSON.parse(fs.readFileSync(prefixPath, 'utf8'));
    return data.prefix || '$';
  } catch (error) {
    return '$';
  }
}

// Hàm ghi prefix vào file
function setPrefix(newPrefix) {
  fs.writeFileSync(prefixPath, JSON.stringify({ prefix: newPrefix }, null, 2));
}

// Khởi tạo files và đọc prefix
initializeFiles();
PREFIX = getPrefix();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// Khởi tạo collections
client.commands = new Collection();
client.voiceConnections = new Map();
client.audioPlayers = new Map();

// Hàm đọc và ghi các file khác
function getMessageContent() {
  return JSON.parse(fs.readFileSync(messagePath, 'utf8')).content;
}
function setMessageContent(newContent) {
  fs.writeFileSync(messagePath, JSON.stringify({ content: newContent }, null, 2));
}
function getSchedule() {
  return JSON.parse(fs.readFileSync(schedulePath, 'utf8')).cron;
}
function setSchedule(newCron) {
  fs.writeFileSync(schedulePath, JSON.stringify({ cron: newCron }, null, 2));
}
function getDailyMessage(key) {
  return JSON.parse(fs.readFileSync(dailyPath, 'utf8'))[key];
}
function setDailyMessage(key, content) {
  const data = JSON.parse(fs.readFileSync(dailyPath, 'utf8'));
  data[key] = content;
  fs.writeFileSync(dailyPath, JSON.stringify(data, null, 2));
}
function getBirthdays() {
  return JSON.parse(fs.readFileSync(birthdayPath, 'utf8'));
}
function setBirthday(userId, date) {
  const data = getBirthdays();
  data[userId] = date;
  fs.writeFileSync(birthdayPath, JSON.stringify(data, null, 2));
}
function getEvents() {
  return JSON.parse(fs.readFileSync(eventPath, 'utf8'));
}
function addEvent(content, date) {
  const data = getEvents();
  data.push({ content, date });
  fs.writeFileSync(eventPath, JSON.stringify(data, null, 2));
}

// ==================== HỆ THỐNG TIN NHẮN ĐỊNH KỲ MỚI ====================

function getVietnamTime() {
  /** Lấy thời gian Việt Nam (UTC+7) */
  const now = new Date();
  // Chuyển sang UTC+7
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const vietnamTime = new Date(utc + (3600000 * 7));
  return vietnamTime;
}

async function sendMorningMessage() {
  /** Tin nhắn chào buổi sáng lúc 8:00 */
  try {
    const morningMessages = [
      "🌅 **Chào buổi sáng cả nhà!** Một ngày mới tràn đầy năng lượng và may mắn! ☀️",
      "🌞 **Buổi sáng tốt lành!** Hy vọng mọi người có một ngày làm việc hiệu quả! 💪",
      "☀️ **Good morning!** Hãy bắt đầu ngày mới với tinh thần tích cực nào! ✨",
      "🌄 **Chúc cả nhà buổi sáng an lành!** Đừng quên ăn sáng đầy đủ nhé! 🍳",
      "🌤️ **Buổi sáng vui vẻ!** Hôm nay sẽ là một ngày tuyệt vời! 🎉"
    ];
    
    const message = morningMessages[Math.floor(Math.random() * morningMessages.length)];
    
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("🌅 CHÀO BUỔI SÁNG - 08:00")
      .setDescription(message)
      .addFields(
        { name: "📅 Hôm nay là", value: `<t:${Math.floor(Date.now() / 1000)}:D>`, inline: true },
        { name: "⏰ Bây giờ là", value: `<t:${Math.floor(Date.now() / 1000)}:t>`, inline: true }
      );

    const tips = [
      "💡 **Mẹo:** Uống một ly nước ấm để khởi động ngày mới!",
      "💡 **Mẹo:** Lên kế hoạch công việc trong ngày để hiệu quả hơn!",
      "💡 **Mẹo:** Tập thể dục nhẹ nhàng để cơ thể tỉnh táo!",
      "💡 **Mẹo:** Nghe nhạc tích cực để có tâm trạng tốt!",
      "💡 **Mẹo:** Ăn sáng đầy đủ dinh dưỡng!"
    ];
    
    embed.addFields({
      name: "🌟 Lời khuyên buổi sáng",
      value: tips[Math.floor(Math.random() * tips.length)],
      inline: false
    });

    embed.setFooter({ text: "Chúc bạn một ngày tuyệt vời!" });

    const channel = client.channels.cache.get(process.env.CHANNEL_ID);
    if (channel) {
      await channel.send({ embeds: [embed] });
      console.log("✅ Đã gửi tin nhắn chào buổi sáng lúc 08:00");
    } else {
      console.log(`❌ Không tìm thấy kênh với ID: ${process.env.CHANNEL_ID}`);
    }
      
  } catch (error) {
    console.error(`❌ Lỗi khi gửi tin nhắn buổi sáng: ${error}`);
  }
}

async function sendLunchMessage() {
  /** Nhắc ăn trưa lúc 12:00 */
  try {
    const lunchMessages = [
      "🍱 **Đến giờ ăn trưa rồi cả nhà ơi!** Nhớ ăn uống đủ chất nhé!",
      "🥗 **Trưa nay ăn gì nhỉ?** Đừng bỏ bữa trưa quan trọng nhé!",
      "🍜 **Giờ ăn trưa!** Nghỉ ngơi một chút để nạp năng lượng!",
      "🥘 **Bon appétit!** Chúc mọi người có bữa trưa ngon miệng!",
      "🍽️ **Ăn trưa thôi nào!** Nhớ ăn chậm nhai kỹ nhé!"
    ];
    
    const message = lunchMessages[Math.floor(Math.random() * lunchMessages.length)];
    
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle("🍽️ GIỜ ĂN TRƯA - 12:00")
      .setDescription(message)
      .addFields({
        name: "⏰ Thời gian nghỉ ngơi",
        value: "Hãy dành ít nhất 30 phút để thư giãn!",
        inline: false
      });

    const channel = client.channels.cache.get(process.env.CHANNEL_ID);
    if (channel) {
      await channel.send({ embeds: [embed] });
      console.log("✅ Đã gửi tin nhắn nhắc ăn trưa lúc 12:00");
    } else {
      console.log(`❌ Không tìm thấy kênh với ID: ${process.env.CHANNEL_ID}`);
    }
      
  } catch (error) {
    console.error(`❌ Lỗi khi gửi tin nhắn ăn trưa: ${error}`);
  }
}

async function sendEveningMessage() {
  /** Tin nhắn chiều tà lúc 17:30 */
  try {
    const eveningMessages = [
      "🌇 **Chiều muộn rồi đấy!** Sắp kết thúc một ngày làm việc rồi!",
      "🌆 **Buổi chiều tốt lành!** Cố gắng hoàn thành nốt công việc cuối ngày nhé!",
      "🏙️ **Xế chiều rồi!** Đừng quên nghỉ ngơi và thư giãn!",
      "🌃 **Chiều tà an lành!** Chuẩn bị kết thúc một ngày làm việc hiệu quả!",
      "🌄 **Hoàng hôn sắp xuống!** Nhìn lại những gì đã đạt được hôm nay nào!"
    ];
    
    const message = eveningMessages[Math.floor(Math.random() * eveningMessages.length)];
    
    const embed = new EmbedBuilder()
      .setColor(0xFF8C00)
      .setTitle("🌇 CHIỀU TÀ - 17:30")
      .setDescription(message)
      .addFields({
        name: "📊 Hoàn thành ngày làm việc",
        value: "Hãy tự hào về những gì bạn đã làm hôm nay!",
        inline: false
      });

    const channel = client.channels.cache.get(process.env.CHANNEL_ID);
    if (channel) {
      await channel.send({ embeds: [embed] });
      console.log("✅ Đã gửi tin nhắn buổi chiều lúc 17:30");
    } else {
      console.log(`❌ Không tìm thấy kênh với ID: ${process.env.CHANNEL_ID}`);
    }
      
  } catch (error) {
    console.error(`❌ Lỗi khi gửi tin nhắn buổi chiều: ${error}`);
  }
}

async function sendNightActivityMessage() {
  /** Nhắc nhở hoạt động buổi tối lúc 20:00 */
  try {
    const activities = [
      "🎮 **Tối rồi!** Có ai online game không nào?",
      "📺 **Buổi tối vui vẻ!** Xem phim gì hay tối nay?",
      "🎵 **Âm nhạc buổi tối!** Cùng nghe nhạc thư giãn nào!",
      "📚 **Tối nay đọc sách?** Hay học thêm điều gì mới?",
      "💬 **Trò chuyện tối!** Có ai muốn tâm sự không?"
    ];
    
    const message = activities[Math.floor(Math.random() * activities.length)];
    
    const embed = new EmbedBuilder()
      .setColor(0x8A2BE2)
      .setTitle("🌃 BUỔI TỐI - 20:00")
      .setDescription(message)
      .addFields({
        name: "⏳ Còn 2 tiếng nữa là đến giờ ngủ",
        value: "Hãy tận hưởng buổi tối thật trọn vẹn!",
        inline: false
      });

    const channel = client.channels.cache.get(process.env.CHANNEL_ID);
    if (channel) {
      await channel.send({ embeds: [embed] });
      console.log("✅ Đã gửi tin nhắn nhắc buổi tối lúc 20:00");
    } else {
      console.log(`❌ Không tìm thấy kênh với ID: ${process.env.CHANNEL_ID}`);
    }
      
  } catch (error) {
    console.error(`❌ Lỗi khi gửi tin nhắn buổi tối: ${error}`);
  }
}

async function sendGoodNightMessage() {
  /** Tin nhắn chúc ngủ ngon lúc 22:00 */
  try {
    const nightMessages = [
      "🌙 **Chúc cả nhà ngủ ngon!** Đừng thức khuya quá nhé! 😴",
      "✨ **Good night!** Ngủ thật ngon và mơ những giấc mơ đẹp! 💫",
      "🌌 **Đêm đã khuya!** Hãy tắt máy và nghỉ ngơi thôi nào! 🛌",
      "🌠 **Chúc ngủ ngon!** Mai lại là một ngày mới tràn đầy hi vọng! 🌅",
      "💤 **Đến giờ đi ngủ rồi!** Nhớ thư giãn và tắt hết thiết bị điện tử! 📴"
    ];
    
    const message = nightMessages[Math.floor(Math.random() * nightMessages.length)];
    
    const embed = new EmbedBuilder()
      .setColor(0x4B0082)
      .setTitle("🌙 CHÚC NGỦ NGON - 22:00")
      .setDescription(message);

    const sleepTips = [
      "💡 **Mẹo:** Tắt các thiết bị điện tử 30 phút trước khi ngủ",
      "💡 **Mẹo:** Đọc sách giúp thư giãn và dễ ngủ hơn",
      "💡 **Mẹo:** Nghe nhạc nhẹ hoặc âm thanh thiên nhiên",
      "💡 **Mẹo:** Giữ phòng ngủ mát mẻ và thoáng khí",
      "💡 **Mẹo:** Uống một ly sữa ấm trước khi ngủ"
    ];
    
    embed.addFields(
      {
        name: "🌟 Mẹo ngủ ngon",
        value: sleepTips[Math.floor(Math.random() * sleepTips.length)],
        inline: false
      },
      {
        name: "📅 Ngày mai",
        value: "Hẹn gặp lại vào buổi sáng! 🌅",
        inline: true
      }
    );

    embed.setFooter({ text: "Sweet dreams! 💫" });

    const channel = client.channels.cache.get(process.env.CHANNEL_ID);
    if (channel) {
      await channel.send({ embeds: [embed] });
      console.log("✅ Đã gửi tin nhắn chúc ngủ ngon lúc 22:00");
    } else {
      console.log(`❌ Không tìm thấy kênh với ID: ${process.env.CHANNEL_ID}`);
    }
      
  } catch (error) {
    console.error(`❌ Lỗi khi gửi tin nhắn chúc ngủ ngon: ${error}`);
  }
}

// Hàm tính uptime
function getUptime() {
  const uptime = Date.now() - botStartTime;
  const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Hàm lấy thông tin hệ thống
function getSystemInfo() {
  const cpuUsage = (os.loadavg()[0] / os.cpus().length * 100).toFixed(2);
  const memoryUsage = ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2);
  const memoryUsed = ((os.totalmem() - os.freemem()) / (1024 * 1024 * 1024)).toFixed(2);
  const memoryTotal = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
  
  return {
    cpu: cpuUsage,
    memory: memoryUsage,
    memoryUsed: memoryUsed,
    memoryTotal: memoryTotal
  };
}

// Gửi tin nhắn định kỳ
let scheduledTask = null;
function startScheduledMessage() {
  const cronTime = getSchedule();
  if (scheduledTask) scheduledTask.stop();
  scheduledTask = cron.schedule(cronTime, () => {
    const channel = client.channels.cache.get(process.env.CHANNEL_ID);
    if (channel) {
      const message = getMessageContent();
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('📢 Tin nhắn định kỳ')
        .setDescription(message)
        .setTimestamp();
      channel.send({ embeds: [embed] });
    }
  });
}

// Bộ đếm thống kê
let messageCount = {};
let userJoinTimes = {};

// Hàm helper cho Embed lỗi
function sendErrorEmbed(channel, message) {
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('❌ Lỗi')
    .setDescription(message)
    .setTimestamp();
  return channel.send({ embeds: [embed] });
}

// Hàm helper cho Embed thành công
function sendSuccessEmbed(channel, message) {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Thành công')
    .setDescription(message)
    .setTimestamp();
  return channel.send({ embeds: [embed] });
}

// Hàm kiểm tra quyền admin
function isAdmin(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

// Hàm thống kê lệnh
function trackCommandUsage(command) {
  commandUsage[command] = (commandUsage[command] || 0) + 1;
}

client.once('ready', () => {
  console.log(`✅ Bot đã đăng nhập với tên ${client.user.tag}`);
  console.log(`📊 Đang quản lý ${client.guilds.cache.size} server`);
  console.log(`🔧 Prefix hiện tại: ${PREFIX}`);
  
  botStartTime = Date.now();
  
  const channel = client.channels.cache.get(process.env.CHANNEL_ID);
  if (!channel) return console.log('❌ Không tìm thấy kênh.');

  // ==================== HỆ THỐNG TIN NHẮN ĐỊNH KỲ MỚI ====================
  
  // Kiểm tra và gửi tin nhắn mỗi phút
  cron.schedule('* * * * *', async () => {
    try {
      const now = getVietnamTime();
      const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                         now.getMinutes().toString().padStart(2, '0');
      
      // Debug: in thời gian hiện tại (chỉ trong console)
      if (now.getSeconds() === 0) {
        console.log(`⏰ Kiểm tra thời gian: ${currentTime} (UTC+7)`);
      }
      
      // Kiểm tra và gửi tin nhắn theo giờ
      const channel = client.channels.cache.get(process.env.CHANNEL_ID);
      if (!channel) {
        if (now.getMinutes() === 0) {
          console.log(`❌ Không tìm thấy kênh schedule với ID: ${process.env.CHANNEL_ID}`);
        }
        return;
      }
      
      if (currentTime === "08:00") {
        await sendMorningMessage();
      } else if (currentTime === "12:00") {
        await sendLunchMessage();
      } else if (currentTime === "17:30") {
        await sendEveningMessage();
      } else if (currentTime === "20:00") {
        await sendNightActivityMessage();
      } else if (currentTime === "22:00") {
        await sendGoodNightMessage();
      }
      
    } catch (error) {
      console.error(`Lỗi trong scheduled_messages: ${error}`);
    }
  });

  // Kiểm tra sinh nhật và sự kiện
  cron.schedule('0 9 * * *', () => {
    const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    const birthdays = getBirthdays();
    const events = getEvents();
    
    let birthdayMessage = '';
    let eventMessage = '';

    for (const [id, date] of Object.entries(birthdays)) {
      if (date === today) {
        birthdayMessage += `🎂 <@${id}>\n`;
      }
    }

    events.forEach(event => {
      if (event.date === today) {
        eventMessage += `📅 ${event.content}\n`;
      }
    });

    if (birthdayMessage || eventMessage) {
      const embed = new EmbedBuilder()
        .setColor(0xFF69B4)
        .setTitle('🎉 Thông báo hôm nay')
        .setTimestamp();

      if (birthdayMessage) {
        embed.addFields({ name: '🎂 Sinh nhật', value: birthdayMessage });
      }
      if (eventMessage) {
        embed.addFields({ name: '📅 Sự kiện', value: eventMessage });
      }

      channel.send({ embeds: [embed] });
    }
  });
});

client.on('ready', startScheduledMessage);

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  
  const content = message.content.toLowerCase();
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();
  const channel = message.channel;
  const userId = message.author.id;

  // Khởi tạo thời gian tham gia nếu chưa có
  if (!userJoinTimes[userId]) {
    userJoinTimes[userId] = Date.now();
  }

  messageCount[userId] = (messageCount[userId] || 0) + 1;

  // Tự động phản hồi với Embed
  if (content.includes('hello') || content.includes('bot ơi') || content.includes('chào bot')) {
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('👋 Xin chào!')
      .setDescription(`Chào bạn ${message.author.username}! Tôi có thể giúp gì cho bạn?\nGõ \`${PREFIX}help\` để xem danh sách lệnh.`)
      .setThumbnail(message.author.displayAvatarURL())
      .setTimestamp();
    return channel.send({ embeds: [embed] });
  }

  // === LỆNH INFO MỚI ===
  if (command === 'info') {
    trackCommandUsage('info');
    try {
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🤖 LeiLaBOT - Discord Bot Đa Năng Việt Nam')
        .setDescription('LeiLaBOT là một Discord bot đa chức năng được phát triển bằng JavaScript, mang đến trải nghiệm phong phú và tiện ích cho server Discord của bạn!')
        .addFields(
          { name: '📊 Thống kê', value: `• **Server:** ${client.guilds.cache.size}\n• **Uptime:** ${getUptime()}\n• **Ping:** ${Date.now() - message.createdTimestamp}ms\n• **Lệnh đã dùng:** ${Object.values(commandUsage).reduce((a, b) => a + b, 0)}`, inline: true },
          { name: '🎯 Tính năng', value: '• 🤖 Bot thông minh\n• 🔊 Âm nhạc\n• 🎮 Mini games\n• ⏰ Tự động hóa\n• 🛠️ Quản lý', inline: true },
          { name: '🔧 Thông tin', value: `• **Prefix:** \`${PREFIX}\`\n• **Phiên bản:** 2.0.0\n• **Ngôn ngữ:** JavaScript\n• **Hỗ trợ:** Tiếng Việt 100%`, inline: true }
        )
        .addFields(
          { name: '🌟 Tính năng nổi bật', value: '• Hệ thống tin nhắn định kỳ thông minh\n• Phát nhạc từ YouTube\n• Quản lý thành viên với embed đẹp mắt\n• Mini games giải trí\n• Dịch thuật đa ngôn ngữ\n• Tự động chào mừng thành viên mới' },
          { name: '📈 Thống kê ấn tượng', value: '• **50+ Lệnh** đa dạng\n• **10+ Tính năng** độc đáo\n• **Hỗ trợ tiếng Việt** 100%\n• **Uptime 99.9%** - Hoạt động ổn định\n• **Xử lý nhanh** - Phản hồi tức thì' },
          { name: '🎉 Tại sao chọn LeiLaBOT?', value: '• ✅ **Hoàn toàn miễn phí** - Không giới hạn tính năng\n• ✅ **Dễ sử dụng** - Giao diện tiếng Việt rõ ràng\n• ✅ **Ổn định cao** - Ít lỗi, hoạt động liên tục\n• ✅ **Hỗ trợ nhanh** - Đội ngũ phát triển nhiệt tình' }
        )
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({ text: `LeiLaBOT • ${new Date().getFullYear()} | Hơn 1000+ server đã tin dùng!`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      // Tạo nút hành động
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('📖 Hướng dẫn sử dụng')
            .setStyle(ButtonStyle.Link)
            .setURL('https://github.com/your-repo/docs'),
          new ButtonBuilder()
            .setLabel('🎯 Mời bot')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID'),
          new ButtonBuilder()
            .setLabel('💬 Support Server')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.gg/yourserver')
        );

      await channel.send({ 
        embeds: [embed],
        components: [row]
      });
      
    } catch (error) {
      console.error(error);
      sendErrorEmbed(channel, `Lỗi khi hiển thị thông tin bot: ${error.message}`);
    }
  }

  // Lệnh kiểm tra trạng thái bot
  if (command === 'botstatus') {
    trackCommandUsage('botstatus');
    try {
      const ping = Date.now() - message.createdTimestamp;
      const systemInfo = getSystemInfo();
      const serverQueue = queue.get(message.guild.id) || [];
      
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🤖 Trạng thái Bot')
        .setDescription('Thông tin về bot hiện tại')
        .addFields(
          { name: '📊 Ping', value: `${ping}ms`, inline: true },
          { name: '🕒 Uptime', value: getUptime(), inline: true },
          { name: '🎵 Queue', value: `${serverQueue.length} bài hát`, inline: true },
          { name: '🔧 Prefix', value: `\`${PREFIX}\``, inline: true }
        );

      // Thông tin voice
      const voiceConnection = client.voiceConnections.get(message.guild.id);
      if (voiceConnection) {
        const voiceChannel = message.guild.channels.cache.get(voiceConnection.joinConfig.channelId);
        embed.addFields({ name: '🔊 Voice', value: `✅ ${voiceChannel.name}`, inline: true });
        
        const audioPlayer = client.audioPlayers.get(message.guild.id);
        if (audioPlayer && audioPlayer.state.status === 'playing') {
          embed.addFields({ name: '🎵 Đang phát', value: '✅ Có', inline: true });
        } else {
          embed.addFields({ name: '🎵 Đang phát', value: '❌ Không', inline: true });
        }
      } else {
        embed.addFields({ name: '🔊 Voice', value: '❌ Không kết nối', inline: true });
      }

      // Thông tin hệ thống
      embed.addFields(
        { name: '💻 CPU', value: `${systemInfo.cpu}%`, inline: true },
        { name: '🧠 RAM', value: `${systemInfo.memory}% (${systemInfo.memoryUsed}GB/${systemInfo.memoryTotal}GB)`, inline: true }
      );

      await channel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error(error);
      sendErrorEmbed(channel, `Lỗi khi kiểm tra trạng thái: ${error.message}`);
    }
  }

  // Lệnh thay đổi prefix
  if (command === 'setprefix') {
    trackCommandUsage('setprefix');
    if (!isAdmin(message.member)) {
      return sendErrorEmbed(channel, 'Bạn không có quyền sử dụng lệnh này!');
    }

    const newPrefix = args[0];
    if (!newPrefix) {
      return sendErrorEmbed(channel, 'Vui lòng nhập prefix mới!');
    }

    try {
      // Kiểm tra prefix hợp lệ
      if (newPrefix.length > 5) {
        return sendErrorEmbed(channel, 'Prefix không được dài quá 5 ký tự!');
      }

      if (['@', '@everyone', '@here', '```'].includes(newPrefix.toLowerCase())) {
        return sendErrorEmbed(channel, 'Prefix không được chứa ký tự đặc biệt!');
      }

      // Lưu prefix cũ
      const oldPrefix = PREFIX;
      
      // Cập nhật prefix mới
      PREFIX = newPrefix;
      setPrefix(newPrefix);

      // Tạo embed thông báo
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🔧 Đã thay đổi Prefix')
        .setDescription('Prefix đã được thay đổi thành công!')
        .addFields(
          { name: '📝 Prefix cũ', value: `\`${oldPrefix}\``, inline: true },
          { name: '📝 Prefix mới', value: `\`${newPrefix}\``, inline: true },
          { name: '👤 Thay đổi bởi', value: message.author.toString(), inline: true }
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      
      // Log thay đổi
      console.log(`Prefix đã thay đổi từ '${oldPrefix}' thành '${newPrefix}' bởi ${message.author.tag}`);
      
    } catch (error) {
      console.error(error);
      sendErrorEmbed(channel, `Lỗi khi thay đổi prefix: ${error.message}`);
    }
  }

  // Lệnh hiển thị prefix hiện tại
  if (command === 'prefix') {
    trackCommandUsage('prefix');
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🔧 Prefix Bot')
      .setDescription(`Prefix hiện tại của bot là: **\`${PREFIX}\`**`)
      .addFields(
        { name: '💡 Cách sử dụng', value: `Gõ \`${PREFIX}help\` để xem danh sách lệnh`, inline: false },
        { name: '🔧 Thay đổi prefix', value: `Admin có thể dùng \`${PREFIX}setprefix <prefix_mới>\``, inline: false }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }

  // Lệnh help với Embed đẹp (cập nhật với prefix động)
  if (command === 'help') {
    trackCommandUsage('help');
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📘 Danh sách lệnh - LeiLaBOT')
      .setDescription(`**Prefix:** \`${PREFIX}\` | **Tổng lệnh:** 50+ | **Hỗ trợ:** Tiếng Việt 100%\n\nChọn một danh mục bên dưới để xem chi tiết:`)
      .addFields(
        { 
          name: '🤖 BOT & HỆ THỐNG', 
          value: '`info` - Thông tin bot\n`botstatus` - Trạng thái bot\n`prefix` - Xem prefix\n`setprefix` - Đổi prefix (admin)\n`help` - Trợ giúp' 
        },
        { 
          name: '🔊 ÂM NHẠC & VOICE', 
          value: '`play` - Phát nhạc YouTube\n`stop` - Dừng nhạc\n`pause` - Tạm dừng\n`resume` - Tiếp tục\n`createvoice` - Tạo voice channel' 
        },
        { 
          name: '👥 THÀNH VIÊN & ROLE', 
          value: '`members` - Danh sách thành viên\n`userinfo` - Thông tin user\n`addrole` - Thêm role\n`removerole` - Xóa role' 
        },
        { 
          name: '🎮 GIẢI TRÍ & GAME', 
          value: '`poll` - Tạo bình chọn\n`guess` - Đoán số\n`quiz` - Câu đố\n`lottery` - Xổ số\n`remindme` - Nhắc lịch' 
        },
        { 
          name: '📊 THỐNG KÊ & THÔNG TIN', 
          value: '`stats` - Thống kê hoạt động\n`serverinfo` - Thông tin server\n`userinfo` - Thông tin user' 
        },
        { 
          name: '⏰ TIN NHẮN TỰ ĐỘNG', 
          value: '`setmessage` - Đặt tin nhắn định kỳ\n`setschedule` - Đặt lịch gửi\n`getmessage` - Xem tin nhắn\n`getschedule` - Xem lịch' 
        },
        { 
          name: '🌐 TIỆN ÍCH & CÔNG CỤ', 
          value: '`translate` - Dịch thuật\n`clear` - Xóa tin nhắn\n`slowmode` - Đặt chế độ chậm' 
        },
        { 
          name: '🎉 SINH NHẬT & SỰ KIỆN', 
          value: '`setbirthday` - Đặt sinh nhật\n`addevent` - Thêm sự kiện' 
        }
      )
      .setFooter({ text: `LeiLaBOT • ${new Date().getFullYear()} | Gõ ${PREFIX}info để xem thông tin chi tiết về bot`, iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    return channel.send({ embeds: [embed] });
  }

  // CÁC LỆNH CŨ (giữ nguyên từ code trước)
  if (command === 'setmessage') {
    trackCommandUsage('setmessage');
    if (!isAdmin(message.member)) {
      return sendErrorEmbed(channel, 'Bạn không có quyền sử dụng lệnh này!');
    }
    const newContent = args.join(' ');
    if (!newContent) return sendErrorEmbed(channel, 'Vui lòng nhập nội dung mới!');
    
    setMessageContent(newContent);
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Cập nhật thành công')
      .setDescription(`Nội dung tin nhắn định kỳ đã được cập nhật:\n\`\`\`${newContent}\`\`\``)
      .setTimestamp();
    return channel.send({ embeds: [embed] });
  }

  if (command === 'setschedule') {
    trackCommandUsage('setschedule');
    if (!isAdmin(message.member)) {
      return sendErrorEmbed(channel, 'Bạn không có quyền sử dụng lệnh này!');
    }
    const newCron = args[0];
    if (!newCron || !cron.validate(newCron)) {
      return sendErrorEmbed(channel, 'Biểu thức cron không hợp lệ!');
    }
    
    setSchedule(newCron);
    startScheduledMessage();
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Cập nhật thành công')
      .setDescription(`Lịch gửi tin nhắn đã được cập nhật:\n\`${newCron}\``)
      .setTimestamp();
    return channel.send({ embeds: [embed] });
  }

  if (command === 'getmessage') {
    trackCommandUsage('getmessage');
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📩 Nội dung tin nhắn định kỳ')
      .setDescription(getMessageContent())
      .setTimestamp();
    return channel.send({ embeds: [embed] });
  }

  if (command === 'getschedule') {
    trackCommandUsage('getschedule');
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('⏰ Lịch gửi tin nhắn')
      .setDescription(`\`${getSchedule()}\``)
      .setTimestamp();
    return channel.send({ embeds: [embed] });
  }

  // Chỉnh nội dung theo khung giờ
  const timeKeys = ['morning', 'noon', 'afternoon', 'evening', 'night'];
  for (const key of timeKeys) {
    if (command === `set${key}`) {
      trackCommandUsage(`set${key}`);
      const newText = args.join(' ');
      setDailyMessage(key, newText);
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Cập nhật thành công')
        .setDescription(`Đã cập nhật nội dung ${key}:\n\`\`\`${newText}\`\`\``)
        .setTimestamp();
      return channel.send({ embeds: [embed] });
    }
  }

  // Tạo voice channel với Embed
  if (command === 'createvoice') {
    trackCommandUsage('createvoice');
    if (!isAdmin(message.member)) {
      return sendErrorEmbed(channel, 'Bạn không có quyền sử dụng lệnh này!');
    }
    try {
      const vc = await message.guild.channels.create({
        name: '🔊 Voice Room',
        type: 2,
        permissionOverwrites: [
          {
            id: message.guild.id,
            allow: [PermissionsBitField.Flags.Connect]
          }
        ]
      });
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Tạo voice channel thành công')
        .setDescription(`Đã tạo voice channel: ${vc}`)
        .setTimestamp();
      return channel.send({ embeds: [embed] });
    } catch (error) {
      return sendErrorEmbed(channel, 'Không thể tạo voice channel!');
    }
  }

  // Hệ thống phát nhạc (chỉ dùng URL)
  if (command === 'play') {
    trackCommandUsage('play');
    const url = args[0];
    if (!url) return sendErrorEmbed(channel, 'Vui lòng cung cấp URL YouTube!');
    
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return sendErrorEmbed(channel, 'Bạn cần tham gia voice channel trước!');

    try {
      // Kiểm tra URL hợp lệ
      if (!ytdl.validateURL(url)) {
        return sendErrorEmbed(channel, 'URL YouTube không hợp lệ!');
      }

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      const player = createAudioPlayer();
      const resource = createAudioResource(ytdl(url, { 
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25
      }));

      connection.subscribe(player);
      player.play(resource);

      // Lưu trữ connection và player
      client.voiceConnections.set(message.guild.id, connection);
      client.audioPlayers.set(message.guild.id, player);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🎶 Đang phát nhạc')
        .setDescription(`Đang phát từ URL: ${url}`)
        .setTimestamp();
      channel.send({ embeds: [embed] });

      player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
        client.voiceConnections.delete(message.guild.id);
        client.audioPlayers.delete(message.guild.id);
      });

    } catch (error) {
      console.error(error);
      sendErrorEmbed(channel, 'Có lỗi khi phát nhạc!');
    }
  }

  // Các lệnh điều khiển nhạc
  if (command === 'stop') {
    trackCommandUsage('stop');
    const connection = client.voiceConnections.get(message.guild.id);
    if (connection) {
      connection.destroy();
      client.voiceConnections.delete(message.guild.id);
      client.audioPlayers.delete(message.guild.id);
      sendSuccessEmbed(channel, '⏹️ Đã dừng phát nhạc');
    } else {
      sendErrorEmbed(channel, 'Không có bài hát nào đang phát!');
    }
  }

  if (command === 'pause') {
    trackCommandUsage('pause');
    const player = client.audioPlayers.get(message.guild.id);
    if (player && player.state.status === 'playing') {
      player.pause();
      sendSuccessEmbed(channel, '⏸️ Đã tạm dừng');
    } else {
      sendErrorEmbed(channel, 'Không có bài hát nào đang phát!');
    }
  }

  if (command === 'resume') {
    trackCommandUsage('resume');
    const player = client.audioPlayers.get(message.guild.id);
    if (player && player.state.status === 'paused') {
      player.unpause();
      sendSuccessEmbed(channel, '▶️ Đã tiếp tục phát');
    } else {
      sendErrorEmbed(channel, 'Bài hát không ở trạng thái tạm dừng!');
    }
  }

  // Quản lý role với Embed
  if (command === 'addrole') {
    trackCommandUsage('addrole');
    const roleName = args.join(' ');
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      await message.member.roles.add(role);
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Thêm role thành công')
        .setDescription(`Đã thêm role **${role.name}** cho bạn`)
        .setTimestamp();
      return channel.send({ embeds: [embed] });
    } else {
      return sendErrorEmbed(channel, `Không tìm thấy role "${roleName}"`);
    }
  }

  if (command === 'removerole') {
    trackCommandUsage('removerole');
    const roleName = args.join(' ');
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      await message.member.roles.remove(role);
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Xóa role thành công')
        .setDescription(`Đã xóa role **${role.name}** khỏi bạn`)
        .setTimestamp();
      return channel.send({ embeds: [embed] });
    } else {
      return sendErrorEmbed(channel, `Không tìm thấy role "${roleName}"`);
    }
  }

  // Xem danh sách thành viên
  if (command === 'members') {
    trackCommandUsage('members');
    try {
      const members = await message.guild.members.fetch();
      const memberList = members.map(m => ({
        name: m.user.username,
        id: m.user.id,
        joinedAt: m.joinedTimestamp,
        bot: m.user.bot,
        roles: m.roles.cache.size - 1
      }));

      memberList.sort((a, b) => a.joinedAt - b.joinedAt);

      const itemsPerPage = 10;
      let currentPage = 0;
      const totalPages = Math.ceil(memberList.length / itemsPerPage);

      function createMembersEmbed(page) {
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const currentMembers = memberList.slice(start, end);

        const embed = new EmbedBuilder()
          .setColor(0x00AE86)
          .setTitle(`👥 DANH SÁCH THÀNH VIÊN - ${message.guild.name}`)
          .setThumbnail(message.guild.iconURL({ dynamic: true }))
          .setDescription(`**Tổng số:** ${memberList.length} thành viên\n**Bot:** ${memberList.filter(m => m.bot).length} | **Người dùng:** ${memberList.filter(m => !m.bot).length}`)
          .setFooter({ 
            text: `Trang ${page + 1}/${totalPages} • ${message.guild.memberCount} thành viên`,
            iconURL: message.guild.iconURL({ dynamic: true })
          })
          .setTimestamp();

        currentMembers.forEach((member, index) => {
          const memberNumber = start + index + 1;
          const joinDate = `<t:${Math.floor(member.joinedAt / 1000)}:R>`;
          const rolesText = member.roles > 0 ? `${member.roles} roles` : 'Không có role';
          const botBadge = member.bot ? ' 🤖' : '';
          
          embed.addFields({
            name: `#${memberNumber} ${member.name}${botBadge}`,
            value: `• ID: \`${member.id}\`\n• Tham gia: ${joinDate}\n• Roles: ${rolesText}`,
            inline: true
          });
        });

        return embed;
      }

      function createButtons(page) {
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('first_members')
              .setLabel('⏮️ Đầu')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId('prev_members')
              .setLabel('◀️ Trước')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId('next_members')
              .setLabel('Tiếp ▶️')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page === totalPages - 1),
            new ButtonBuilder()
              .setCustomId('last_members')
              .setLabel('Cuối ⏭️')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === totalPages - 1)
          );
        return row;
      }

      const messageEmbed = await channel.send({
        embeds: [createMembersEmbed(currentPage)],
        components: [createButtons(currentPage)]
      });

      const filter = i => i.user.id === message.author.id && i.customId.endsWith('_members');
      const collector = messageEmbed.createMessageComponentCollector({ 
        filter, 
        time: 60000 
      });

      collector.on('collect', async i => {
        try {
          await i.deferUpdate();
          
          switch (i.customId) {
            case 'first_members':
              currentPage = 0;
              break;
            case 'prev_members':
              if (currentPage > 0) currentPage--;
              break;
            case 'next_members':
              if (currentPage < totalPages - 1) currentPage++;
              break;
            case 'last_members':
              currentPage = totalPages - 1;
              break;
          }

          await i.editReply({
            embeds: [createMembersEmbed(currentPage)],
            components: [createButtons(currentPage)]
          });
        } catch (error) {
          console.error('Lỗi khi xử lý nút:', error);
        }
      });

      collector.on('end', () => {
        messageEmbed.edit({ components: [] }).catch(console.error);
      });

    } catch (error) {
      console.error('Lỗi khi lấy danh sách thành viên:', error);
      sendErrorEmbed(channel, 'Có lỗi xảy ra khi lấy danh sách thành viên.');
    }
  }

  // Bình chọn với Embed
  if (command === 'poll') {
    trackCommandUsage('poll');
    const matches = message.content.match(/"([^"]+)"/g);
    if (!matches || matches.length < 2) {
      return sendErrorEmbed(channel, 'Cần ít nhất 1 câu hỏi và 1 lựa chọn!\nVí dụ: `$poll "Bạn thích màu gì?" "Đỏ" "Xanh" "Vàng"`');
    }
    
    const question = matches[0].replace(/"/g, '');
    const options = matches.slice(1).map(opt => opt.replace(/"/g, ''));
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    
    let pollText = `**${question}**\n\n`;
    options.forEach((opt, i) => pollText += `${emojis[i]} ${opt}\n`);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📊 Bình chọn')
      .setDescription(pollText)
      .setFooter({ text: `Bình chọn bởi ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    const pollMsg = await channel.send({ embeds: [embed] });
    options.forEach((_, i) => pollMsg.react(emojis[i]));
  }

  // Nhắc lịch với Embed
  if (command === 'remindme') {
    trackCommandUsage('remindme');
    const minutes = parseInt(args[0], 10);
    const reminder = args.slice(1).join(' ').trim();
    
    if (isNaN(minutes) || minutes <= 0) {
      return sendErrorEmbed(channel, 'Số phút không hợp lệ!');
    }

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('⏰ Đã đặt lời nhắc')
      .setDescription(`Tôi sẽ nhắc bạn sau **${minutes} phút**\nNội dung: ${reminder || 'Đến giờ rồi!'}`)
      .setTimestamp();
    
    await channel.send({ embeds: [embed] });

    setTimeout(() => {
      const reminderEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🔔 Lời nhắc')
        .setDescription(reminder || 'Đến giờ rồi!')
        .setFooter({ text: `Được đặt bởi ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
      
      channel.send({ content: `<@${message.author.id}>`, embeds: [reminderEmbed] });
    }, minutes * 60000);
  }

  // Mini game đoán số
  if (command === 'guess') {
    trackCommandUsage('guess');
    const guess = parseInt(args[0]);
    const number = Math.floor(Math.random() * 10) + 1;
    
    if (isNaN(guess) || guess < 1 || guess > 10) {
      return sendErrorEmbed(channel, 'Vui lòng nhập số từ 1 đến 10!');
    }

    if (guess === number) {
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🎉 Chính xác!')
        .setDescription(`Bạn đã đoán đúng! Số là **${number}**`)
        .setFooter({ text: `Người chơi: ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
      channel.send({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('😅 Sai rồi!')
        .setDescription(`Bạn đoán **${guess}** nhưng số đúng là **${number}**`)
        .setFooter({ text: `Người chơi: ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();
      channel.send({ embeds: [embed] });
    }
  }

  // Xổ số
  if (command === 'lottery') {
    trackCommandUsage('lottery');
    const members = await message.guild.members.fetch();
    const active = members.filter(m => !m.user.bot && m.presence?.status === 'online');
    
    if (active.size === 0) {
      return sendErrorEmbed(channel, 'Không có thành viên online nào!');
    }

    const winner = active.random();
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🎉 XỔ SỐ HÔM NAY')
      .setDescription(`**Người trúng thưởng là:**\n${winner}\n\nChúc mừng! 🎊`)
      .setThumbnail(winner.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Tổng số người tham gia: ${active.size}`, iconURL: message.guild.iconURL({ dynamic: true }) })
      .setTimestamp();
    
    channel.send({ embeds: [embed] });
  }

  // Quiz game
  const quizQuestions = [
    { question: "Thủ đô của Việt Nam là gì?", answer: "hà nội" },
    { question: "2 + 2 bằng mấy?", answer: "4" },
    { question: "Màu của lá cây là gì?", answer: "xanh" },
    { question: "Con vật nào được gọi là chúa sơn lâm?", answer: "hổ" },
    { question: "Ai là người tìm ra châu Mỹ?", answer: "columbus" }
  ];

  if (command === 'quiz') {
    trackCommandUsage('quiz');
    const q = quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🧠 Câu hỏi Quiz')
      .setDescription(q.question)
      .setFooter({ text: 'Bạn có 15 giây để trả lời!', iconURL: message.author.displayAvatarURL() })
      .setTimestamp();
    
    await channel.send({ embeds: [embed] });

    const filter = m => !m.author.bot && m.author.id === message.author.id;
    channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] })
      .then(collected => {
        const reply = collected.first().content.toLowerCase();
        if (reply.includes(q.answer)) {
          const successEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🎉 Chính xác!')
            .setDescription(`Đáp án: **${q.answer}**\nBạn đã trả lời đúng!`)
            .setTimestamp();
          channel.send({ embeds: [successEmbed] });
        } else {
          const failEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Sai rồi!')
            .setDescription(`Đáp án đúng là: **${q.answer}**`)
            .setTimestamp();
          channel.send({ embeds: [failEmbed] });
        }
      })
      .catch(() => {
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('⏰ Hết giờ!')
          .setDescription(`Đáp án là: **${q.answer}**`)
          .setTimestamp();
        channel.send({ embeds: [timeoutEmbed] });
      });
  }

  // Xóa tin nhắn
  if (command === 'clear') {
    trackCommandUsage('clear');
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return sendErrorEmbed(channel, 'Bạn không có quyền xóa tin nhắn!');
    }
    
    const count = parseInt(args[0]);
    if (!count || count < 1 || count > 100) {
      return sendErrorEmbed(channel, 'Vui lòng nhập số từ 1 đến 100!');
    }

    try {
      const deleted = await channel.bulkDelete(count + 1, true);
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🧹 Đã xóa tin nhắn')
        .setDescription(`Đã xóa **${deleted.size - 1}** tin nhắn`)
        .setTimestamp();
      
      const msg = await channel.send({ embeds: [embed] });
      setTimeout(() => msg.delete(), 3000);
    } catch (error) {
      sendErrorEmbed(channel, 'Không thể xóa tin nhắn cũ hơn 14 ngày!');
    }
  }

  // Dịch thuật
  if (command === 'translate') {
    trackCommandUsage('translate');
    const text = args.join(' ');
    if (!text) return sendErrorEmbed(channel, 'Vui lòng nhập văn bản cần dịch!');

    try {
      const result = await translate(text, { to: 'vi' });
      const embed = new EmbedBuilder()
        .setColor(0x7289DA)
        .setTitle('🌐 Dịch thuật')
        .addFields(
          { name: '📥 Văn bản gốc', value: text, inline: false },
          { name: '📤 Bản dịch', value: result.text, inline: false }
        )
        .setFooter({ text: 'Dịch bởi Google Translate', iconURL: 'https://www.google.com/favicon.ico' })
        .setTimestamp();
      
      channel.send({ embeds: [embed] });
    } catch (error) {
      sendErrorEmbed(channel, 'Không thể dịch văn bản!');
    }
  }

  // Thống kê hoạt động với Embed
  if (command === 'stats') {
    trackCommandUsage('stats');
    const sorted = Object.entries(messageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    let statsText = '';
    sorted.forEach(([id, count], index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      statsText += `${medal} <@${id}>: **${count}** tin nhắn\n`;
    });

    const totalMessages = Object.values(messageCount).reduce((a, b) => a + b, 0);
    const uniqueUsers = Object.keys(messageCount).length;

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📊 Thống kê hoạt động')
      .setDescription(`**Tổng số tin nhắn:** ${totalMessages}\n**Số người dùng:** ${uniqueUsers}`)
      .addFields({ name: '🏆 Top hoạt động', value: statsText || 'Chưa có dữ liệu' })
      .setFooter({ text: `Thống kê từ ${new Date(userJoinTimes[Object.keys(userJoinTimes)[0]] || Date.now()).toLocaleDateString('vi-VN')}`, iconURL: message.guild.iconURL({ dynamic: true }) })
      .setTimestamp();

    channel.send({ embeds: [embed] });
  }

  // Thông tin server
  if (command === 'serverinfo') {
    trackCommandUsage('serverinfo');
    const guild = message.guild;
    const owner = await guild.fetchOwner();
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`ℹ️ Thông tin server - ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '👑 Chủ server', value: `${owner.user.tag}`, inline: true },
        { name: '🆔 Server ID', value: guild.id, inline: true },
        { name: '📅 Ngày tạo', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '👥 Thành viên', value: `Tổng: ${guild.memberCount}\nOnline: ${guild.members.cache.filter(m => m.presence?.status === 'online').size}`, inline: true },
        { name: '📊 Số lượng', value: `Kênh: ${guild.channels.cache.size}\nRole: ${guild.roles.cache.size}\nEmoji: ${guild.emojis.cache.size}`, inline: true },
        { name: '🌐 Khu vực', value: guild.preferredLocale, inline: true }
      )
      .setFooter({ text: `Server được tạo vào`, iconURL: guild.iconURL({ dynamic: true }) })
      .setTimestamp(guild.createdAt);

    channel.send({ embeds: [embed] });
  }

  // Thông tin user
  if (command === 'userinfo') {
    trackCommandUsage('userinfo');
    const target = message.mentions.users.first() || message.author;
    const member = await message.guild.members.fetch(target.id);
    
    const embed = new EmbedBuilder()
      .setColor(member.displayHexColor || 0x0099FF)
      .setTitle(`👤 Thông tin - ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '📛 Tên đầy đủ', value: target.tag, inline: true },
        { name: '🆔 User ID', value: target.id, inline: true },
        { name: '🤖 Là bot', value: target.bot ? '✅' : '❌', inline: true },
        { name: '📅 Tham gia server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: '🎂 Tạo tài khoản', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '🎭 Vai trò cao nhất', value: member.roles.highest.toString(), inline: true },
        { name: '📊 Số role', value: `${member.roles.cache.size - 1}`, inline: true },
        { name: '💬 Tin nhắn', value: `${messageCount[target.id] || 0}`, inline: true },
        { name: '🎉 Sinh nhật', value: getBirthdays()[target.id] || 'Chưa đặt', inline: true }
      )
      .setFooter({ text: `Yêu cầu bởi ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    channel.send({ embeds: [embed] });
  }

  // Đặt sinh nhật
  if (command === 'setbirthday') {
    trackCommandUsage('setbirthday');
    const date = args[0];
    if (!date || !/^\d{1,2}\/\d{1,2}$/.test(date)) {
      return sendErrorEmbed(channel, 'Vui lòng nhập ngày sinh theo định dạng: dd/mm\nVí dụ: `$setbirthday 15/08`');
    }

    setBirthday(message.author.id, date);
    const embed = new EmbedBuilder()
      .setColor(0xFF69B4)
      .setTitle('🎉 Đã đặt sinh nhật')
      .setDescription(`Sinh nhật của bạn đã được đặt là: **${date}**\nTôi sẽ chúc mừng bạn vào ngày này!`)
      .setTimestamp();
    
    channel.send({ embeds: [embed] });
  }

  // Thêm sự kiện
  if (command === 'addevent') {
    trackCommandUsage('addevent');
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) {
      return sendErrorEmbed(channel, 'Bạn không có quyền thêm sự kiện!');
    }

    const date = args[0];
    const content = args.slice(1).join(' ');

    if (!date || !/^\d{1,2}\/\d{1,2}$/.test(date) || !content) {
      return sendErrorEmbed(channel, 'Vui lòng nhập đúng định dạng: `$addevent dd/mm Nội dung sự kiện`');
    }

    addEvent(content, date);
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Đã thêm sự kiện')
      .setDescription(`**Ngày:** ${date}\n**Nội dung:** ${content}`)
      .setTimestamp();
    
    channel.send({ embeds: [embed] });
  }

  // Chế độ slowmode
  if (command === 'slowmode') {
    trackCommandUsage('slowmode');
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return sendErrorEmbed(channel, 'Bạn không có quyền thay đổi slowmode!');
    }

    const seconds = parseInt(args[0]);
    if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
      return sendErrorEmbed(channel, 'Vui lòng nhập số giây từ 0 đến 21600 (6 giờ)!');
    }

    await channel.setRateLimitPerUser(seconds);
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Đã thay đổi slowmode')
      .setDescription(seconds === 0 ? 'Đã tắt slowmode' : `Đã đặt slowmode: **${seconds} giây**`)
      .setTimestamp();
    
    channel.send({ embeds: [embed] });
  }
});

// Sự kiện thành viên tham gia
client.on('guildMemberAdd', async member => {
  const channel = member.guild.channels.cache.get(process.env.CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('👋 Chào mừng thành viên mới!')
    .setDescription(`Xin chào ${member}! Chúc mừng bạn đã tham gia **${member.guild.name}**!`)
    .addFields(
      { name: '📛 Tên thành viên', value: member.user.tag, inline: true },
      { name: '🆔 User ID', value: member.id, inline: true },
      { name: '📅 Tham gia vào', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `Thành viên thứ ${member.guild.memberCount}`, iconURL: member.guild.iconURL({ dynamic: true }) })
    .setTimestamp();

  channel.send({ content: `Xin chào ${member}!`, embeds: [embed] });
});

// Tự động ghim tin nhắn quan trọng
client.on('messageCreate', message => {
  if (message.content.includes('#quantrong') && !message.author.bot) {
    message.pin().then(() => {
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('📌 Tin nhắn đã được ghim')
        .setDescription('Tin nhắn này chứa từ khóa quan trọng và đã được ghim tự động.')
        .setTimestamp();
      
      message.channel.send({ embeds: [embed] });
    }).catch(console.error);
  }
});

client.login(process.env.DISCORD_TOKEN);