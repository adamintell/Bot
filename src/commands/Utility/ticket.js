import { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder,
    PermissionFlagsBits
} from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const TICKET_PANEL_CHANNEL_ID = process.env.TICKET_PANEL_CHANNEL_ID || '1541012981041725481';

export default {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Deploys or resends the support ticket hub panel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    category: 'utility',

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: 64 });
        if (!deferSuccess) return;

        try {
            const channel = await interaction.guild.channels.fetch(TICKET_PANEL_CHANNEL_ID).catch(() => null);
            if (!channel) {
                return await InteractionHelper.safeEditReply(interaction, {
                    content: `❌ Could not find channel ID \`${TICKET_PANEL_CHANNEL_ID}\`.`
                });
            }

            const recentMessages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
            if (recentMessages) {
                const oldPanels = recentMessages.filter(m => (m.author.id === client.user.id || m.author.bot) && m.components.length > 0);
                for (const [, msg] of oldPanels) {
                    await msg.delete().catch(() => {});
                }
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('Select a ticket type...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('General Help')
                        .setDescription('Get help with server or gameplay inquiries.')
                        .setValue('ticket_general')
                        .setEmoji('🎫'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Bug Report')
                        .setDescription('Report a bug or unexpected issue.')
                        .setValue('ticket_bug')
                        .setEmoji('🐛'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Player Report')
                        .setDescription('Report a player breaking server rules.')
                        .setValue('ticket_report')
                        .setEmoji('⚠️')
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);
            const panelEmbed = createEmbed({
                title: '📩 Support Ticket Hub',
                description: 'Need assistance? Select a topic below to open a private support ticket:'
            });

            await channel.send({ embeds: [panelEmbed], components: [row] });

            await InteractionHelper.safeEditReply(interaction, {
                content: `✅ Fresh Support Ticket panel deployed to <#${TICKET_PANEL_CHANNEL_ID}>!`
            });
        } catch (err) {
            logger.error('Error deploying ticket panel via command:', err);
        }
    }
};
