/** Normaliza o endereço do servidor digitado pelo técnico: "10.0.0.5:5002" -> "http://10.0.0.5:5002/api". */
export type ResultadoUrl = { ok: true; url: string } | { ok: false; erro: string };

export const normalizarUrlServidor = (texto: string): ResultadoUrl => {
  let t = String(texto ?? '').trim();
  if (!t) return { ok: false, erro: 'Informe o endereço do servidor' };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = `http://${t}`;
  let u: URL;
  try { u = new URL(t); } catch { return { ok: false, erro: 'Endereço do servidor inválido' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, erro: 'Use um endereço http:// ou https://' };
  if (!u.hostname) return { ok: false, erro: 'Endereço do servidor inválido' };
  let caminho = u.pathname.replace(/\/+$/, '');
  if (!/\/api$/i.test(caminho)) caminho = `${caminho}/api`;
  return { ok: true, url: `${u.protocol}//${u.host}${caminho}` };
};
