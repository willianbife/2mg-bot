# Sistema de Embeds 2mg

Este diretório contém o novo sistema de design profissional para o bot 2mg, focado em elegância, legibilidade e ausência total de emojis.

## Princípios de Design

1. **Sem Emojis:** Todos os indicadores visuais são baseados em cores, separadores Unicode (`▸`, `├`, `▪`) e formatação Markdown.
2. **Color-Coding:** Cores específicas para cada contexto de negócio (Sucesso = Verde, Erro = Vermelho, Info = Azul, etc).
3. **Espaçamento:** Uso deliberado de quebras de linha para criar hierarquia visual.
4. **Builders Especializados:** Cada contexto possui seu próprio construtor validado com Zod.

## Builders Disponíveis

### 1. `panelEmbed`
Utilizado para painéis informativos de longa duração (boas-vindas, links, áreas).
- **Tipos:** `welcome`, `links`, `areas`, `support`, `migration`.

### 2. `ticketEmbed`
Exclusivo para o sistema de atendimento.
- **Status:** `opened`, `pending`, `resolved`, `closed`.

### 3. `auditEmbed`
Para logs de auditoria e segurança.
- **Ações:** `ban`, `kick`, `mute`, `role_grant`, `role_remove`, `warn`, `antiraid_trigger`.

### 4. `statsEmbed`
Para visualização de dados e métricas.
- **Tipos:** `voice_stats`, `role_history`, `user_stats`.

### 5. `notificationEmbed`
Para feedbacks rápidos de comandos e interações.
- **Tipos:** `success`, `info`, `warning`, `pending`.

### 6. `errorEmbed`
Para reportar falhas e erros de permissão.

## Exemplo de Uso

```typescript
import { notificationEmbed } from "@neon/core";

await interaction.reply({
  embeds: [
    notificationEmbed({
      type: "success",
      title: "Configuração Salva",
      message: "As alterações foram aplicadas com sucesso ao servidor."
    })
  ]
});
```

## Paleta de Cores (HEX)

- **Primary:** `#1E90FF`
- **Secondary:** `#4B0082`
- **Success:** `#2ECC71`
- **Danger:** `#E74C3C`
- **Warning:** `#F39C12`
- **Info:** `#3498DB`
- **Neutral:** `#95A5A6`
- **Accent:** `#FF6B6B`
