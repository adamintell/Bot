import { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder 
} from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const TICKET_PANEL_CHANNEL_ID = process.env.TICKET_PANEL_CHANNEL_ID || '1541012981041725481';

export default {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Open the player support ticket menu.'),
    category: 'utility',

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: 64 });
        if (!deferSuccess) {
            logger.warn('Tickets command defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId
            });
            return;
        }

        if (TICKET_PANEL_CHANNEL_ID && interaction.channelId !== TICKET_PANEL_CHANNEL_ID) {
            throw new TitanBotError(
                'Invalid channel',
                ErrorTypes.USER_INPUT,
                `You can only use this command in <#${TICKET_PANEL_CHANNEL_ID}>!`
            );
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
        const embed = createEmbed({
            title: '📩 Support Ticket Hub',
            description: 'Need assistance? Select a topic below to open a private ticket:'
        });

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed],
            components: [row]
        });

        logger.info('Tickets command executed', {
            userId: interaction.user.id,
            guildId: interaction.guildId
        });
    }
};