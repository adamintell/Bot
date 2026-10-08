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

    const targetUserId = args[0] || interaction.customId.split(':')[1] || interaction.customId.split('_').pop();
    const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
    const fields = originalEmbed.data.fields || [];

    // Helper function to extract field values
    const getFieldValue = (name) => {
      const f = fields.find(field => field.name.toLowerCase().includes(name.toLowerCase()));
      return f ? f.value : 'N/A';
    };

    let positionName = originalEmbed.data.title?.replace('📥 New Application:', '').trim();
    if (!positionName || positionName === originalEmbed.data.title) {
      positionName = getFieldValue('Position Applied').replace(/[*`]/g, '').trim() || 'Trial Moderator';
    }

    // Update Embed in Staff Review Channel
    originalEmbed.setColor('#57F287');
    originalEmbed.addFields({ name: 'Review Status', value: `✅ **APPROVED** by <@${interaction.user.id}>` });

    const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
    disabledRow.components.forEach(btn => btn.setDisabled(true));

    await interaction.editReply({ embeds: [originalEmbed], components: [disabledRow] });

    // Fetch User & Member
    const user = await client.users.fetch(targetUserId).catch(() => null);
    const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);

    // Assign Server Roles
    if (member) {
      const targetRoleId = CONFIG.ROLE_IDS[positionName];
      if (targetRoleId) await member.roles.add(targetRoleId).catch(err => logger.error(`Failed assigning role ${targetRoleId}:`, err));
      if (CONFIG.COMMUNITY_STAFF_ROLE_ID) await member.roles.add(CONFIG.COMMUNITY_STAFF_ROLE_ID).catch(() => {});
    }

    // Send Detailed Results Direct Message
    if (user) {
      const resultDmEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle(`🎉 Application Results: APPROVED (${positionName})`)
        .setDescription(
          `Hello <@${user.id}>,\n\n` +
          `We are pleased to inform you that your application for **${positionName}** at **Pursuit Studios** has been **ACCEPTED**!\n\n` +
          `Below is a full summary copy of your submitted application results:`
        )
        .addFields(
          { name: 'Position Applied', value: `**${positionName}**`, inline: true },
          { name: 'Roblox Profile / User', value: getFieldValue('Roblox'), inline: true },
          { name: 'Availability & Timezone', value: getFieldValue('Availability') },
          { name: 'Experience & Skills', value: getFieldValue('Experience') },
          { name: 'Why Hire You?', value: getFieldValue('Why Hire') }
        )
        .setFooter({ text: 'Pursuit Studios Staff Team • Roles Granted' })
        .setTimestamp();

      await user.send({ embeds: [resultDmEmbed] }).then(() => {
        logger.info(`[App Review] Sent approval results DM to ${user.tag} (${user.id})`);
      }).catch((err) => {
        logger.warn(`[App Review] Could not DM ${user.tag} (${user.id}):${err.message}`);
      });
    }
  }
};
