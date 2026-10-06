import { PermissionFlagsBits } from 'discord.js';
import { createEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || '1541012779358756945';
const TICKET_TRANSCRIPT_CHANNEL_ID = process.env.TICKET_TRANSCRIPT_CHANNEL_ID || '1549553157456007208';

export default {
  customId: 'close_ticket',
  name: 'close_ticket',

  async execute(interaction, client) {
    // 1. Immediately defer reply so Discord doesn't timeout
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || 
                    interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    
    if (!isStaff) {
      return await interaction.editReply({ content: '⚠️ Only support staff can close tickets.' });
    }

    await interaction.editReply({ content: '🔒 Ticket closing and channel deleting in 5 seconds...' });

    try {
      // 2. Fetch transcript log channel
      const transcriptChannel = await client.channels.fetch(TICKET_TRANSCRIPT_CHANNEL_ID).catch(() => null);

      if (transcriptChannel && transcriptChannel.isTextBased()) {
        const closedEmbed = createEmbed({ 
          title: `🔒 Ticket Closed`,
          description: `**Channel:** \`${interaction.channel.name}\`\n**Closed By:** <@${interaction.user.id}> (${interaction.user.tag})` 
        });

        await transcriptChannel.send({ embeds: [closedEmbed] }).catch(() => {});
      }
    } catch (err) {
      logger.error('Error logging closed ticket to transcript channel:', err);
    }

    // 3. Delete ticket channel after 5 seconds
    setTimeout(async () => {
      await interaction.channel.delete('Ticket Closed by Staff').catch((err) => {
        logger.error('Failed deleting channel:', err);
      });
    }, 5000);
  }
};
