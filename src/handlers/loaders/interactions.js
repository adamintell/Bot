import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { logger } from '../../utils/logger.js';
import { handlePursuitVerificationButton } from '../../commands/PursuitVerification/pursuitverification.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const interactionTypes = ['buttons', 'selectMenus', 'modals'];

async function getAllInteractionFiles(directory, fileList = []) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      await getAllInteractionFiles(entryPath, fileList);
    } else if (entry.name.endsWith('.js')) {
      fileList.push(entryPath);
    }
  }

  return fileList;
}

export default async (client) => {
  try {
    const interactionsPath = join(__dirname, '../../interactions');

    for (const type of interactionTypes) {
      const typePath = join(interactionsPath, type);

      try {
        const interactionFiles = await getAllInteractionFiles(typePath);
        let loadedCount = 0;

        for (const filePath of interactionFiles) {
          const relativePath = filePath.slice(interactionsPath.length + 1).replace(/\\/g, '/');
          const fileName = relativePath.split('/').pop();

          try {
            const module = await import(pathToFileURL(filePath).href);
            const moduleExport = module.default;
            const interactions = Array.isArray(moduleExport) ? moduleExport : [moduleExport];

            for (const interaction of interactions) {
              if (!interaction?.name || !interaction?.execute) {
                logger.warn(`Interaction ${relativePath} in ${type} is missing required properties.`);
                continue;
              }

              client[type].set(interaction.name, interaction);
              loadedCount += 1;
              logger.info(`Loaded ${type.slice(0, -1)}: ${interaction.name} (${fileName})`);
            }
          } catch (error) {
            logger.error(`Error loading interaction ${relativePath} in ${type}:`, error);
          }
        }

        logger.info(`Loaded ${loadedCount} ${type}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.error(`Error loading ${type}:`, error);
        } else {
          logger.debug(`No ${type} directory found, skipping...`);
        }
      }
    }

    // Attach Interaction Event Listener
    client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isButton()) {
          if (interaction.customId === 'update_roles') {
            await handlePursuitVerificationButton(interaction);
            return;
          }

          const button = client.buttons.get(interaction.customId);
          if (button) {
            await button.execute(interaction);
            return;
          }
        }

        if (interaction.isStringSelectMenu()) {
          const menu = client.selectMenus.get(interaction.customId);
          if (menu) {
            await menu.execute(interaction);
            return;
          }
        }

        if (interaction.isHere are the complete updated scripts, modified to integrate seamlessly with your existing loader directory design (`src/interactions/buttons`) and existing event listeners.

### 1. `src/handlers/loaders/interactions.js`

```javascript
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { logger } from '../../utils/logger.js';
import { handlePursuitVerificationButton } from '../../commands/PursuitVerification/pursuitverification.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const interactionTypes = ['buttons', 'selectMenus', 'modals'];

async function getAllInteractionFiles(directory, fileList = []) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      await getAllInteractionFiles(entryPath, fileList);
    } else if (entry.name.endsWith('.js')) {
      fileList.push(entryPath);
    }
  }

  return fileList;
}

export default async (client) => {
  try {
    const interactionsPath = join(__dirname, '../../interactions');

    for (const type of interactionTypes) {
      const typePath = join(interactionsPath, type);

      try {
        const interactionFiles = await getAllInteractionFiles(typePath);
        let loadedCount = 0;

        for (const filePath of interactionFiles) {
          const relativePath = filePath.slice(interactionsPath.length + 1).replace(/\\/g, '/');
          const fileName = relativePath.split('/').pop();

          try {
            const module = await import(pathToFileURL(filePath).href);
            const moduleExport = module.default;
            const interactions = Array.isArray(moduleExport) ? moduleExport : [moduleExport];

            for (const interaction of interactions) {
              if (!interaction?.name || !interaction?.execute) {
                logger.warn(`Interaction ${relativePath} in ${type} is missing required properties.`);
                continue;
              }

              client[type].set(interaction.name, interaction);
              loadedCount += 1;
              logger.info(`Loaded ${type.slice(0, -1)}: ${interaction.name} (${fileName})`);
            }
          } catch (error) {
            logger.error(`Error loading interaction ${relativePath} in ${type}:`, error);
          }
        }

        logger.info(`Loaded ${loadedCount} ${type}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.error(`Error loading ${type}:`, error);
        } else {
          logger.debug(`No ${type} directory found, skipping...`);
        }
      }
    }

    // Attach interaction listener to handle dynamically routed buttons, menus, and custom actions
    client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isButton()) {
          if (interaction.customId === 'update_roles') {
            await handlePursuitVerificationButton(interaction);
            return;
          }

          const buttonHandler = client.buttons.get(interaction.customId);
          if (buttonHandler) {
            await buttonHandler.execute(interaction, client);
          }
        } else if (interaction.isStringSelectMenu() || interaction.isEntitySelectMenu()) {
          const menuHandler = client.selectMenus.get(interaction.customId);
          if (menuHandler) {
            await menuHandler.execute(interaction, client);
          }
        } else if (interaction.isModalSubmit()) {
          const modalHandler = client.modals.get(interaction.customId);
          if (modalHandler) {
            await modalHandler.execute(interaction, client);
          }
        }
      } catch (error) {
        logger.error('Error handling interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '⚠️ An error occurred while processing your request.',
            ephemeral: true
          }).catch(() => {});
        }
      }
    });

  } catch (error) {
    logger.error('Error loading interactions:', error);
  }
};
