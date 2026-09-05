const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS guilds (
  guild_id TEXT PRIMARY KEY,
  category_id TEXT,
  generator_id TEXT,
  interface_channel_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS temp_channels (
  channel_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  generator_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS permissions (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  PRIMARY KEY(channel_id, user_id, type),
  FOREIGN KEY(channel_id) REFERENCES temp_channels(channel_id) ON DELETE CASCADE
);
`);

module.exports = {
  getGuild: id => db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(id),
  setGuild: (id, categoryId, generatorId) => db.prepare(`INSERT INTO guilds(guild_id,category_id,generator_id,created_at) VALUES(?,?,?,?) ON CONFLICT(guild_id) DO UPDATE SET category_id=excluded.category_id,generator_id=excluded.generator_id`).run(id, categoryId, generatorId, Date.now()),
  setInterfaceChannel: (id, channelId) => db.prepare('UPDATE guilds SET interface_channel_id=? WHERE guild_id=?').run(channelId, id),
  getTemp: id => db.prepare('SELECT * FROM temp_channels WHERE channel_id=?').get(id),
  addTemp: (channelId, guildId, ownerId, generatorId) => db.prepare('INSERT OR REPLACE INTO temp_channels VALUES(?,?,?,?,?)').run(channelId,guildId,ownerId,generatorId,Date.now()),
  removeTemp: id => db.prepare('DELETE FROM temp_channels WHERE channel_id=?').run(id),
  listTemps: guildId => db.prepare('SELECT * FROM temp_channels WHERE guild_id=?').all(guildId),
  addPermission: (channelId,userId,type) => db.prepare('INSERT OR REPLACE INTO permissions VALUES(?,?,?)').run(channelId,userId,type),
  removePermission: (channelId,userId,type) => db.prepare('DELETE FROM permissions WHERE channel_id=? AND user_id=? AND type=?').run(channelId,userId,type),
  close: () => db.close()
};
