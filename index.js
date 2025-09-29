/**
 * @Author: Your name
 * @Date:   2025-09-29 18:55:36
 * @Last Modified by:   Your name
 * @Last Modified time: 2025-09-29 19:04:16
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

client.login(process.env.DISCORD_TOKEN);
