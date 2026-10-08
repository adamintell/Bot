import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import fetch from 'node-fetch';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('vipcheck')
    .setDescription('Check VIP subscription status and Roblox linkage for a member.')
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('Discord member to look up')
        .setRequired(false)
    )
    .addStringOption(option => 
      option
        .setName('target')
        .setDescription('Enter raw Discord ID, Roblox Username, or Roblox User ID')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 }).catch(() => {});
    }

    const targetWebsite = process.env.TARGET_WEBSITE || 'https://www.interactivemountain.com';
    const apiKey = process.env.API_KEY || 'MountWare';

    const discordUser = interaction.options.getUser('user');
    const rawTarget = interaction.options.getString('target');

    let searchParam = '';
    let searchType = '';

    if (discordUser) {
      searchParam = discordUser.id;
      searchType = 'discord_id';
    } else if (rawTarget) {
      searchParam = rawTarget.trim();
      searchType = /^\d+$/.test(searchParam) ? 'id' : 'username';
    } else {
      searchParam = interaction.user.id;
      searchType = 'discord_id';
    }

    try {
      const apiUrl = `${targetWebsite}/api/v1/subscribers/check?${searchType}=${encodeURIComponent(searchParam)}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      }).catch(() => null);

      if (!response || !response.ok) {
        const fallbackEmbed = new EmbedBuilder()
          .setColor('#F1C40F')
          .setTitle(`👑 VIP & Linkage Status: ${discordUser?.tag || searchParam}`)
          .setThumbnail(discordUser?.displayAvatarURL() || null)
          .addFields(
            { name: 'Discord Account', value: discordUser ? `<@${discordUser.id}> (\`${discordUser.id}\`)` : `\`${searchParam}\``, inline: true },
            { name: 'Linked Roblox Account', value: '`Not Linked / Query Failed`', inline: true },
            { name: 'VIP Status', value: '`No VIP / Free`', inline: true },
            { name: 'Website Profile', value: `[Interactive Mountain Profile](${targetWebsite})` }
          )
          .setFooter({ text: 'Interactive Mountain VIP System' })
          .setTimestamp();

        return await interaction.editReply({ embeds: [fallbackEmbed] });
      }

      const data = await response.json();

      const isSubscribed = data.active || false;
      const planName = data.plan || data.tier || 'VIP Tier';
      const robloxUsername = data.robloxUsername || data.roblox_name || 'Not Linked';
      const robloxId = data.robloxId || data.roblox_id || 'N/A';
      const expirationText = data.expiresAt ? `<t:${Math.floor(new Date(data.expiresAt).getTime() / 1000)}:R>` : 'Lifetime / Active';

      const embed = new EmbedBuilder()
        .setColor(isSubscribed ? '#57F287' : '#ED4245')
        .setTitle(`👑 VIP & Linkage Status`)
        .setThumbnail(discordUser?.displayAvatarURL() || null)
        .addFields(
          { name: 'Discord Member', value: discordUser ? `<@${discordUser.id}> (\`${discordUser.id}\`)` : `\`${searchParam}\``, inline: true },
          { name: 'Roblox Linked', value: robloxUsername !== 'Not Linked' ? `**${robloxUsername}** (\`${robloxId}\`)` : '`Not Linked`', inline: true },
          { name: 'VIP Plan', value: isSubscribed ? `🟢 **${planName}**` : '🔴 **No Active VIP**', inline: true },
          { name: 'Expires / Renews', value: expirationText, inline: true },
          { name: 'Website Account', value: `[View Website Account](${targetWebsite})`, inline: true }
        )
        .setFooter({ text: 'Interactive Mountain API' })
        .setTimestamp();

      return await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      logger.error('Error fetching VIP status from API:', err);
      return await interaction.editReply({
        content: '❌ Failed to connect to the Interactive Mountain API endpoint.'
      });
    }
  }
};
