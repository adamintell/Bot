import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChannelType, 
    EmbedBuilder, 
    MessageFlags 
} from 'discord.js';
import { getColor } from '../../config/bot.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

// Configuration: Up to 3 restricted role IDs
const RESTRICTED_ROLE_IDS = [
    process.env.RESTRICTED_ROLE_1 || '1556747422376661022',
    process.env.RESTRICTED_ROLE_2 || '1556747628019064884',
    process.env.RESTRICTED_ROLE_3 || '1551616265515307178'
].filter(id => id && !id.includes('ROLE_ID'));

export default {
    data: new SlashCommandBuilder()
        .setName('restrictedmute')
        .setDescription('Toggle channel messaging permissions for designated restricted roles.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub =>
            sub.setName('apply')
                .setDescription('Lock messaging/chat permissions for all 3 restricted roles in text channels.')
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Restore messaging permissions for the 3 restricted roles in text channels.')
        ),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) return;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
            return await replyUserError(interaction, { 
                type: ErrorTypes.PERMISSION, 
                message: 'You need **Manage Roles** permissions to execute this restriction command.' 
            });
        }

        if (RESTRICTED_ROLE_IDS.length === 0) {
            return await InteractionHelper.safeEditReply(interaction, {
                content: '⚠️ No restricted roles configured in environment variables or constants.'
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        try {
            const channels = await guild.channels.fetch();
            const textChannels = channels.filter(c => 
                c && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
            );

            let updatedChannels = 0;

            for (const [, channel] of textChannels) {
                for (const roleId of RESTRICTED_ROLE_IDS) {
                    const targetRole = guild.roles.cache.get(roleId);
                    if (!targetRole) continue;

                    if (subcommand === 'apply') {
                        // Keep ViewChannel enabled, but explicitly deny sending/chatting permissions
                        await channel.permissionOverwrites.edit(roleId, {
                            ViewChannel: true,
                            SendMessages: false,
                            SendMessagesInThreads: false,
                            CreatePublicThreads: false,
                            CreatePrivateThreads: false,
                            AddReactions: false,
                            UseApplicationCommands: false
                        });
                    } else if (subcommand === 'remove') {
                        // Reset permissions back to default inherit
                        await channel.permissionOverwrites.delete(roleId).catch(() => {});
                    }
                }
                updatedChannels++;
            }

            const rolesFormatted = RESTRICTED_ROLE_IDS.map(id => `<@&${id}>`).join(', ');
            const isApply = subcommand === 'apply';

            const statusEmbed = new EmbedBuilder()
                .setColor(getColor(isApply ? 'error' : 'success'))
                .setTitle(isApply ? '🔒 Restricted Roles Locked' : '🔓 Restricted Roles Unlocked')
                .setDescription(
                    isApply 
                        ? `Applied view-only messaging locks across **${updatedChannels}** text channels for:\n${rolesFormatted}`
                        : `Restored standard chatting permissions across **${updatedChannels}** text channels for:\n${rolesFormatted}`
                )
                .setFooter({ text: 'Interactive Mountain™ Access Control' })
                .setTimestamp();

            await InteractionHelper.safeEditReply(interaction, { embeds: [statusEmbed] });

        } catch (err) {
            logger.error('[RestrictedMute] Error modifying channel permission overwrites:', err);
            await replyUserError(interaction, { 
                type: ErrorTypes.UNKNOWN, 
                message: 'Failed to update channel permission overrides. Ensure the bot role is positioned higher than target roles.' 
            });
        }
    }
};