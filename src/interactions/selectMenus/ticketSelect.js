import { 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} from 'discord.js';
import { logger } from '../../utils/logger.js';

export default {
    name: 'ticket_select',
    async execute(interaction, client) {
        const selectedOption = interaction.values[0];

        try {
            if (selectedOption === 'ticket_general') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_ticket_general')
                    .setTitle('General Help Ticket');

                const q1 = new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('ticket_subject')
                        .setLabel('Subject / Issue Summary')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Need help with account/gameplay...')
                        .setRequired(true)
                );

                const q2 = new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('ticket_details')
                        .setLabel('Detailed Explanation')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Explain what you need assistance with...')
                        .setRequired(true)
                );

                modal.addComponents(q1, q2);
                return await interaction.showModal(modal);
            }

            if (selectedOption === 'ticket_bug') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_ticket_bug')
                    .setTitle('Bug Report Ticket');

                const q1 = new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('bug_title')
                        .setLabel('Bug Overview')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Vehicle glitching / UI issue...')
                        .setRequired(true)
                );

                const q2 = new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('bug_steps')
                        .setLabel('Steps to Reproduce')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('1. Spawn car\n2. Press key...')
                        .setRequired(true)
                );

                modal.addComponents(q1, q2);
                return await interaction.showModal(modal);
            }

            if (selectedOption === 'ticket_report') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_ticket_report')
                    .setTitle('Player Report Ticket');

                const q1 = new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('report_target')
                        .setLabel('Player Username / ID')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Username or Discord Tag')
                        .setRequired(true)
                );

                const q2 = new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('report_reason')
                        .setLabel('Reason & Evidence Links')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Rule broken, links to screenshots/videos...')
                        .setRequired(true)
                );

                modal.addComponents(q1, q2);
                return await interaction.showModal(modal);
            }
        } catch (err) {
            logger.error('Error opening ticket modal:', { error: err.message });
        }
    }
};