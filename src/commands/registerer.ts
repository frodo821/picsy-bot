import { Collection, Interaction, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { getLogger } from '../logging';
import { DISCORD_APP_ID, DISCORD_TOKEN } from '../settings';

const logger = getLogger('picsy.discord.commands');
const _cmds = {
  builders: []
} as { builders: SlashCommandBuilder[] };

export const commands = new Collection<string, (interaction: Interaction) => Promise<void>>();

export const initializeCommands = async (opts?: { appId?: string, token?: string }) => {
  const rest = new REST().setToken(opts?.token ?? DISCORD_TOKEN!);

  try {
    logger.info('Started refreshing application (/) commands.');
    const result = await rest.put(Routes.applicationCommands(opts?.appId ?? DISCORD_APP_ID!), {
      body: _cmds.builders.map(b => b.toJSON()),
    });
    logger.info('Successfully reloaded application (/) commands.', result);
  } catch {
    logger.error('Failed to register commands');
  }
}

export const register = (builder: SlashCommandBuilder, handler: (i: Interaction) => Promise<void>) => {
  _cmds.builders.push(builder);
  commands.set(builder.name, handler);
}
