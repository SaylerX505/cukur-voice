const path = require('node:path');
require('dotenv').config();

function emoji(name, fallback) {
  const id = process.env[`EMOJI_${name}`];
  return id ? { name: name.toLowerCase(), id } : fallback;
}

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  // Optional: when set, commands are registered to one guild for instant development updates.
  // When omitted, commands are registered globally. No Guild ID is required.
  devGuildId: process.env.DEV_GUILD_ID || null,
  botName: process.env.BOT_NAME || 'Cukur Voice',
  databasePath: path.join(process.cwd(), 'data', 'cukur.sqlite'),
  defaults: {
    roomTemplate: process.env.DEFAULT_ROOM_TEMPLATE || "{user}'s Room",
    userLimit: Number(process.env.DEFAULT_ROOM_LIMIT || 0)
  },
  emojis: {
    settings: emoji('SETTINGS', '⚙️'), lock: emoji('LOCK', '🔒'), unlock: emoji('UNLOCK', '🔓'),
    hide: emoji('HIDE', '👁️'), show: emoji('SHOW', '👁️'), rename: emoji('RENAME', '✏️'),
    limit: emoji('LIMIT', '👥'), trust: emoji('TRUST', '➕'), block: emoji('BLOCK', '➖'),
    claim: emoji('CLAIM', '👑'), transfer: emoji('TRANSFER', '🔁'), disconnect: emoji('DISCONNECT', '⛔'),
    delete: emoji('DELETE', '🗑️'), invite: emoji('INVITE', '🔗'), info: emoji('INFO', 'ℹ️'),
    setup: emoji('SETUP', '🛠️'), text: emoji('TEXT', '💬')
  }
};
