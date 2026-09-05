const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const config = require('./config');
const db = require('./database');
const { registerCommands } = require('./commands');
const { handleVoiceState, reconcile } = require('./voice');
const { handleInteraction } = require('./interactions');

if (!config.token || !config.clientId) throw new Error('DISCORD_TOKEN and CLIENT_ID are required.');

// Only request intents the bot actually needs. GuildMembers is privileged and
// is not required for temporary voice-channel management.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();

client.once(Events.ClientReady, async readyClient => {
  console.log(`[Cukur Voice] Logged in as ${readyClient.user.tag}`);
  try {
    await registerCommands(readyClient);
    await reconcile(readyClient);
    console.log('[Cukur Voice] Startup reconciliation complete.');
  } catch (error) {
    console.error('[Startup]', error);
  }
});

// Discord.js event names are case-sensitive. Use the Events constants so
// interaction and voice-state handlers actually receive Discord events.
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    await handleVoiceState(oldState, newState);
  } catch (error) {
    console.error('[VoiceState]', error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    await handleInteraction(interaction);
  } catch (error) {
    console.error('[Interaction]', error);
    const payload = {
      content: 'Something went wrong while processing that action.',
      ephemeral: true
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

process.on('SIGINT', () => {
  db.close();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  client.destroy();
  process.exit(0);
});

client.login(config.token);
