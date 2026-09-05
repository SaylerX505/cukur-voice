# Cukur Voice

A Discord-native temporary voice manager built with JavaScript and discord.js v14. No dashboard, no web server, no external control panel.

## Test release features

- Temporary voice rooms from the generator and optional waiting-room trigger.
- Automatic empty-room cleanup and startup stale-room reconciliation.
- Persistent SQLite state with safe migration from the previous release.
- Automatic owner transfer when the owner leaves while members remain.
- Manual `/voice transfer` and `/voice claim` ownership controls.
- Owner controls: rename, limit, lock, unlock, hide, show, permit, reject, kick, disconnect, delete and info.
- Voice bitrate and RTC region controls.
- Optional private temporary text channel for every room.
- Optional temporary voice role with automatic cleanup/transfer tracking.
- Configurable room-name templates using `{user}` and `{username}`.
- Configurable default limit, bitrate and region.
- Optional audit log channel.
- Moderator override through Manage Channels.
- Three-row interactive `/interface` panel with Discord application emoji support and Unicode fallbacks.
- `/setup` creates/repairs the main category, generator and waiting room.
- Multi-server configuration with guild-scoped SQLite data.

## Setup

1. Use Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Fill `DISCORD_TOKEN` and `CLIENT_ID`.
4. Optionally set `DEV_GUILD_ID` for instant command registration during testing.
5. Run `npm install` then `npm start`.
6. Invite the bot with `bot` and `applications.commands` scopes.
7. Minimum practical permissions: Manage Channels, Move Members, View Channels, Connect, Speak, Send Messages, Embed Links and Use Application Commands. Administrator is not required.
8. Run `/setup` in each server.
9. Run `/interface` to post the control panel.

## Configuration

`/config logs #channel` enables audit logging.

`/config text true` enables automatic private text channels for new rooms.

`/config waiting-room <voice>` makes the selected voice channel another room-creation trigger.

`/config voice-role @Role` assigns that role to the current room owner and tracks it for cleanup/transfer.

`/config template {user}'s Room` changes the default room name. `{user}` becomes the display name and `{username}` becomes the Discord username.

`/config limit 0`, `/config bitrate 64`, and `/config region auto` set defaults for newly created rooms.

## Owner commands

`/voice rename`, `limit`, `lock`, `unlock`, `hide`, `show`, `claim`, `transfer`, `permit`, `reject`, `kick`, `disconnect`, `bitrate`, `region`, `text`, `delete`, `info`.

The interactive panel exposes the most-used controls. Commands remain available for actions that need a user/channel/role argument.

## Custom emojis

Create application emojis in the Discord Developer Portal and put their IDs in the `EMOJI_*` variables in `.env`. If an ID is blank, Cukur Voice automatically uses a Unicode fallback.

## Architecture

The bot remains intentionally Discord-native. SQLite is the persistence layer, discord.js handles Discord state, and the temporary-room engine is isolated from the interaction layer. This makes the project ready for future Discord-native extensions such as richer templates, additional room policies, waiting-room workflows and more without introducing a dashboard.

This test release is designed to be run and tested directly on a Discord server before further hardening.
