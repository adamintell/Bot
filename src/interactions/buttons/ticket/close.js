import { PermissionFlagsBits } from 'discord.js';
import discordTranscripts from 'discord-html-transcripts';
import { createEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || '1541012779358756945';
const TICKET_TRANSCRIPT_CHANNEL_ID = process.env.TICKET_TRANSCRIPT_CHANNEL_ID || '1549553157456007208';

export default {
  customId: 'close_ticket',
  name: 'close_ticket',

  async execute(interaction, client) {
    // Instantly acknowledge reply so Discord doesn't timeout while creating HTML
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || 
                    interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    
    if (!isStaff) {
      return await interaction.editReply({ content: '⚠️ Only support staff can close tickets.' });
    }

    await interaction.editReply({ content: '🔒 Saving HTML transcript and deleting channel in 5 seconds...' });

    try {
      const attachment = await discordTranscripts.createTranscript(interaction.channel, {
        limit: -1,
        fileName: `${interaction.channel.name}-transcript.html`,
        returnType: 'attachment',
        poweredBy: false
      });

      const transcriptChannel = await client.channels.fetch(TICKET_TRANSCRIPT_CHANNEL_ID).catch(() => null);
      if (transcriptChannel && transcriptChannel.isTextBased()) {
        const embed = createEmbed({ 
          title: `🔒 Ticket Closed & Transcribed (${interaction.channel.name})` 
        }).addFields(
          { name: 'Closed By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
          { name: 'Ticket Channel', value: interaction.channel.name, inline: true }
        );

        await transcriptChannel.send({ embeds: [embed], files: [attachment] });
      }
    } catch (err) {
      logger.error('Transcript Error on Ticket Close:', err);
    }

    setTimeout(async () => {
      await interaction.channel.delete().catch(() => {});
    }, 5000);
  }
};
