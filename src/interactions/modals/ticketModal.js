import { 
    ChannelType, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

let ticketCounter = 1;

const CONFIG = {
    STAFF_ROLE_ID: process.env.STAFF_ROLE_ID || '1541012779358756945',
    TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID || '1546534588967424010',
    TICKET_LOG_CHANNEL_ID: process.env.TICKET_LOG_CHANNEL_ID || '1546531415645233232'
};

export default [
    {
        name: 'modal_ticket_general',
        async execute(interaction, client) {
            await handleTicketCreation(interaction, client, 'general', '🎫 General Support Ticket', [
                { name: 'Subject', value: interaction.fields.getTextInputValue('ticket_subject') },
                { name: 'Details', value: interaction.fields.getTextInputValue('ticket_details') }
            ]);
        }
    },
    {
        name: 'modal_ticket_bug',
        async execute(interaction, client) {
            await handleTicketCreation(interaction, client, 'bug', '🐛 Bug Report Ticket', [
                { name: 'Bug Title', value: interaction.fields.getTextInputValue('bug_title') },
                { name: 'Steps / Details', value: interaction.fields.getTextInputValue('bug_steps') }
            ]);
        }
    },
    {
        name: 'modal_ticket_report',
        async execute(interaction, client) {
            await handleTicketCreation(interaction, client, 'report', '⚠️ Player Report Ticket', [
                { name: 'Reported Player', value: interaction.fields.getTextInputValue('report_target') },
                { name: 'Reason & Evidence', value: interaction.fields.getTextInputValue('report_reason') }
            ]);
        }
    }
];

async function handleTicketCreation(interaction, client, ticketType, title, fields) {
    // Safely defer reply if not already deferred
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 }).catch(() => {});
    }

    const player = interaction.user;
    const guild = interaction.guild;

    try {
        const ticketID = String(ticketCounter++).padStart(4, '0');
        const sanitizedUsername = player.username.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
        const channelName = `ticket-${ticketID}-${sanitizedUsername}`;

        // Build valid permission overwrites
        const permissionOverwrites = [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: player.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ];

        // Safely add Staff Role overwrite if the role exists in the server
        const staffRole = guild.roles.cache.get(CONFIG.STAFF_ROLE_ID);
        if (staffRole) {
            permissionOverwrites.push({
                id: staffRole.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory]
            });
        }

        // Validate Ticket Category
        let categoryId = CONFIG.TICKET_CATEGORY_ID;
        const categoryExists = guild.channels.cache.has(categoryId);
        if (!categoryExists) categoryId = null;

        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites
        });

        const controlButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('🙋‍♂️ Claim Ticket').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('🔄 Unclaim Ticket').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
        );

        const ticketEmbed = createEmbed({
            title: `${title} (#${ticketID})`,
            description: 'Support staff will be with you shortly. Use the controls below to manage this ticket.'
        })
            .setAuthor({ name: player.tag, iconURL: player.displayAvatarURL() })
            .addFields(
                ...fields,
                { name: 'Ticket Number', value: `#${ticketID}`, inline: true },
                { name: 'Claimed By', value: 'Unclaimed', inline: true }
            );

        const pingContent = staffRole ? `<@${player.id}> <@&${staffRole.id}>` : `<@${player.id}>`;

        await ticketChannel.send({
            content: pingContent,
            embeds: [ticketEmbed],
            components: [controlButtons]
        });

        // Send log entry
        const logChannel = await client.channels.fetch(CONFIG.TICKET_LOG_CHANNEL_ID).catch(() => null);
        if (logChannel && logChannel.isTextBased()) {
            const logEmbed = createEmbed({ title: `🎫 Ticket Opened (#${ticketID})` })
                .addFields(
                    { name: 'Ticket Number', value: `#${ticketID}`, inline: true },
                    { name: 'Opened By', value: `<@${player.id}> (${player.tag})`, inline: true },
                    { name: 'Channel', value: `<#${ticketChannel.id}>`, inline: true },
                    { name: 'Type', value: ticketType, inline: true }
                );
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }

        await interaction.editReply({ content: `✅ Ticket created! Please head to <#${ticketChannel.id}>.` });

    } catch (err) {
        logger.error('Ticket Creation Failed:', err);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: `⚠️ Failed to create ticket: \`${err.message}\`` }).catch(() => {});
        }
    }
}
