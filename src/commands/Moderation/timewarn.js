import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderation/moderationService.js';

const durationChoices = [
    { name: "5 minutes", value: 5 },
    { name: "10 minutes", value: 10 },
    { name: "15 minutes", value: 15 },
    { name: "30 minutes", value: 30 },
    { name: "1 hour", value: 60 },
];

export default {
    data: new SlashCommandBuilder()
        .setName("timewarn")
        .setDescription("Issue a temporary timed warning to a user.")
        .addUserOption((option) =>
            option.setName("target").setDescription("User to warn").setRequired(true)
        )
        .addIntegerOption((option) =>
            option
                .setName("duration")
                .setDescription("Duration of the timed warning")
                .setRequired(true)
                .addChoices(...durationChoices)
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Reason for the warning").setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Timewarn interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'timewarn',
            });
            return;
        }

        const targetUser = interaction.options.getUser("target");
        const member = interaction.options.getMember("target");
        const durationMinutes = interaction.options.getInteger("duration");
        const reason = interaction.options.getString("reason");

        if (!targetUser) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'You must specify a user to warn.',
                { subtype: 'invalid_user' }
            );
        }

        if (targetUser.id === interaction.user.id) {
            throw new TitanBotError(
                "Cannot warn self",
                ErrorTypes.VALIDATION,
                "You cannot issue a warning to yourself."
            );
        }

        if (targetUser.id === client.user.id) {
            throw new TitanBotError(
                "Cannot warn bot",
                ErrorTypes.VALIDATION,
                "You cannot warn the bot."
            );
        }

        const durationMs = durationMinutes * 60 * 1000;
        const durationDisplay = durationChoices.find((c) => c.value === durationMinutes)?.name || `${durationMinutes} minutes`;

        // Send DM notification to user before processing moderation service
        let dmSent = false;
        try {
            const dmEmbed = warningEmbed(
                `⚠️ **Temporary Warning Issued** in ${interaction.guild.name}`,
                `**Reason:** ${reason}\n**Duration:** ${durationDisplay}\n**Responsible Moderator:** <@${interaction.user.id}>`
            );
            await targetUser.send({ embeds: [dmEmbed] });
            dmSent = true;
        } catch (err) {
            logger.info(`Failed to send DM to user ${targetUser.id}: DMs might be disabled.`);
        }

        const result = await ModerationService.warnUser({
            guild: interaction.guild,
            member,
            targetUser,
            moderator: interaction.member,
            durationMs,
            reason,
            isTemporary: true
        });

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    `⚠️ **Timed Warning Issued** for ${targetUser.tag}.`,
                    `**Duration:** ${durationDisplay}\n**Reason:** ${reason}\n**DM Sent:** ${dmSent ? 'Yes ✅' : 'No ❌ (DMs closed)'}\n**Case ID:** #${result.caseId || 'N/A'}`
                )
            ]
        });
    }
};