/**
 * "trust proxy" do Express: de quem o servidor aceita o cabeçalho X-Forwarded-For para descobrir o IP do cliente. O IP vale para o
 * limite de tentativas de login; confiar em QUALQUER origem deixa um atacante trocar de IP a cada tentativa só mudando o cabeçalho.
 *
 * TRUST_PROXY no ambiente:
 *   (vazio)        "loopback": só aceita o cabeçalho de um proxy NA MESMA MÁQUINA (nginx, Caddy, cloudflared, o proxy do Vite). Padrão seguro.
 *   "1", "2"…      quantidade de proxies na frente do servidor.
 *   "false"        nunca aceita o cabeçalho (servidor exposto direto).
 *   "true"         aceita de qualquer origem. NÃO recomendado (o limite por IP pode ser burlado); só para quem sabe o que faz.
 *   "loopback, 10.0.0.0/8"  lista de faixas confiáveis.
 */
export const opcaoTrustProxy = (valor = process.env.TRUST_PROXY) => {
  const v = String(valor ?? '').trim();
  if (!v) return 'loopback';
  if (/^\d+$/.test(v)) return Number(v);
  if (v.toLowerCase() === 'true') return true;
  if (v.toLowerCase() === 'false') return false;
  return v;
};
