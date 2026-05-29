import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { formService } from "@neon/core";

export const formCommand = {
  data: new SlashCommandBuilder()
    .setName("form")
    .setDescription("Formulários do servidor")
    .addSubcommand(sub =>
      sub.setName("staff")
        .setDescription("Candidatar-se para a equipe")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "staff") {
      const modal = await formService.createModal("form:staff", "Recrutamento Staff", [
        { label: "Qual seu nome e idade?", style: "SHORT" },
        { label: "Por que quer entrar na equipe?", style: "PARAGRAPH" },
        { label: "Quanto tempo tem disponível?", style: "SHORT" },
        { label: "Já teve experiência anterior?", style: "PARAGRAPH" }
      ]);

      await interaction.showModal(modal);
    }
  }
};
