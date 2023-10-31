import { SlashCommandBuilder } from "discord.js";
import { register } from "./registerer";
import PICSYManager from "../picsy";

const tip = new SlashCommandBuilder()
  .setName('tip')
  .setDescription('他の人にpicsyを渡す')
  .addUserOption(option => option.setName('to').setDescription('渡す相手').setRequired(true))
  .addIntegerOption(option => option.setName('amount').setDescription('渡す量').setRequired(true))
  .setDMPermission(false);

register(tip, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const sender = interaction.user;
  const to = interaction.options.getUser('to', true);
  const amount = interaction.options.getInteger('amount', true);

  if (sender.id === to.id) {
    await interaction.followUp({ content: '自分に渡すことはできません', ephemeral: true });
    return;
  }

  if (amount <= 0) {
    await interaction.followUp({ content: '0以下の値は指定できません', ephemeral: true });
    return;
  }

  const picsy = await PICSYManager.getInstance();
  picsy.transfer(sender.id, to.id, amount);
  await interaction.followUp({ content: '成功！', ephemeral: true });

  await interaction.channel?.send({
    content: `<@${to.id}> さんに <@${sender.id}> さんが ${amount} picsy を渡しました :tada:`,
  });
});

const karma = new SlashCommandBuilder()
  .setName('karma')
  .setDescription('自分のkarma(貢献度)を確認する')
  .setDMPermission(false);

register(karma, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const sender = interaction.user;

  const picsy = await PICSYManager.getInstance();

  const evals = picsy.evaluation;
  const entries = Object.entries(evals);

  entries.sort((a, b) => b[1] - a[1]);
  if (!(sender.id in evals)) {
    await interaction.followUp({ content: `あなたのkarmaは 1.0 です。ランキング: ${entries.length + 1}位`, ephemeral: true });
    return;
  }

  const idx = entries.findIndex(([id, _]) => id === sender.id);
  await interaction.followUp({ content: `あなたのkarmaは ${evals[sender.id]} です。ランキング: ${idx + 1}位`, ephemeral: true });
});
