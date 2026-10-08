import { EmbedBuilder, ActionRowBuilder } from 'discord.js';

export default {
  customId: 'app_reject',
  name: 'app_reject',

  async execute(interaction, client, args) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => {});
    }

    const targetUserId = args[0];
    const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);

    // Extract Position Title from Embed Title or Field
    let positionName = originalEmbed.data.title?.replace('📥 New Application:', '').trim();
    if (!positionName) {
      const positionField = originalEmbed.data.fields.find(f => f.name === 'Position Applied');
      positionName = positionField ? positionField.value.replace(/[*`]/g, '').trim() : 'Trial Moderator';
    }

    originalEmbed.setColor('#ED4245');
    originalEmbed.addFields({ name: 'Review Status', value: `❌ **REJECTED** by <@${interaction.user.id}>` });

    const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
    disabledRow.components.forEach(btn => btn.setDisabled(true));

    await interaction.editReply({ embeds: [originalEmbed], components: [disabledRow] });

    const applicantMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

    if (applicantMember) {
      // Send Personal DM Notification
      const dmEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle(`Application Status Update: ${positionName}`)
        .setDescription(
          `Hello <@${applicantMember.id}>,\n\n` +
          `Thank you for applying for **${positionName}** at **Pursuit Studios**.\n\n` +
          `Unfortunately, your application was not accepted at this time. We encourage you to re-apply in the future when positions open back up.`
        )
        .setFooter({ text: 'Pursuit Studios Management' })
        .setTimestamp();

      await applicantMember.send({ embeds: [dmEmbed] }).catch(() => {});
    }
  }
};
