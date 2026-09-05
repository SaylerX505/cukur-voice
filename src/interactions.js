const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config');
const db = require('./database');
const { setup } = require('./commands');

function ownerRoom(interaction) {
  const temp = db.getTemp(interaction.channelId);
  if (!temp || temp.owner_id !== interaction.user.id) return null;
  return temp;
}

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
    )
  ];
}

async function reply(interaction, content, ephemeral = true) {
  const payload = { content, ephemeral };
  if (interaction.deferred || interaction.replied) return interaction.editReply({ content });
  return interaction.reply(payload);
}

async function handleInteraction(interaction) {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      const result = await setup(interaction.guild);
      return interaction.editReply(`Cukur Voice is ready. Join ${result.generator} to create a temporary room.`);
    }
    if (interaction.commandName === 'interface') {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const embed = new EmbedBuilder().setTitle('Cukur Voice').setDescription('Use the controls below to manage your temporary voice room.').setColor(0x5865f2);
      await channel.send({ embeds: [embed], components: panel() });
      return reply(interaction, `Control panel sent to ${channel}.`);
    }
    if (interaction.commandName === 'voice') return handleVoiceCommand(interaction);
  }

  if (interaction.isButton() && interaction.customId.startsWith('cv:')) return handleButton(interaction);
  if (interaction.isModalSubmit() && interaction.customId.startsWith('cvmodal:')) return handleModal(interaction);
}

async function handleVoiceCommand(i) {
  const sub = i.options.getSubcommand();
  if (sub === 'claim') {
    const room = db.getTemp(i.channelId);
    if (!room) return reply(i, 'You must be inside a Cukur Voice room.');
    if (room.owner_id === i.user.id) return reply(i, 'You already own this room.');
    if (room.owner_id && i.channel.members.has(room.owner_id)) return reply(i, 'This room already has an active owner.');
    db.addTemp(i.channelId, i.guildId, i.user.id, room.generator_id);
    await i.channel.permissionOverwrites.edit(i.user.id, { ViewChannel: true, Connect: true, Speak: true, ManageChannels: true });
    return reply(i, 'You are now the room owner.');
  }
  const temp = ownerRoom(i);
  if (!temp) return reply(i, 'You must own a temporary voice room to use this command.');
  const channel = i.channel;
  switch (sub) {
    case 'rename': await channel.setName(i.options.getString('name'), 'Cukur Voice rename'); return reply(i, 'Room renamed.');
    case 'limit': await channel.setUserLimit(i.options.getInteger('amount')); return reply(i, 'User limit updated.');
    case 'lock': await channel.permissionOverwrites.edit(i.guild.roles.everyone, { Connect: false }); return reply(i, 'Room locked.');
    case 'unlock': await channel.permissionOverwrites.edit(i.guild.roles.everyone, { Connect: true }); return reply(i, 'Room unlocked.');
    case 'hide': await channel.permissionOverwrites.edit(i.guild.roles.everyone, { ViewChannel: false }); return reply(i, 'Room hidden.');
    case 'show': await channel.permissionOverwrites.edit(i.guild.roles.everyone, { ViewChannel: true }); return reply(i, 'Room visible.');
    case 'permit': { const u=i.options.getUser('user'); await channel.permissionOverwrites.edit(u.id,{ViewChannel:true,Connect:true}); db.addPermission(channel.id,u.id,'permit'); return reply(i, `Allowed ${u}.`); }
    case 'reject': { const u=i.options.getUser('user'); await channel.permissionOverwrites.edit(u.id,{ViewChannel:false,Connect:false}); db.addPermission(channel.id,u.id,'reject'); if(channel.members.has(u.id)) await channel.members.get(u.id).voice.disconnect('Rejected by room owner').catch(()=>{}); return reply(i, `Blocked ${u}.`); }
    case 'kick': { const u=i.options.getUser('user'); if(!channel.members.has(u.id)) return reply(i,'That member is not in your room.'); await channel.members.get(u.id).voice.disconnect('Disconnected by room owner'); return reply(i, `Disconnected ${u}.`); }
    case 'info': return reply(i, `Room: ${channel}\nOwner: <@${temp.owner_id}>\nMembers: ${channel.members.size}\nLimit: ${channel.userLimit || 'Unlimited'}`);
  }
}

async function handleButton(i) {
  const action = i.customId.slice(3);
  if (action === 'claim') {
    const room = db.getTemp(i.channelId);
    if (!room) return reply(i, 'You must be inside a Cukur Voice room.');
    if (room.owner_id && i.channel.members.has(room.owner_id)) return reply(i, 'This room already has an active owner.');
    db.addTemp(i.channelId, i.guildId, i.user.id, room.generator_id);
    await i.channel.permissionOverwrites.edit(i.user.id, { ViewChannel: true, Connect: true, Speak: true, ManageChannels: true });
    return reply(i, 'You are now the room owner.');
  }
  const temp = ownerRoom(i);
  if (!temp) return reply(i, 'Only the room owner can use these controls.');
  const channel = i.channel;
  if (action === 'rename' || action === 'limit') return require('./modals').open(i, action);
  if (action === 'invite') return reply(i, 'Use `/voice permit @user` while you are in the room.');
  if (action === 'info') return reply(i, `Room: ${channel}\nOwner: <@${temp.owner_id}>\nMembers: ${channel.members.size}\nLimit: ${channel.userLimit || 'Unlimited'}`);
  if (action === 'disconnect') {
    for (const [, member] of channel.members.filter(m => m.id !== i.user.id)) await member.voice.disconnect('Disconnected by room owner').catch(()=>{});
    return reply(i, 'Disconnected everyone else from the room.');
  }
  const actions = {
    lock: () => channel.permissionOverwrites.edit(i.guild.roles.everyone,{Connect:false}),
    unlock: () => channel.permissionOverwrites.edit(i.guild.roles.everyone,{Connect:true}),
    hide: () => channel.permissionOverwrites.edit(i.guild.roles.everyone,{ViewChannel:false}),
    show: () => channel.permissionOverwrites.edit(i.guild.roles.everyone,{ViewChannel:true})
  };
  if (actions[action]) { await actions[action](); return reply(i, `Room ${action} applied.`); }
}

async function handleModal(i) {
  const action = i.customId.slice('cvmodal:'.length);
  const temp = ownerRoom(i);
  if (!temp) return reply(i, 'Only the room owner can use this control.');
  const value = i.fields.getTextInputValue('value').trim();
  if (action === 'rename') {
    if (!value) return reply(i, 'Channel name cannot be empty.');
    await i.channel.setName(value, 'Cukur Voice rename');
    return reply(i, 'Room renamed.');
  }
  if (action === 'limit') {
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 0 || limit > 99) return reply(i, 'Limit must be a whole number from 0 to 99.');
    await i.channel.setUserLimit(limit);
    return reply(i, 'User limit updated.');
  }
}

module.exports = { handleInteraction };
