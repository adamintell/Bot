import { EmbedBuilder, ActionRowBuilder } from 'discord.js';
import { logger } from '../../../utils/logger.js';

export default {
  customId: 'app_reject',
  name: 'app_reject',

  async execute(interaction, client, args) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => {});
    }

    const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
    const fields = originalEmbed.data.fields || [];

    const getFieldValue = (name) => {
      const f = fields.find(field => field.name.toLowerCase().includes(name.toLowerCase()));
      return f ? f.value : 'N/A';
    };

    // Extract Target User ID using Regex directly from embed or args
    let targetUserId = args[0] || interaction.customId.split(':')[1] || interaction.customId.split('_').pop();
    if (!targetUserId || targetUserId.length < 17) {
      const applicantField = getFieldValue('Applicant');
      const idMatch = applicantField.match(/\d{17,19}/);
      if (idMatch) targetUserId = idMatch[0];
    }

    let positionName = originalEmbed.data.title?.replace('📥 New Application:', '').trim();
    if (!positionName || positionName === originalEmbed.data.title) {
      positionName = getFieldValue('Position Applied').replace(/[*`]/g, '').trim() || 'Trial Moderator';
    }

    // Update Staff Review Embed
    originalEmbed.setColor('#ED4245');
    originalEmbed.addFields({ name: 'Review Status', value: `❌ **REJECTED** by <@${interaction.user.id}>` });

    const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
    disabledRow.components.forEach(btn => btn.setDisabled(true));

    await interaction.editReply({ embeds: [originalEmbed], components: [disabledRow] });

    if (!targetUserId) {
      return logger.error('[App Review] Could not determine target user ID to send rejection DM.');
    }

    // Fetch User
    const user = await client.users.fetch(targetUserId).catch(() => null);

    // Send DM
    if (user) {
      const dmEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle(`Application Status Update: ${positionName}`)
        .setDescription(
          `Hello <@${user.id}>,\n\n` +
          `Thank you for applying for **${positionName}** at **Pursuit Studios**.\n\n` +
          `Unfortunately, your application was **NOT ACCEPTED** at this time.\n\n` +
          `**Submitted Application Summary:**\n` +
          `• **Roblox User / Profile:** ${getFieldValue('Roblox')}\n` +
          `• **Availability:** ${getFieldValue('Availability')}\n` +
          `• **Experience:** ${getFieldValue('Experience')}\n\n` +
          `We encourage you to re-apply in the future when positions open back up.`
        )
        .setFooter({ text: 'Pursuit Studios Staff Team' })
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] }).then(() => {
        logger.info(`[App Review] Rejection DM sent to ${user.tag} (${user.id})`);
      }).catch(err => {
        logger.warn(`[App Review] DM blocked for ${user.tag}: ${err.message}`);
      });
    }
  }
};
