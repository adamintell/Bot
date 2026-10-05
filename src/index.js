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
    MessageFlags
} from 'discord.js';

// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    APPLY_CHANNEL_ID: process.env.APPLY_CHANNEL_ID || '1551220007051206737',
    APP_LOG_CHANNEL_ID: process.env.APP_LOG_CHANNEL_ID || '1551217750498607204', 
    REVIEWER_ROLE_ID: process.env.REVIEWER_ROLE_ID || '1551216636235747468',
    COMMUNITY_STAFF_ROLE_ID: process.env.COMMUNITY_STAFF_ROLE_ID || '1541012779358756945',
    
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

// Helper function to re-send application panel
async function sendApplicationPanel() {
    try {
        const channel = await client.channels.fetch(CONFIG.APPLY_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) return console.error('[Error] Application channel not found.');

        // Delete previous messages sent by the bot in the channel
        const recentMessages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
        if (recentMessages) {
            const botMsgs = recentMessages.filter(m => m.author.id === client.user.id);
            for (const [_, msg] of botMsgs) {
                await msg.delete().catch(() => {});
            }
        }

        // Create Panel
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

    // Check for Slurs
    if (SLUR_WORDS.some(w => new RegExp(`\\b${w}\\b`, 'i').test(content) || new RegExp(`\\b${w}\\b`, 'i').test(cleanContent))) {
        assignedRole = CONFIG.RESTRICTED_ROLE_SLUR;
        type = 'Slur / Hate Speech';
    } 
    // Check for Cursing
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
// APPLICATION INTERACTION HANDLER
// ==========================================
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        // 1. Click "Apply for Staff" Button
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

        // 2. Position Selected from Dropdown
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

        // 3. Modal Submission
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

        // 4. Approval / Rejection Buttons
        if (interaction.isButton() && (interaction.customId.startsWith('approve_') || interaction.customId.startsWith('reject_'))) {
            const isApproved = interaction.customId.startsWith('approve_');
            const targetId = interaction.customId.split('_')[1];

            const embed = EmbedBuilder.from(interaction.message.embeds[0]);
            const posField = embed.data.fields.find(f => f.name === 'Position');
            const posName = posField ? posField.value : 'Trial Moderator';

            embed.setColor(isApproved ? 0x2ecc71 : 0xe74c3c);
            embed.addFields({ name: 'Status', value: isApproved ? `✅ Approved by <@${interaction.user.id}>` : `❌ Rejected by <@${interaction.user.id}>` });

            // Disable buttons
            const row = ActionRowBuilder.from(interaction.message.components[0]);
            row.components.forEach(b => b.setDisabled(true));

            await interaction.update({ embeds: [embed], components: [row] });

            // Assign roles if approved
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);
            if (member && isApproved) {
                const targetRole = CONFIG.ROLE_IDS[posName];
                if (targetRole) await member.roles.add(targetRole).catch(() => {});
                if (CONFIG.COMMUNITY_STAFF_ROLE_ID) await member.roles.add(CONFIG.COMMUNITY_STAFF_ROLE_ID).catch(() => {});
            }

            // DM Applicant
            if (member) {
                await member.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(isApproved ? 0x2ecc71 : 0xe74c3c)
                            .setTitle(`Application Status: ${posName}`)
                            .setDescription(isApproved ? '🎉 Congratulations! Your application was accepted.' : 'Thank you for applying. Unfortunately, your application was declined.')
                    ]
                }).catch(() => {});
            }
        }
    } catch (err) {
        console.error('Interaction error:', err);
    }
});

client.login(CONFIG.BOT_TOKEN);