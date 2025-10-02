/**
 * @Author: Your name
 * @Date:   2025-09-29 18:55:36
 * @Last Modified by:   Your name
 * @Last Modified time: 2025-10-03 01:13:06
 */
require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, Collection } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const yts = require('yt-search');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const translate = require('@vitalets/google-translate-api');

const PREFIX = '$';
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

// Đường dẫn file
const messagePath = path.join(__dirname, 'message.json');
const schedulePath = path.join(__dirname, 'schedule.json');
const dailyPath = path.join(__dirname, 'dailyMessages.json');
const birthdayPath = path.join(__dirname, 'birthdays.json');
const eventPath = path.join(__dirname, 'events.json');

// Khởi tạo file nếu chưa tồn tại
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
    { path: eventPath, default: [] }
  ];

  files.forEach(file => {
    if (!fs.existsSync(file.path)) {
      fs.writeFileSync(file.path, JSON.stringify(file.default, null, 2));
    }
  });
}

// Hàm đọc và ghi file
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

// Khởi tạo files khi bot start
initializeFiles();

// Gửi tin nhắn tự động theo khung giờ
client.once('ready', () => {
  console.log(`✅ Bot đã đăng nhập với tên ${client.user.tag}`);
  console.log(`📊 Đang quản lý ${client.guilds.cache.size} server`);
  
  const channel = client.channels.cache.get(process.env.CHANNEL_ID);
  if (!channel) return console.log('❌ Không tìm thấy kênh.');

  // Tin nhắn tự động theo giờ với Embed
  cron.schedule('0 8 * * *', () => {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🌅 Chào buổi sáng')
      .setDescription(getDailyMessage('morning'))
      .setTimestamp();
    channel.send({ embeds: [embed] });
  });
  
  cron.schedule('0 12 * * *', () => {
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('☀️ Buổi trưa')
      .setDescription(getDailyMessage('noon'))
      .setTimestamp();
    channel.send({ embeds: [embed] });
  });
  
  cron.schedule('0 16 * * *', () => {
    const embed = new EmbedBuilder()
      .setColor(0x87CEEB)
      .setTitle('🌇 Buổi chiều')
      .setDescription(getDailyMessage('afternoon'))
      .setTimestamp();
    channel.send({ embeds: [embed] });
  });
  
  cron.schedule('0 20 * * *', () => {
    const embed = new EmbedBuilder()
      .setColor(0x4B0082)
      .setTitle('🌃 Buổi tối')
      .setDescription(getDailyMessage('evening'))
      .setTimestamp();
    channel.send({ embeds: [embed] });
  });
  
  cron.schedule('0 23 * * *', () => {
    const embed = new EmbedBuilder()
      .setColor(0x191970)
      .setTitle('🌙 Buổi đêm')
      .setDescription(getDailyMessage('night'))
      .setTimestamp();
    channel.send({ embeds: [embed] });
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

// Bộ đếm thống kê
let messageCount = {};
let userJoinTimes = {};

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

  // Lệnh help với Embed đẹp
  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📘 Danh sách lệnh - LeiLaBOT')
      .setDescription(`Prefix: \`${PREFIX}\``)
      .addFields(
        { name: '✅ Tin nhắn định kỳ', value: '`setmessage <nội dung>`\n`setschedule <cron>`\n`getmessage`\n`getschedule`', inline: true },
        { name: '⏰ Tin nhắn tự động', value: '`setmorning/noon/afternoon/evening/night <nội dung>`', inline: true },
        { name: '🔊 Voice & nhạc', value: '`createvoice`\n`play <URL/tên>`\n`stop`\n`pause`\n`resume`', inline: true },
        { name: '🧑‍🤝‍🧑 Thành viên & Role', value: '`members`\n`addrole <tên>`\n`removerole <tên>`\n`userinfo [@user]`', inline: true },
        { name: '🗳️ Tiện ích', value: '`poll "câu hỏi" "lựa chọn"`\n`remindme <phút> <nội dung>`\n`translate <văn bản>`', inline: true },
        { name: '🎲 Mini game', value: '`guess <số 1-10>`\n`quiz`\n`lottery`', inline: true },
        { name: '📈 Thống kê', value: '`stats`\n`serverinfo`', inline: true },
        { name: '🎉 Sinh nhật & Sự kiện', value: '`setbirthday <dd/mm>`\n`addevent <dd/mm> <nội dung>`', inline: true },
        { name: '🛠️ Quản lý', value: '`clear <số>`\n`slowmode <giây>`', inline: true }
      )
      .setFooter({ text: `LeiLaBOT • ${new Date().getFullYear()}`, iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    return channel.send({ embeds: [embed] });
  }

  // Lệnh quản lý tin nhắn định kỳ với Embed
  if (command === 'setmessage') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
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
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
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
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📩 Nội dung tin nhắn định kỳ')
      .setDescription(getMessageContent())
      .setTimestamp();
    return channel.send({ embeds: [embed] });
  }

  if (command === 'getschedule') {
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
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
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

  // Hệ thống phát nhạc nâng cấp
  if (command === 'play') {
    const query = args.join(' ');
    if (!query) return sendErrorEmbed(channel, 'Vui lòng cung cấp URL hoặc tên bài hát!');
    
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return sendErrorEmbed(channel, 'Bạn cần tham gia voice channel trước!');

    try {
      let url = query;
      
      // Nếu không phải URL, tìm kiếm trên YouTube
      if (!ytdl.validateURL(query)) {
        const searchResult = await yts(query);
        if (!searchResult.videos.length) {
          return sendErrorEmbed(channel, 'Không tìm thấy bài hát!');
        }
        url = searchResult.videos[0].url;
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
        .setDescription(`Đang phát: ${url}`)
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
    const player = client.audioPlayers.get(message.guild.id);
    if (player && player.state.status === 'playing') {
      player.pause();
      sendSuccessEmbed(channel, '⏸️ Đã tạm dừng');
    } else {
      sendErrorEmbed(channel, 'Không có bài hát nào đang phát!');
    }
  }

  if (command === 'resume') {
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

  // Xem danh sách thành viên (đã được nâng cấp)
  if (command === 'members') {
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