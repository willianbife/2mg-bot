import { panelEmbed } from "./builders/panelEmbed.js";
import { notificationEmbed } from "./builders/notificationEmbed.js";

export const templates = {
  welcome: (guildName: string) => panelEmbed({
    type: 'welcome',
    title: 'Bem-vindo',
    description: `Seja bem-vindo ao servidor **${guildName}**!\nUtilize os canais abaixo para se orientar.`
  }),
  
  accessDenied: (permission: string) => notificationEmbed({
    type: 'warning',
    title: 'Acesso Negado',
    message: `Você não possui a permissão necessária: \`${permission}\``
  }),

  actionSuccess: (action: string) => notificationEmbed({
    type: 'success',
    title: 'Sucesso',
    message: `A ação **${action}** foi executada com êxito.`
  })
};
