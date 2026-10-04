import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags, 
    EmbedBuilder 
} from 'discord.js';
import axios from 'axios';
import { getColor } from '../../config/bot.js';
import { logger } from '../../utils/logger.js';
import { createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';

const CONFIG = {
    API_KEY: 'MountWare',
    CHANNEL_ID: '1549884201694924860',
    VERIFIED_ROLE_ID: '1549884565932216332',
    STAFF_ROLE_ID: '1549908626527756349',
    WEBSITE_API_URL: 'https://www.interactivemountain.com/api'
};

// ==========================================
// PURSUIT VERIFICATION COMMAND & HELPERS
// ==========================================

export const pursuitVerificationCommand = {
    data: new SlashCommandBuilder()
        .setName('pursuitverification')
        .setDescription('Lookup or manage Pursuit Verification account details for a member.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The Discord member you want to look up')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (CONFIG.STAFF_ROLE_ID && !interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) {
            throw createError(
                'Unauthorized staff command usage',
                ErrorTypes.PERMISSION,
                '❌ You do not have permission to use pursuit verification lookup commands.'
            );
        }

        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) return;

        const targetUser = interaction.options.getUser('target');

        try {
            const response = await axios.get(`${CONFIG.WEBSITE_API_URL}/member/discord/${targetUser.id}`, {
                headers: { 'x-sf-api-key': CONFIG.API_KEY },
                timeout: 5000
            });

            const data = response.data;
            const robloxName = data?.robloxUsername || data?.roblox_username || data?.username;
            let robloxId = data?.robloxId || data?.roblox_id;
            const isVerified = (data?.isVerified || data?.verified) ? 'Yes' : 'No';

            if (!robloxName) {
                return await InteractionHelper.safeEditReply(interaction, {
                    content: `❌ **No Account Found:** <@${targetUser.id}> has not completed Pursuit Verification on \`interactivemountain.com\`.`
                });
            }

            let robloxAvatar = targetUser.displayAvatarURL({ dynamic: true });

            if (robloxId && !isNaN(robloxId)) {
                try {
                    const thumbRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png&isCircular=false`);
                    if (thumbRes.data?.data?.[0]?.imageUrl) {
                        robloxAvatar = thumbRes.data.data[0].imageUrl;
                    }
                } catch (tErr) {
                    logger.warn(`Could not fetch Roblox headshot for ${robloxId}:${tErr.message}`);
                }
            } else {
                try {
                    const rblxRes = await axios.post('https://users.roblox.com/v1/usernames/users', {
                        usernames: [robloxName],
                        excludeBannedUsers: false
                    });
                    if (rblxRes.data?.data?.[0]?.id) {
                        robloxId = rblxRes.data.data[0].id;
                        const thumbRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png&isCircular=false`);
                        if (thumbRes.data?.data?.[0]?.imageUrl) {
                            robloxAvatar = thumbRes.data.data[0].imageUrl;
                        }
                    }
                } catch (rErr) {
                    logger.warn(`Could not query Roblox API for username ${robloxName}:${rErr.message}`);
                }
            }

            const profileUrl = (robloxId && !isNaN(robloxId))
                ? `https://www.roblox.com/users/${robloxId}/profile`
                : `https://www.roblox.com/search/users?keyword=${encodeURIComponent(robloxName)}`;

            const staffEmbed = new EmbedBuilder()
                .setColor(getColor('info'))
                .setTitle(`Pursuit Verification Data — ${targetUser.tag}`)
                .setThumbnail(robloxAvatar)
                .addFields(
                    { name: 'Discord User', value: `<@${targetUser.id}> (\`${targetUser.id}\`)`, inline: false },
                    { name: 'Linked Roblox Username', value: `\`${robloxName}\``, inline: true },
                    { name: 'Roblox User ID', value: `\`${robloxId || 'N/A'}\``, inline: true },
                    { name: 'Pursuit Verified', value: `\`${isVerified}\``, inline: true },
                    { name: 'Roblox Profile Link', value: `[View Profile](${profileUrl})`, inline: false }
                )
                .setFooter({ text: 'Interactive Mountain™ Pursuit Verification System' })
                .setTimestamp();

            await InteractionHelper.safeEditReply(interaction, { embeds: [staffEmbed] });

        } catch (error) {
            if (error.response?.status === 404) {
                await InteractionHelper.safeEditReply(interaction, {
                    content: `❌ **No Data:** <@${targetUser.id}> is not registered in the Pursuit Verification database.`
                });
            } else {
                logger.error('API Pursuit Verification Lookup Error:', error);
                throw createError(
                    'Failed to query pursuit verification API',
                    ErrorTypes.API,
                    '⚠️ Failed to pull player info from the pursuit verification API.',
                    { targetUserId: targetUser.id }
                );
            }
        }
    }
};

export async function handlePursuitVerificationButton(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    if (!deferSuccess) return;

    const userId = interaction.user.id;

    try {
        const response = await axios.get(`${CONFIG.WEBSITE_API_URL}/member/discord/${userId}`, {
            headers: { 'x-sf-api-key': CONFIG.API_KEY },
            timeout: 5000
        });

        const robloxName = response.data?.robloxUsername || response.data?.roblox_username || response.data?.username;

        if (!robloxName) {
            return await InteractionHelper.safeEditReply(interaction, {
                content: '❌ **Unverified!** You have not completed Pursuit Verification on our website yet.\n\nClick **Link Account** above, copy your verification code, and verify it under `interactivemountain.com/settings`.'
            });
        }

        const member = interaction.member;
        let nicknameUpdated = true;

        try {
            await member.setNickname(robloxName);
        } catch (nickErr) {
            nicknameUpdated = false;
            logger.warn(`Could not change nickname for ${interaction.user.tag}: ${nickErr.message}`);
        }

        if (CONFIG.VERIFIED_ROLE_ID) {
            try {
                await member.roles.add(CONFIG.VERIFIED_ROLE_ID);
            } catch (roleErr) {
                logger.warn(`Could not add pursuit verified role to ${interaction.user.tag}: ${roleErr.message}`);
            }
        }

        if (nicknameUpdated) {
            await InteractionHelper.safeEditReply(interaction, {
                content: `✅ **Pursuit Verified!** Your server nickname has been updated to **${robloxName}** and your verified role has been assigned!`
            });
        } else {
            await InteractionHelper.safeEditReply(interaction, {
                content: `✅ **Pursuit Verified!** Roles synced for **${robloxName}**! *(Note: Server owner or admin nicknames cannot be modified by bots).*`
            });
        }

        try {
            await logEvent({
                client: interaction.client,
                guildId: interaction.guildId,
                eventType: EVENT_TYPES.USER_VERIFY,
                data: {
                    description: `User ${interaction.user.tag} completed Pursuit Verification as ${robloxName}`,
                    userId: interaction.user.id,
                    robloxName: robloxName
                }
            });
        } catch (logErr) {
            logger.warn('Failed to log pursuit verification event:', logErr);
        }

    } catch (error) {
        if (error.response?.status === 404) {
            await InteractionHelper.safeEditReply(interaction, {
                content: '❌ **Account Not Found!** Please go to `interactivemountain.com/settings` and complete the Pursuit Verification bio step first.'
            });
        } else {
            logger.error('Pursuit Verification Button API Error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                content: '⚠️ Pursuit Verification service unavailable. Please try again in a few moments.'
            });
        }
    }
}

export async function setupPursuitVerificationPanel(client) {
    try {
        const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);
        if (!channel) {
            logger.error(`Pursuit Verification channel ${CONFIG.CHANNEL_ID} not found.`);
            return;
        }

        const verifyEmbed = new EmbedBuilder()
            .setColor(getColor('info'))
            .setTitle('Pursuit Verification — Interactive Mountain')
            .setDescription(
                'Linking your Discord and Roblox accounts via Pursuit Verification unlocks member roles, keeps your group ranks in sync, and ties your site purchases to this server.\n\n' +
                '**How to complete Pursuit Verification**\n' +
                '1. Go to `interactivemountain.com/settings` and log in.\n' +
                '2. Generate a verification code under **Link Roblox Account**.\n' +
                '3. Paste the code into your **Roblox Profile Bio** and click **Verify Bio** on the site.\n' +
                '4. Click **Update Roles** below to sync your Discord nickname and roles!\n\n' +
                'Stuck? Open a support ticket and our staff will assist you.'
            )
            .setFooter({ text: 'Interactive Mountain™ Pursuit Verification' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Roblox Group')
                .setStyle(ButtonStyle.Link)
                .setURL('https://www.roblox.com/communities/805966808/Mountain-Community'),
            new ButtonBuilder()
                .setLabel('Link Account')
                .setStyle(ButtonStyle.Link)
                .setURL('https://www.interactivemountain.com/settings'),
            new ButtonBuilder()
                .setCustomId('update_roles')
                .setLabel('Update Roles')
                .setStyle(ButtonStyle.Primary)
        );

        const messages = await channel.messages.fetch({ limit: 10 });
        const existing = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);
        if (!existing) {
            await channel.send({ embeds: [verifyEmbed], components: [row] });
            logger.info('Pursuit Verification panel posted successfully!');
        }
    } catch (panelErr) {
        logger.error('Error setting up Pursuit Verification panel:', panelErr);
    }
}
