/**
 * Log de requisições. O corpo só é logado com LOG_BODIES=1 (depuração), sempre redigido:
 * rotas de autenticação e de upload nunca têm corpo logado, chaves sensíveis viram [oculto]
 * e textos longos (fotos em data URL, rascunhos) são resumidos.
 */
const CHAVE_SENSIVEL = /pass|senha|token|secret|authorization|cookie/i;
const ROTAS_SEM_CORPO = [/^\/api\/auth(\/|\?|$)/, /\/fotos(\/|\?|$)/];
const PARAM_SENSIVEL = /([?&](?:[^=&]*(?:token|senha|password|secret)[^=&]*)=)[^&]*/gi;
const MAX_TEXTO = 500;
const MAX_LOG = 2000;

export const urlSegura = (url) => String(url).replace(PARAM_SENSIVEL, '$1[oculto]');

export const redigir = (valor, nivel = 0) => {
  if (typeof valor === 'string') return valor.length > MAX_TEXTO ? `[texto de ${valor.length} caracteres]` : valor;
  if (valor === null || typeof valor !== 'object') return valor;
  if (nivel >= 5) return '[profundo demais]';
  if (Array.isArray(valor)) {
    const itens = valor.slice(0, 20).map((v) => redigir(v, nivel + 1));
    return valor.length > 20 ? [...itens, `[+${valor.length - 20} itens]`] : itens;
  }
  return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, CHAVE_SENSIVEL.test(k) ? '[oculto]' : redigir(v, nivel + 1)]));
};

export const corpoParaLog = (req) => {
  if (ROTAS_SEM_CORPO.some((r) => r.test(req.originalUrl || req.url))) return '[omitido]';
  if (req.body === undefined) return '[sem corpo]';
  const txt = JSON.stringify(redigir(req.body));
  return txt.length > MAX_LOG ? `${txt.slice(0, MAX_LOG)}…` : txt;
};

export const requestLogger = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${urlSegura(req.originalUrl || req.url)}`);
  console.log('IP:', req.ip);
  console.log('X-Forwarded-For:', req.headers['x-forwarded-for']);
  // O corpo só existe depois dos parsers; por isso é logado ao terminar a resposta.
  if (process.env.LOG_BODIES === '1' && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    res.on('finish', () => console.log('Body:', corpoParaLog(req)));
  }
  next();
};
