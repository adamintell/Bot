import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { logger } from '../../utils/logger.js';
import { handlePursuitVerificationButton } from '../../commands/PursuitVerification/pursuitverification.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const interactionTypes = ['buttons', 'selectMenus', 'modals'];

async function getAllInteractionFiles(directory, fileList = []) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await getAllInteractionFiles(entryPath, fileList);
      } else if (entry.name.endsWith('.js')) {
        fileList.push(entryPath);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error(`Error reading directory ${directory}:`, err);
    }
  }

  return fileList;
}

export default async function loadInteractions(client) {
  try {
    const interactionsPath = join(__dirname, '../../interactions');

    for (const type of interactionTypes) {
      const typePath = join(interactionsPath, type);
      const interactionFiles = await getAllInteractionFiles(typePath);
      let loadedCount = 0;

      for (const filePath of interactionFiles) {
        const relativePath = filePath.slice(interactionsPath.length + 1).replace(/\\/g, '/');
        const fileName = relativePath.split('/').pop();

        try {
          const module = await import(pathToFileURL(filePath).href);
          const moduleExport = module.default || module;
          const interactions = Array.isArray(moduleExport) ? moduleExport : [moduleExport];

          for (const interaction of interactions) {
            if (!interaction?.name || !interaction?.execute) {
              logger.warn(`Interaction ${relativePath} in ${type} is missing required properties.`);
              continue;
            }

            if (client[type]) {
              client[type].set(interaction.name, interaction);
              loadedCount += 1;
              logger.info(`Loaded ${type.slice(0, -1)}: ${interaction.name} (${fileName})`);
            }
          }
        } catch (fileErr) {
          logger.error(`Error loading interaction file ${relativePath} in ${type}:`, fileErr);
        }
      }

      logger.info(`Loaded ${loadedCount} ${type}`);
    }

    // Attach Interaction Listener safely without crashing bot
    client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isButton()) {
          if (interaction.customId === 'pv_update_roles' || interaction.customId === 'update_roles') {
            await handlePursuitVerificationButton(interaction);
            return;
          }

          const buttonHandler = client.buttons?.get(interaction.customId);
          if (buttonHandler) {
            await buttonHandler.execute(interaction, client);
          }
        } else if (interaction.isStringSelectMenu() || interaction.isEntitySelectMenu()) {
          const menuHandler = client.selectMenus?.get(interaction.customId);
          if (menuHandler) {
            await menuHandler.execute(interaction, client);
          }
        } else if (interaction.isModalSubmit()) {
          const modalHandler = client.modals?.get(interaction.customId);
          if (modalHandler) {
            await modalHandler.execute(interaction, client);
          }
        }
      } catch (interactionErr) {
        logger.error('Error handling interaction event:', interactionErr);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '⚠️ An error occurred while processing your request.',
            ephemeral: true
          }).catch(() => {});
        }
      }
    });

  } catch (error) {
    logger.error('❌ Error during interaction loader setup:', error);
  }
}
