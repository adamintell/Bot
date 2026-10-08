import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    MessageFlags 
} from 'discord.js';
import axios from 'axios';
import { getColor } from '../../config/bot.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';

const CONFIG = {
    API_KEY: process.env.API_KEY || 'MountWare',
    SUB_ADMIN_ROLE_ID: process.env.SUB_ADMIN_ROLE_ID || '1549163772357124238',
    WEBSITE_API_URL: process.env.WEBSITE_API_URL || 'https://www.interactivemountain.com/api'
};

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

export const addsubCommand = {
    data: new SlashCommandBuilder()
        .setName('addsub')
        .setDescription('Grant a subscription/tier to a Roblox user.')
        .addStringOption(option =>
            option.setName('roblox_id')
                .setDescription('Roblox User ID (e.g. 123456789)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('roblox_username')
                .setDescription('Roblox Username')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('tier')
                .setDescription('Subscription Tier')
                .setRequired(true)
                .addChoices(
                    { name: 'Lifetime VIP (Priority 100)', value: 'Lifetime VIP' },
                    { name: "Founder VIP (Priority 90)", value: "Founder VIP" },
                    { name: 'Tester VIP (Priority 85)', value: 'Tester VIP' },
                    { name: 'Diamond VIP (Priority 80)', value: 'Diamond VIP' },
                    { name: 'Titanium / PlatinumPro VIP (Priority 70)', value: 'Titanium VIP' },
                    { name: 'Platinum VIP (Priority 60)', value: 'Platinum VIP' },
                    { name: 'Gold VIP (Priority 50)', value: 'Gold VIP' },
                    { name: 'Silver VIP (Priority 40)', value: 'Silver VIP' }
                )
        ),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) return;

        // Role Check: Restrict usage to Role ID 1549163772357124238 or Administrators
        const hasRole = interaction.member.roles.cache.has(CONFIG.SUB_ADMIN_ROLE_ID);
        if (!hasRole && !interaction.member.permissions.has('Administrator')) {
            return await InteractionHelper.safeEditReply(interaction, {
                content: `❌ You do not have permission to run this command. Requires <@&${CONFIG.SUB_ADMIN_ROLE_ID}>.`
            });
        }

        const robloxId = interaction.options.getString('roblox_id').trim();
        const robloxUsername = interaction.options.getString('roblox_username').trim();
        const tier = interaction.options.getString('tier');
        const normalized = normalizeTier(tier);

        try {
            const response = await axios.post(`${CONFIG.WEBSITE_API_URL}/v1/subscribers/add`, {
                roblox_id: robloxId,
                roblox_username: robloxUsername,
                tier: tier,
                normalized_tier: normalized,
                source: 'Discord Bot',
                active: true,
                added_by: interaction.user.tag
            }, {
                headers: { 
                    'x-api-key': CONFIG.API_KEY,
                    'x-sf-api-key': CONFIG.API_KEY 
                },
                timeout: 5000
            });

            let headshotUrl = interaction.user.displayAvatarURL();
            if (robloxId && !isNaN(robloxId)) {
                try {
                    const thumbRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png&isCircular=false`);
                    if (thumbRes.data?.data?.[0]?.imageUrl) {
                        headshotUrl = thumbRes.data.data[0].imageUrl;
                    }
                } catch (tErr) {
                    logger.warn(`Could not fetch headshot for ${robloxId}:${tErr.message}`);
                }
            }

            const embed = new EmbedBuilder()
                .setColor(getColor('success') || 0x2ecc71)
                .setTitle('✅ SubSync Tier Successfully Granted!')
                .setThumbnail(headshotUrl)
                .addFields(
                    { name: 'Roblox Username', value: `**${robloxUsername}**`, inline: true },
                    { name: 'Roblox User ID', value: `\`${robloxId}\``, inline: true },
                    { name: 'Tier Granted', value: `🟢 **${tier}**`, inline: true },
                    { name: 'Normalized Rank', value: `⭐ **${normalized}** (Rank: ${TIER_PRIORITY[normalized] || 0})`, inline: true },
                    { name: 'Granted By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Roblox Profile', value: `[View Roblox Profile](https://www.roblox.com/users/${robloxId}/profile)`, inline: true }
                )
                .setFooter({ text: 'Interactive Mountain™ SubSync API' })
                .setTimestamp();

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

            try {
                await logEvent({
                    client: interaction.client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.USER_UPDATE || 'USER_UPDATE',
                    data: {
                        description: `${interaction.user.tag} granted ${tier} subscription to ${robloxUsername} (${robloxId})`,
                        userId: interaction.user.id,
                        robloxName: robloxUsername
                    }
                });
            } catch (logErr) {
                logger.warn('Failed to log addsub event:', logErr);
            }

        } catch (error) {
            logger.error('API Subscription Add Error:', error);
            const errorMsg = error.response?.data?.message || 'Failed to communicate with Interactive Mountain SubSync service.';
            await InteractionHelper.safeEditReply(interaction, {
                content: `⚠️ **Error:** ${errorMsg}`
            });
        }
    }
};