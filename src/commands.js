const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('./config');
const db = require('./database');

const commands = [
  new SlashCommandBuilder().setName('setup').setDescription('Create or repair the Cukur Voice system.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('config').setDescription('Configure Cukur Voice.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s=>s.setName('logs').setDescription('Set the audit log channel.').addChannelOption(o=>o.setName('channel').setDescription('Text channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(s=>s.setName('text').setDescription('Enable or disable private temporary text channels.').addBooleanOption(o=>o.setName('enabled').setDescription('Enabled').setRequired(true)))
    .addSubcommand(s=>s.setName('waiting-room').setDescription('Set the optional waiting room.').addChannelOption(o=>o.setName('channel').setDescription('Voice channel').addChannelTypes(ChannelType.GuildVoice).setRequired(true)))
    .addSubcommand(s=>s.setName('voice-role').setDescription('Set the optional temporary voice role.').addRoleOption(o=>o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s=>s.setName('template').setDescription('Set the default room name template.').addStringOption(o=>o.setName('value').setDescription('{user} is replaced by the display name.').setRequired(true).setMaxLength(100)))
    .addSubcommand(s=>s.setName('limit').setDescription('Set the default room limit.').addIntegerOption(o=>o.setName('amount').setDescription('0 means unlimited').setRequired(true).setMinValue(0).setMaxValue(99))),
  new SlashCommandBuilder().setName('voice').setDescription('Manage your temporary voice room.')
    .addSubcommand(s=>s.setName('rename').setDescription('Rename your room.').addStringOption(o=>o.setName('name').setDescription('New channel name').setRequired(true).setMaxLength(100)))
    .addSubcommand(s=>s.setName('limit').setDescription('Set the member limit.').addIntegerOption(o=>o.setName('amount').setDescription('0 means unlimited').setRequired(true).setMinValue(0).setMaxValue(99)))
    .addSubcommand(s=>s.setName('lock').setDescription('Prevent new members from joining.')).addSubcommand(s=>s.setName('unlock').setDescription('Allow members to join.')).addSubcommand(s=>s.setName('hide').setDescription('Hide the room from @everyone.')).addSubcommand(s=>s.setName('show').setDescription('Make the room visible again.')).addSubcommand(s=>s.setName('claim').setDescription('Claim an ownerless room.'))
    .addSubcommand(s=>s.setName('transfer').setDescription('Transfer ownership.').addUserOption(o=>o.setName('user').setDescription('New owner').setRequired(true))).addSubcommand(s=>s.setName('trust').setDescription('Trust a member in your room.').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true))).addSubcommand(s=>s.setName('block').setDescription('Block a member from your room.').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true))).addSubcommand(s=>s.setName('kick').setDescription('Disconnect a member.').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true))).addSubcommand(s=>s.setName('disconnect').setDescription('Disconnect everyone else.'))
    .addSubcommand(s=>s.setName('text').setDescription('Create or remove the private room text channel.').addBooleanOption(o=>o.setName('enabled').setDescription('Enabled').setRequired(true))).addSubcommand(s=>s.setName('delete').setDescription('Delete your temporary room now.')).addSubcommand(s=>s.setName('info').setDescription('Show room information.')),
  new SlashCommandBuilder().setName('interface').setDescription('Post or refresh the interactive voice control panel.').addChannelOption(o=>o.setName('channel').setDescription('Target text channel').addChannelTypes(ChannelType.GuildText).setRequired(false))
].map(c=>c.toJSON());

async function registerCommands(client){
  if(!config.token||!config.clientId)throw new Error('DISCORD_TOKEN and CLIENT_ID are required.');
  const rest=new REST({version:'10'}).setToken(config.token);
  const route=config.devGuildId?Routes.applicationGuildCommands(config.clientId,config.devGuildId):Routes.applicationCommands(config.clientId);
  await rest.put(route,{body:commands});
  console.log(`[Cukur Voice] Registered ${commands.length} commands.`);
}

async function setup(guild){
  const me=guild.members.me||await guild.members.fetchMe();
  const missing=[];
  if(!me.permissions.has(PermissionFlagsBits.ViewChannel))missing.push('View Channels');
  if(!me.permissions.has(PermissionFlagsBits.ManageChannels))missing.push('Manage Channels');
  if(missing.length){
    const error=new Error(`Cukur Voice is missing required bot permissions: ${missing.join(', ')}. Give the bot these permissions (or Administrator) and run /setup again.`);
    error.code='CV_MISSING_PERMISSIONS';
    error.missingPermissions=missing;
    throw error;
  }

  let cfg=db.getGuild(guild.id),category=cfg&&guild.channels.cache.get(cfg.category_id),generator=cfg&&guild.channels.cache.get(cfg.generator_id),waiting=cfg&&cfg.waiting_room_id&&guild.channels.cache.get(cfg.waiting_room_id),interfaceChannel=cfg&&cfg.interface_channel_id&&guild.channels.cache.get(cfg.interface_channel_id);
  if(!category||category.type!==ChannelType.GuildCategory)category=await guild.channels.create({name:'Temporary Voice',type:ChannelType.GuildCategory,reason:'Cukur Voice setup'});
  if(!generator||generator.type!==ChannelType.GuildVoice)generator=await guild.channels.create({name:'➕ Create Room',type:ChannelType.GuildVoice,parent:category.id,reason:'Cukur Voice setup'});
  if(!waiting||waiting.type!==ChannelType.GuildVoice)waiting=await guild.channels.create({name:'Waiting Room',type:ChannelType.GuildVoice,parent:category.id,reason:'Cukur Voice setup'});
  if(!interfaceChannel||!interfaceChannel.isTextBased())interfaceChannel=await guild.channels.create({name:'voice-control',type:ChannelType.GuildText,parent:category.id,reason:'Cukur Voice setup',permissionOverwrites:[{id:guild.roles.everyone.id,deny:[PermissionFlagsBits.SendMessages]}]});
  db.upsertGuild(guild.id,{category_id:category.id,generator_id:generator.id,waiting_room_id:waiting.id,interface_channel_id:interfaceChannel.id});
  return{category,generator,waiting,interfaceChannel,config:db.getGuild(guild.id)};
}

module.exports={commands,registerCommands,setup};
