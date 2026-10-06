/* Catálogo de planos Pessoa Física (fonte da verdade no servidor).
   O app público envia só o `codigo`; nome, velocidade e valor são gravados daqui. */
export const PLANOS_PF = [
  { codigo: 'basico', nome: 'Plano Básico', contrate: 300, leve: 300, valor: 89.9, destaque: null,
    beneficios: ['Wi-Fi 5 incluso', 'CW Play: mais de 160 canais', 'Suporte humanizado'] },
  { codigo: 'mais-vendido', nome: 'Plano Mais Vendido', contrate: 400, leve: 600, valor: 99.9, destaque: 'Mais vendido',
    beneficios: ['Wi-Fi 6 incluso', 'CW Play: mais de 160 canais', 'Suporte humanizado'] },
  { codigo: 'avancado', nome: 'Plano Avançado', contrate: 600, leve: 800, valor: 129.9, destaque: null,
    beneficios: ['Wi-Fi 6 incluso', 'CW Play: mais de 160 canais', 'Suporte humanizado', 'CW Voice (telefonia fixa via VoIP)'] },
  { codigo: 'premium', nome: 'Plano Premium', contrate: 800, leve: 800, valor: 149.9, destaque: 'Premium',
    beneficios: ['Wi-Fi 6 incluso', 'CW Play: mais de 160 canais', 'Suporte humanizado', 'CW Voice (telefonia fixa via VoIP)',
      'CW Vision (1 câmera com gravações na nuvem e retenção por 3 dias) ou rede Mesh (ponto adicional para manter o sinal forte)'] },
];

export const buscarPlano = (codigo) => PLANOS_PF.find((p) => p.codigo === codigo) || null;
