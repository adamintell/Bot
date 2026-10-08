import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';

const ALLOWED_ROLE_IDS = [
  process.env.ROLE_MEMBER_ID || '1541012796710461460',
  process.env.ROLE_VERIFIED_MEMBER_ID || '1549884565932216332'
];

export default {
  customId: 'start_application_button',
  name: 'start_application_button',

  async execute(interaction, client, args) {
    // 1. Immediately defer reply to prevent Discord 3-second timeout
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 }).catch(() => {});
    }

    const hasRole = interaction.member?.roles.cache.some(r => ALLOWED_ROLE_IDS.includes(r.id));
    if (!hasRole) {
      return await interaction.editReply({
        content: '⛔ **Access Denied:** Only members with the **Member** or **Verified Member** role are eligible to apply for Trial Moderator.'
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_application_position')
      .setPlaceholder('Choose a staff position to apply for...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Trial Moderator')
          .setValue('Trial Moderator')
          .setDescription('Entry-level moderation role under evaluation.')
          .setEmoji('🔰')
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return await interaction.editReply({
      content: 'Please select the position you wish to apply for from the dropdown below:',
      components: [row]
    });
  }
};