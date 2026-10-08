import 'dotenv/config';
import { 
    Client, 
    GatewayIntentBits, 
    Events, 
    EmbedBuilder, 
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    SlashCommandBuilder,
    REST,
    Routes
} from 'discord.js';
import fetch from 'node-fetch';

// ==========================================
// CONFIGURATION & SUBSCRIPTION DATA MAPS
// ==========================================
const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN || process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID || '1318042571216551978',
    GUILD_ID: process.env.GUILD_ID || '', 

    APPLY_CHANNEL_ID: process.env.APPLY_CHANNEL_ID || '1551220007051206737',
    APP_LOG_CHANNEL_ID: process.env.APP_LOG_CHANNEL_ID || '1551217750498607204', 
    REVIEWER_ROLE_ID: process.env.REVIEWER_ROLE_ID || '1551216636235747468',
    COMMUNITY_STAFF_ROLE_ID: process.env.COMMUNITY_STAFF_ROLE_ID || '1541012779358756945',
    SUB_ADMIN_ROLE_ID: process.env.SUB_ADMIN_ROLE_ID || '1549163772357124238', // Restricted Role ID
    
    // Website API Configuration
    TARGET_WEBSITE: process.env.TARGET_WEBSITE || 'https://www.interactivemountain.com',
    API_KEY: process.env.API_KEY || 'MountWare',

    // AutoMod Restricted Roles
    RESTRICTED_ROLE_CURSE: process.env.RESTRICTED_ROLE_1 || '1556747422376661022',
    RESTRICTED_ROLE_SLUR: process.env.RESTRICTED_ROLE_2 || '1556747628019064884',

    BANNER_URL: process.env.BANNER_URL || 'https://imgur.com/KTOgSoS.png',

    ALLOWED_ROLES: [
        process.env.ROLE_MEMBER_ID || '1541012796710461460',
        process.env.ROLE_VERIFIED_MEMBER_ID || '1549884565932216332'
    ],

    ROLE_IDS: {
        'Trial Moderator': process.env.ROLE_TRIAL_MODERATOR || '1541012783246872586'
    }
};

// SubSync Priorities & Aliases
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
    if (!rawTier || typeof rawTier !== 'string') return null;
    const clean = rawTier.trim();
    if (TIER_ALIASES[clean]) return TIER_ALIASES[clean];
    if (TIER_ALIASES[clean.toLowerCase()]) return TIER_ALIASES[clean.toLowerCase()];
    return clean;
}

// Word Filters
const CURSE_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'crap', 'dick'];
const SLUR_WORDS = ['nigger', 'nigga', 'faggot', 'fag', 'retard', 'tranny', 'chink', 'kike', 'spic'];

const activeDrafts = new Map();

// Initialize Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ==========================================
// SLASH COMMAND DEFINITIONS
// ==========================================
const commands = [
    // 1. /vipcheck
    new SlashCommandBuilder()
        .setName('vipcheck')
        .setDescription('Check VIP subscription status and Roblox linkage for a member.')
        .addUserOption(option => 
            option.setName('user').setDescription('Discord member to look up').setRequired(false)
        )
        .addStringOption(option => 
            option.setName('target').setDescription('Enter raw Discord ID, Roblox Username, or Roblox User ID').setRequired(false)
        ),

    // 2. /addsub
    new SlashCommandBuilder()
        .setName('addsub')
        .setDescription('Grant a subscription/tier to a Roblox user.')
        .addStringOption(option =>
            option.setName('roblox_id').setDescription('Roblox User ID (e.g. 123456789)').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('roblox_username').setDescription('Roblox Username').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('tier').setDescription('Subscription Tier').setRequired(true)
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
        )
].map(cmd => cmd.toJSON());

// Deploy Commands Function
async function registerSlashCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(CONFIG.BOT_TOKEN);
        const appId = client.user?.id || CONFIG.CLIENT_ID;

        console.log(`🔄 Deploying ${commands.length} application (/) commands for Application ID:${appId}...`);

        if (CONFIG.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(appId, CONFIG.GUILD_ID),
                { body: commands }
            );
            console.log(`⚡ Instantly registered commands in Guild ID: ${CONFIG.GUILD_ID}`);
        }

        await rest.put(
            Routes.applicationCommands(appId),
            { body: commands }
        );

        console.log('✅ Successfully registered (/vipcheck) and (/addsub) commands globally!');
    } catch (err) {
        console.error('❌ Failed to register slash commands:', err);
    }
}

// Helper function to re-send application panel
async function sendApplicationPanel() {
    try {
        const channel = await client.channels.fetch(CONFIG.APPLY_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) return console.error('[Error] Application channel not found.');

        const recentMessages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
        if (recentMessages) {
            const botMsgs = recentMessages.filter(m => m.author.id === client.user.id);
            for (const [_, msg] of botMsgs) {
                await msg.delete().catch(() => {});
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('Pursuit Studios Staff Applications')
            .setDescription(
                'Welcome to **Pursuit Studios**!\n\n' +
                '**Requirements to apply:**\n' +
                '• Must hold the **Member** or **Verified Member** role.\n' +
                '• Provide accurate and detailed responses.\n\n' +
                '👇 **Click the button below to start your application.**'
            )
            .setImage(CONFIG.BANNER_URL);

        const applyBtn = new ButtonBuilder()
            .setCustomId('start_app')
            .setLabel('Apply for Staff')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝');

        const row = new ActionRowBuilder().addComponents(applyBtn);

        await channel.send({ embeds: [embed], components: [row] });
        console.log('✅ Fresh Staff Application embed posted.');
    } catch (err) {
        console.error('Error posting application panel:', err);
    }
}

// ==========================================
// CLIENT READY EVENT
// ==========================================
client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);
    await registerSlashCommands();
    await sendApplicationPanel();
});

// ==========================================
// AUTOMOD MESSAGE LISTENER
// ==========================================
client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;

    const content = message.content.toLowerCase();
    const cleanContent = content.replace(/[^a-zA-Z0-9\s]/g, '');

    let assignedRole = null;
    let type = '';

    if (SLUR_WORDS.some(w => new RegExp(`\\b${w}\\b`, 'i').test(content) || new RegExp(`\\b${w}\\b`, 'i').test(cleanContent))) {
        assignedRole = CONFIG.RESTRICTED_ROLE_SLUR;
        type = 'Slur / Hate Speech';
    } 
    else if (CURSE_WORDS.some(w => new RegExp(`\\b${w}\\b`, 'i').test(content) || new RegExp(`\\b${w}\\b`, 'i').test(cleanContent))) {
        assignedRole = CONFIG.RESTRICTED_ROLE_CURSE;
        type = 'Profanity / Cursing';
    }

    if (assignedRole) {
        try {
            if (message.deletable) await message.delete().catch(() => {});
            
            if (message.member && !message.member.roles.cache.has(assignedRole)) {
                await message.member.roles.add(assignedRole);
            }

            const warnMsg = await message.channel.send({
                content: `<@${message.author.id}> ⚠️ Your message was deleted and a restriction role was applied for containing **${type}**.`
            });
            
            setTimeout(() => warnMsg.delete().catch(() => {}), 8000);
        } catch (err) {
            console.error('AutoMod action failed:', err);
        }
    }
});

// ==========================================
// INTERACTION HANDLER
// ==========================================
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            
            // 1. /vipcheck
            if (interaction.commandName === 'vipcheck') {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
                }

                const discordUser = interaction.options.getUser('user');
                const rawTarget = interaction.options.getString('target');

                let searchParam = discordUser ? discordUser.id : (rawTarget ? rawTarget.trim() : interaction.user.id);
                let searchType = discordUser ? 'discord_id' : (/^\d+$/.test(searchParam) ? 'id' : 'username');

                try {
                    const apiUrl = `${CONFIG.TARGET_WEBSITE}/api/v1/subscribers/check?${searchType}=${encodeURIComponent(searchParam)}`;
                    
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 5000);

                    const response = await fetch(apiUrl, {
                        method: 'GET',
                        headers: {
                            'x-api-key': CONFIG.API_KEY,
                            'Content-Type': 'application/json'
                        },
                        signal: controller.signal
                    }).catch(() => null);

                    clearTimeout(timeout);

                    if (!response || !response.ok) {
                        const fallbackEmbed = new EmbedBuilder()
                            .setColor(0xf1c40f)
                            .setTitle(`👑 VIP & Linkage Status: ${discordUser?.username || searchParam}`)
                            .setThumbnail(discordUser?.displayAvatarURL() || null)
                            .addFields(
                                { name: 'Discord Account', value: discordUser ? `<@${discordUser.id}> (\`${discordUser.id}\`)` : `\`${searchParam}\``, inline: true },
                                { name: 'Linked Roblox Account', value: '`Not Linked / Unreachable`', inline: true },
                                { name: 'VIP Status', value: '`No VIP / Free`', inline: true },
                                { name: 'Website Profile', value: `[Interactive Mountain Profile](${CONFIG.TARGET_WEBSITE})` }
                            )
                            .setFooter({ text: 'Interactive Mountain SubSync API' })
                            .setTimestamp();

                        return await interaction.editReply({ embeds: [fallbackEmbed] });
                    }

                    const data = await response.json();

                    const isSubscribed = data.active || false;
                    const rawPlan = data.plan || data.tier || 'Free';
                    const normalizedPlan = normalizeTier(rawPlan);
                    const priorityScore = TIER_PRIORITY[normalizedPlan] || 0;

                    const robloxUsername = data.robloxUsername || data.roblox_name || 'Not Linked';
                    const robloxId = data.robloxId || data.roblox_id || 'N/A';
                    const expirationText = data.expiresAt ? `<t:${Math.floor(new Date(data.expiresAt).getTime() / 1000)}:R>` : 'Lifetime / Active';

                    const embed = new EmbedBuilder()
                        .setColor(isSubscribed ? 0x2ecc71 : 0xe74c3c)
                        .setTitle(`👑 VIP & SubSync Status`)
                        .setThumbnail(discordUser?.displayAvatarURL() || null)
                        .addFields(
                            { name: 'Discord Member', value: discordUser ? `<@${discordUser.id}> (\`${discordUser.id}\`)` : `\`${searchParam}\``, inline: true },
                            { name: 'Roblox Linked', value: robloxUsername !== 'Not Linked' ? `**${robloxUsername}** (\`${robloxId}\`)` : '`Not Linked`', inline: true },
                            { name: 'Active Tier', value: isSubscribed ? `🟢 **${rawPlan}** (${normalizedPlan})` : '🔴 **No Active VIP**', inline: true },
                            { name: 'Tier Priority', value: isSubscribed ? `⭐ **${priorityScore}**` : '`0`', inline: true },
                            { name: 'Expires / Renews', value: expirationText, inline: true },
                            { name: 'Website Account', value: `[View Website Account](${CONFIG.TARGET_WEBSITE})`, inline: true }
                        )
                        .setFooter({ text: 'Interactive Mountain SubSync API' })
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [embed] });

                } catch (err) {
                    console.error('Error executing vipcheck:', err);
                    return await interaction.editReply({ content: '❌ An error occurred while executing the VIP check.' }).catch(() => {});
                }
            }

            // 2. /addsub
            if (interaction.commandName === 'addsub') {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
                }

                // Check Role Permission (Requires Role ID 1549163772357124238 or Admin)
                const hasRole = interaction.member.roles.cache.has(CONFIG.SUB_ADMIN_ROLE_ID);
                if (!hasRole && !interaction.member.permissions.has('Administrator')) {
                    return await interaction.editReply({
                        content: `❌ You do not have permission to use this command. Requires <@&${CONFIG.SUB_ADMIN_ROLE_ID}>.`
                    });
                }

                const robloxId = interaction.options.getString('roblox_id').trim();
                const robloxUsername = interaction.options.getString('roblox_username').trim();
                const tier = interaction.options.getString('tier');
                const normalized = normalizeTier(tier);

                try {
                    const response = await fetch(`${CONFIG.TARGET_WEBSITE}/api/v1/subscribers/add`, {
                        method: 'POST',
                        headers: {
                            'x-api-key': CONFIG.API_KEY,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            roblox_id: robloxId,
                            roblox_username: robloxUsername,
                            tier: tier,
                            normalized_tier: normalized,
                            source: 'Discord Bot',
                            active: true,
                            added_by: interaction.user.tag
                        })
                    });

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        return await interaction.editReply({ content: `❌ Failed to grant subscription: ${errData.message || response.statusText}` });
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x2ecc71)
                        .setTitle('✅ SubSync Tier Successfully Granted!')
                        .addFields(
                            { name: 'Roblox Username', value: `**${robloxUsername}**`, inline: true },
                            { name: 'Roblox ID', value: `\`${robloxId}\``, inline: true },
                            { name: 'Tier Granted', value: `🟢 **${tier}**`, inline: true },
                            { name: 'Normalized Rank', value: `⭐ **${normalized}** (Rank: ${TIER_PRIORITY[normalized] || 0})`, inline: true },
                            { name: 'Added By', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Website Link', value: `[View Account](${CONFIG.TARGET_WEBSITE})`, inline: true }
                        )
                        .setFooter({ text: 'Interactive Mountain Dev API' })
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [embed] });

                } catch (err) {
                    console.error('Error adding subscription via API:', err);
                    return await interaction.editReply({ content: '❌ Failed to communicate with Interactive Mountain API.' });
                }
            }
        }

        // Application Button Handlers
        if (interaction.isButton() && interaction.customId === 'start_app') {
            const hasRole = CONFIG.ALLOWED_ROLES.some(r => interaction.member?.roles.cache.has(r));
            if (!hasRole) {
                return await interaction.reply({ 
                    content: '⛔ You need the **Member** or **Verified Member** role to apply.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_pos')
                .setPlaceholder('Select a position...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Trial Moderator')
                        .setValue('Trial Moderator')
                        .setDescription('Entry-level moderation role.')
                        .setEmoji('🔰')
                );

            return await interaction.reply({
                content: 'Choose the position you are applying for:',
                components: [new ActionRowBuilder().addComponents(selectMenu)],
                flags: MessageFlags.Ephemeral
            });
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'select_pos') {
            const selectedPos = interaction.values[0];
            activeDrafts.set(interaction.user.id, selectedPos);

            const modal = new ModalBuilder()
                .setCustomId('app_modal')
                .setTitle(`Apply: ${selectedPos}`)
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('app_roblox')
                            .setLabel('Roblox Username / Profile Link')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('app_exp')
                            .setLabel('Relevant Experience')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('app_why')
                            .setLabel('Why should we hire you?')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('app_avail')
                            .setLabel('Availability (Hours/Timezone)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );

            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'app_modal') {
            const position = activeDrafts.get(interaction.user.id) || 'Trial Moderator';
            const roblox = interaction.fields.getTextInputValue('app_roblox');
            const exp = interaction.fields.getTextInputValue('app_exp');
            const why = interaction.fields.getTextInputValue('app_why');
            const avail = interaction.fields.getTextInputValue('app_avail');

            const logChannel = await interaction.guild.channels.fetch(CONFIG.APP_LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return await interaction.reply({ content: '❌ Review channel not found.', flags: MessageFlags.Ephemeral });

            const logEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`📥 New Application: ${position}`)
                .addFields(
                    { name: 'Applicant', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true },
                    { name: 'Position', value: position, inline: true },
                    { name: 'Roblox User/Link', value: roblox, inline: true },
                    { name: 'Availability', value: avail },
                    { name: 'Experience', value: exp },
                    { name: 'Why Hire?', value: why }
                )
                .setTimestamp();

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`approve_${interaction.user.id}`).setLabel('Approve').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`reject_${interaction.user.id}`).setLabel('Reject').setStyle(ButtonStyle.Danger).setEmoji('❌')
            );

            await logChannel.send({
                content: CONFIG.REVIEWER_ROLE_ID ? `<@&${CONFIG.REVIEWER_ROLE_ID}>` : null,
                embeds: [logEmbed],
                components: [actionRow]
            });

            activeDrafts.delete(interaction.user.id);
            return await interaction.reply({ content: '✅ Your application has been submitted!', flags: MessageFlags.Ephemeral });
        }

        if (interaction.isButton() && (interaction.customId.startsWith('approve_') || interaction.customId.startsWith('reject_'))) {
            const isApproved = interaction.customId.startsWith('approve_');
            const targetId = interaction.customId.split('_')[1];

            const embed = EmbedBuilder.from(interaction.message.embeds[0]);
            const posField = embed.data.fields.find(f => f.name === 'Position');
            const posName = posField ? posField.value : 'Trial Moderator';

            embed.setColor(isApproved ? 0x2ecc71 : 0xe74c3c);
            embed.addFields({ name: 'Status', value: isApproved ? `✅ Approved by <@${interaction.user.id}>` : `❌ Rejected by <@${interaction.user.id}>` });

            const row = ActionRowBuilder.from(interaction.message.components[0]);
            row.components.forEach(b => b.setDisabled(true));

            await interaction.update({ embeds: [embed], components: [row] });

            const member = await interaction.guild.members.fetch(targetId).catch(() => null);
            if (member && isApproved) {
                const targetRole = CONFIG.ROLE_IDS[posName];
                if (targetRole) await member.roles.add(targetRole).catch(() => {});
                if (CONFIG.COMMUNITY_STAFF_ROLE_ID) await member.roles.add(CONFIG.COMMUNITY_STAFF_ROLE_ID).catch(() => {});
            }

            const targetUser = await client.users.fetch(targetId).catch(() => null);
            if (targetUser) {
                if (isApproved) {
                    await targetUser.send(
                        `🎉 **Application Approved!**\n\n` +
                        `Hello <@${targetUser.id}>, your staff application for **${posName}** at Pursuit Studios has been **APPROVED**!\n` +
                        `Your roles have been updated in the server. Welcome to the team!`
                    ).catch(() => {});
                } else {
                    await targetUser.send(
                        `❌ **Application Update**\n\n` +
                        `Hello <@${targetUser.id}>, thank you for applying for **${posName}** at Pursuit Studios.\n` +
                        `Unfortunately, your application was **NOT ACCEPTED** at this time. We encourage you to re-apply in the future!`
                    ).catch(() => {});
                }
            }
        }
    } catch (err) {
        console.error('Interaction error:', err);
    }
});

client.login(CONFIG.BOT_TOKEN);
