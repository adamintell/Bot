import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderation/moderationService.js';

const durationChoices = [
    { name: "1 hour", value: 1 },
    { name: "6 hours", value: 6 },
    { name: "12 hours", value: 12 },
    { name: "24 hours (1 day)", value: 24 },
    { name: "3 days", value: 72 },
    { name: "7 days", value: 168 },
];

export default {
    data: new SlashCommandBuilder()
        .setName("timeban")
        .setDescription("Temporarily ban a user for a specific duration.")
        .addUserOption((option) =>
            option.setName("target").setDescription("User to timeban").setRequired(true)
        )
        .addIntegerOption((option) =>
            option
                .setName("duration")
                .setDescription("Duration of the temp ban (in hours)")
                .setRequired(true)
                .addChoices(...durationChoices)
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Reason for the timeban")
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Timeban interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'timeban',
            });
            return;
        }

        const targetUser = interaction.options.getUser("target");
        const member = interaction.options.getMember("target");
        const durationHours = interaction.options.getInteger("duration");
        const reason = interaction.options.getString("reason") || "No reason provided";

        if (!targetUser) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'You must specify a user to timeban.',
                { subtype: 'invalid_user' }
            );
        }

        if (targetUser.id === interaction.user.id) {
            throw new TitanBotError(
                "Cannot ban self",
                ErrorTypes.VALIDATION,
                "You cannot temporarily ban yourself."
            );
        }

        if (targetUser.id === client.user.id) {
            throw new TitanBotError(
                "Cannot ban bot",
                ErrorTypes.VALIDATION,
                "You cannot ban the bot."
            );
        }

        const durationDisplay = durationChoices.find((c) => c.value === durationHours)?.name || `${durationHours} hours`;

        // Send DM notification before issuing ban
        let dmSent = false;
        try {
            const dmEmbed = warningEmbed(
                `⛔ **Temporary Ban Issued** in ${interaction.guild.name}`,
                `**Reason:** ${reason}\n**Duration:** ${durationDisplay}\n**Responsible Moderator:** <@${interaction.user.id}>`
            );
            await targetUser.send({ embeds: [dmEmbed] });
            dmSent = true;
        } catch (err) {
            logger.info(`Failed to send DM to user ${targetUser.id}: DMs might be disabled.`);
        }

        const durationMs = durationHours * 60 * 60 * 1000;
        const result = await ModerationService.tempBanUser({
            guild: interaction.guild,
            member,
            targetUser,
            moderator: interaction.member,
            durationMs,
            reason,
        });

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    `🔨 **Temporarily Banned** ${targetUser.tag}.`,
                    `**Duration:** ${durationDisplay}\n**Reason:** ${reason}\n**DM Sent:** ${dmSent ? 'Yes ✅' : 'No ❌ (DMs closed)'}\n**Case ID:** #${result.caseId || 'N/A'}`
                )
            ]
        });
    }
};