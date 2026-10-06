import { 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder 
} from 'discord.js';
import { createEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { getReactionRoleKey } from '../utils/database/keys.js';
import { getGuildConfig, setGuildConfig, patchGuildConfig } from './config/guildConfig.js';
import {
    getTicketPanelStatus,
    getVerificationPanelStatus,
    getReactionRolePanelStatus,
} from '../utils/panelStatus.js';
import { getAllReactionRoleMessages } from './reactionRoleService.js';

async function persistVerificationMessageId(client, guildId, config, messageId) {
    if (!messageId || config.verification?.messageId === messageId) return;
    await patchGuildConfig(client, guildId, {
        verification: { ...config.verification, messageId },
    });
}

async function persistReactionRoleMessageId(client, guildId, panelData, messageId) {
    if (!messageId || panelData.messageId === messageId) return;
    const oldKey = getReactionRoleKey(guildId, panelData.messageId);
    panelData.messageId = messageId;
    const newKey = getReactionRoleKey(guildId, messageId);
    await client.db.set(newKey, panelData);
    await client.db.delete(oldKey).catch(() => {});
}

// Helper to deploy a fresh Ticket Panel Embed
async function deployFreshTicketPanel(client, channel) {
    // Clean up any stale bot messages in the channel up to 50 messages back
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

    const newMsg = await channel.send({ embeds: [panelEmbed], components: [row] });
    return newMsg?.id || null;
}

export async function reconcileTicketPanels(client) {
    const summary = {
        scannedGuilds: 0,
        healthyPanels: 0,
        deletedPanels: 0,
        missingChannels: 0,
        recoveredIds: 0,
        errors: 0,
    };

    for (const guild of client.guilds.cache.values()) {
        summary.scannedGuilds += 1;

        try {
            const config = await getGuildConfig(client, guild.id);
            const channelId = config?.ticketPanelChannelId || process.env.TICKET_PANEL_CHANNEL_ID || '1541012981041725481';
            
            if (!channelId) continue;

            const channel = await guild.channels.fetch(channelId).catch(() => null);
            if (!channel || !channel.isTextBased()) {
                summary.missingChannels += 1;
                logger.warn(`Ticket panel channel missing for guild ${guild.id} (${guild.name})`);
                continue;
            }

            const panelStatus = await getTicketPanelStatus(client, guild, config);

            if (panelStatus.recoveredId) {
                summary.recoveredIds += 1;
                config.ticketPanelMessageId = panelStatus.recoveredId;
                await setGuildConfig(client, guild.id, config);
            }

            if (panelStatus.exists) {
                summary.healthyPanels += 1;
            } else if (panelStatus.reason === 'panel_deleted' || !panelStatus.exists) {
                summary.deletedPanels += 1;
                logger.warn(`Ticket panel missing/deleted for ${guild.name} — automatically re-deploying fresh panel...`);

                // Re-deploy panel and save new message ID to guild config
                const newMsgId = await deployFreshTicketPanel(client, channel);
                if (newMsgId) {
                    summary.recoveredIds += 1;
                    config.ticketPanelMessageId = newMsgId;
                    config.ticketPanelChannelId = channelId;
                    await setGuildConfig(client, guild.id, config);
                    logger.info(`Successfully re-deployed fresh ticket panel (Msg ID: ${newMsgId}) in ${guild.name}`);
                }
            }
        } catch (error) {
            summary.errors += 1;
            logger.warn(`Ticket panel health check failed for guild ${guild.id}:`, error.message);
        }
    }

    return summary;
}

export async function reconcileVerificationPanels(client) {
    const summary = {
        scannedGuilds: 0,
        healthyPanels: 0,
        deletedPanels: 0,
        missingChannels: 0,
        recoveredIds: 0,
        errors: 0,
    };

    for (const guild of client.guilds.cache.values()) {
        summary.scannedGuilds += 1;

        try {
            const config = await getGuildConfig(client, guild.id);
            const verification = config?.verification;
            if (!verification?.channelId || verification.enabled === false) continue;

            const panelStatus = await getVerificationPanelStatus(client, guild, verification);

            if (panelStatus.recoveredId) {
                summary.recoveredIds += 1;
                await persistVerificationMessageId(client, guild.id, config, panelStatus.recoveredId);
            }

            if (panelStatus.exists) {
                summary.healthyPanels += 1;
            } else if (panelStatus.reason === 'channel_missing') {
                summary.missingChannels += 1;
                logger.warn(`Verification panel channel missing for guild ${guild.id} (${guild.name})`);
            } else if (panelStatus.reason === 'panel_deleted') {
                summary.deletedPanels += 1;
                logger.warn(
                    `Verification panel deleted for guild ${guild.id} (${guild.name}) — repost from /verification dashboard`,
                );
            }
        } catch (error) {
            summary.errors += 1;
            logger.warn(`Verification panel health check failed for guild ${guild.id}:`, error.message);
        }
    }

    return summary;
}

export async function reconcileReactionRolePanelHealth(client) {
    const summary = {
        scannedGuilds: 0,
        scannedPanels: 0,
        healthyPanels: 0,
        deletedPanels: 0,
        missingChannels: 0,
        recoveredIds: 0,
        errors: 0,
    };

    for (const guild of client.guilds.cache.values()) {
        summary.scannedGuilds += 1;

        try {
            const panels = await getAllReactionRoleMessages(client, guild.id);
            if (!panels?.length) continue;

            for (const panelData of panels) {
                if (!panelData?.channelId || !panelData?.messageId) continue;
                summary.scannedPanels += 1;

                const panelStatus = await getReactionRolePanelStatus(client, guild, panelData);

                if (panelStatus.recoveredId) {
                    summary.recoveredIds += 1;
                    await persistReactionRoleMessageId(client, guild.id, panelData, panelStatus.recoveredId);
                }

                if (panelStatus.exists) {
                    summary.healthyPanels += 1;
                } else if (panelStatus.reason === 'channel_missing') {
                    summary.missingChannels += 1;
                    logger.warn(
                        `Reaction role panel channel missing for guild ${guild.id}, message ${panelData.messageId}`,
                    );
                } else if (panelStatus.reason === 'panel_deleted') {
                    summary.deletedPanels += 1;
                    logger.warn(
                        `Reaction role panel deleted for guild ${guild.id} — repost from /reactroles dashboard`,
                    );
                }
            }
        } catch (error) {
            summary.errors += 1;
            logger.warn(`Reaction role panel health check failed for guild ${guild.id}:`, error.message);
        }
    }

    return summary;
}
