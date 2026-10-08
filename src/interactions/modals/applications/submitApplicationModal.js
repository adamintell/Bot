import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { activeDrafts } from '../../selectMenus/applications/selectApplicationPosition.js';
import { logger } from '../../../utils/logger.js';

const CONFIG = {
  APP_LOG_CHANNEL_ID: process.env.APP_LOG_CHANNEL_ID || '1551217750498607204',
  REVIEWER_ROLE_ID: process.env.REVIEWER_ROLE_ID || '1551216636235747468'
};

export default {
  customId: 'submit_application_modal',
  name: 'submit_application_modal',

  async execute(interaction, client, args) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 }).catch(() => {});
    }

    const selectedPosition = activeDrafts?.get(interaction.user.id) || 'Trial Moderator';
    const robloxUser = interaction.fields.getTextInputValue('app_roblox_username');
    const experience = interaction.fields.getTextInputValue('app_experience');
    const scenario = interaction.fields.getTextInputValue('app_scenario');
    const availability = interaction.fields.getTextInputValue('app_availability');

    const appLogChannel = await client.channels.fetch(CONFIG.APP_LOG_CHANNEL_ID).catch(() => null);

    if (!appLogChannel || !appLogChannel.isTextBased()) {
      return await interaction.editReply({
        content: '❌ Application log channel is unavailable. Please contact an administrator.'
      });
    }

    const logEmbed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`📥 New Application: ${selectedPosition}`)
      .addFields(
        { name: 'Applicant', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true },
        { name: 'Position Applied', value: `**${selectedPosition}**`, inline: true },
        { name: 'Roblox Profile / User', value: robloxUser, inline: true },
        { name: 'Availability & Timezone', value: availability },
        { name: 'Experience & Skills', value: experience },
        { name: 'Why Hire You?', value: scenario }
      )
      .setTimestamp();

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`app_approve:${interaction.user.id}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`app_reject:${interaction.user.id}`)
        .setLabel('Reject')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

    await appLogChannel.send({
      content: CONFIG.REVIEWER_ROLE_ID ? `<@&${CONFIG.REVIEWER_ROLE_ID}>` : null,
      embeds: [logEmbed],
      components: [actionRow]
    });

    if (activeDrafts) activeDrafts.delete(interaction.user.id);

    return await interaction.editReply({
      content: `✅ Your application for **${selectedPosition}** has been submitted successfully!`
    });
  }
};