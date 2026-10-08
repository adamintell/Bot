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
    const positionField = originalEmbed.data.fields.find(f => f.name === 'Position Applied');
    const positionName = positionField ? positionField.value.replace(/[*`]/g, '').trim() : 'Trial Moderator';

    originalEmbed.setColor('#ED4245');
    originalEmbed.addFields({ name: 'Review Status', value: `❌ **REJECTED** by <@${interaction.user.id}>` });

    const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
    disabledRow.components.forEach(btn => btn.setDisabled(true));

    await interaction.editReply({ embeds: [originalEmbed], components: [disabledRow] });

    const applicantMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

    if (applicantMember) {
      const dmEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle(`Application Status: ${positionName}`)
        .setDescription(`Thank you for your interest in joining Pursuit Studios. Unfortunately, your application for **${positionName}** was not accepted at this time.`)
        .setTimestamp();

      await applicantMember.send({ embeds: [dmEmbed] }).catch(() => {});
    }
  }
};