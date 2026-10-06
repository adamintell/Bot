import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { logger } from '../../../utils/logger.js';

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || '1541012779358756945';

export default {
    name: 'unclaim_ticket',
    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => {});
        }

        const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || 
                        interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        
        if (!isStaff) {
            return await interaction.followUp({ content: '⚠️ Only support staff can unclaim tickets.', flags: 64 });
        }

        try {
            const messages = await interaction.channel.messages.fetch({ limit: 10 }).catch(() => null);
            const initialMsg = messages?.find(m => m.embeds.length > 0 && m.author.id === client.user.id);

            if (!initialMsg) {
                return await interaction.followUp({ content: '⚠️ Could not find ticket embed.', flags: 64 });
            }

            const updatedEmbed = EmbedBuilder.from(initialMsg.embeds[0]);
            const fields = updatedEmbed.data.fields || [];
            const idx = fields.findIndex(f => f.name === 'Claimed By');

            if (idx !== -1) {
                fields[idx].value = 'Unclaimed';
            }

            updatedEmbed.setFields(fields);
            await initialMsg.edit({ embeds: [updatedEmbed] });
            await interaction.followUp({ content: `🔄 <@${interaction.user.id}> unclaimed this ticket.` });
        } catch (err) {
            logger.error('Unclaim Ticket Error:', err);
            await interaction.followUp({ content: '❌ Failed to unclaim ticket.', flags: 64 });
        }
    }
};