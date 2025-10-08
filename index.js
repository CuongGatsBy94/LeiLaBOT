/**
 * @Author: Your name
 * @Date:   2025-10-05 04:12:42
 * @Last Modified by:   Your name
 * @Last Modified time: 2025-10-08 19:36:30
 */
require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, Collection, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const playdl = require('play-dl');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const translate = require('@vitalets/google-translate-api');
const os = require('os');

// Biến toàn cục
let PREFIX = '$';
let botStartTime = Date.now();
let commandUsage = {};
let messageCount = {};
let userJoinTimes = {};

// Hệ thống queue cho âm nhạc
const musicQueues = new Map();

function getQueue(guildId) {
  if (!musicQueues.has(guildId)) {
    musicQueues.set(guildId, {
      songs: [],
      currentIndex: 0,
      isPlaying: false,
      isPaused: false,
      connection: null,
      player: null
    });
  }
  return musicQueues.get(guildId);
}

function addToQueue(guildId, song) {
  const queue = getQueue(guildId);
  queue.songs.push(song);
  return queue.songs.length;
}

function clearQueue(guildId) {
  const queue = getQueue(guildId);
  queue.songs = [];
  queue.currentIndex = 0;
  queue.isPlaying = false;
  queue.isPaused = false;
}

async function playSong(guildId, client) {
  const queue = getQueue(guildId);
  
  if (queue.currentIndex >= queue.songs.length) {
    if (queue.connection) {
      const channel = client.channels.cache.get(queue.connection.joinConfig.channelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0x808080)
          .setTitle('🎵 Đã phát hết queue')
          .setDescription('Tất cả bài hát trong queue đã được phát xong.')
          .setTimestamp();
        channel.send({ embeds: [embed] }).catch(console.error);
      }
      queue.connection.destroy();
    }
    musicQueues.delete(guildId);
    return;
  }

  const song = queue.songs[queue.currentIndex];
  queue.isPlaying = true;
  queue.isPaused = false;

  try {
    const stream = await playdl.stream(song.url);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true
    });

    if (queue.player) {
      queue.player.play(resource);
      
      const channel = client.channels.cache.get(queue.connection.joinConfig.channelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🎶 Đang phát')
          .setDescription(`**[${song.title}](${song.url})**`)
          .addFields(
            { name: '📺 Kênh', value: song.channel, inline: true },
            { name: '⏱️ Thời lượng', value: song.duration, inline: true },
            { name: '📊 Vị trí', value: `${queue.currentIndex + 1}/${queue.songs.length}`, inline: true },
            { name: '👤 Yêu cầu bởi', value: song.requester, inline: false }
          )
          .setThumbnail(song.thumbnail)
          .setTimestamp();
        
        channel.send({ embeds: [embed] }).catch(console.error);
      }

      queue.player.once(AudioPlayerStatus.Idle, () => {
        setTimeout(() => {
          queue.currentIndex++;
          playSong(guildId, client);
        }, 1000);
      });
    }
  } catch (error) {
    console.error('Lỗi phát nhạc:', error);
    const channel = client.channels.cache.get(queue.connection.joinConfig.channelId);
    if (channel) {
      channel.send('❌ Lỗi khi phát bài hát này! Đang chuyển sang bài tiếp theo...').catch(console.error);
    }
    queue.currentIndex++;
    setTimeout(() => playSong(guildId, client), 2000);
  }
}

// Đường dẫn file
const messagePath = path.join(__dirname, 'message.json');
const schedulePath = path.join(__dirname, 'schedule.json');
const dailyPath = path.join(__dirname, 'dailyMessages.json');
const birthdayPath = path.join(__dirname, 'birthdays.json');
const eventPath = path.join(__dirname, 'events.json');
const prefixPath = path.join(__dirname, 'prefix.json');
const welcomePath = path.join(__dirname, 'welcomeConfig.json');
const dmMessagesPath = path.join(__dirname, 'dmMessages.json');
const botConfigPath = path.join(__dirname, 'botConfig.json');

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
    }},
    { path: dmMessagesPath, default: [] },
    { path: botConfigPath, default: { 
      dmLogChannel: "",
      autoReply: false
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

// Hàm đọc tin nhắn DM
function getDmMessages() {
  try {
    return JSON.parse(fs.readFileSync(dmMessagesPath, 'utf8'));
  } catch (error) {
    return [];
  }
}

// Hàm ghi tin nhắn DM
function addDmMessage(message) {
  try {
    const messages = getDmMessages();
    messages.push({
      id: message.id,
      author: {
        id: message.author.id,
        tag: message.author.tag,
        username: message.author.username
      },
      content: message.content,
      timestamp: message.createdTimestamp,
      attachments: message.attachments.map(att => ({
        name: att.name,
        url: att.url,
        size: att.size
      }))
    });
    
    if (messages.length > 100) {
      messages.splice(0, messages.length - 100);
    }
    
    fs.writeFileSync(dmMessagesPath, JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error('Error saving DM message:', error);
  }
}

// Hàm đọc cấu hình bot
function getBotConfig() {
  try {
    return JSON.parse(fs.readFileSync(botConfigPath, 'utf8'));
  } catch (error) {
    return {
      dmLogChannel: "",
      autoReply: false
    };
  }
}

// Hàm ghi cấu hình bot
function setBotConfig(config) {
  fs.writeFileSync(botConfigPath, JSON.stringify(config, null, 2));
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

// Client với đầy đủ intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
  ],
});

client.commands = new Collection();

// ==================== HỆ THỐNG XỬ LÝ TIN NHẮN DM ====================

async function handleDirectMessage(message) {
  try {
    console.log(`📩 DM từ ${message.author.tag}: ${message.content}`);
    
    addDmMessage(message);
    
    const config = getBotConfig();
    
    if (config.dmLogChannel) {
      const logChannel = client.channels.cache.get(config.dmLogChannel);
      
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor(0x7289DA)
          .setTitle('📩 Tin nhắn DM mới')
          .setDescription(`**Người gửi:** ${message.author.tag} (${message.author.id})`)
          .addFields(
            { name: '📝 Nội dung', value: message.content || '*Không có nội dung văn bản*', inline: false }
          )
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .setTimestamp();

        if (message.attachments.size > 0) {
          const attachments = message.attachments.map(att => 
            `[${att.name}](${att.url})`
          ).join('\n');
          embed.addFields({ name: '📎 File đính kèm', value: attachments, inline: false });
        }

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`dm_reply_${message.author.id}`)
              .setLabel('💌 Phản hồi')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`dm_userinfo_${message.author.id}`)
              .setLabel('👤 Thông tin')
              .setStyle(ButtonStyle.Secondary)
          );

        await logChannel.send({ 
          embeds: [embed],
          components: [row]
        });
      }
    }

    const autoReplyEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🤖 Cảm ơn bạn đã liên hệ!')
      .setDescription('Tin nhắn của bạn đã được ghi nhận. Chúng tôi sẽ phản hồi sớm nhất có thể!')
      .addFields(
        { name: '📞 Hỗ trợ nhanh', value: 'Tham gia server hỗ trợ: https://discord.gg/9CFJxJUBj7', inline: false },
        { name: '📋 Lệnh hỗ trợ', value: `Gõ \`${PREFIX}help\` để xem danh sách lệnh`, inline: false }
      )
      .setFooter({ text: 'LeiLaBOT Support' })
      .setTimestamp();

    await message.author.send({ embeds: [autoReplyEmbed] }).catch(console.error);

  } catch (error) {
    console.error('Lỗi khi xử lý tin nhắn DM:', error);
  }
}

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
      .setFooter({ text: `Chúc bạn có những trải nghiệm tuyệt vời tại ${member.guild.name}!` })
      .setTimestamp();

    await welcomeChannel.send({ 
      content: `Chào mừng ${member}! 👋`,
      embeds: [embed]
    });

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
        { name: '👥 Thành viên còn lại', value: `${member.guild.memberCount - 1}`, inline: true }
      )
      .setTimestamp();

    await goodbyeChannel.send({ embeds: [embed] });

  } catch (error) {
    console.error('Lỗi khi gửi tin nhắn tạm biệt:', error);
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
  
  // THIẾT LẬP STATUS - HIỂN THỊ DÒNG CHỮ BÊN DƯỚI TÊN BOT
  client.user.setPresence({
    activities: [{
      name: ` | ${PREFIX}help`,
      type: 2 // LISTENING - sẽ hiển thị "Đang nghe Cùng nghe nhạc | $help"
    }],
    status: 'online'
  });
  
  const config = getWelcomeConfig();
  if (config.welcomeChannel) {
    console.log(`🎉 Kênh chào mừng: ${config.welcomeChannel}`);
  }
  if (config.goodbyeChannel) {
    console.log(`😢 Kênh tạm biệt: ${config.goodbyeChannel}`);
  }

  const botConfig = getBotConfig();
  if (botConfig.dmLogChannel) {
    console.log(`📩 Kênh log DM: ${botConfig.dmLogChannel}`);
  }
  
  botStartTime = Date.now();
});

client.on('guildMemberAdd', async (member) => {
  console.log(`Thành viên mới: ${member.user.tag} (${member.id})`);
  await sendWelcomeMessage(member);
});

client.on('guildMemberRemove', async (member) => {
  console.log(`Thành viên rời đi: ${member.user.tag} (${member.id})`);
  await sendGoodbyeMessage(member);
});

// ==================== XỬ LÝ INTERACTIONS ====================

client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    try {
      if (interaction.customId === 'introduce') {
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🎮 Giới thiệu bản thân')
          .setDescription(`Xin chào ${interaction.user}! Hãy giới thiệu bản thân trong kênh chat chính để mọi người biết thêm về bạn nhé! 😊`)
          .setThumbnail(interaction.user.displayAvatarURL())
          .setTimestamp();

        await interaction.reply({ 
          embeds: [embed], 
          ephemeral: true 
        });
      }

      if (interaction.customId.startsWith('dm_reply_')) {
        const userId = interaction.customId.replace('dm_reply_', '');
        
        const modal = new ModalBuilder()
          .setCustomId(`dm_reply_modal_${userId}`)
          .setTitle('Phản hồi tin nhắn DM');

        const messageInput = new TextInputBuilder()
          .setCustomId('reply_message')
          .setLabel('Nội dung phản hồi')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(2000);

        const actionRow = new ActionRowBuilder().addComponents(messageInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('dm_userinfo_')) {
        const userId = interaction.customId.replace('dm_userinfo_', '');
        
        try {
          const user = await client.users.fetch(userId);
          const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('👤 Thông tin người gửi')
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
              { name: 'Tên', value: user.tag, inline: true },
              { name: 'ID', value: user.id, inline: true },
              { name: 'Tạo tài khoản', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
              { name: 'Bot', value: user.bot ? '✅' : '❌', inline: true }
            )
            .setTimestamp();

          await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
          await interaction.reply({ content: 'Không thể lấy thông tin user!', ephemeral: true });
        }
      }
    } catch (error) {
      console.error('Lỗi khi xử lý button interaction:', error);
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('dm_reply_modal_')) {
      const userId = interaction.customId.replace('dm_reply_modal_', '');
      const replyMessage = interaction.fields.getTextInputValue('reply_message');

      try {
        const user = await client.users.fetch(userId);
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('💌 Phản hồi từ LeiLaBOT')
          .setDescription(replyMessage)
          .setFooter({ text: 'LeiLaBOT Support Team' })
          .setTimestamp();

        await user.send({ embeds: [embed] });
        await interaction.reply({ content: `✅ Đã gửi phản hồi đến ${user.tag}!`, ephemeral: true });

      } catch (error) {
        await interaction.reply({ content: '❌ Không thể gửi tin nhắn!', ephemeral: true });
      }
    }
  }
});

// ==================== HỆ THỐNG LỆNH CHÍNH ====================

client.on('messageCreate', async message => {
  // Xử lý tin nhắn DM
  if (!message.guild && !message.author.bot) {
    await handleDirectMessage(message);
    return;
  }
  
  // Bỏ qua nếu không phải tin nhắn trong server hoặc là bot
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

  // ==================== LỆNH CƠ BẢN ====================
  if (command === 'help') {
    trackCommandUsage('help');
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📘 Danh sách lệnh - LeiLaBOT')
      .setDescription(`**Prefix:** \`${PREFIX}\``)
      .addFields(
        { 
          name: '🤖 BOT & HỆ THỐNG', 
          value: '`info` - Thông tin bot\n`botstatus` - Trạng thái bot\n`prefix` - Xem prefix\n`setprefix` - Đổi prefix (admin)\n`help` - Trợ giúp' 
        },
        { 
          name: '🎉 CHÀO MỪNG', 
          value: '`setwelcome` - Cấu hình welcome system' 
        },
        { 
          name: '🔊 ÂM NHẠC', 
          value: '`play` - Phát nhạc YouTube\n`stop` - Dừng nhạc\n`pause` - Tạm dừng\n`resume` - Tiếp tục\n`skip` - Bỏ qua bài\n`queue` - Xem queue' 
        },
        { 
          name: '👥 THÀNH VIÊN', 
          value: '`userinfo` - Thông tin user\n`serverinfo` - Thông tin server' 
        },
        { 
          name: '📨 DM (ADMIN ONLY)', 
          value: '`dms` - Xem tin nhắn DM\n`setdmlog` - Đặt kênh log DM\n`autoreply` - Bật/tắt auto reply' 
        }
      )
      .setFooter({ text: `LeiLaBOT • ${new Date().getFullYear()}` })
      .setTimestamp();

    return channel.send({ embeds: [embed] });
  }

  if (command === 'info') {
    trackCommandUsage('info');
    try {
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🤖 LeiLaBOT - Discord Bot Đa Năng')
        .setDescription('Bot Discord đa chức năng với nhiều tính năng hữu ích!')
        .addFields(
          { name: '📊 Thống kê', value: `• **Server:** ${client.guilds.cache.size}\n• **Uptime:** ${getUptime()}\n• **Ping:** ${Date.now() - message.createdTimestamp}ms`, inline: true },
          { name: '🎯 Tính năng', value: '• 🤖 Bot thông minh\n• 🔊 Âm nhạc\n• 🎉 Tự động hóa\n• 🛠️ Quản lý', inline: true },
          { name: '🔧 Thông tin', value: `• **Prefix:** \`${PREFIX}\`\n• **Phiên bản:** 2.0.0\n• **Hỗ trợ:** Tiếng Việt 100%`, inline: true }
        )
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({ text: `LeiLaBOT • ${new Date().getFullYear()}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error(error);
      sendErrorEmbed(channel, `Lỗi khi hiển thị thông tin bot: ${error.message}`);
    }
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

        case 'info':
          const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('⚙️ Cấu hình Welcome System')
            .addFields(
              { name: '🎉 Kênh chào mừng', value: config.welcomeChannel ? `<#${config.welcomeChannel}>` : 'Chưa đặt', inline: true },
              { name: '😢 Kênh tạm biệt', value: config.goodbyeChannel ? `<#${config.goodbyeChannel}>` : 'Chưa đặt', inline: true },
              { name: '👑 Role tự động', value: config.welcomeRole ? `<@&${config.welcomeRole}>` : 'Chưa đặt', inline: true }
            )
            .setTimestamp();
          
          await channel.send({ embeds: [embed] });
          break;

        default:
          const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🛠️ Hướng dẫn lệnh setwelcome')
            .addFields(
              { name: '🎯 Các lệnh con', value: 
                '`channel <#channel>` - Đặt kênh chào mừng\n' +
                '`goodbyechannel <#channel>` - Đặt kênh tạm biệt\n' +
                '`role <@role>` - Đặt role tự động\n' +
                '`info` - Xem cấu hình hiện tại'
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

  // ==================== LỆNH ÂM NHẠC ====================
  if (command === 'play') {
    trackCommandUsage('play');
    const query = args.join(' ');
    if (!query) return sendErrorEmbed(channel, 'Vui lòng cung cấp URL YouTube hoặc tên bài hát!');
    
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return sendErrorEmbed(channel, 'Bạn cần tham gia voice channel trước!');

    try {
      const loadingEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('🔄 Đang tìm kiếm...')
        .setDescription(`Đang tìm kiếm: **${query}**`)
        .setTimestamp();
      
      const loadingMsg = await channel.send({ embeds: [loadingEmbed] });

      let songInfo;
      
      if (ytdl.validateURL(query)) {
        songInfo = await ytdl.getInfo(query);
      } else {
        const searchResults = await playdl.search(query, { limit: 1 });
        if (searchResults.length === 0) {
          await loadingMsg.delete().catch(console.error);
          return sendErrorEmbed(channel, 'Không tìm thấy bài hát nào!');
        }
        songInfo = await ytdl.getInfo(searchResults[0].url);
      }

      const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
        channel: songInfo.videoDetails.author.name,
        duration: songInfo.videoDetails.lengthSeconds ? 
          `${Math.floor(songInfo.videoDetails.lengthSeconds / 60)}:${(songInfo.videoDetails.lengthSeconds % 60).toString().padStart(2, '0')}` : 'Live',
        thumbnail: songInfo.videoDetails.thumbnails[0]?.url,
        requester: message.author.toString()
      };

      const queue = getQueue(message.guild.id);
      
      if (!queue.connection) {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        
        connection.subscribe(player);
        
        queue.connection = connection;
        queue.player = player;
      }

      const position = addToQueue(message.guild.id, song);

      await loadingMsg.delete().catch(console.error);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🎵 Đã thêm vào queue')
        .setDescription(`**[${song.title}](${song.url})**`)
        .addFields(
          { name: '📺 Kênh', value: song.channel, inline: true },
          { name: '⏱️ Thời lượng', value: song.duration, inline: true },
          { name: '📊 Vị trí trong queue', value: `#${position}`, inline: true },
          { name: '👤 Yêu cầu bởi', value: message.author.toString(), inline: false }
        )
        .setThumbnail(song.thumbnail)
        .setTimestamp();
      
      await channel.send({ embeds: [embed] });

      if (!queue.isPlaying) {
        await playSong(message.guild.id, client);
      }

    } catch (error) {
      console.error('Lỗi lệnh play:', error);
      sendErrorEmbed(channel, `Lỗi khi phát nhạc: ${error.message}`);
    }
  }

  if (command === 'stop') {
    trackCommandUsage('stop');
    try {
      const queue = getQueue(message.guild.id);
      if (queue.connection && queue.player) {
        queue.player.stop();
        queue.connection.destroy();
        clearQueue(message.guild.id);
        
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('⏹️ Đã dừng phát nhạc')
          .setDescription('Bot đã ngừng phát nhạc và rời khỏi voice channel.')
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
      } else {
        sendErrorEmbed(channel, 'Không có bài hát nào đang phát!');
      }
    } catch (error) {
      console.error('Stop command error:', error);
      sendErrorEmbed(channel, 'Có lỗi khi dừng nhạc!');
    }
  }

  if (command === 'pause') {
    trackCommandUsage('pause');
    try {
      const queue = getQueue(message.guild.id);
      if (queue.player && queue.isPlaying) {
        queue.player.pause();
        queue.isPaused = true;
        
        const embed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('⏸️ Đã tạm dừng')
          .setDescription('Nhạc đã được tạm dừng.')
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
      } else {
        sendErrorEmbed(channel, 'Không có bài hát nào đang phát!');
      }
    } catch (error) {
      console.error('Pause command error:', error);
      sendErrorEmbed(channel, 'Có lỗi khi tạm dừng nhạc!');
    }
  }

  if (command === 'resume') {
    trackCommandUsage('resume');
    try {
      const queue = getQueue(message.guild.id);
      if (queue.player && queue.isPaused) {
        queue.player.unpause();
        queue.isPaused = false;
        
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('▶️ Đã tiếp tục phát')
          .setDescription('Nhạc đã được tiếp tục phát.')
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
      } else {
        sendErrorEmbed(channel, 'Bài hát không ở trạng thái tạm dừng!');
      }
    } catch (error) {
      console.error('Resume command error:', error);
      sendErrorEmbed(channel, 'Có lỗi khi tiếp tục phát nhạc!');
    }
  }

  // ==================== LỆNH DM (ADMIN ONLY) ====================
  if (command === 'dms') {
    trackCommandUsage('dms');
    if (!isAdmin(message.member)) {
      return sendErrorEmbed(channel, 'Bạn không có quyền sử dụng lệnh này!');
    }

    try {
      const dmMessages = getDmMessages();
      const recentMessages = dmMessages.slice(-10).reverse();

      if (recentMessages.length === 0) {
        return sendErrorEmbed(channel, 'Chưa có tin nhắn DM nào!');
      }

      const embed = new EmbedBuilder()
        .setColor(0x7289DA)
        .setTitle('📨 Tin nhắn DM gần đây')
        .setDescription(`Tổng số tin nhắn: ${dmMessages.length}`)
        .setFooter({ text: 'Hiển thị 10 tin nhắn gần nhất' })
        .setTimestamp();

      recentMessages.forEach((msg, index) => {
        const time = new Date(msg.timestamp).toLocaleString('vi-VN');
        const content = msg.content.length > 100 
          ? msg.content.substring(0, 100) + '...' 
          : msg.content;
        
        embed.addFields({
          name: `#${index + 1} ${msg.author.tag} - ${time}`,
          value: `📝 ${content || '*Không có nội dung*'}`,
          inline: false
        });
      });

      await channel.send({ embeds: [embed] });

    } catch (error) {
      console.error(error);
      sendErrorEmbed(channel, `Lỗi khi hiển thị tin nhắn DM: ${error.message}`);
    }
  }

  if (command === 'setdmlog') {
    trackCommandUsage('setdmlog');
    if (!isAdmin(message.member)) {
      return sendErrorEmbed(channel, 'Bạn không có quyền sử dụng lệnh này!');
    }

    const logChannel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    if (!logChannel) {
      return sendErrorEmbed(channel, 'Vui lòng đề cập đến kênh log hợp lệ!');
    }

    const config = getBotConfig();
    config.dmLogChannel = logChannel.id;
    setBotConfig(config);

    await sendSuccessEmbed(channel, `Đã đặt kênh log DM: ${logChannel}`);
  }

  if (command === 'autoreply') {
    trackCommandUsage('autoreply');
    if (!isAdmin(message.member)) {
      return sendErrorEmbed(channel, 'Bạn không có quyền sử dụng lệnh này!');
    }

    const config = getBotConfig();
    config.autoReply = !config.autoReply;
    setBotConfig(config);

    const status = config.autoReply ? 'BẬT' : 'TẮT';
    const color = config.autoReply ? 0x00FF00 : 0xFF0000;
    
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('⚙️ Tự động phản hồi DM')
      .setDescription(`Đã ${config.autoReply ? 'BẬT' : 'TẮT'} tính năng tự động phản hồi tin nhắn DM.`)
      .addFields(
        { name: '📊 Trạng thái hiện tại', value: status, inline: true }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);