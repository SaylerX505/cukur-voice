const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

function open(interaction, action) {
  const labels = { rename: ['Rename room','New channel name'], limit: ['Member limit','0 = unlimited'], bitrate: ['Bitrate','8-384 kbps'], region: ['Voice region','Use auto or a Discord region such as us-east'] };
  const [title, placeholder] = labels[action] || ['Cukur Voice','Value'];
  const input = new TextInputBuilder().setCustomId('value').setLabel(placeholder).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(action === 'rename' ? 100 : 32);
  return interaction.showModal(new ModalBuilder().setCustomId(`cvmodal:${action}`).setTitle(title).addComponents(new ActionRowBuilder().addComponents(input)));
}

module.exports = { open };
