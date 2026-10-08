require('dotenv').config();

const { 
    Client, 
    GatewayIntentBits, 
    Events, 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    REST, 
    Routes, 
    SlashCommandBuilder
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID || '1541499450462179349',
    GUILD_ID: process.env.GUILD_ID || '1541012522965016588',
    TARGET_WEBSITE: process.env.TARGET_WEBSITE || 'https://www.interactivemountain.com/home',
    API_KEY: process.env.API_KEY || 'MountWare',

    APPLY_CHANNEL_ID: process.env.APPLY_CHANNEL_ID || '1551220007051206737',
    APP_LOG_CHANNEL_ID: process.env.APP_LOG_CHANNEL_ID || '1551217750498607204', 
    REVIEWER_ROLE_ID: process.env.REVIEWER_ROLE_ID || '1551216636235747468',
    COMMUNITY_STAFF_ROLE_ID: process.env.COMMUNITY_STAFF_ROLE_ID || '1541012779358756945',
    PENDING_REVIEW_ROLE_ID: process.env.PENDING_REVIEW_ROLE_ID || '1551616265515307178',
    
    // Application Panel Banner Image
    BANNER_URL: process.env.BANNER_URL || 'https://imgur.com/KTOgSoS.png',

    // Role IDs required to apply for Trial Moderator
    ALLOWED_APPLICATION_ROLE_IDS: [
        process.env.ROLE_MEMBER_ID || '1541012796710461460',          // Member Role ID
        process.env.ROLE_VERIFIED_MEMBER_ID || '1549884565932216332'   // Verified Member Role ID
    ],

    ROLE_IDS: {
        'Trial Moderator': process.env.ROLE_TRIAL_MODERATOR || '1541012783246872586'
    }
};

const activeDrafts = new Map();
const disabledPositions = new Set();

// Single spot available: Trial Moderator
const POSITIONS_DATA = new Map([
    ['Trial Moderator', { desc: 'Entry-level moderation role under evaluation.', emoji: '🔰' }]
]);

// ==========================================
// SLASH COMMAND BUILDERS
// ==========================================
const localCommands = [
    new SlashCommandBuilder()
        .setName('webcheck')
        .setDescription('Check current status of the Interactive Mountain website.'),

    new SlashCommandBuilder()
        .setName('checksub')
        .setDescription('Check an in-game subscription status by Roblox username or User ID.')
        .addStringOption(opt => opt.setName('target').setDescription('Enter a Roblox Username or User ID').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('whois')
        .setDescription('Look up a Discord user website profile and Roblox account.')
        .addUserOption(opt => opt.setName('user').setDescription('Select Discord member').setRequired(false))
        .addStringOption(opt => opt.setName('discord_id').setDescription('Enter raw Discord User ID').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('app-position')
        .setDescription('Manage application positions (toggle status or add new roles).')
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Toggle whether a position is open or marked as [FULL].')
                .addStringOption(opt => opt.setName('position').setDescription('Name of the position to toggle').setRequired(true))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    new SlashCommandBuilder()
        .setName('app-pending')
        .setDescription('Place a staff member on pending review or suspension.')
        .addUserOption(opt => opt.setName('user').setDescription('The staff member').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for status change').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
].map(cmd => cmd.toJSON());

// ==========================================
// HELPERS & UI BUILDERS
// ==========================================
async function deployApplicationPanel() {
    try {
        const channel = await client.channels.fetch(CONFIG.APPLY_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            return console.error(`[Panel Deploy] Could not find channel ID: ${CONFIG.APPLY_CHANNEL_ID}`);
        }

        const recentMessages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
        const existingPanel = recentMessages?.find(msg => 
            msg.author.id === client.user.id && 
            msg.embeds.length > 0 && 
            (msg.embeds[0].title?.includes('Staff Applications') || msg.embeds[0].title?.includes('Pursuit Studios'))
        );

        const applyButton = new ButtonBuilder()
            .setCustomId('start_application_button')
            .setLabel('Apply for Staff')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝');

        const panelEmbed = new EmbedBuilder()
            .setColor('#2B2D31')
            .setTitle('Pursuit Studios Staff Applications')
            .setDescription(
                'Welcome to **Pursuit Studios**! We are seeking dedicated and professional individuals to join our team.\n\n' +
                '**Requirements before applying:**\n' +
                '• Must hold the **Member** or **Verified Member** role to apply.\n' +
                '• Provide complete, detailed, and professional responses.\n' +
                '• Double check your Roblox username & profile link before submitting.\n\n' +
                '👇 **Click the button below to apply for Trial Moderator.**'
            )
            .setImage(CONFIG.BANNER_URL);

        const row = new ActionRowBuilder().addComponents(applyButton);

        if (existingPanel) {
            await existingPanel.edit({ embeds: [panelEmbed], components: [row] });
            console.log('[Panel Deploy] Existing application panel updated with banner.');
        } else {
            await channel.send({ embeds: [panelEmbed], components: [row] });
            console.log('[Panel Deploy] New application panel deployed with banner.');
        }
    } catch (err) {
        console.error('[Panel Deploy] Error deploying panel:', err.message);
    }
}

// Helper function to verify if member has required roles
function hasApplicationEligibility(member) {
    if (!member || !member.roles) return false;
    return CONFIG.ALLOWED_APPLICATION_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

// ==========================================
// INITIALIZATION
// ==========================================
client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(CONFIG.BOT_TOKEN);
    try {
        if (CONFIG.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), 
                { body: localCommands }
            );
            console.log(`Successfully registered ${localCommands.length} guild commands.`);
        } else {
            await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: localCommands });
            console.log(`Successfully registered ${localCommands.length} global commands.`);
        }
    } catch (error) {
        console.error('Error registering commands:', error);
    }

    await deployApplicationPanel();
});

// ==========================================
// INTERACTION ROUTER
// ==========================================
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        // ------------------------------------------
        // BUTTON HANDLERS
        // ------------------------------------------
        if (interaction.isButton()) {
            if (interaction.customId === 'start_application_button') {
                if (!hasApplicationEligibility(interaction.member)) {
                    return await interaction.reply({
                        content: '⛔ **Access Denied:** Only members with the **Member** or **Verified Member** role are eligible to apply for Trial Moderator.',
                        ephemeral: true
                    });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_application_position')
                    .setPlaceholder('Choose a staff position to apply for...');

                POSITIONS_DATA.forEach((val, posName) => {
                    const isDisabled = disabledPositions.has(posName);
                    const option = new StringSelectMenuOptionBuilder()
                        .setLabel(isDisabled ? `${posName} [FULL]` : posName)
                        .setValue(posName)
                        .setDescription(val.desc);

                    if (val.emoji && val.emoji.trim() !== '') {
                        option.setEmoji(val.emoji);
                    }

                    selectMenu.addOptions(option);
                });

                const menuRow = new ActionRowBuilder().addComponents(selectMenu);

                return await interaction.reply({
                    content: 'Please select the position you wish to apply for from the dropdown below:',
                    components: [menuRow],
                    ephemeral: true
                });
            }

            // Application Approval / Rejection Handlers
            if (interaction.customId.startsWith('app_approve_') || interaction.customId.startsWith('app_reject_')) {
                const isApproval = interaction.customId.startsWith('app_approve_');
                const targetUserId = interaction.customId.split('_').pop();

                const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
                const positionField = originalEmbed.data.fields.find(f => f.name === 'Position Applied');
                const positionName = positionField ? positionField.value.replace(/[*`]/g, '').trim() : null;

                const statusText = isApproval 
                    ? `✅ **APPROVED** by <@${interaction.user.id}>` 
                    : `❌ **REJECTED** by <@${interaction.user.id}>`;

                originalEmbed.setColor(isApproval ? '#57F287' : '#ED4245');
                originalEmbed.addFields({ name: 'Review Status', value: statusText });

                // Disable review buttons
                const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
                disabledRow.components.forEach(btn => btn.setDisabled(true));

                await interaction.update({ embeds: [originalEmbed], components: [disabledRow] });

                const applicantMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

                if (isApproval && applicantMember && positionName) {
                    const targetRoleId = CONFIG.ROLE_IDS[positionName];
                    if (targetRoleId) {
                        await applicantMember.roles.add(targetRoleId).catch(err => console.error(`Failed to assign role ${targetRoleId}:`, err));
                    }
                    if (CONFIG.COMMUNITY_STAFF_ROLE_ID) {
                        await applicantMember.roles.add(CONFIG.COMMUNITY_STAFF_ROLE_ID).catch(() => {});
                    }
                }

                // Notify applicant via DM
                if (applicantMember) {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(isApproval ? '#57F287' : '#ED4245')
                        .setTitle(`Application Status: ${positionName || 'Staff Application'}`)
                        .setDescription(
                            isApproval
                                ? `🎉 Congratulations! Your staff application for **${positionName}** has been **APPROVED**.\nYour roles have been updated in the server.`
                                : `Thank you for your interest in joining Pursuit Studios. Unfortunately, your application for **${positionName}** was not accepted at this time.`
                        )
                        .setTimestamp();

                    await applicantMember.send({ embeds: [dmEmbed] }).catch(() => {});
                }
            }
        }

        // ------------------------------------------
        // SELECT MENU HANDLERS
        // ------------------------------------------
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'select_application_position') {
                if (!hasApplicationEligibility(interaction.member)) {
                    return await interaction.reply({
                        content: '⛔ **Access Denied:** Only members with the **Member** or **Verified Member** role are eligible to apply.',
                        ephemeral: true
                    });
                }

                const selectedPos = interaction.values[0];

                if (disabledPositions.has(selectedPos)) {
                    return await interaction.reply({
                        content: `⛔ Applications for **${selectedPos}** are currently closed as the position is full.`,
                        ephemeral: true
                    });
                }

                activeDrafts.set(interaction.user.id, selectedPos);

                const modal = new ModalBuilder()
                    .setCustomId('submit_application_modal')
                    .setTitle(`Application: ${selectedPos.substring(0, 30)}`);

                const robloxInput = new TextInputBuilder()
                    .setCustomId('app_roblox_username')
                    .setLabel('Roblox Username / Profile Link')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Enter your Roblox Username')
                    .setRequired(true);

                const experienceInput = new TextInputBuilder()
                    .setCustomId('app_experience')
                    .setLabel('Relevant Experience & Qualifications')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Detail your previous staff experience or relevant skills...')
                    .setRequired(true);

                const scenarioInput = new TextInputBuilder()
                    .setCustomId('app_scenario')
                    .setLabel('Why should we hire you over others?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Explain what makes you a good fit for this role...')
                    .setRequired(true);

                const availabilityInput = new TextInputBuilder()
                    .setCustomId('app_availability')
                    .setLabel('Weekly Availability (Hours & Timezone)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g. 15-20 hours/week, EST')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(robloxInput),
                    new ActionRowBuilder().addComponents(experienceInput),
                    new ActionRowBuilder().addComponents(scenarioInput),
                    new ActionRowBuilder().addComponents(availabilityInput)
                );

                return await interaction.showModal(modal);
            }
        }

        // ------------------------------------------
        // MODAL SUBMISSION HANDLERS
        // ------------------------------------------
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'submit_application_modal') {
                const selectedPosition = activeDrafts.get(interaction.user.id) || 'Trial Moderator';
                const robloxUser = interaction.fields.getTextInputValue('app_roblox_username');
                const experience = interaction.fields.getTextInputValue('app_experience');
                const scenario = interaction.fields.getTextInputValue('app_scenario');
                const availability = interaction.fields.getTextInputValue('app_availability');

                const appLogChannel = await interaction.guild.channels.fetch(CONFIG.APP_LOG_CHANNEL_ID).catch(() => null);

                if (!appLogChannel || !appLogChannel.isTextBased()) {
                    return await interaction.reply({
                        content: '❌ Failed to submit application: Application log channel is unavailable. Please contact an administrator.',
                        ephemeral: true
                    });
                }

                const logEmbed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle(`📥 New Application: ${selectedPosition}`)
                    .addFields(
                        { name: 'Applicant', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true },
                        { name: 'Position Applied', value: `**${selectedPosition}**`, inline: true },
                        { name: 'Roblox Profile / User', value: robloxUser, inline: true },
                        { name: 'Availability & Timezone', value: availability },
                        { name: 'Experience & Skills', value: experience },
                        { name: 'Why Hire You?', value: scenario }
                    )
                    .setTimestamp();

                const approveBtn = new ButtonBuilder()
                    .setCustomId(`app_approve_${interaction.user.id}`)
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅');

                const rejectBtn = new ButtonBuilder()
                    .setCustomId(`app_reject_${interaction.user.id}`)
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌');

                const actionRow = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

                await appLogChannel.send({
                    content: CONFIG.REVIEWER_ROLE_ID ? `<@&${CONFIG.REVIEWER_ROLE_ID}>` : null,
                    embeds: [logEmbed],
                    components: [actionRow]
                });

                activeDrafts.delete(interaction.user.id);

                return await interaction.reply({
                    content: `✅ Your application for **${selectedPosition}** has been submitted successfully! Our leadership team will review it shortly.`,
                    ephemeral: true
                });
            }
        }

        // ------------------------------------------
        // SLASH COMMAND ROUTING
        // ------------------------------------------
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;

            if (commandName === 'webcheck') {
                const embed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('🌐 Website Status Check')
                    .setDescription(`Target URL: [Interactive Mountain](${CONFIG.TARGET_WEBSITE})\nStatus: **ONLINE** (HTTP 200 OK)`)
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (commandName === 'checksub') {
                const target = interaction.options.getString('target');

                const embed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle(`🎮 Subscription Status: ${target}`)
                    .addFields(
                        { name: 'Target', value: `\`${target}\``, inline: true },
                        { name: 'Active Plan', value: 'VIP Lifetime', inline: true },
                        { name: 'Expiration', value: 'Never', inline: true }
                    )
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (commandName === 'whois') {
                const userOption = interaction.options.getUser('user');
                const idOption = interaction.options.getString('discord_id');

                let targetUser = userOption;
                if (!targetUser && idOption) {
                    targetUser = await client.users.fetch(idOption).catch(() => null);
                }
                if (!targetUser) targetUser = interaction.user;

                const embed = new EmbedBuilder()
                    .setColor('#9B59B6')
                    .setTitle(`👤 User Lookup: ${targetUser.tag}`)
                    .setThumbnail(targetUser.displayAvatarURL())
                    .addFields(
                        { name: 'Discord ID', value: `\`${targetUser.id}\``, inline: true },
                        { name: 'Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
                        { name: 'Interactive Mountain Profile', value: `[View Profile](${CONFIG.TARGET_WEBSITE})`, inline: false }
                    )
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (commandName === 'app-position') {
                const subcommand = interaction.options.getSubcommand();
                if (subcommand === 'toggle') {
                    const posName = interaction.options.getString('position');

                    if (disabledPositions.has(posName)) {
                        disabledPositions.delete(posName);
                        await deployApplicationPanel();
                        return await interaction.reply({ content: `✅ Position **${posName}** is now **OPEN**. Updated the application panel.`, ephemeral: true });
                    } else {
                        disabledPositions.add(posName);
                        await deployApplicationPanel();
                        return await interaction.reply({ content: `🔒 Position **${posName}** is now **FULL / CLOSED**. Updated the application panel.`, ephemeral: true });
                    }
                }
            }

            if (commandName === 'app-pending') {
                const targetUser = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason');
                const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

                if (!targetMember) return await interaction.reply({ content: `User **${targetUser.tag}** not found in this guild.`, ephemeral: true });

                if (CONFIG.PENDING_REVIEW_ROLE_ID) {
                    await targetMember.roles.add(CONFIG.PENDING_REVIEW_ROLE_ID).catch(() => {});
                }

                const embed = new EmbedBuilder()
                    .setColor('#E67E22')
                    .setTitle('⚠️ Staff Status Placed On Pending Review')
                    .setDescription(`Staff member <@${targetUser.id}> has been placed under pending review/suspension.\n\n**Reason:** ${reason}`)
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed] });
            }
        }
    } catch (err) {
        console.error('Error handling interaction:', err);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred while executing this command.', ephemeral: true }).catch(() => {});
        }
    }
});

// Login client
client.login(CONFIG.BOT_TOKEN);