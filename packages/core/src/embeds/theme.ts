export interface EmbedTheme {
  colors: {
    primary: number;
    secondary: number;
    success: number;
    danger: number;
    warning: number;
    info: number;
    neutral: number;
    accent: number;
  };
  separators: {
    main: string;
    sub: string;
    divider: string;
    bullet: string;
  };
  footer: string;
}

export const modernTheme: EmbedTheme = {
  colors: {
    primary: 0x1E90FF,      // Azul profissional (Dodger Blue)
    secondary: 0x4B0082,    // Roxo profundo (Indigo)
    success: 0x2ECC71,      // Verde (Emerald)
    danger: 0xE74C3C,       // Vermelho (Alizarin)
    warning: 0xF39C12,      // Laranja (Pumpkin)
    info: 0x3498DB,         // Azul claro (Peter River)
    neutral: 0x95A5A6,      // Cinza (Asbestos)
    accent: 0xFF6B6B,       // Rosa/Coral (Tomato)
  },
  separators: {
    main: '▸',              // Bullet principal
    sub: '├',               // Sub-indicador
    divider: '─',           // Divisor horizontal
    bullet: '▪',            // Ponto de lista
  },
  footer: '2mg Community Suite',
};

export const getCurrentTheme = () => ({ theme: modernTheme });
