import { EmbedBuilder, ActionRowBuilder } from 'discord.js';
import { logger } from '../../../utils/logger.js';

const CONFIG = {
  COMMUNITY_STAFF_ROLE_ID: process.env.COMMUNITY_STAFF_ROLE_ID || '1541012779358756945',
  ROLE_IDS: {
    'Trial Moderator': process.env.ROLE_TRIAL_MODERATOR || '1541012783246872586'
  }
};

export default [
  {
    name: 'app_approve',
    async execute(interaction) {
      await handleReview(interaction, true);
    }
  },
  {
    name: 'app_reject',
    async execute(interaction) {
      await handleReview(interaction, false);
    }
  }
];

async function handleReview(interaction, isApproval) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate().catch(() => {});
  }

  const targetUserId = interaction.customId.split('_').pop();
  const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
  const positionField = originalEmbed.data.fields.find(f => f.name === 'Position Applied');
  const positionName = positionField ? positionField.value.replace(/[*`]/g, '').trim() : 'Trial Moderator';

  const statusText = isApproval 
    ? `✅ **APPROVED** by <@${interaction.user.id}>` 
    : `❌ **REJECTED** by <@${interaction.user.id}>`;

  originalEmbed.setColor(isApproval ? '#57F287' : '#ED4245');
  originalEmbed.addFields({ name: 'Review Status', value: statusText });

  const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
  disabledRow.components.forEach(btn => btn.setDisabled(true));

  await interaction.editReply({ embeds: [originalEmbed], components: [disabledRow] });

  const applicantMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

  if (isApproval && applicantMember) {
    const targetRoleId = CONFIG.ROLE_IDS[positionName];
    if (targetRoleId) await applicantMember.roles.add(targetRoleId).catch(() => {});
    if (CONFIG.COMMUNITY_STAFF_ROLE_ID) await applicantMember.roles.add(CONFIG.COMMUNITY_STAFF_ROLE_ID).catch(() => {});
  }

  if (applicantMember) {
    const dmEmbed = new EmbedBuilder()
      .setColor(isApproval ? '#57F287' : '#ED4245')
      .setTitle(`Application Status: ${positionName}`)
      .setDescription(
        isApproval
          ? `🎉 Congratulations! Your staff application for **${positionName}** has been **APPROVED**.\nYour roles have been updated in the server.`
          : `Thank you for your interest in joining Pursuit Studios. Unfortunately, your application for **${positionName}** was not accepted at this time.`
      )
      .setTimestamp();

    await applicantMember.send({ embeds: [dmEmbed] }).catch(() => {});
  }
}