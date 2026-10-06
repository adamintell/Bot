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
    await interaction.deferReply({ flags: 64 });
    const player = interaction.user;
    const guild = interaction.guild;

    try {
        const ticketID = String(ticketCounter++).padStart(4, '0');
        const channelName = `ticket-${ticketID}-${player.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CONFIG.TICKET_CATEGORY_ID || null,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: player.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
                { id: CONFIG.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
            ]
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

        await ticketChannel.send({
            content: `<@${player.id}> <@&${CONFIG.STAFF_ROLE_ID}>`,
            embeds: [ticketEmbed],
            components: [controlButtons]
        });

        const logChannel = await client.channels.fetch(CONFIG.TICKET_LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            const logEmbed = createEmbed({ title: `🎫 Ticket Opened (#${ticketID})` })
                .addFields(
                    { name: 'Ticket Number', value: `#${ticketID}`, inline: true },
                    { name: 'Opened By', value: `<@${player.id}> (${player.tag})`, inline: true },
                    { name: 'Channel', value: `<#${ticketChannel.id}>`, inline: true },
                    { name: 'Type', value: ticketType, inline: true }
                );
            await logChannel.send({ embeds: [logEmbed] });
        }

        await interaction.editReply({ content: `✅ Ticket created! Please head to <#${ticketChannel.id}>.` });
    } catch (err) {
        logger.error('Ticket Creation Error:', { error: err.message });
        await interaction.editReply({ content: `⚠️ Failed to create ticket channel: \`${err.message}\`` });
    }
}