/**
 * CORS. Sem CORS_ALLOWED_ORIGINS (ou com "*") mantém o comportamento aberto de sempre.
 * Com a lista ("https://app.exemplo.com,https://admin.exemplo.com") só essas origens de navegador passam.
 * Requisições sem cabeçalho Origin (app nativo, curl, servidor a servidor) não dependem de CORS e sempre passam.
 */
export const origensPermitidas = (valor = process.env.CORS_ALLOWED_ORIGINS) =>
  String(valor || '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);

export const criarOpcoesCors = (valor) => {
  const lista = origensPermitidas(valor);
  if (!lista.length || lista.includes('*')) return { origin: true, credentials: true };
  return {
    origin: (origin, cb) => cb(null, !origin || lista.includes(origin)),
    credentials: true,
  };
};
