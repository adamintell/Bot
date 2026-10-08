import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export const activeDrafts = new Map();

export default {
  customId: 'select_application_position',
  name: 'select_application_position',

  async execute(interaction, client, args) {
    const selectedPos = interaction.values[0];
    activeDrafts.set(interaction.user.id, selectedPos);

    const modal = new ModalBuilder()
      .setCustomId('submit_application_modal')
      .setTitle(`Application: ${selectedPos.substring(0, 30)}`);

    const q1 = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('app_roblox_username')
        .setLabel('Roblox Username / Profile Link')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter your Roblox Username')
        .setRequired(true)
    );

    const q2 = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('app_experience')
        .setLabel('Relevant Experience & Qualifications')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Detail your previous staff experience or relevant skills...')
        .setRequired(true)
    );

    const q3 = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('app_scenario')
        .setLabel('Why should we hire you over others?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Explain what makes you a good fit for this role...')
        .setRequired(true)
    );

    const q4 = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('app_availability')
        .setLabel('Weekly Availability (Hours & Timezone)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 15-20 hours/week, EST')
        .setRequired(true)
    );

    modal.addComponents(q1, q2, q3, q4);
    return await interaction.showModal(modal);
  }
};