export const theme2mg = {
  primary: 0x1E90FF,          // Azul profissional (Dodger Blue)
  secondary: 0x4B0082,        // Roxo profundo (Indigo)
  success: 0x2ECC71,          // Verde (Emerald)
  danger: 0xE74C3C,           // Vermelho (Alizarin)
  warning: 0xF39C12,          // Laranja (Pumpkin)
  info: 0x3498DB,             // Azul claro (Peter River)
  neutral: 0x95A5A6,          // Cinza (Asbestos)
  accent: 0xFFD700,           // Ouro (Gold)
};

export const separators = {
  main: '▸',                  // Bullet principal
  sub: '├',                   // Sub-indicador
  divider: '─',               // Divisor horizontal
  bullet: '▪',                // Ponto de lista
};

export const modernTheme = {
  colors: theme2mg,
  separators,
  footer: '2mg Community Suite'
};

export const getCurrentTheme = () => ({ theme: modernTheme });
