const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('./config');
const db = require('./database');
const { setup } = require('./commands');
const { deleteTemp, transferOwner, logEvent } = require('./voice');

function getTemp(i) { return db.getTemp(i.channelId); }
function isModerator(i) { return Boolean(i.member?.permissions?.has(PermissionFlagsBits.ManageChannels)); }
function canManage(i, temp) { return Boolean(temp && (temp.owner_id === i.user.id || isModerator(i))); }
function ownerOnly(i, temp) { return Boolean(temp && temp.owner_id === i.user.id); }

function panel() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cv:rename').setLabel('Rename').setEmoji(config.emojis.rename).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cv:limit').setLabel('Limit').setEmoji(config.emojis.limit).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cv:lock').setLabel('Lock').setEmoji(config.emojis.lock).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cv:hide').setLabel('Hide').setEmoji(config.emojis.hide).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cv:claim').setLabel('Claim').setEmoji(config.emojis.claim).setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cv:unlock').setLabel('Unlock').setEmoji(config.emojis.unlock).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('cv:show').setLabel('Show').setEmoji(config.emojis.show).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('cv:invite').setLabel('Invite').setEmoji(config.emojis.invite).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('cv:disconnect').setLabel('Disconnect').setEmoji(config.emojis.disconnect).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cv:info').setLabel('Info').setEmoji(config.emojis.info).setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cv:transfer').setLabel('Transfer').setEmoji(config.emojis.transfer).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('cv:delete').setLabel('Delete').setEmoji(config.emojis.delete).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cv:bitrate').setLabel('Bitrate').setEmoji(config.emojis.bitrate).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cv:region').setLabel('Region').setEmoji(config.emojis.region).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cv:text').setLabel('Text').setEmoji(config.emojis.text).setStyle(ButtonStyle.Secondary)
    )
  ];
}

async function reply(i, content, ephemeral = true) {
  if (i.deferred || i.replied) return i.editReply({ content });
  return i.reply({ content, ephemeral });
}

function roomInfo(channel, temp) {
  return `Room: ${channel}\nOwner: <@${temp.owner_id}>\nMembers: ${channel.members.size}\nLimit: ${channel.userLimit || 'Unlimited'}\nBitrate: ${Math.round(channel.bitrate / 1000)} kbps\nRegion: ${channel.rtcRegion || 'Auto'}\nText: ${temp.text_channel_id ? `<#${temp.text_channel_id}>` : 'Disabled'}`;
}

async function ensureTextChannel(i, temp) {
  if (temp.text_channel_id) return i.guild.channels.cache.get(temp.text_channel_id) || null;
  const category = i.channel.parent;
  if (!category) return null;
  const text = await i.guild.channels.create({
    name: `text-${i.user.username}`.slice(0, 100), type: ChannelType.GuildText, parent: category.id,
    reason: 'Cukur Voice private room text',
    permissionOverwrites: [
      { id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: temp.owner_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
    ]
  });
  for (const p of db.listPermissions(i.channelId).filter(x => x.type === 'permit')) {
    await text.permissionOverwrites.edit(p.user_id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
  }
  db.setTempText(i.channelId, text.id);
  return text;
}

async function handleConfig(i) {
  if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) return reply(i, 'You need Manage Server to change Cukur Voice settings.');
  const sub = i.options.getSubcommand();
  const value = {};
  if (sub === 'logs') value.log_channel_id = i.options.getChannel('channel').id;
  if (sub === 'text') value.text_enabled = i.options.getBoolean('enabled') ? 1 : 0;
  if (sub === 'waiting-room') value.waiting_room_id = i.options.getChannel('channel').id;
  if (sub === 'voice-role') value.voice_role_id = i.options.getRole('role').id;
  if (sub === 'template') value.room_template = i.options.getString('value');
  if (sub === 'limit') value.default_limit = i.options.getInteger('amount');
  if (sub === 'bitrate') value.default_bitrate = i.options.getInteger('kbps') * 1000;
  if (sub === 'region') {
    const region = i.options.getString('value').trim().toLowerCase();
    value.default_region = region === 'auto' ? null : region;
  }
  db.upsertGuild(i.guildId, value);
  await logEvent(i.guild, 'Configuration updated', `${i.user} changed Cukur Voice setting: ${sub}.`);
  return reply(i, `Cukur Voice setting updated: ${sub}.`);
}

async function handleVoiceCommand(i) {
  const sub = i.options.getSubcommand();
  let temp = getTemp(i);
  if (sub === 'claim') {
    if (!temp) return reply(i, 'You must be inside a Cukur Voice room.');
    if (temp.owner_id === i.user.id) return reply(i, 'You already own this room.');
    if (temp.owner_id && i.channel.members.has(temp.owner_id)) return reply(i, 'This room already has an active owner.');
    await transferOwner(i.channel, temp.owner_id, i.member);
    return reply(i, 'You are now the room owner.');
  }
  if (!temp) return reply(i, 'You must be inside a Cukur Voice room.');
  if (!canManage(i, temp)) return reply(i, 'Only the room owner or a member with Manage Channels can use this control.');

  const channel = i.channel;
  switch (sub) {
    case 'rename': await channel.setName(i.options.getString('name'), 'Cukur Voice rename'); break;
    case 'limit': await channel.setUserLimit(i.options.getInteger('amount')); break;
    case 'lock': await channel.permissionOverwrites.edit(i.guild.roles.everyone, { Connect: false }); break;
    case 'unlock': await channel.permissionOverwrites.edit(i.guild.roles.everyone, { Connect: true }); break;
    case 'hide': await channel.permissionOverwrites.edit(i.guild.roles.everyone, { ViewChannel: false }); break;
    case 'show': await channel.permissionOverwrites.edit(i.guild.roles.everyone, { ViewChannel: true }); break;
    case 'transfer': {
      if (!ownerOnly(i, temp)) return reply(i, 'Only the current owner can transfer ownership.');
      const user = i.options.getUser('user');
      const member = await i.guild.members.fetch(user.id);
      if (!channel.members.has(member.id)) return reply(i, 'The new owner must be inside the room.');
      await transferOwner(channel, i.user.id, member); break;
    }
    case 'permit': {
      const user = i.options.getUser('user');
      await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, Connect: true });
      db.addPermission(channel.id, user.id, 'permit');
      if (temp.text_channel_id) await i.guild.channels.cache.get(temp.text_channel_id)?.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
      return reply(i, `Allowed ${user}.`);
    }
    case 'reject': {
      const user = i.options.getUser('user');
      await channel.permissionOverwrites.edit(user.id, { ViewChannel: false, Connect: false });
      db.addPermission(channel.id, user.id, 'reject');
      if (temp.text_channel_id) await i.guild.channels.cache.get(temp.text_channel_id)?.permissionOverwrites.delete(user.id).catch(() => {});
      const member = channel.members.get(user.id); if (member) await member.voice.disconnect('Rejected by room owner').catch(() => {});
      return reply(i, `Blocked ${user}.`);
    }
    case 'kick': {
      const user = i.options.getUser('user'); const member = channel.members.get(user.id);
      if (!member) return reply(i, 'That member is not in your room.');
      await member.voice.disconnect('Disconnected by room owner'); return reply(i, `Disconnected ${user}.`);
    }
    case 'disconnect':
      for (const [, member] of channel.members.filter(m => m.id !== i.user.id)) await member.voice.disconnect('Disconnected by room owner').catch(() => {});
      break;
    case 'bitrate': {
      const kbps = i.options.getInteger('kbps');
      const max = Math.floor((i.guild.maximumBitrate || 64000) / 1000);
      if (kbps * 1000 > (i.guild.maximumBitrate || 64000)) return reply(i, `This server allows up to ${max} kbps.`);
      await channel.setBitrate(kbps * 1000, 'Cukur Voice bitrate'); break;
    }
    case 'region': {
      const value = i.options.getString('value').trim().toLowerCase();
      await channel.setRTCRegion(value === 'auto' ? null : value, 'Cukur Voice region'); break;
    }
    case 'text': {
      if (!ownerOnly(i, temp)) return reply(i, 'Only the room owner can toggle the room text channel.');
      const enabled = i.options.getBoolean('enabled');
      if (enabled) { const text = await ensureTextChannel(i, temp); if (!text) return reply(i, 'I could not create the private text channel.'); }
      else if (temp.text_channel_id) { const text = i.guild.channels.cache.get(temp.text_channel_id); if (text) await text.delete('Cukur Voice text disabled').catch(() => {}); db.setTempText(channel.id, null); }
      break;
    }
    case 'delete':
      if (!ownerOnly(i, temp) && !isModerator(i)) return reply(i, 'Only the room owner or a moderator can delete this room.');
      await deleteTemp(channel, `Deleted by ${i.user.tag}`); return reply(i, 'Temporary room deleted.');
    case 'info': return reply(i, roomInfo(channel, temp));
  }
  await logEvent(i.guild, 'Room updated', `${i.user} used /voice ${sub} in ${channel}.`);
  return reply(i, `Room ${sub} applied.`);
}

async function handleButton(i) {
  const action = i.customId.slice(3);
  const temp = getTemp(i);
  if (action === 'claim') {
    if (!temp) return reply(i, 'You must be inside a Cukur Voice room.');
    if (temp.owner_id && i.channel.members.has(temp.owner_id)) return reply(i, 'This room already has an active owner.');
    await transferOwner(i.channel, temp.owner_id, i.member); return reply(i, 'You are now the room owner.');
  }
  if (!temp) return reply(i, 'You must be inside a Cukur Voice room.');
  if (!canManage(i, temp)) return reply(i, 'Only the room owner or a member with Manage Channels can use these controls.');
  if (action === 'rename' || action === 'limit' || action === 'bitrate' || action === 'region') return require('./modals').open(i, action);
  if (action === 'invite') return reply(i, 'Use `/voice permit @user` while you are in the room.');
  if (action === 'info') return reply(i, roomInfo(i.channel, temp));
  if (action === 'delete') { if (!ownerOnly(i,temp) && !isModerator(i)) return reply(i,'Only the owner or moderator can delete this room.'); await deleteTemp(i.channel, `Deleted by ${i.user.tag}`); return reply(i, 'Temporary room deleted.'); }
  if (action === 'transfer') return reply(i, 'Use `/voice transfer @user` to choose the new owner.');
  if (action === 'text') return reply(i, 'Use `/voice text enabled:true` or `enabled:false` to toggle the private text channel.');
  if (action === 'disconnect') {
    for (const [, member] of i.channel.members.filter(m => m.id !== i.user.id)) await member.voice.disconnect('Disconnected by room owner').catch(() => {});
    return reply(i, 'Disconnected everyone else from the room.');
  }
  const actions = {
    lock: () => i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { Connect: false }),
    unlock: () => i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { Connect: true }),
    hide: () => i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { ViewChannel: false }),
    show: () => i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { ViewChannel: true })
  };
  if (actions[action]) { await actions[action](); await logEvent(i.guild,'Room updated',`${i.user} used the ${action} control in ${i.channel}.`); return reply(i, `Room ${action} applied.`); }
}

async function handleModal(i) {
  const action = i.customId.slice('cvmodal:'.length);
  const temp = getTemp(i);
  if (!temp || !canManage(i, temp)) return reply(i, 'Only the room owner or a moderator can use this control.');
  const value = i.fields.getTextInputValue('value').trim();
  if (action === 'rename') { if (!value) return reply(i,'Channel name cannot be empty.'); await i.channel.setName(value,'Cukur Voice rename'); return reply(i,'Room renamed.'); }
  if (action === 'limit') { const limit=Number(value); if(!Number.isInteger(limit)||limit<0||limit>99) return reply(i,'Limit must be a whole number from 0 to 99.'); await i.channel.setUserLimit(limit); return reply(i,'User limit updated.'); }
  if (action === 'bitrate') { const kbps=Number(value); const max=Math.floor((i.guild.maximumBitrate||64000)/1000); if(!Number.isInteger(kbps)||kbps<8||kbps>384||kbps>max) return reply(i,`Bitrate must be 8-${max} kbps on this server.`); await i.channel.setBitrate(kbps*1000,'Cukur Voice bitrate'); return reply(i,'Bitrate updated.'); }
  if (action === 'region') { const region=value.toLowerCase(); await i.channel.setRTCRegion(region==='auto'?null:region,'Cukur Voice region'); return reply(i,'Voice region updated.'); }
}

async function handleInteraction(i) {
  if (i.isChatInputCommand()) {
    if (i.commandName === 'setup') { await i.deferReply({ephemeral:true}); const r=await setup(i.guild); return i.editReply(`Cukur Voice is ready. Generator: ${r.generator}. Waiting room: ${r.waiting}.`); }
    if (i.commandName === 'config') return handleConfig(i);
    if (i.commandName === 'interface') {
      const channel=i.options.getChannel('channel')||i.channel;
      if (!channel.isTextBased()) return reply(i,'Choose a text channel.');
      const embed=new EmbedBuilder().setTitle('Cukur Voice').setDescription('Manage your temporary voice room with the controls below. Owners and moderators can use the appropriate controls.').setTimestamp();
      await channel.send({embeds:[embed],components:panel()}); db.upsertGuild(i.guildId,{interface_channel_id:channel.id});
      return reply(i,`Control panel sent to ${channel}.`);
    }
    if (i.commandName === 'voice') return handleVoiceCommand(i);
  }
  if (i.isButton() && i.customId.startsWith('cv:')) return handleButton(i);
  if (i.isModalSubmit() && i.customId.startsWith('cvmodal:')) return handleModal(i);
}

module.exports = { handleInteraction, panel };
