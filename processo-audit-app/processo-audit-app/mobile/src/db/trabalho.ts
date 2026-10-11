import type { Banco } from './banco';
import { rascunhoVazio, type Rascunho } from '@/domain/etapas';
import type { DetalheOS } from '@/domain/tipos';

/* Dados que o técnico produz em campo e que NÃO vêm do servidor: rascunho da finalização, fotos tiradas e o detalhe da OS em cache. */

export const lerRascunho = async (b: Banco, osId: number): Promise<Rascunho | null> => {
  const r = await b.first<{ dados: string }>('SELECT dados FROM rascunhos WHERE os_id = ?', [osId]);
  if (!r) return null;
  return { ...rascunhoVazio(), ...(JSON.parse(r.dados) as Partial<Rascunho>) }; // campos novos de versões futuras do app ganham o padrão
};

export const salvarRascunho = (b: Banco, usuarioId: number, osId: number, r: Rascunho, agora: number = Date.now()) =>
  b.run('INSERT INTO rascunhos (os_id, usuario_id, dados, atualizado_em) VALUES (?,?,?,?) ON CONFLICT(os_id) DO UPDATE SET dados = excluded.dados, usuario_id = excluded.usuario_id, atualizado_em = excluded.atualizado_em',
    [osId, usuarioId, JSON.stringify(r), new Date(agora).toISOString()]);

export const apagarRascunho = (b: Banco, osId: number) => b.run('DELETE FROM rascunhos WHERE os_id = ?', [osId]);

export interface FotoLocal {
  client_uuid: string;
  usuario_id: number;
  os_id: number;
  arquivo: string | null; // null depois que o arquivo foi apagado do aparelho
  mime: string;
  tamanho: number | null;
  tirada_em: string;
  lat: number | null;
  lng: number | null;
  legenda: string | null;
  servidor_id: number | null; // id da foto no servidor depois que o envio foi confirmado
  removida: boolean;
  criado_em: string;
}

interface LinhaFoto extends Omit<FotoLocal, 'removida'> { removida: number }
const paraFoto = (r: LinhaFoto): FotoLocal => ({ ...r, removida: r.removida === 1 });

export const inserirFoto = (b: Banco, f: Omit<FotoLocal, 'servidor_id' | 'removida'>) =>
  b.run('INSERT INTO fotos_locais (client_uuid, usuario_id, os_id, arquivo, mime, tamanho, tirada_em, lat, lng, legenda, criado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [f.client_uuid, f.usuario_id, f.os_id, f.arquivo, f.mime, f.tamanho, f.tirada_em, f.lat, f.lng, f.legenda, f.criado_em]);

/** As fotos da OS que o técnico ainda considera suas (as removidas ficam guardadas só até o servidor confirmar a remoção). */
export const listarFotos = async (b: Banco, osId: number): Promise<FotoLocal[]> =>
  (await b.all<LinhaFoto>('SELECT * FROM fotos_locais WHERE os_id = ? AND removida = 0 ORDER BY criado_em, client_uuid', [osId])).map(paraFoto);

export const obterFoto = async (b: Banco, clientUuid: string): Promise<FotoLocal | null> => {
  const r = await b.first<LinhaFoto>('SELECT * FROM fotos_locais WHERE client_uuid = ?', [clientUuid]);
  return r ? paraFoto(r) : null;
};

export const listarFotosComArquivo = async (b: Banco): Promise<FotoLocal[]> =>
  (await b.all<LinhaFoto>('SELECT * FROM fotos_locais WHERE arquivo IS NOT NULL')).map(paraFoto);

export const definirServidorId = (b: Banco, clientUuid: string, servidorId: number) =>
  b.run('UPDATE fotos_locais SET servidor_id = ? WHERE client_uuid = ?', [servidorId, clientUuid]);

export const marcarFotoRemovida = (b: Banco, clientUuid: string) => b.run('UPDATE fotos_locais SET removida = 1 WHERE client_uuid = ?', [clientUuid]);

export const limparArquivoDaFoto = (b: Banco, clientUuid: string) => b.run('UPDATE fotos_locais SET arquivo = NULL WHERE client_uuid = ?', [clientUuid]);

export const apagarFoto = (b: Banco, clientUuid: string) => b.run('DELETE FROM fotos_locais WHERE client_uuid = ?', [clientUuid]);

export const salvarDetalhe = (b: Banco, osId: number, d: DetalheOS) =>
  b.run('INSERT INTO os_detalhe (os_id, dados, baixado_em) VALUES (?,?,?) ON CONFLICT(os_id) DO UPDATE SET dados = excluded.dados, baixado_em = excluded.baixado_em',
    [osId, JSON.stringify(d), d.baixado_em]);

export const lerDetalhes = async (b: Banco): Promise<Record<number, DetalheOS>> =>
  Object.fromEntries((await b.all<{ os_id: number; dados: string }>('SELECT os_id, dados FROM os_detalhe')).map((r) => [r.os_id, JSON.parse(r.dados) as DetalheOS]));

/** Mantém o cache só das OS que o técnico ainda enxerga ou que têm trabalho local pendente. */
export const podarDetalhes = async (b: Banco, manter: readonly number[]): Promise<void> => {
  const guardar = new Set(manter);
  const todos = await b.all<{ os_id: number }>('SELECT os_id FROM os_detalhe');
  for (const { os_id } of todos) if (!guardar.has(os_id)) await b.run('DELETE FROM os_detalhe WHERE os_id = ?', [os_id]);
};
