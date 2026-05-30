import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { economyService } from "@neon/core";

export const economyCommands = {
  data: new SlashCommandBuilder()
    .setName("economy")
    .setDescription("Comandos de economia")
    .addSubcommand(sub =>
      sub.setName("balance")
        .setDescription("Verifica seu saldo ou de outro usuário")
        .addUserOption(opt => opt.setName("user").setDescription("Usuário para ver o saldo"))
    )
    .addSubcommand(sub =>
      sub.setName("daily")
        .setDescription("Coleta sua recompensa diária")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "balance") {
      const target = interaction.options.getUser("user") || interaction.user;
      const user = await economyService.getUser(target.id, target.username);

      const embed = new EmbedBuilder()
        .setTitle(`Carteira de ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "💵 Saldo", value: `\`R$ ${user.balance.toFixed(2)}\``, inline: true },
          { name: "🏦 Banco", value: `\`R$ ${user.bank.toFixed(2)}\``, inline: true }
        )
        .setColor("Gold");

      await interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "daily") {
      const amount = Math.floor(Math.random() * (500 - 100 + 1)) + 100;
      
      try {
        // Aqui poderíamos adicionar um cooldown no banco de dados, 
        // mas por agora vamos focar na funcionalidade base.
        await economyService.addBalance(interaction.user.id, amount, "Recompensa Diária");
        
        await interaction.reply({
          content: `✅ Você coletou sua recompensa diária de **R$ ${amount.toFixed(2)}**!`
        });
      } catch (_error) {
        await interaction.reply({ content: "Ocorreu um erro ao coletar seu daily.", ephemeral: true });
      }
    }
  }
};
