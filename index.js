/**
 * @Author: Your name
 * @Date:   2025-09-29 18:55:36
 * @Last Modified by:   Your name
 * @Last Modified time: 2025-10-01 19:28:52
 */
require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const PREFIX = '$';
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Đường dẫn file
const messagePath = path.join(__dirname, 'message.json');
const schedulePath = path.join(__dirname, 'schedule.json');
const dailyPath = path.join(__dirname, 'dailyMessages.json');

// Hàm đọc và ghi file
function getMessageContent() {
  return JSON.parse(fs.readFileSync(messagePath)).content;
}
function setMessageContent(newContent) {
  fs.writeFileSync(messagePath, JSON.stringify({ content: newContent }, null, 2));
}
function getSchedule() {
  return JSON.parse(fs.readFileSync(schedulePath)).cron;
}
function setSchedule(newCron) {
  fs.writeFileSync(schedulePath, JSON.stringify({ cron: newCron }, null, 2));
}
function getDailyMessage(key) {
  return JSON.parse(fs.readFileSync(dailyPath))[key];
}
function setDailyMessage(key, content) {
  const data = JSON.parse(fs.readFileSync(dailyPath));
  data[key] = content;
  fs.writeFileSync(dailyPath, JSON.stringify(data, null, 2));
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
      channel.send(message);
    }
  });
}

// Gửi tin nhắn tự động theo khung giờ
client.once('ready', () => {
  console.log(`✅ Bot đã đăng nhập với tên ${client.user.tag}`);
  const channel = client.channels.cache.get(process.env.CHANNEL_ID);
  if (!channel) return console.log('❌ Không tìm thấy kênh.');

  cron.schedule('0 8 * * *', () => channel.send(getDailyMessage('morning')));
  cron.schedule('0 12 * * *', () => channel.send(getDailyMessage('noon')));
  cron.schedule('0 16 * * *', () => channel.send(getDailyMessage('afternoon')));
  cron.schedule('0 20 * * *', () => channel.send(getDailyMessage('evening')));
  cron.schedule('0 23 * * *', () => channel.send(getDailyMessage('night')));
});

client.on('ready', startScheduledMessage);

// Bộ đếm thống kê
let messageCount = {};

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  const content = message.content.toLowerCase();
  const args = message.content.split(' ');
  const channel = message.channel;
  const userId = message.author.id;
  messageCount[userId] = (messageCount[userId] || 0) + 1;

  // Tự động phản hồi
  if (content.includes('hello') || content.includes('bot ơi')) {
    return channel.send('👋 Xin chào! Có gì mình giúp bạn không?');
  }

  // Lệnh quản lý tin nhắn định kỳ
  if (content.startsWith(`${PREFIX}setmessage`)) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
    const newContent = message.content.replace(`${PREFIX}setmessage`, '').trim();
    if (!newContent) return channel.send('⚠️ Vui lòng nhập nội dung mới.');
    setMessageContent(newContent);
    return channel.send(`✅ Đã cập nhật nội dung:\n> ${newContent}`);
  }

  if (content.startsWith(`${PREFIX}setschedule`)) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
    const newCron = message.content.replace(`${PREFIX}setschedule`, '').trim();
    try {
      cron.validate(newCron);
      setSchedule(newCron);
      startScheduledMessage();
      return channel.send(`✅ Đã cập nhật thời gian gửi tin nhắn: \`${newCron}\``);
    } catch {
      return channel.send('❌ Biểu thức cron không hợp lệ.');
    }
  }

  if (content === `${PREFIX}getmessage`) {
    return channel.send(`📩 Nội dung hiện tại:\n> ${getMessageContent()}`);
  }

  if (content === `${PREFIX}getschedule`) {
    return channel.send(`⏰ Thời gian gửi hiện tại: \`${getSchedule()}\``);
  }

  // Chỉnh nội dung theo khung giờ
  const timeKeys = ['morning', 'noon', 'afternoon', 'evening', 'night'];
  for (const key of timeKeys) {
    if (content.startsWith(`${PREFIX}set${key}`)) {
      const newText = message.content.replace(`${PREFIX}set${key}`, '').trim();
      setDailyMessage(key, newText);
      return channel.send(`✅ Đã cập nhật nội dung ${key}:\n> ${newText}`);
    }
  }

  // Tạo voice channel
  if (content === `${PREFIX}createvoice`) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
    const vc = await message.guild.channels.create({ name: '🔊 Voice Room', type: 2 });
    return channel.send(`✅ Đã tạo voice channel: ${vc.name}`);
  }

  // Phát nhạc
  if (content.startsWith(`${PREFIX}play`)) {
    const url = args[1];
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return channel.send('⚠️ Vào voice channel trước nhé!');
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });
    const stream = ytdl(url, { filter: 'audioonly' });
    const resource = createAudioResource(stream);
    const player = createAudioPlayer();
    connection.subscribe(player);
    player.play(resource);
    return channel.send('🎶 Đang phát nhạc!');
  }

  // Quản lý role
  if (content.startsWith(`${PREFIX}addrole`)) {
    const roleName = args[1];
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      await message.member.roles.add(role);
      return channel.send(`✅ Đã thêm role ${role.name}`);
    } else {
      return channel.send(`❌ Không tìm thấy role ${roleName}`);
    }
  }

  if (content.startsWith(`${PREFIX}removerole`)) {
    const roleName = args[1];
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      await message.member.roles.remove(role);
      return channel.send(`✅ Đã xóa role ${role.name}`);
    } else {
      return channel.send(`❌ Không tìm thấy role ${roleName}`);
    }
  }

  // Xem danh sách thành viên
  if (content === `${PREFIX}members`) {
    const members = await message.guild.members.fetch();
    const names = members.map(m => m.user.username).join(', ');
    return channel.send(`👥 Thành viên trong server:\n${names}`);
  }

  // Bình chọn
  if (content.startsWith(`${PREFIX}poll`)) {
    const matches = message.content.match(/"([^"]+)"/g);
    if (!matches || matches.length < 2) return channel.send('❌ Cần ít nhất 1 câu hỏi và 1 lựa chọn.');
    const question = matches[0].replace(/"/g, '');
    const options = matches.slice(1).map(opt => opt.replace(/"/g, ''));
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
    let pollText = `📊 **${question}**\n`;
    options.forEach((opt, i) => pollText += `${emojis[i]} ${opt}\n`);
    const pollMsg = await channel.send(pollText);
    options.forEach((_, i) => pollMsg.react(emojis[i]));
  }

  // Nhắc lịch
  if (content.startsWith(`${PREFIX}remindme`)) {
    const minutes = parseInt(args[1], 10);
    const reminder = args.slice(2).join(' ').trim();
    if (isNaN(minutes) || minutes <= 0) {
      return channel.send('❌ Số phút không hợp lệ.');
    }
    await channel.send(`⏰ Bot sẽ nhắc bạn sau ${minutes} phút.`);
    setTimeout(() => {
      channel.send(`🔔 Nhắc bạn: ${reminder || 'Đến giờ rồi!'}`);
    }, minutes * 60000);
    return;
  }
  
    // Mini game đoán số
    if (content.startsWith(`${PREFIX}guess`)) {
      const guess = parseInt(args[1]);
      const number = Math.floor(Math.random() * 10) + 1;
      if (guess === number) {
        channel.send(`🎉 Chính xác! Số là ${number}`);
      } else {
        channel.send(`😅 Sai rồi! Số đúng là ${number}`);
      }
    }
  
    // Thống kê hoạt động
    if (content === `${PREFIX}stats`) {
      const sorted = Object.entries(messageCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => `<@${id}>: ${count} tin nhắn`);
      channel.send(`📊 Top hoạt động:\n${sorted.join('\n')}`);
    }
  
    // Hiển thị menu lệnh
    if (content === `${PREFIX}help`) {
      channel.send(`
  📘 **Danh sách lệnh bot LeiLaBOT**
  
  ✅ Tin nhắn định kỳ:
  • .setmessage <nội dung>
  • .setschedule <cron>
  • .getmessage / .getschedule
  
  ⏰ Tin nhắn tự động theo khung giờ:
  • .setmorning / .setnoon / .setafternoon / .setevening / .setnight
  
  🔊 Voice & nhạc:
  • .createvoice
  • .play <YouTube URL>
  
  🧑‍🤝‍🧑 Role & thành viên:
  • .addrole <tên role>
  • .removerole <tên role>
  • .members
  
  🗳️ Bình chọn:
  • .poll "Câu hỏi?" "Lựa chọn 1" "Lựa chọn 2"
  
  📅 Nhắc lịch:
  • .remindme <phút> <nội dung>
  
  🎲 Mini game:
  • .guess <số từ 1-10>
  
  📈 Thống kê:
  • .stats
  
  💬 Phản hồi tự động:
  • Gõ "hello" hoặc "bot ơi"
  
  🆘 Trợ giúp:
  • .help – Hiển thị menu này
      `);
    }
  });
  
  client.login(process.env.DISCORD_TOKEN);
  