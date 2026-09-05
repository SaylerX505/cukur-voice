const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('./config');
const db = require('./database');

const commands = [
  new SlashCommandBuilder().setName('setup').setDescription('Create the Cukur Voice temporary voice system.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('voice').setDescription('Manage your temporary voice channel.')
    .addSubcommand(s => s.setName('rename').setDescription('Rename your room.').addStringOption(o=>o.setName('name').setDescription('New channel name').setRequired(true).setMaxLength(100)))
    .addSubcommand(s => s.setName('limit').setDescription('Set the member limit.').addIntegerOption(o=>o.setName('amount').setDescription('0 means unlimited').setRequired(true).setMinValue(0).setMaxValue(99)))
    .addSubcommand(s => s.setName('lock').setDescription('Prevent new members from joining.'))
    .addSubcommand(s => s.setName('unlock').setDescription('Allow members to join.'))
    .addSubcommand(s => s.setName('hide').setDescription('Hide the room from @everyone.'))
    .addSubcommand(s => s.setName('show').setDescription('Make the room visible again.'))
    .addSubcommand(s => s.setName('claim').setDescription('Claim an ownerless room.'))
    .addSubcommand(s => s.setName('permit').setDescription('Allow a member into your room.').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(s => s.setName('reject').setDescription('Block a member from your room.').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(s => s.setName('kick').setDescription('Disconnect a member.').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(s => s.setName('info').setDescription('Show room information.')),
  new SlashCommandBuilder().setName('interface').setDescription('Post the interactive voice control panel in a text channel.')
    .addChannelOption(o=>o.setName('channel').setDescription('Target text channel').addChannelTypes(ChannelType.GuildText).setRequired(false))
].map(c=>c.toJSON());

async function registerCommands(client) {
  if (!config.token || !config.clientId) throw new Error('DISCORD_TOKEN and CLIENT_ID are required.');
  const rest = new REST({ version: '10' }).setToken(config.token);
  const route = config.devGuildId ? Routes.applicationGuildCommands(config.clientId, config.devGuildId) : Routes.applicationCommands(config.clientId);
  await rest.put(route, { body: commands });
  console.log(`[Cukur Voice] Registered ${commands.length} commands.`);
}

async function setup(guild) {
  const existing = db.getGuild(guild.id);
  if (existing) {
    const category = guild.channels.cache.get(existing.category_id);
    const generator = guild.channels.cache.get(existing.generator_id);
    if (category && generator) return { category, generator };
  }
  const category = await guild.channels.create({ name: 'Temporary Voice', type: ChannelType.GuildCategory, reason: 'Cukur Voice setup' });
  const generator = await guild.channels.create({ name: '➕ Create Room', type: ChannelType.GuildVoice, parent: category.id, reason: 'Cukur Voice setup' });
  db.setGuild(guild.id, category.id, generator.id);
  return { category, generator };
}

module.exports = { commands, registerCommands, setup };
