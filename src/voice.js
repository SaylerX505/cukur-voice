const { ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('./database');

async function createTemp(newState, guildConfig) {
  const member = newState.member;
  const category = newState.guild.channels.cache.get(guildConfig.category_id);
  if (!category) return null;
  const safeName = `${member.displayName}'s Room`.slice(0, 100);
  const channel = await newState.guild.channels.create({
    name: safeName,
    type: ChannelType.GuildVoice,
    parent: category.id,
    userLimit: 0,
    reason: `Cukur Voice room for ${member.user.tag}`,
    permissionOverwrites: [
      { id: newState.guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ManageChannels] }
    ]
  });
  db.addTemp(channel.id, newState.guild.id, member.id, guildConfig.generator_id);
  await member.voice.setChannel(channel, 'Cukur Voice room created');
  return channel;
}

async function cleanup(channel, client) {
  const temp = db.getTemp(channel.id);
  if (!temp) return;
  if (channel.members.size > 0) return;
  db.removeTemp(channel.id);
  await channel.delete('Cukur Voice room became empty').catch(()=>{});
}

async function transferOwner(channel, oldOwnerId) {
  const temp = db.getTemp(channel.id);
  if (!temp || temp.owner_id !== oldOwnerId || channel.members.size === 0) return;
  const next = channel.members.first();
  if (!next) return;
  db.addTemp(channel.id, channel.guild.id, next.id, temp.generator_id);
  await channel.permissionOverwrites.edit(next.id, { ViewChannel: true, Connect: true, Speak: true, ManageChannels: true }).catch(()=>{});
}

async function handleVoiceState(oldState, newState) {
  if (oldState.channelId === newState.channelId) return;
  const guild = newState.guild || oldState.guild;
  const cfg = db.getGuild(guild.id);

  if (newState.channelId && cfg && newState.channelId === cfg.generator_id) {
    if (newState.member.user.bot) return;
    await createTemp(newState, cfg);
  }

  if (oldState.channelId) {
    const oldChannel = oldState.guild.channels.cache.get(oldState.channelId);
    if (oldChannel) {
      const temp = db.getTemp(oldChannel.id);
      if (temp && temp.owner_id === oldState.member.id) await transferOwner(oldChannel, oldState.member.id);
      await cleanup(oldChannel);
    }
  }
}

module.exports = { handleVoiceState };
