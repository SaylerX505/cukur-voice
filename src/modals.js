const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

async function open(interaction, action) {
  const modal = new ModalBuilder().setCustomId(`cvmodal:${action}`).setTitle(action === 'rename' ? 'Rename room' : 'Set member limit');
  const input = new TextInputBuilder().setCustomId('value').setLabel(action === 'rename' ? 'Channel name' : 'Limit (0-99)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(action === 'rename' ? 100 : 2);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

module.exports = { open };
