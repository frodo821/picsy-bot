import { configDotenv } from 'dotenv';
configDotenv();

import { Client, Events, GatewayIntentBits } from 'discord.js';
import { getLogger } from './logging';
import { commands, initializeCommands } from './commands';
import { APP_NAME, DISCORD_TOKEN } from './settings';

const logger = getLogger(APP_NAME);

async function main() {
  const discord = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageTyping,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMembers,
    ],
  });

  await initializeCommands();

  (discord as any).commands = commands;

  discord.once(Events.ClientReady, () => {
    logger.info('logged in');
  });

  discord.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply({ ephemeral: true });

    logger.info(`received command: ${interaction.commandName}`);

    const command = commands.get(interaction.commandName);

    if (!command) {
      interaction.followUp({ content: `コマンド "${interaction.commandName}" が見つかりません`, ephemeral: true });
      return;
    }

    try {
      await command(interaction);
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.stack ?? '(unknown stack trace)');
      } else {
        logger.error(error);
      }
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '実行中にエラーが発生しました', ephemeral: true });
      } else {
        await interaction.reply({ content: '実行中にエラーが発生しました', ephemeral: true });
      }
    }
  });

  await discord.login(DISCORD_TOKEN!);
}

main();
