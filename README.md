# Cukur Voice

A professional Discord temporary voice channel manager built with JavaScript and discord.js v14.

## Core features
- Automatic temporary rooms from a generator channel.
- Automatic cleanup when rooms become empty.
- Persistent SQLite state using better-sqlite3.
- Owner transfer when the current owner leaves.
- `/setup` creates the category and generator automatically.
- `/voice` controls: rename, limit, lock, unlock, hide, show, claim, permit, reject, kick, info.
- Interactive control panel via `/interface`.
- Custom Discord application emojis with Unicode fallbacks.
- Guild-scoped configuration, so multiple servers can use the same bot.

## Setup

1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN` and `CLIENT_ID`.
3. Optional: set `DEV_GUILD_ID` for instant command registration in one development server. Leave it blank for global commands.
4. Create custom application emojis in Discord Developer Portal and paste their IDs into the `EMOJI_*` variables. The bot automatically renders them in the panel; leaving an ID blank uses a Unicode fallback.
5. Run `npm install` then `npm start`.
6. Invite the bot with the `bot` and `applications.commands` scopes. It needs Manage Channels, Move Members, View Channels, Connect, Speak, Send Messages, Embed Links and Use Application Commands. Administrator is not required.
7. Run `/setup` in each server.

## Design

The project intentionally keeps the first release dashboard-free and Discord-native. The architecture leaves room for a future web dashboard, templates, voice roles, private text chats, waiting rooms, audit logs and more without rewriting the core temporary-channel engine.

Inspired by the best patterns in Astro and VoiceMaster-style temporary voice systems: generator channels, owner controls, automatic cleanup and an interface panel. Astro documents the same generator/owner/interface model and advanced extensions such as voice roles, templates and waiting rooms.
