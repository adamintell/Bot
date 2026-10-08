import { EmbedBuilder, ActionRowBuilder } from 'discord.js';
import { logger } from '../../../utils/logger.js';

const CONFIG = {
  COMMUNITY_STAFF_ROLE_ID: process.env.COMMUNITY_STAFF_ROLE_ID || '1541012779358756945',
  ROLE_IDS: {
    'Trial Moderator': process.env.ROLE_TRIAL_MODERATOR || '1541012783246872586'
  }
};

export default {
  customId: 'app_approve',
  name: 'app_approve',

  async execute(interaction, client, args) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => {});
    }

    const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
    const fields = originalEmbed.data.fields || [];

    // Helper function to extract field values
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
    originalEmbed.setColor('#57F287');
    originalEmbed.addFields({ name: 'Review Status', value: `✅ **APPROVED** by <@${interaction.user.id}>` });

    const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
    disabledRow.components.forEach(btn => btn.setDisabled(true));

    await interaction.editReply({ embeds: [originalEmbed], components: [disabledRow] });

    if (!targetUserId) {
      return logger.error('[App Review] Could not determine target user ID to send approval DM.');
    }

    // Fetch User & Member
    const user = await client.users.fetch(targetUserId).catch(() => null);
    const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);

    // Assign Server Roles
    if (member) {
      const targetRoleId = CONFIG.ROLE_IDS[positionName];
      if (targetRoleId) await member.roles.add(targetRoleId).catch(() => {});
      if (CONFIG.COMMUNITY_STAFF_ROLE_ID) await member.roles.add(CONFIG.COMMUNITY_STAFF_ROLE_ID).catch(() => {});
    }

    // Send DM
    if (user) {
      const dmEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle(`🎉 Application Approved: ${positionName}`)
        .setDescription(
          `Hello <@${user.id}>,\n\n` +
          `Your staff application for **${positionName}** at **Pursuit Studios** has been **APPROVED**!\n\n` +
          `**Submitted Application Summary:**\n` +
          `• **Roblox User / Profile:** ${getFieldValue('Roblox')}\n` +
          `• **Availability:** ${getFieldValue('Availability')}\n` +
          `• **Experience:** ${getFieldValue('Experience')}\n\n` +
          `Your roles have been granted in the Discord server. Welcome to the team!`
        )
        .setFooter({ text: 'Pursuit Studios Staff Team' })
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] }).then(() => {
        logger.info(`[App Review] Approval DM sent to ${user.tag} (${user.id})`);
      }).catch(err => {
        logger.warn(`[App Review] DM blocked for ${user.tag}:${err.message}`);
      });
    }
  }
};
