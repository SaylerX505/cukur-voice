const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');

// Wispbyte/Node 22 compatible storage: pure Node.js JSON, no native SQLite bindings.
fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

const filePath = config.databasePath.endsWith('.json')
  ? config.databasePath
  : config.databasePath.replace(/\.(db|sqlite3?)$/i, '.json');

const empty = {
  guilds: {},
  temp_channels: {},
  permissions: [],
  role_assignments: []
};

function load() {
  try {
    if (!fs.existsSync(filePath)) return structuredClone(empty);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      guilds: parsed.guilds || {},
      temp_channels: parsed.temp_channels || {},
      permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
      role_assignments: Array.isArray(parsed.role_assignments) ? parsed.role_assignments : []
    };
  } catch {
    return structuredClone(empty);
  }
}

let data = load();

function save() {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

function guildDefaults(id, patch = {}, current = null) {
  return {
    guild_id: id,
    category_id: patch.category_id ?? current?.category_id ?? null,
    generator_id: patch.generator_id ?? current?.generator_id ?? null,
    interface_channel_id: patch.interface_channel_id ?? current?.interface_channel_id ?? null,
    waiting_room_id: patch.waiting_room_id ?? current?.waiting_room_id ?? null,
    log_channel_id: patch.log_channel_id ?? current?.log_channel_id ?? null,
    voice_role_id: patch.voice_role_id ?? current?.voice_role_id ?? null,
    text_enabled: patch.text_enabled ?? current?.text_enabled ?? 0,
    room_template: patch.room_template ?? current?.room_template ?? config.defaults.roomTemplate,
    default_limit: patch.default_limit ?? current?.default_limit ?? config.defaults.userLimit,
    default_bitrate: patch.default_bitrate ?? current?.default_bitrate ?? config.defaults.bitrate,
    default_region: patch.default_region ?? current?.default_region ?? config.defaults.region,
    created_at: current?.created_at ?? Date.now()
  };
}

const api = {
  listGuilds: () => Object.values(data.guilds),

  getGuild: id => data.guilds[id] || undefined,

  upsertGuild: (id, patch = {}) => {
    const current = api.getGuild(id);
    data.guilds[id] = guildDefaults(id, patch, current);
    save();
    return data.guilds[id];
  },

  getTemp: id => data.temp_channels[id] || undefined,

  addTemp: (channelId, guildId, ownerId, generatorId, textChannelId = null) => {
    data.temp_channels[channelId] = {
      channel_id: channelId,
      guild_id: guildId,
      owner_id: ownerId,
      generator_id: generatorId,
      text_channel_id: textChannelId,
      created_at: data.temp_channels[channelId]?.created_at ?? Date.now()
    };
    save();
    return data.temp_channels[channelId];
  },

  setTempText: (channelId, textId) => {
    if (!data.temp_channels[channelId]) return { changes: 0 };
    data.temp_channels[channelId].text_channel_id = textId;
    save();
    return { changes: 1 };
  },

  removeTemp: id => {
    if (!data.temp_channels[id]) return { changes: 0 };
    delete data.temp_channels[id];
    data.permissions = data.permissions.filter(x => x.channel_id !== id);
    data.role_assignments = data.role_assignments.filter(x => x.channel_id !== id);
    save();
    return { changes: 1 };
  },

  listTemps: guildId => Object.values(data.temp_channels).filter(x => x.guild_id === guildId),

  addPermission: (channelId, userId, type) => {
    const exists = data.permissions.some(x => x.channel_id === channelId && x.user_id === userId && x.type === type);
    if (!exists) data.permissions.push({ channel_id: channelId, user_id: userId, type });
    save();
    return { changes: exists ? 0 : 1 };
  },

  removePermission: (channelId, userId, type) => {
    const before = data.permissions.length;
    data.permissions = data.permissions.filter(x => !(x.channel_id === channelId && x.user_id === userId && x.type === type));
    save();
    return { changes: before - data.permissions.length };
  },

  listPermissions: channelId => data.permissions.filter(x => x.channel_id === channelId),

  addRoleAssignment: (channelId, userId, roleId) => {
    const exists = data.role_assignments.some(x => x.channel_id === channelId && x.user_id === userId && x.role_id === roleId);
    if (!exists) data.role_assignments.push({ channel_id: channelId, user_id: userId, role_id: roleId });
    save();
    return { changes: exists ? 0 : 1 };
  },

  listRoleAssignments: channelId => data.role_assignments.filter(x => x.channel_id === channelId),

  close: () => save()
};

module.exports = api;
