import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const BLACKLIST_LOG_CHANNEL_ID = process.env.BLACKLIST_LOG_CHANNEL_ID || '1554574405584035951';

export default {
    data: new SlashCommandBuilder()
        .setName("blacklist")
        .setDescription("Issue an official server blacklist notice.")
        .addStringOption((option) =>
            option.setName("server_id").setDescription("Target Server ID").setRequired(true)
        )
        .addStringOption((option) =>
            option.setName("invite").setDescription("Discord Invite Link").setRequired(true)
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Reason for blacklisting")
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Blacklist interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'blacklist',
            });
            return;
        }

        const serverId = interaction.options.getString("server_id");
        const invite = interaction.options.getString("invite");
        const reason = interaction.options.getString("reason") || "Violation of community safety protocols.";

        const logChannel = await interaction.guild.channels.fetch(BLACKLIST_LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) {
            throw new TitanBotError(
                'Log channel not found',
                ErrorTypes.USER_INPUT,
                `Blacklist log channel (<#${BLACKLIST_LOG_CHANNEL_ID}>) could not be found or access was denied.`
            );
        }

        const blacklistEmbed = createEmbed({
            title: '🔒 SERVER BLACKLIST NOTICE',
            description: 'The following Discord server has been officially blacklisted by administration.'
        }).addFields(
            { name: 'Server ID', value: `\`${serverId}\``, inline: true },
            { name: 'Server Invite', value: invite.startsWith('http') ? invite : `https://${invite}`, inline: true },
            { name: 'Reason / Details', value: reason },
            { name: 'Issued By', value: `<@${interaction.user.id}>`, inline: true }
        );

        await logChannel.send({ embeds: [blacklistEmbed] });

        logger.info(`Blacklist issued for server ${serverId}`, {
            moderatorId: interaction.user.id,
            guildId: interaction.guildId
        });

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    `🔒 **Blacklist Notice Published**`,
                    `Official notice posted to <#${BLACKLIST_LOG_CHANNEL_ID}> for Server ID \`${serverId}\`.`
                )
            ]
        });
    }
};