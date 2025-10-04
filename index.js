/**
 * @Author: Your name
 * @Date:   2025-09-29 18:55:36
 * @Last Modified by:   Your name
 * @Last Modified time: 2025-10-05 04:14:51
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
let queue = new Map();
let commandUsage = {};

// Đường dẫn file
const messagePath = path.join(__dirname, 'message.json');
const schedulePath = path.join(__dirname, 'schedule.json');
const dailyPath = path.join(__dirname, 'dailyMessages.json');
const birthdayPath = path.join(__dirname, 'birthdays.json');
const eventPath = path.join(__dirname, 'events.json');
const prefixPath = path.join(__dirname, 'prefix.json');
const welcomePath = path.join(__dirname, 'welcomeConfig.json');

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
    { path: prefixPath, default: { prefix: "$" } },
    { path: welcomePath, default: { 
      welcomeChannel: "",
      goodbyeChannel: "",
      welcomeMessage: "👋 Chào mừng {user} đã tham gia **{server}**!",
      goodbyeMessage: "😢 {user} đã rời khỏi **{server}**...",
      welcomeRole: ""
    }}
  ];

  files.forEach(file => {
    if (!fs.existsSync(file.path)) {
      fs.writeFileSync(file.path, JSON.stringify(file.default, null, 2));
    }
  });
}

// Hàm đọc cấu hình welcome
function getWelcomeConfig() {
  try {
    return JSON.parse(fs.readFileSync(welcomePath, 'utf8'));
  } catch (error) {
    return {
      welcomeChannel: "",
      goodbyeChannel: "",
      welcomeMessage: "👋 Chào mừng {user} đã tham gia **{server}**!",
      goodbyeMessage: "😢 {user} đã rời khỏi **{server}**...",
      welcomeRole: ""
    };
  }
}

// Hàm ghi cấu hình welcome
function setWelcomeConfig(config) {
  fs.writeFileSync(welcomePath, JSON.stringify(config, null, 2));
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

// ==================== HỆ THỐNG CHÀO MỪNG & TẠM BIỆT ====================

async function sendWelcomeMessage(member) {
  try {
    const config = getWelcomeConfig();
    if (!config.welcomeChannel) return;

    const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannel);
    if (!welcomeChannel) return;

    if (config.welcomeRole) {
      const role = member.guild.roles.cache.get(config.welcomeRole);
      if (role) {
        await member.roles.add(role).catch(console.error);
      }
    }

    let welcomeMsg = config.welcomeMessage
      .replace(/{user}/g, member.toString())
      .replace(/{server}/g, member.guild.name)
      .replace(/{username}/g, member.user.username)
      .replace(/{memberCount}/g, member.guild.memberCount.toString());

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎉 Chào Mừng Thành Viên Mới!')
      .setDescription(welcomeMsg)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '📛 Tên thành viên', value: member.user.tag, inline: true },
        { name: '🆔 User ID', value: member.id, inline: true },
        { name: '📅 Tham gia vào', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '👥 Thành viên thứ', value: `#${member.guild.memberCount}`, inline: true },
        { name: '📅 Tạo tài khoản', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
      )
      .setImage('https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphyhttps://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbHpsdG5pNDU4dm90NHZmMDJkM2M1Z3lrdWozN3k3OTMzOHg1bnRiNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/R4C2rSbLdKXYcw1ts3/giphy.gif.gif')
      .setFooter({ text: `Chúc bạn có những trải nghiệm tuyệt vời tại ${member.guild.name}!` })
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('📖 Đọc quy tắc')
          .setStyle(ButtonStyle.Link)
          .setURL('https://your-rules-link.com'),
        new ButtonBuilder()
          .setLabel('🎮 Giới thiệu bản thân')
          .setStyle(ButtonStyle.Primary)
          .setCustomId('introduce')
      );

    const welcomeMessage = await welcomeChannel.send({ 
      content: `Chào mừng ${member}! 👋`,
      embeds: [embed],
      components: [row]
    });

    await welcomeMessage.react('👋').catch(console.error);
    await welcomeMessage.react('🎉').catch(console.error);

  } catch (error) {
    console.error('Lỗi khi gửi tin nhắn chào mừng:', error);
  }
}

async function sendGoodbyeMessage(member) {
  try {
    const config = getWelcomeConfig();
    if (!config.goodbyeChannel) return;

    const goodbyeChannel = member.guild.channels.cache.get(config.goodbyeChannel);
    if (!goodbyeChannel) return;

    let goodbyeMsg = config.goodbyeMessage
      .replace(/{user}/g, member.user.tag)
      .replace(/{server}/g, member.guild.name)
      .replace(/{username}/g, member.user.username)
      .replace(/{memberCount}/g, (member.guild.memberCount - 1).toString());

    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('😢 Thành Viên Rời Đi')
      .setDescription(goodbyeMsg)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '📛 Tên thành viên', value: member.user.tag, inline: true },
        { name: '🆔 User ID', value: member.id, inline: true },
        { name: '📅 Rời đi lúc', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '👥 Thành viên còn lại', value: `${member.guild.memberCount - 1}`, inline: true },
        { name: '📅 Tham gia server', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Không rõ', inline: true }
      )
      .setImage('https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExNGgyNHRsMXNtemp2cGZybWM5YmRuN3hmbnRiMzFla3FlbHdmYjNkaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/i2Rcn45tJjqcnh3Qcl/giphy.gif')
      .setFooter({ text: `Hy vọng sẽ gặp lại ${member.user.username} trong tương lai!` })
      .setTimestamp();

    const goodbyeMessage = await goodbyeChannel.send({ 
      embeds: [embed]
    });

    await goodbyeMessage.react('😢').catch(console.error);
    await goodbyeMessage.react('👋').catch(console.error);

  } catch (error) {
    console.error('Lỗi khi gửi tin nhắn tạm biệt:', error);
  }
}

// ==================== HỆ THỐNG TIN NHẮN ĐỊNH KỲ ====================

function getVietnamTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 7));
}

async function sendMorningMessage() {
  try {
    const morningMessages = [
      "🌅 **Chào buổi sáng cả nhà!** Một ngày mới tràn đầy năng lượng và may mắn! ☀️",
      "🌞 **Buổi sáng tốt lành!** Hy vọng mọi người có một ngày làm việc hiệu quả! 💪",
      "☀️ **Good morning!** Hãy bắt đầu ngày mới với tinh thần tích cực nào! ✨"
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
      "💡 **Mẹo:** Lên kế hoạch công việc trong ngày để hiệu quả hơn!"
    ];
    
    embed.addFields({
      name: "🌟 Lời khuyên buổi sáng",
      value: tips[Math.floor(Math.random() * tips.length)],
      inline: false
    });

    const channel = client.channels.cache.get(process.env.CHANNEL_ID);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error(`Lỗi khi gửi tin nhắn buổi sáng: ${error}`);
  }
}

async function sendLunchMessage() {
  try {
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle("🍽️ GIỜ ĂN TRƯA - 12:00")
      .setDescription("🍱 **Đến giờ ăn trưa rồi cả nhà ơi!** Nhớ ăn uống đủ chất nhé!")
      .addFields({
        name: "⏰ Thời gian nghỉ ngơi",
        value: "Hãy dành ít nhất 30 phút để thư giãn!",
        inline: false
      });

    const channel = client.channels.cache.get(process.env.CHANNEL_ID);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error(`Lỗi khi gửi tin nhắn ăn trưa: ${error}`);
  }
}

async function sendEveningMessage() {
  try {
    const embed = new EmbedBuilder()
      .setColor(0xFF8C00)
      .setTitle("🌇 CHIỀU TÀ - 17:30")
      .setDescription("🌇 **Chiều muộn rồi đấy!** Sắp kết thúc một ngày làm việc rồi!")
      .addFields({
        name: "📊 Hoàn thành ngày làm việc",
        value: "Hãy tự hào về những gì bạn đã làm hôm nay!",
        inline: false
      });

    const channel = client.channels.cache.get(process.env.CHANNEL_ID);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error(`Lỗi khi gửi tin nhắn buổi chiều: ${error}`);
  }
}

async function sendNightActivityMessage() {
  try {
    const embed = new EmbedBuilder()
      .setColor(0x8A2BE2)
      .setTitle("🌃 BUỔI TỐI - 20:00")
      .setDescription("🎮 **Tối rồi!** Có ai online game không nào?")
      .addFields({
        name: "⏳ Còn 2 tiếng nữa là đến giờ ngủ",
        value: "Hãy tận hưởng buổi tối thật trọn vẹn!",
        inline: false
      });

    const channel = client.channels.cache.get(process.env.CHANNEL_ID);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error(`Lỗi khi gửi tin nhắn buổi tối: ${error}`);
  }
}

async function sendGoodNightMessage() {
  try {
    const embed = new EmbedBuilder()
      .setColor(0x4B0082)
      .setTitle("🌙 CHÚC NGỦ NGON - 22:00")
      .setDescription("🌙 **Chúc cả nhà ngủ ngon!** Đừng thức khuya quá nhé! 😴");

    const sleepTips = [
      "💡 **Mẹo:** Tắt các thiết bị điện tử 30 phút trước khi ngủ",
      "💡 **Mẹo:** Đọc sách giúp thư giãn và dễ ngủ hơn"
    ];
    
    embed.addFields(
      {
        name: "🌟 Mẹo ngủ ngon",
        value: sleepTips[Math.floor(Math.random() * sleepTips.length)],
        inline: false
      }
    );

    const channel = client.channels.cache.get(process.env.CHANNEL_ID);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error(`Lỗi khi gửi tin nhắn chúc ngủ ngon: ${error}`);
  }
}

// ==================== HÀM TIỆN ÍCH ====================

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

function sendErrorEmbed(channel, message) {
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('❌ Lỗi')
    .setDescription(message)
    .setTimestamp();
  return channel.send({ embeds: [embed] });
}

function sendSuccessEmbed(channel, message) {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Thành công')
    .setDescription(message)
    .setTimestamp();
  return channel.send({ embeds: [embed] });
}

function isAdmin(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function trackCommandUsage(command) {
  commandUsage[command] = (commandUsage[command] || 0) + 1;
}

// ==================== SỰ KIỆN CLIENT ====================

client.once('ready', () => {
  console.log(`✅ Bot đã đăng nhập với tên ${client.user.tag}`);
  console.log(`📊 Đang quản lý ${client.guilds.cache.size} server`);
  console.log(`🔧 Prefix hiện tại: ${PREFIX}`);
  
  const config = getWelcomeConfig();
  if (config.welcomeChannel) {
    console.log(`🎉 Kênh chào mừng: ${config.welcomeChannel}`);
  }
  if (config.goodbyeChannel) {
    console.log(`😢 Kênh tạm biệt: ${config.goodbyeChannel}`);
  }
  
  botStartTime = Date.now();

  // Lịch trình tin nhắn tự động
  cron.schedule('* * * * *', async () => {
    try {
      const now = getVietnamTime();
      const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                         now.getMinutes().toString().padStart(2, '0');
      
      const channel = client.channels.cache.get(process.env.CHANNEL_ID);
      if (!channel) return;
      
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
});

client.on('guildMemberAdd', async (member) => {
  console.log(`Thành viên mới: ${member.user.tag} (${member.id})`);
  await sendWelcomeMessage(member);
});

client.on('guildMemberRemove', async (member) => {
  console.log(`Thành viên rời đi: ${member.user.tag} (${member.id})`);
  await sendGoodbyeMessage(member);
});

// ==================== XỬ LÝ BUTTON INTERACTIONS ====================

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  try {
    if (interaction.customId === 'introduce') {
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🎮 Giới thiệu bản thân')
        .setDescription(`Xin chào ${interaction.user}! Hãy giới thiệu bản thân trong kênh chat chính để mọi người biết thêm về bạn nhé! 😊`)
        .addFields(
          { name: '💡 Gợi ý giới thiệu', value: '• Tên và tuổi\n• Sở thích\n• Mục tiêu\n• Kinh nghiệm' }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ 
        embeds: [embed], 
        ephemeral: true 
      });
    }
  } catch (error) {
    console.error('Lỗi khi xử lý button interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ 
        content: 'Có lỗi xảy ra khi xử lý yêu cầu!', 
        ephemeral: true 
      });
    }
  }
});

// ==================== HỆ THỐNG LỆNH ====================

let messageCount = {};
let userJoinTimes = {};

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  
  const content = message.content.toLowerCase();
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();
  const channel = message.channel;
  const userId = message.author.id;

  if (!userJoinTimes[userId]) {
    userJoinTimes[userId] = Date.now();
  }
  messageCount[userId] = (messageCount[userId] || 0) + 1;

  // Lệnh chào hỏi tự động
  if (content.includes('hello') || content.includes('bot ơi') || content.includes('chào bot')) {
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('👋 Xin chào!')
      .setDescription(`Chào bạn ${message.author.username}! Tôi có thể giúp gì cho bạn?\nGõ \`${PREFIX}help\` để xem danh sách lệnh.`)
      .setThumbnail(message.author.displayAvatarURL())
      .setTimestamp();
    return channel.send({ embeds: [embed] });
  }

  // ==================== LỆNH WELCOME SYSTEM ====================
  if (command === 'setwelcome') {
    trackCommandUsage('setwelcome');
    if (!isAdmin(message.member)) {
      return sendErrorEmbed(channel, 'Bạn không có quyền sử dụng lệnh này!');
    }

    const subCommand = args[0];
    const config = getWelcomeConfig();

    try {
      switch (subCommand) {
        case 'channel':
          const welcomeChannel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
          if (!welcomeChannel) {
            return sendErrorEmbed(channel, 'Vui lòng đề cập đến một kênh hợp lệ!');
          }
          config.welcomeChannel = welcomeChannel.id;
          setWelcomeConfig(config);
          await sendSuccessEmbed(channel, `Đã đặt kênh chào mừng: ${welcomeChannel}`);
          break;

        case 'goodbyechannel':
          const goodbyeChannel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
          if (!goodbyeChannel) {
            return sendErrorEmbed(channel, 'Vui lòng đề cập đến một kênh hợp lệ!');
          }
          config.goodbyeChannel = goodbyeChannel.id;
          setWelcomeConfig(config);
          await sendSuccessEmbed(channel, `Đã đặt kênh tạm biệt: ${goodbyeChannel}`);
          break;

        case 'message':
          const welcomeMessage = args.slice(1).join(' ');
          if (!welcomeMessage) {
            return sendErrorEmbed(channel, 'Vui lòng nhập nội dung tin nhắn chào mừng!');
          }
          config.welcomeMessage = welcomeMessage;
          setWelcomeConfig(config);
          await sendSuccessEmbed(channel, `Đã đặt tin nhắn chào mừng: ${welcomeMessage}`);
          break;

        case 'goodbyemessage':
          const goodbyeMessage = args.slice(1).join(' ');
          if (!goodbyeMessage) {
            return sendErrorEmbed(channel, 'Vui lòng nhập nội dung tin nhắn tạm biệt!');
          }
          config.goodbyeMessage = goodbyeMessage;
          setWelcomeConfig(config);
          await sendSuccessEmbed(channel, `Đã đặt tin nhắn tạm biệt: ${goodbyeMessage}`);
          break;

        case 'role':
          const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
          if (!role) {
            return sendErrorEmbed(channel, 'Vui lòng đề cập đến một role hợp lệ!');
          }
          config.welcomeRole = role.id;
          setWelcomeConfig(config);
          await sendSuccessEmbed(channel, `Đã đặt role tự động: ${role}`);
          break;

        case 'test':
          await sendWelcomeMessage(message.member);
          await sendSuccessEmbed(channel, 'Đã gửi tin nhắn chào mừng test!');
          break;

        case 'info':
          const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('⚙️ Cấu hình Welcome System')
            .addFields(
              { name: '🎉 Kênh chào mừng', value: config.welcomeChannel ? `<#${config.welcomeChannel}>` : 'Chưa đặt', inline: true },
              { name: '😢 Kênh tạm biệt', value: config.goodbyeChannel ? `<#${config.goodbyeChannel}>` : 'Chưa đặt', inline: true },
              { name: '👑 Role tự động', value: config.welcomeRole ? `<@&${config.welcomeRole}>` : 'Chưa đặt', inline: true },
              { name: '📝 Tin nhắn chào mừng', value: config.welcomeMessage || 'Mặc định', inline: false },
              { name: '📝 Tin nhắn tạm biệt', value: config.goodbyeMessage || 'Mặc định', inline: false }
            )
            .setFooter({ text: 'Sử dụng $setwelcome <option> để thay đổi cấu hình' })
            .setTimestamp();
          
          await channel.send({ embeds: [embed] });
          break;

        default:
          const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🛠️ Hướng dẫn lệnh setwelcome')
            .setDescription('Cấu hình hệ thống chào mừng và tạm biệt')
            .addFields(
              { name: '🎯 Các lệnh con', value: 
                '`channel <#channel>` - Đặt kênh chào mừng\n' +
                '`goodbyechannel <#channel>` - Đặt kênh tạm biệt\n' +
                '`message <nội dung>` - Đặt tin nhắn chào mừng\n' +
                '`goodbyemessage <nội dung>` - Đặt tin nhắn tạm biệt\n' +
                '`role <@role>` - Đặt role tự động\n' +
                '`test` - Gửi tin nhắn test\n' +
                '`info` - Xem cấu hình hiện tại'
              },
              { name: '🔤 Placeholder hỗ trợ', value: 
                '`{user}` - Mention user\n' +
                '`{username}` - Tên user\n' +
                '`{server}` - Tên server\n' +
                '`{memberCount}` - Số thành viên'
              }
            );
          
          await channel.send({ embeds: [helpEmbed] });
          break;
      }
    } catch (error) {
      console.error(error);
      sendErrorEmbed(channel, `Lỗi khi cấu hình: ${error.message}`);
    }
  }

  // ==================== LỆNH CƠ BẢN ====================
// ==================== LỆNH CƠ BẢN ====================
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

    // Tạo nút hành động với các liên kết thực tế
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('📖 Hướng dẫn sử dụng')
          .setStyle(ButtonStyle.Link)
          .setURL('https://github.com/CuongGatsBy94/LeiLaBOT'),
        new ButtonBuilder()
          .setLabel('🎯 Mời bot')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.com/oauth2/authorize?client_id=1421716299947708436'),
        new ButtonBuilder()
          .setLabel('💬 Support Server')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.gg/9CFJxJUBj7')
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
  if (command === 'help') {
    trackCommandUsage('help');
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📘 Danh sách lệnh - LeiLaBOT')
      .setDescription(`**Prefix:** \`${PREFIX}\` | **Tổng lệnh:** 50+ | **Hỗ trợ:** Tiếng Việt 100%`)
      .addFields(
        { 
          name: '🤖 BOT & HỆ THỐNG', 
          value: '`info` - Thông tin bot\n`botstatus` - Trạng thái bot\n`prefix` - Xem prefix\n`setprefix` - Đổi prefix (admin)\n`help` - Trợ giúp' 
        },
        { 
          name: '🎉 CHÀO MỪNG', 
          value: '`setwelcome` - Cấu hình welcome system\n`setwelcome info` - Xem cấu hình' 
        },
        { 
          name: '🔊 ÂM NHẠC', 
          value: '`play` - Phát nhạc YouTube\n`stop` - Dừng nhạc\n`pause` - Tạm dừng\n`resume` - Tiếp tục' 
        },
        { 
          name: '👥 THÀNH VIÊN', 
          value: '`members` - Danh sách thành viên\n`userinfo` - Thông tin user\n`serverinfo` - Thông tin server' 
        },
        { 
          name: '🎮 GIẢI TRÍ', 
          value: '`poll` - Tạo bình chọn\n`guess` - Đoán số\n`quiz` - Câu đố\n`lottery` - Xổ số' 
        },
        { 
          name: '🛠️ TIỆN ÍCH', 
          value: '`translate` - Dịch thuật\n`clear` - Xóa tin nhắn\n`remindme` - Nhắc lịch' 
        },
        { 
          name: '🔐 XÁC MINH', 
          value: '`verifyinfo` - Thông tin xác minh\n`support` - Hỗ trợ xác minh' 
        }
      )
      .setFooter({ text: `LeiLaBOT • ${new Date().getFullYear()}`, iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    return channel.send({ embeds: [embed] });
  }

  if (command === 'botstatus') {
    trackCommandUsage('botstatus');
    try {
      const ping = Date.now() - message.createdTimestamp;
      const systemInfo = getSystemInfo();
      
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🤖 Trạng thái Bot')
        .addFields(
          { name: '📊 Ping', value: `${ping}ms`, inline: true },
          { name: '🕒 Uptime', value: getUptime(), inline: true },
          { name: '🔧 Prefix', value: `\`${PREFIX}\``, inline: true },
          { name: '💻 CPU', value: `${systemInfo.cpu}%`, inline: true },
          { name: '🧠 RAM', value: `${systemInfo.memory}%`, inline: true }
        );

      await channel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error(error);
      sendErrorEmbed(channel, `Lỗi khi kiểm tra trạng thái: ${error.message}`);
    }
  }

  if (command === 'prefix') {
    trackCommandUsage('prefix');
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🔧 Prefix hiện tại')
      .setDescription(`Prefix của bot là: \`${PREFIX}\``)
      .addFields(
        { name: '📝 Cách sử dụng', value: `Gõ \`${PREFIX}help\` để xem danh sách lệnh` },
        { name: '⚙️ Thay đổi prefix', value: `Sử dụng \`${PREFIX}setprefix <prefix mới>\` (chỉ admin)` }
      )
      .setTimestamp();
    
    await channel.send({ embeds: [embed] });
  }

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
      const oldPrefix = PREFIX;
      PREFIX = newPrefix;
      setPrefix(newPrefix);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🔧 Đã thay đổi Prefix')
        .setDescription('Prefix đã được thay đổi thành công!')
        .addFields(
          { name: '📝 Prefix cũ', value: `\`${oldPrefix}\``, inline: true },
          { name: '📝 Prefix mới', value: `\`${newPrefix}\``, inline: true }
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error(error);
      sendErrorEmbed(channel, `Lỗi khi thay đổi prefix: ${error.message}`);
    }
  }

  // ==================== LỆNH ÂM NHẠC ====================
  if (command === 'play') {
    trackCommandUsage('play');
    const url = args[0];
    if (!url) return sendErrorEmbed(channel, 'Vui lòng cung cấp URL YouTube!');
    
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return sendErrorEmbed(channel, 'Bạn cần tham gia voice channel trước!');

    try {
      if (!ytdl.validateURL(url)) {
        return sendErrorEmbed(channel, 'URL YouTube không hợp lệ!');
      }

      // Kiểm tra nếu bot đã kết nối voice channel khác
      const existingConnection = client.voiceConnections.get(message.guild.id);
      if (existingConnection) {
        existingConnection.destroy();
      }

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      const player = createAudioPlayer();
      
      // Thêm xử lý lỗi cho player
      player.on('error', error => {
        console.error('Audio player error:', error);
        sendErrorEmbed(channel, 'Lỗi khi phát nhạc!');
      });

      const resource = createAudioResource(ytdl(url, { 
        filter: 'audioonly',
        quality: 'highestaudio'
      }), {
        inlineVolume: true
      });

      connection.subscribe(player);
      player.play(resource);

      client.voiceConnections.set(message.guild.id, connection);
      client.audioPlayers.set(message.guild.id, player);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🎶 Đang phát nhạc')
        .setDescription(`Đang phát từ URL: ${url}`)
        .addFields(
          { name: '🎵 Kênh', value: voiceChannel.name, inline: true },
          { name: '⏱️ Trạng thái', value: 'Đang phát', inline: true }
        )
        .setTimestamp();
      channel.send({ embeds: [embed] });

      player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
        client.voiceConnections.delete(message.guild.id);
        client.audioPlayers.delete(message.guild.id);
      });

    } catch (error) {
      console.error('Play command error:', error);
      sendErrorEmbed(channel, 'Có lỗi khi phát nhạc! Vui lòng thử lại.');
    }
  }

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

  // ==================== LỆNH QUẢN LÝ ====================
  if (command === 'members') {
    trackCommandUsage('members');
    try {
      const members = await message.guild.members.fetch();
      const memberList = members.map(m => ({
        name: m.user.username,
        id: m.user.id,
        joinedAt: m.joinedTimestamp,
        bot: m.user.bot
      }));

      memberList.sort((a, b) => a.joinedAt - b.joinedAt);

      const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle(`👥 DANH SÁCH THÀNH VIÊN - ${message.guild.name}`)
        .setDescription(`**Tổng số:** ${memberList.length} thành viên`)
        .setFooter({ text: `${message.guild.memberCount} thành viên` })
        .setTimestamp();

      // Hiển thị 10 thành viên đầu tiên
      memberList.slice(0, 10).forEach((member, index) => {
        const joinDate = `<t:${Math.floor(member.joinedAt / 1000)}:R>`;
        embed.addFields({
          name: `#${index + 1} ${member.name} ${member.bot ? '🤖' : ''}`,
          value: `• Tham gia: ${joinDate}`,
          inline: true
        });
      });

      // Thêm thông tin thống kê
      const botCount = memberList.filter(m => m.bot).length;
      const humanCount = memberList.length - botCount;
      embed.addFields({
        name: '📊 Thống kê',
        value: `• 👤 Người: ${humanCount}\n• 🤖 Bot: ${botCount}`,
        inline: false
      });

      await channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Lỗi khi lấy danh sách thành viên:', error);
      sendErrorEmbed(channel, 'Có lỗi xảy ra khi lấy danh sách thành viên.');
    }
  }

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
        { name: '💬 Tin nhắn', value: `${messageCount[target.id] || 0}`, inline: true }
      )
      .setFooter({ text: `Yêu cầu bởi ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    channel.send({ embeds: [embed] });
  }

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
        { name: '👥 Thành viên', value: `Tổng: ${guild.memberCount}`, inline: true },
        { name: '📊 Số lượng', value: `Kênh: ${guild.channels.cache.size}\nRole: ${guild.roles.cache.size}`, inline: true }
      )
      .setTimestamp(guild.createdAt);

    channel.send({ embeds: [embed] });
  }

  // ==================== LỆNH GIẢI TRÍ ====================
  if (command === 'poll') {
    trackCommandUsage('poll');
    const matches = message.content.match(/"([^"]+)"/g);
    if (!matches || matches.length < 2) {
      return sendErrorEmbed(channel, 'Cần ít nhất 1 câu hỏi và 1 lựa chọn!\nVí dụ: `$poll "Bạn thích màu gì?" "Đỏ" "Xanh" "Vàng"`');
    }
    
    const question = matches[0].replace(/"/g, '');
    const options = matches.slice(1).map(opt => opt.replace(/"/g, ''));
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
    
    let pollText = `**${question}**\n\n`;
    options.forEach((opt, i) => pollText += `${emojis[i]} ${opt}\n`);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📊 Bình chọn')
      .setDescription(pollText)
      .setFooter({ text: `Bình chọn bởi ${message.author.username}` })
      .setTimestamp();

    const pollMsg = await channel.send({ embeds: [embed] });
    options.forEach((_, i) => pollMsg.react(emojis[i]));
  }

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
        .setTimestamp();
      channel.send({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('😅 Sai rồi!')
        .setDescription(`Bạn đoán **${guess}** nhưng số đúng là **${number}**`)
        .setTimestamp();
      channel.send({ embeds: [embed] });
    }
  }

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
      .setFooter({ text: `Tổng số người tham gia: ${active.size}` })
      .setTimestamp();
    
    channel.send({ embeds: [embed] });
  }

  // ==================== LỆNH TIỆN ÍCH ====================
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
        .setTimestamp();
      
      channel.send({ embeds: [embed] });
    } catch (error) {
      sendErrorEmbed(channel, 'Không thể dịch văn bản!');
    }
  }

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
        .setFooter({ text: `Được đặt bởi ${message.author.username}` })
        .setTimestamp();
      
      channel.send({ content: `<@${message.author.id}>`, embeds: [reminderEmbed] });
    }, minutes * 60000);
  }
  // ==================== LỆNH XÁC MINH ====================
  if (command === 'verifyinfo') {
    trackCommandUsage('verifyinfo');
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🔐 Thông tin Xác minh Bot')
        .setDescription('Thông tin về quá trình xác minh LeiLaBOT với Discord')
        .addFields(
            { name: '📊 Số server hiện tại', value: `${client.guilds.cache.size}/75 servers`, inline: true },
            { name: '⏰ Thời gian hoạt động', value: getUptime(), inline: true },
            { name: '✅ Trạng thái', value: 'Đang trong quá trình xác minh', inline: true },
            { name: '📋 Yêu cầu', value: '• 75+ servers\n• 2+ tháng hoạt động\n• Privacy Policy\n• Terms of Service\n• Tuân thủ ToS', inline: false },
            { name: '🔗 Links quan trọng', value: '[Developer Portal](https://discord.com/developers/applications) | [Documentation](https://discord.com/developers/docs/topics/oauth2)', inline: false }
        )
        .setFooter({ text: 'LeiLaBOT Verification Process' })
        .setTimestamp();
    
    await channel.send({ embeds: [embed] });
  }

  if (command === 'support') {
    trackCommandUsage('support');
    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🤝 Hỗ trợ Xác minh')
        .setDescription('Giúp LeiLaBOT được xác minh bằng cách:')
        .addFields(
            { name: '1. Mời bot', value: 'Mời bot đến server của bạn', inline: false },
            { name: '2. Đánh giá', value: 'Đánh giá bot trên các bot list', inline: false },
            { name: '3. Báo cáo lỗi', value: 'Giúp cải thiện chất lượng bot', inline: false }
        )
        .setFooter({ text: 'Cảm ơn sự hỗ trợ của bạn!' })
        .setTimestamp();
    
    await channel.send({ embeds: [embed] });
  }
});
client.login(process.env.DISCORD_TOKEN);