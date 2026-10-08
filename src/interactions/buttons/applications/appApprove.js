import { EmbedBuilder, ActionRowBuilder } from 'discord.js';

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

    const targetUserId = args[0];
    const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
    const positionField = originalEmbed.data.fields.find(f => f.name === 'Position Applied');
    const positionName = positionField ? positionField.value.replace(/[*`]/g, '').trim() : 'Trial Moderator';

    originalEmbed.setColor('#57F287');
    originalEmbed.addFields({ name: 'Review Status', value: `✅ **APPROVED** by <@${interaction.user.id}>` });

    const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
    disabledRow.components.forEach(btn => btn.setDisabled(true));

    await interaction.editReply({ embeds: [originalEmbed], components: [disabledRow] });

    const applicantMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

    if (applicantMember) {
      const targetRoleId = CONFIG.ROLE_IDS[positionName];
      if (targetRoleId) await applicantMember.roles.add(targetRoleId).catch(() => {});
      if (CONFIG.COMMUNITY_STAFF_ROLE_ID) await applicantMember.roles.add(CONFIG.COMMUNITY_STAFF_ROLE_ID).catch(() => {});

      const dmEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle(`Application Status: ${positionName}`)
        .setDescription(`🎉 Congratulations! Your staff application for **${positionName}** has been **APPROVED**.\nYour roles have been updated in the server.`)
        .setTimestamp();

      await applicantMember.send({ embeds: [dmEmbed] }).catch(() => {});
    }
  }
};