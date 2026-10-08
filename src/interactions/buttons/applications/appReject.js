import { EmbedBuilder, ActionRowBuilder } from 'discord.js';
import { logger } from '../../../utils/logger.js';

export default {
  customId: 'app_reject',
  name: 'app_reject',

  async execute(interaction, client, args) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => {});
    }

    const targetUserId = args[0] || interaction.customId.split(':')[1] || interaction.customId.split('_').pop();
    const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
    const fields = originalEmbed.data.fields || [];

    const getFieldValue = (name) => {
      const f = fields.find(field => field.name.toLowerCase().includes(name.toLowerCase()));
      return f ? f.value : 'N/A';
    };

    let positionName = originalEmbed.data.title?.replace('📥 New Application:', '').trim();
    if (!positionName || positionName === originalEmbed.data.title) {
      positionName = getFieldValue('Position Applied').replace(/[*`]/g, '').trim() || 'Trial Moderator';
    }

    // Update Embed in Staff Review Channel
    originalEmbed.setColor('#ED4245');
    originalEmbed.addFields({ name: 'Review Status', value: `❌ **REJECTED** by <@${interaction.user.id}>` });

    const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
    disabledRow.components.forEach(btn => btn.setDisabled(true));

    await interaction.editReply({ embeds: [originalEmbed], components: [disabledRow] });

    // Fetch User
    const user = await client.users.fetch(targetUserId).catch(() => null);

    // Send Detailed Results Direct Message
    if (user) {
      const resultDmEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle(`Application Results: REJECTED (${positionName})`)
        .setDescription(
          `Hello <@${user.id}>,\n\n` +
          `Thank you for taking the time to apply for **${positionName}** at **Pursuit Studios**.\n\n` +
          `Unfortunately, your application was **NOT ACCEPTED** at this time. Here is a copy of your submitted application responses for your records:`
        )
        .addFields(
          { name: 'Position Applied', value: `**${positionName}**`, inline: true },
          { name: 'Roblox Profile / User', value: getFieldValue('Roblox'), inline: true },
          { name: 'Availability & Timezone', value: getFieldValue('Availability') },
          { name: 'Experience & Skills', value: getFieldValue('Experience') },
          { name: 'Why Hire You?', value: getFieldValue('Why Hire') }
        )
        .setFooter({ text: 'Pursuit Studios Staff Team' })
        .setTimestamp();

      await user.send({ embeds: [resultDmEmbed] }).then(() => {
        logger.info(`[App Review] Sent rejection results DM to ${user.tag} (${user.id})`);
      }).catch((err) => {
        logger.warn(`[App Review] Could not DM ${user.tag} (${user.id}): ${err.message}`);
      });
    }
  }
};
