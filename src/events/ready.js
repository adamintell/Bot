import { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { logger, startupLog } from "../utils/logger.js";
import config from "../config/application.js";
import { reconcileReactionRoleMessages } from "../services/reactionRoleService.js";
import { reconcileTicketPanels, reconcileVerificationPanels, reconcileReactionRolePanelHealth } from "../services/panelHealthService.js";
import { reconcileLevelRoles } from "../services/leveling/levelRoleSyncService.js";
import { initRiffyAfterReady } from "../services/music/riffySetup.js";

const APP_CONFIG = {
  APPLY_CHANNEL_ID: process.env.APPLY_CHANNEL_ID || '1551220007051206737',
  BANNER_URL: process.env.BANNER_URL || 'https://imgur.com/KTOgSoS.png'
};

export default {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    try {
      client.user.setPresence(config.bot.presence);

      startupLog(`Ready! Logged in as ${client.user.tag}`);
      startupLog(`Serving ${client.guilds.cache.size} guild(s)`);
      startupLog(`Loaded ${client.commands.size} commands`);

      if (client.config?.features?.music) {
        initRiffyAfterReady(client);
      }

      // 1. Deploy / Refresh Application Panel
      await deployApplicationPanel(client);

      // 2. Health Reconciliations
      const reconciliationSummary = await reconcileReactionRoleMessages(client);
      startupLog(
        `Reaction role reconciliation: scanned ${reconciliationSummary.scannedMessages}, removed ${reconciliationSummary.removedMessages}, errors ${reconciliationSummary.errors}`
      );

      const ticketPanelSummary = await reconcileTicketPanels(client);
      startupLog(
        `Ticket panel health: scanned ${ticketPanelSummary.scannedGuilds} guilds, healthy ${ticketPanelSummary.healthyPanels}, deleted ${ticketPanelSummary.deletedPanels}, missing channel ${ticketPanelSummary.missingChannels}, recovered ${ticketPanelSummary.recoveredIds}, errors ${ticketPanelSummary.errors}`
      );

      const verificationPanelSummary = await reconcileVerificationPanels(client);
      startupLog(
        `Verification panel health: scanned ${verificationPanelSummary.scannedGuilds} guilds, healthy ${verificationPanelSummary.healthyPanels}, deleted ${verificationPanelSummary.deletedPanels}, missing channel ${verificationPanelSummary.missingChannels}, recovered ${verificationPanelSummary.recoveredIds}, errors ${verificationPanelSummary.errors}`
      );

      const reactionRolePanelSummary = await reconcileReactionRolePanelHealth(client);
      startupLog(
        `Reaction role panel health: scanned ${reactionRolePanelSummary.scannedPanels} panels, healthy ${reactionRolePanelSummary.healthyPanels}, deleted ${reactionRolePanelSummary.deletedPanels}, missing channel ${reactionRolePanelSummary.missingChannels}, recovered ${reactionRolePanelSummary.recoveredIds}, errors ${reactionRolePanelSummary.errors}`
      );

      const levelRoleSummary = await reconcileLevelRoles(client);
      startupLog(
        `Level role sync: scanned ${levelRoleSummary.scannedGuilds} guilds, pruned ${levelRoleSummary.prunedRewardEntries} stale rewards, re-awarded ${levelRoleSummary.rolesReAwarded} roles, errors ${levelRoleSummary.errors}`
      );
    } catch (error) {
      logger.error("Error in ready event:", error);
    }
  },
};

async function deployApplicationPanel(client) {
  try {
    const channel = await client.channels.fetch(APP_CONFIG.APPLY_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

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
      .setImage(APP_CONFIG.BANNER_URL);

    const row = new ActionRowBuilder().addComponents(applyButton);

    if (existingPanel) {
      await existingPanel.edit({ embeds: [panelEmbed], components: [row] });
      startupLog('[Application Panel] Existing panel successfully refreshed.');
    } else {
      await channel.send({ embeds: [panelEmbed], components: [row] });
      startupLog('[Application Panel] New panel deployed.');
    }
  } catch (err) {
    logger.error('Error deploying application panel in ready event:', err);
  }
}
