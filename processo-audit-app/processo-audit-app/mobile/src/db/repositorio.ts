import type { Banco } from './banco';
import type { Bootstrap, ChecklistItem, ItemEstoque, Motivo, OS, PosseItem, RegrasFechamento, TecnicoResumo, TipoServico } from '@/domain/tipos';

/** Tudo o que o app mostra offline: o último retrato recebido do servidor. */
export interface Dados {
  geradoEm: string; // quando o SERVIDOR montou o retrato (é o "atualizado às HH:MM" mostrado ao técnico)
  tecnico: TecnicoResumo;
  os: OS[];
  posse: PosseItem[];
  motivos: Motivo[];
  checklist: ChecklistItem[];
  sugestoesServicos: string[];
  tiposServico: TipoServico[];
  tecnicos: TecnicoResumo[];
  itens: ItemEstoque[];
  regras: RegrasFechamento;
}

const json = <T>(texto: string): T => JSON.parse(texto) as T;

export const definirMeta = (b: Banco, chave: string, valor: string) =>
  b.run('INSERT INTO meta (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor', [chave, valor]);

export const lerMeta = async (b: Banco, chave: string): Promise<string | null> =>
  (await b.first<{ valor: string }>('SELECT valor FROM meta WHERE chave = ?', [chave]))?.valor ?? null;

/** Troca o retrato inteiro de uma vez (tudo ou nada): OS que saíram do técnico somem, as alteradas são atualizadas. */
export const salvarBootstrap = (b: Banco, d: Bootstrap): Promise<void> => b.transacao(async (tx) => {
  await tx.run('DELETE FROM os');
  for (const [i, o] of d.os.entries()) {
    await tx.run('INSERT INTO os (id, numero, status, prazo, ordem, dados) VALUES (?,?,?,?,?,?)', [o.id, o.numero, o.status, o.prazo, i, JSON.stringify(o)]);
  }
  await tx.run('DELETE FROM posse');
  for (const p of d.posse) await tx.run('INSERT INTO posse (lote_id, item_id, dados) VALUES (?,?,?)', [p.lote_id, p.item_id, JSON.stringify(p)]);
  const catalogos: Record<string, unknown> = {
    tecnico: d.tecnico, motivos: d.motivos, checklist: d.checklist, sugestoes_servicos: d.sugestoes_servicos,
    tipos_servico: d.tipos_servico, tecnicos: d.tecnicos, itens: d.itens, regras: d.regras,
  };
  for (const [chave, valor] of Object.entries(catalogos)) {
    await tx.run('INSERT INTO catalogo (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor', [chave, JSON.stringify(valor)]);
  }
  await tx.run('INSERT INTO meta (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor', ['gerado_em', d.gerado_em]);
});

/** O último retrato guardado, ou null se o aparelho ainda nunca sincronizou. */
export const lerDados = async (b: Banco): Promise<Dados | null> => {
  const geradoEm = await lerMeta(b, 'gerado_em');
  if (!geradoEm) return null;
  const cat = Object.fromEntries((await b.all<{ chave: string; valor: string }>('SELECT chave, valor FROM catalogo')).map((r) => [r.chave, json<any>(r.valor)]));
  const os = (await b.all<{ dados: string }>('SELECT dados FROM os ORDER BY ordem')).map((r) => json<OS>(r.dados));
  const posse = (await b.all<{ dados: string }>('SELECT dados FROM posse ORDER BY item_id, lote_id')).map((r) => json<PosseItem>(r.dados));
  return {
    geradoEm, tecnico: cat.tecnico, os, posse, motivos: cat.motivos ?? [], checklist: cat.checklist ?? [],
    sugestoesServicos: cat.sugestoes_servicos ?? [], tiposServico: cat.tipos_servico ?? [], tecnicos: cat.tecnicos ?? [], itens: cat.itens ?? [], regras: cat.regras,
  };
};

/** Atualiza uma OS guardada (ex.: depois de iniciar a execução), sem esperar o próximo retrato do servidor. */
export const atualizarOS = (b: Banco, id: number, mudancas: Partial<OS>): Promise<OS | null> => b.transacao(async (tx) => {
  const linha = await tx.first<{ dados: string }>('SELECT dados FROM os WHERE id = ?', [id]);
  if (!linha) return null;
  const nova = { ...json<OS>(linha.dados), ...mudancas, id };
  await tx.run('UPDATE os SET status = ?, prazo = ?, dados = ? WHERE id = ?', [nova.status, nova.prazo, JSON.stringify(nova), id]);
  return nova;
});

/** Apaga tudo o que veio do servidor (troca de técnico ou saída voluntária). Não mexe em configurações. */
export const limparDadosLocais = (b: Banco): Promise<void> => b.transacao(async (tx) => {
  for (const t of ['os', 'posse', 'catalogo', 'meta']) await tx.run(`DELETE FROM ${t}`);
});
