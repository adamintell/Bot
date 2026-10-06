import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import discordTranscripts from 'discord-html-transcripts';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

const CONFIG = {
    STAFF_ROLE_ID: process.env.STAFF_ROLE_ID || '1541012779358756945',
    TICKET_TRANSCRIPT_CHANNEL_ID: process.env.TICKET_TRANSCRIPT_CHANNEL_ID || '1549553157456007208'
};

export default [
    {
        name: 'claim_ticket',
        async execute(interaction, client) {
            const isStaff = interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!isStaff) return await interaction.reply({ content: '⚠️ Only support staff can claim tickets.', flags: 64 });

            const initialMsg = (await interaction.channel.messages.fetch({ limit: 10 })).find(m => m.embeds.length > 0 && m.author.id === client.user.id);
            if (!initialMsg) return await interaction.reply({ content: '⚠️ Could not find ticket embed.', flags: 64 });

            const updatedEmbed = EmbedBuilder.from(initialMsg.embeds[0]);
            const fields = updatedEmbed.data.fields || [];
            const idx = fields.findIndex(f => f.name === 'Claimed By');

            if (idx !== -1) fields[idx].value = `<@${interaction.user.id}> (${interaction.user.tag})`;
            else fields.push({ name: 'Claimed By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true });

            updatedEmbed.setFields(fields);
            await initialMsg.edit({ embeds: [updatedEmbed] });
            await interaction.reply({ content: `✅ <@${interaction.user.id}> has claimed this ticket!` });
        }
    },
    {
        name: 'unclaim_ticket',
        async execute(interaction, client) {
            const isStaff = interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!isStaff) return await interaction.reply({ content: '⚠️️ Only support staff can unclaim tickets.', flags: 64 });

            const initialMsg = (await interaction.channel.messages.fetch({ limit: 10 })).find(m => m.embeds.length > 0 && m.author.id === client.user.id);
            if (!initialMsg) return await interaction.reply({ content: '⚠️ Could not find ticket embed.', flags: 64 });

            const updatedEmbed = EmbedBuilder.from(initialMsg.embeds[0]);
            const fields = updatedEmbed.data.fields || [];
            const idx = fields.findIndex(f => f.name === 'Claimed By');

            if (idx !== -1) fields[idx].value = 'Unclaimed';

            updatedEmbed.setFields(fields);
            await initialMsg.edit({ embeds: [updatedEmbed] });
            await interaction.reply({ content: `🔄 <@${interaction.user.id}> unclaimed this ticket.` });
        }
    },
    {
        name: 'close_ticket',
        async execute(interaction, client) {
            const isStaff = interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!isStaff) return await interaction.reply({ content: '⚠️ Only support staff can close tickets.', flags: 64 });

            await interaction.reply({ content: '🔒 Saving transcript and closing channel in 5 seconds...' });

            try {
                const attachment = await discordTranscripts.createTranscript(interaction.channel, {
                    limit: -1,
                    fileName: `${interaction.channel.name}-transcript.html`,
                    returnType: 'attachment',
                    poweredBy: false
                });

                const transcriptChannel = await client.channels.fetch(CONFIG.TICKET_TRANSCRIPT_CHANNEL_ID).catch(() => null);
                if (transcriptChannel) {
                    const embed = createEmbed({ title: `🔒 Ticket Closed & Transcribed (${interaction.channel.name})` })
                        .addFields(
                            { name: 'Closed By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                            { name: 'Ticket Channel', value: interaction.channel.name, inline: true }
                        );
                    await transcriptChannel.send({ embeds: [embed], files: [attachment] });
                }
            } catch (err) {
                logger.error('Transcript Error:', { error: err.message });
            }

            setTimeout(async () => {
                await interaction.channel.delete().catch(() => {});
            }, 5000);
        }
    }
];