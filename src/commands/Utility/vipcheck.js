import { SlashCommandBuilder } from 'discord.js';
import fetch from 'node-fetch';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const TIER_PRIORITY = {
    Lifetime: 100,
    Founder: 90,
    Tester: 85,
    Diamond: 80,
    PlatinumPro: 70,
    Platinum: 60,
    Gold: 50,
    Silver: 40
};

const TIER_ALIASES = {
    'PlatinumPro (Titanium VIP)': 'PlatinumPro',
    'Titanium VIP': 'PlatinumPro',
    'Platinum VIP': 'Platinum',
    'Gold VIP': 'Gold',
    'Silver VIP': 'Silver',
    'Diamond VIP': 'Diamond',
    'Founder VIP': 'Founder',
    "Founder's VIP": 'Founder',
    'Tester VIP': 'Tester',
    'Playtesters': 'Tester',
    'Gameplay Testers': 'Tester',
    'Lifetime VIP': 'Lifetime',
    'platinumpro': 'PlatinumPro',
    'titanium': 'PlatinumPro',
    'platinum': 'Platinum',
    'gold': 'Gold',
    'silver': 'Silver',
    'diamond': 'Diamond',
    'founder vip': 'Founder',
    "founder's vip": 'Founder',
    'founder': 'Founder',
    'tester': 'Tester',
    'playtester': 'Tester',
    'lifetime': 'Lifetime'
};

function normalizeTier(rawTier) {
    if (!rawTier || typeof rawTier !== 'string') return 'Free';
    const clean = rawTier.trim();
    if (TIER_ALIASES[clean]) return TIER_ALIASES[clean];
    if (TIER_ALIASES[clean.toLowerCase()]) return TIER_ALIASES[clean.toLowerCase()];
    return clean;
}

export default {
    data: new SlashCommandBuilder()
        .setName('vipcheck')
        .setDescription('Check VIP subscription status and Roblox linkage for a member')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Discord member to look up')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('target')
                .setDescription('Enter Discord ID, Roblox User ID, or Username')
                .setRequired(false)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const targetWebsite = process.env.TARGET_WEBSITE || 'https://www.interactivemountain.com';
        const apiKey = process.env.API_KEY || 'MountWare';

        const userOption = interaction.options.getUser('user');
        const rawTarget = interaction.options.getString('target');

        let searchParam = userOption ? userOption.id : (rawTarget ? rawTarget.trim() : interaction.user.id);
        let searchType = userOption ? 'discord_id' : (/^\d+$/.test(searchParam) ? 'id' : 'username');

        logger.info(`[SUBSYNC] VIP check - userOption: ${userOption?.id || 'null'}, target: ${searchParam}, searchType:${searchType}`);

        const apiUrl = `${targetWebsite}/api/v1/subscribers/check?${searchType}=${encodeURIComponent(searchParam)}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        }).catch((err) => {
            logger.warn(`[SUBSYNC] API Connection failed: ${err.message}`);
            return null;
        });

        clearTimeout(timeout);

        if (!response || !response.ok) {
            const fallbackEmbed = createEmbed({
                title: `👑 VIP & Linkage Status: ${userOption?.username || searchParam}`,
                description: `Could not reach SubSync API or account is not registered.`,
            })
            .setColor('#F1C40F')
            .setThumbnail(userOption?.displayAvatarURL() || null)
            .addFields(
                { name: 'Discord Account', value: userOption ? `<@${userOption.id}> (\`${userOption.id}\`)` : `\`${searchParam}\``, inline: true },
                { name: 'Linked Roblox Account', value: '`Not Linked / Unreachable`', inline: true },
                { name: 'VIP Status', value: '`No VIP / Free`', inline: true },
                { name: 'Website Profile', value: `[Interactive Mountain Profile](${targetWebsite})` }
            )
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            });

            return await InteractionHelper.safeEditReply(interaction, { embeds: [fallbackEmbed] });
        }

        const data = await response.json().catch(() => null);

        if (!data) {
            throw createError(
                "Invalid response from API",
                ErrorTypes.API,
                "Received malformed JSON from the SubSync server."
            );
        }

        const isSubscribed = data.active || false;
        const rawPlan = data.plan || data.tier || 'Free';
        const normalizedPlan = normalizeTier(rawPlan);
        const priorityScore = TIER_PRIORITY[normalizedPlan] || 0;

        const robloxUsername = data.robloxUsername || data.roblox_name || 'Not Linked';
        const robloxId = data.robloxId || data.roblox_id || 'N/A';
        const expirationText = data.expiresAt ? `<t:${Math.floor(new Date(data.expiresAt).getTime() / 1000)}:R>` : 'Lifetime / Active';

        const embed = createEmbed({
            title: `👑 VIP & SubSync Status`,
            description: `Subscription details for **${robloxUsername}**.`,
        })
            .setColor(isSubscribed ? '#2ECC71' : '#E74C3C')
            .setThumbnail(userOption?.displayAvatarURL() || null)
            .addFields(
                { name: 'Discord Member', value: userOption ? `<@${userOption.id}> (\`${userOption.id}\`)` : `\`${searchParam}\``, inline: true },
                { name: 'Roblox Linked', value: robloxUsername !== 'Not Linked' ? `**${robloxUsername}** (\`${robloxId}\`)` : '`Not Linked`', inline: true },
                { name: 'Active Tier', value: isSubscribed ? `🟢 **${rawPlan}** (${normalizedPlan})` : '🔴 **No Active VIP**', inline: true },
                { name: 'Tier Priority', value: isSubscribed ? `⭐ **${priorityScore}**` : '`0`', inline: true },
                { name: 'Expires / Renews', value: expirationText, inline: true },
                { name: 'Website Account', value: `[View Account](${targetWebsite})`, inline: true }
            )
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            });

        logger.info(`[SUBSYNC] VIP check completed`, { target: searchParam, isSubscribed, tier: normalizedPlan });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'vipcheck' })
};
