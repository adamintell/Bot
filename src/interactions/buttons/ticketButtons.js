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
            // Acknowledge interaction instantly
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate().catch(() => {});
            }

            const isStaff = interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID) || 
                            interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            
            if (!isStaff) {
                return await interaction.followUp({ content: '⚠️ Only support staff can claim tickets.', flags: 64 });
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
                    fields[idx].value = `<@${interaction.user.id}> (${interaction.user.tag})`;
                } else {
                    fields.push({ name: 'Claimed By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true });
                }

                updatedEmbed.setFields(fields);
                await initialMsg.edit({ embeds: [updatedEmbed] });

                await interaction.followUp({ content: `✅ <@${interaction.user.id}> has claimed this ticket!` });
            } catch (err) {
                logger.error('Claim Ticket Error:', err);
                await interaction.followUp({ content: '❌ Failed to claim ticket.', flags: 64 });
            }
        }
    },
    {
        name: 'unclaim_ticket',
        async execute(interaction, client) {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate().catch(() => {});
            }

            const isStaff = interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID) || 
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
    },
    {
        name: 'close_ticket',
        async execute(interaction, client) {
            // Instantly defer reply to stop 3s Discord timeout
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply().catch(() => {});
            }

            const isStaff = interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID) || 
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

                const transcriptChannel = await client.channels.fetch(CONFIG.TICKET_TRANSCRIPT_CHANNEL_ID).catch(() => null);
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
    }
];
