import { PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import discordTranscripts from 'discord-html-transcripts';
import { createEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || '1541012779358756945';
const TICKET_TRANSCRIPT_CHANNEL_ID = process.env.TICKET_TRANSCRIPT_CHANNEL_ID || '1549553157456007208';

export default {
  customId: 'close_ticket',
  name: 'close_ticket',

  async execute(interaction, client) {
    // 1. Immediately defer to avoid 3s Discord timeout
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || 
                    interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    
    if (!isStaff) {
      return await interaction.editReply({ content: '⚠️ Only support staff can close tickets.' });
    }

    await interaction.editReply({ content: '🔒 Generating transcript and closing ticket in 5 seconds...' });

    try {
      // 2. Generate HTML transcript using safe transcript builder
      const transcriptAttachment = await discordTranscripts.createTranscript(interaction.channel, {
        limit: -1,
        fileName: `${interaction.channel.name}-transcript.html`,
        saveImages: true,
        poweredBy: false
      });

      // 3. Fetch Transcript Log Channel
      const transcriptChannel = await client.channels.fetch(TICKET_TRANSCRIPT_CHANNEL_ID).catch((err) => {
        logger.error(`[Transcript Error] Could not fetch transcript channel ${TICKET_TRANSCRIPT_CHANNEL_ID}:`, err);
        return null;
      });

      if (transcriptChannel && transcriptChannel.isTextBased()) {
        const embed = createEmbed({ 
          title: `🔒 Ticket Closed & Transcribed`,
          description: `**Channel:** \`${interaction.channel.name}\`\n**Closed By:** <@${interaction.user.id}> (${interaction.user.tag})` 
        });

        await transcriptChannel.send({ 
          embeds: [embed], 
          files: [transcriptAttachment] 
        }).catch((err) => {
          logger.error('[Transcript Error] Failed sending transcript file to channel:', err);
        });
      } else {
        logger.warn(`[Transcript Warning] Channel ID ${TICKET_TRANSCRIPT_CHANNEL_ID} is invalid or not text-based.`);
      }

    } catch (err) {
      logger.error('Error generating transcript on close:', err);
    }

    // 4. Delete channel safely after 5-second countdown
    setTimeout(async () => {
      await interaction.channel.delete('Ticket Closed by Staff').catch((err) => {
        logger.error('Failed to delete ticket channel:', err);
      });
    }, 5000);
  }
};
