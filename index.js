/**
 * @Author: Your name
 * @Date:   2025-09-29 18:55:36
 * @Last Modified by:   Your name
 * @Last Modified time: 2025-10-01 18:59:14
 */
require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

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

// ✅ Xem trạng thái bot
client.once('ready', () => {
  console.log(`✅ Bot đã đăng nhập với tên ${client.user.tag}`);
});

// ⚙️ Cấu hình thời gian gửi tin nhắn
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
client.on('ready', startScheduledMessage);

// ✏️ Chỉnh sửa tin nhắn định kỳ & thời gian
client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;

  if (message.content.startsWith('!setmessage')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ Bạn không có quyền chỉnh sửa tin nhắn.');
    }
    const newContent = message.content.replace('!setmessage', '').trim();
    if (!newContent) return message.reply('⚠️ Vui lòng nhập nội dung mới.');
    setMessageContent(newContent);
    message.reply(`✅ Đã cập nhật nội dung:\n> ${newContent}`);
  }

  if (message.content.startsWith('!setschedule')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ Bạn không có quyền chỉnh sửa thời gian.');
    }
    const newCron = message.content.replace('!setschedule', '').trim();
    try {
      cron.validate(newCron);
      setSchedule(newCron);
      startScheduledMessage();
      message.reply(`✅ Đã cập nhật thời gian gửi tin nhắn: \`${newCron}\``);
    } catch {
      message.reply('❌ Biểu thức cron không hợp lệ.');
    }
  }

  if (message.content === '!getmessage') {
    message.reply(`📩 Nội dung hiện tại:\n> ${getMessageContent()}`);
  }

  if (message.content === '!getschedule') {
    message.reply(`⏰ Thời gian gửi hiện tại: \`${getSchedule()}\``);
  }
});

// 🔊 Quản lý voice channel
client.on('messageCreate', async message => {
  if (message.content === '!createvoice') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ Bạn không có quyền tạo phòng voice.');
    }
    const channel = await message.guild.channels.create({
      name: '🔊 Voice Room',
      type: 2,
    });
    message.reply(`✅ Đã tạo voice channel: ${channel.name}`);
  }
});

// 🎵 Phát nhạc từ URL
client.on('messageCreate', async message => {
  if (message.content.startsWith('!play')) {
    const url = message.content.split(' ')[1];
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply('⚠️ Vào voice channel trước nhé!');
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
    message.reply('🎶 Đang phát nhạc!');
  }
});

// 🧑‍🤝‍🧑 Quản lý role
client.on('messageCreate', async message => {
  if (message.content.startsWith('!addrole')) {
    const roleName = message.content.split(' ')[1];
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      await message.member.roles.add(role);
      message.reply(`✅ Đã thêm role ${role.name}`);
    } else {
      message.reply(`❌ Không tìm thấy role ${roleName}`);
    }
  }

  if (message.content.startsWith('!removerole')) {
    const roleName = message.content.split(' ')[1];
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      await message.member.roles.remove(role);
      message.reply(`✅ Đã xóa role ${role.name}`);
    } else {
      message.reply(`❌ Không tìm thấy role ${roleName}`);
    }
  }
});

// 📋 Xem danh sách thành viên
client.on('messageCreate', async message => {
  if (message.content === '!members') {
    const members = await message.guild.members.fetch();
    const names = members.map(m => m.user.username).join(', ');
    message.reply(`👥 Thành viên trong server:\n${names}`);
  }
});

const dailyPath = path.join(__dirname, 'dailyMessages.json');
function getDailyMessage(key) {
  return JSON.parse(fs.readFileSync(dailyPath))[key];
}
function setDailyMessage(key, content) {
  const data = JSON.parse(fs.readFileSync(dailyPath));
  data[key] = content;
  fs.writeFileSync(dailyPath, JSON.stringify(data, null, 2));
}
if (message.content.startsWith('!setmorning')) {
  const content = message.content.replace('!setmorning', '').trim();
  setDailyMessage('morning', content);
  message.reply(`✅ Đã cập nhật nội dung buổi sáng:\n> ${content}`);
}
// Tương tự cho !setnoon, !setafternoon, !setevening, !setnight
cron.schedule('0 8 * * *', () => channel.send(getDailyMessage('morning')));
cron.schedule('0 12 * * *', () => channel.send(getDailyMessage('noon')));
cron.schedule('0 16 * * *', () => channel.send(getDailyMessage('afternoon')));
cron.schedule('0 20 * * *', () => channel.send(getDailyMessage('evening')));
cron.schedule('0 23 * * *', () => channel.send(getDailyMessage('night')));
if (message.content === '!help') {
  message.reply(`
📘 **Danh sách lệnh bot LeiLaBOT**

✅ Tin nhắn định kỳ:
• !setmorning <nội dung>
• !setnoon <nội dung>
• !setafternoon <nội dung>
• !setevening <nội dung>
• !setnight <nội dung>

🗳️ Bình chọn:
• !poll "Câu hỏi?" "Lựa chọn 1" "Lựa chọn 2"

📅 Nhắc lịch:
• !remindme <số phút> <nội dung>

🎲 Mini game:
• !guess <số từ 1-10>

📈 Thống kê:
• !stats

💬 Tự động phản hồi:
• Gõ "hello" hoặc "bot ơi" để bot phản hồi

🆘 Trợ giúp:
• !help – Hiển thị menu này
  `);
}
if (message.content.startsWith('!poll')) {
  const args = message.content.match(/"([^"]+)"/g);
  if (!args || args.length < 2) return message.reply('❌ Cần ít nhất 1 câu hỏi và 1 lựa chọn.');
  const question = args[0].replace(/"/g, '');
  const options = args.slice(1).map(opt => opt.replace(/"/g, ''));
  let pollText = `📊 **${question}**\n`;
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
  options.forEach((opt, i) => pollText += `${emojis[i]} ${opt}\n`);
  message.channel.send(pollText).then(msg => {
    options.forEach((_, i) => msg.react(emojis[i]));
  });
}
if (message.content.startsWith('!remindme')) {
  const [_, minutes, ...text] = message.content.split(' ');
  const delay = parseInt(minutes) * 60000;
  if (isNaN(delay)) return message.reply('❌ Số phút không hợp lệ.');
  message.reply(`⏰ Bot sẽ nhắc bạn sau ${minutes} phút.`);
  setTimeout(() => {
    message.reply(`🔔 Nhắc bạn: ${text.join(' ')}`);
  }, delay);
}
if (message.content.startsWith('!guess')) {
  const guess = parseInt(message.content.split(' ')[1]);
  const number = Math.floor(Math.random() * 10) + 1;
  if (guess === number) {
    message.reply(`🎉 Chính xác! Số là ${number}`);
  } else {
    message.reply(`😅 Sai rồi! Số đúng là ${number}`);
  }
}
let messageCount = {};

client.on('messageCreate', message => {
  if (!message.guild || message.author.bot) return;
  const userId = message.author.id;
  messageCount[userId] = (messageCount[userId] || 0) + 1;

  if (message.content === '!stats') {
    const sorted = Object.entries(messageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => `<@${id}>: ${count} tin nhắn`);
    message.reply(`📊 Top hoạt động:\n${sorted.join('\n')}`);
  }
});
client.on('messageCreate', message => {
  if (message.author.bot) return;
  const content = message.content.toLowerCase();
  if (content.includes('hello') || content.includes('bot ơi')) {
    message.reply('👋 Xin chào! Có gì mình giúp bạn không?');
  }
});

client.login(process.env.DISCORD_TOKEN);
