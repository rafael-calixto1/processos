import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { ApiClient } from '@/api/client';
import { criarApi, type Api } from '@/api/endpoints';
import { armazenamentoEmMemoria } from '@/auth/armazenamento';
import { GerenciadorSessao } from '@/auth/gerenciadorSessao';
import { enfileirar } from '@/db/outbox';
import { rascunhoVazio, type Rascunho } from '@/domain/etapas';
import type { NovaOperacao } from '@/domain/operacoes';
import { carregarEstadoLocal } from '@/sync/estadoLocal';
import type { ContextoComandos } from '@/sync/operacoes';
import { MotorOutbox } from '@/sync/outbox';
import { garantirDono, sincronizar } from '@/sync/sincronizar';
import { criarBancoDeTeste } from '@/testing/bancoNode';
import { FormularioNode, fetchNode } from '@/testing/fetchNode';
import { criarRedeInstavel } from '@/testing/redeInstavel';

export const { API_URL, API_SENHA = 'senha123', API_EMAIL = 'joao@exemplo.com', RAIZ_BACKEND, FOTOS_DIR } = process.env;
export const SEMENTE = JSON.parse(process.env.SEMENTE ?? '{"ids":{}}') as { usuarios: Record<string, string>; ids: Record<string, number> };
export const quando = API_URL && RAIZ_BACKEND ? describe : describe.skip;

/** Consulta o banco de teste pelo script do backend (SQL direto em estoque_movimentacoes etc.). Nunca toca em outro banco. */
export const consulta = <T = any>(comando: string, ...args: Array<string | number>): T => {
  const saida = execFileSync(process.execPath, ['scripts/teste_mobile.js', comando, ...args.map(String)], {
    cwd: RAIZ_BACKEND, env: { ...process.env, DB_NAME: 'processo_audit_test' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(saida.trim().split('\n').filter((l) => l.startsWith('{') || l.startsWith('[')).pop()!) as T;
};

export interface Movimentacao { id: number; tipo: string; lote_id: number; item_id: number; quantidade: number; os_id: number; servico_id: number | null }
export const movimentacoes = (osId: number) => consulta<Movimentacao[]>('movimentacoes', osId);

const requisicao = async (token: string | null, metodo: string, caminho: string, corpo?: unknown) => {
  const r = await fetchNode(`${API_URL}${caminho}`, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: corpo === undefined ? undefined : JSON.stringify(corpo) } as never);
  const texto = await r.text();
  return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
};
const tokens: Record<string, string> = {};
/** Chamada de escritório (admin / estoque) para montar o cenário, como o sistema web faria. */
export const escritorio = async (quem: 'admin' | 'estoque', metodo: string, caminho: string, corpo?: unknown) => {
  if (!tokens[quem]) tokens[quem] = (await requisicao(null, 'POST', '/auth/login', { email: SEMENTE.usuarios[quem], password: API_SENHA })).corpo.token;
  return requisicao(tokens[quem], metodo, caminho, corpo);
};

export interface Cenario { osId: number; osNumero: number; cabo: { loteId: number; codigo: string }; conectores?: Array<{ loteId: number }> }
/** OS nova do João, com uma bobina de 1000 m da qual ele retirou `metros`, e (opcional) lotes de conectores na posse dele. */
export const criarCenario = async ({ metros = 400, pecas }: { metros?: number; pecas?: number[] } = {}): Promise<Cenario> => {
  const { ids } = SEMENTE;
  const compra = await escritorio('estoque', 'POST', '/estoque/compras', { item_id: ids.cabo, tipo_volume: 'bobina', qtd_volumes: 1, medida_por_volume: 1000 });
  const lote = compra.corpo.lotes[0];
  await escritorio('estoque', 'POST', '/estoque/retiradas', { lote_id: lote.id, tecnico_id: ids.joao, quantidade: metros });
  let conectores: Cenario['conectores'];
  if (pecas?.length) {
    const c = await escritorio('estoque', 'POST', '/estoque/compras', { item_id: ids.conector, tipo_volume: 'unidade', medidas: pecas });
    conectores = [];
    for (const [i, l] of c.corpo.lotes.entries()) {
      await escritorio('estoque', 'POST', '/estoque/retiradas', { lote_id: l.id, tecnico_id: ids.joao, quantidade: pecas[i] });
      conectores.push({ loteId: l.id });
    }
  }
  const os = await escritorio('admin', 'POST', '/os', { cliente: `Rota PL-${Date.now() % 10000} → CEO-01`, tecnico_id: ids.joao, prazo: '2026-12-31', latitude: -23.5445, longitude: -46.3118, poste_id: 'PL-0932' });
  return { osId: os.corpo.id, osNumero: os.corpo.numero, cabo: { loteId: lote.id, codigo: lote.codigo }, conectores };
};

const JPEG = (marca: string) => Buffer.concat([Buffer.from('ffd8ffe000104a46494600010100000100010000', 'hex'), Buffer.from(marca), Buffer.from('ffd9', 'hex')]);
export const bytesDaFoto = (marca: string) => JPEG(marca);

export interface Relogio { agora: () => number; avancar: (ms: number) => void }
const criarRelogio = (): Relogio => { let extra = 0; return { agora: () => Date.now() + extra, avancar: (ms) => { extra += ms; } }; };

/** Um celular completo: sessão real, SQLite real, motor real, comandos reais, falando com o backend de teste por uma rede que pode cair. */
export const criarApp = async (email = API_EMAIL) => {
  const armazenamento = armazenamentoEmMemoria();
  const rede = criarRedeInstavel(fetchNode);
  const relogio = criarRelogio();
  const flags = { tokenRuim: false };
  const ref: { g?: GerenciadorSessao } = {};
  const fotosPorUri = new Map<string, Buffer>();
  const apagados: string[] = [];
  const cliente = new ApiClient({
    baseUrl: () => API_URL!, fetchImpl: rede.fetchImpl, timeoutMs: 8000,
    tokens: {
      tokenDeAcesso: () => (flags.tokenRuim ? 'token-que-nao-vale' : ref.g!.tokenDeAcesso()),
      renovar: async () => { flags.tokenRuim = false; return ref.g!.renovar(); },
      sessaoPerdida: () => ref.g!.sessaoPerdida(),
    },
  });
  const api: Api = criarApi(cliente, {
    criarFormulario: async (campos, arquivo) => {
      const bytes = fotosPorUri.get(arquivo.uri);
      if (!bytes) throw new Error(`foto ${arquivo.uri} não existe`);
      return new FormularioNode(campos, { campo: 'foto', nome: arquivo.nome, mime: arquivo.mime, bytes }) as unknown as FormData;
    },
  });
  const g = new GerenciadorSessao({ armazenamento, api: () => api, dispositivo: () => 'jest · integração' });
  ref.g = g;
  const { banco } = await criarBancoDeTeste();
  const usuario = await g.entrar(email, API_SENHA);
  await garantirDono(banco, { id: usuario.id, nome: usuario.name });

  const ctx: ContextoComandos = { banco, usuarioId: usuario.id, uuid: randomUUID, agora: relogio.agora, dispositivo: 'jest', versaoApp: '1.0.0', arquivos: { apagar: async (u) => { apagados.push(u); fotosPorUri.delete(u); } } };
  const novoMotor = () => new MotorOutbox({
    banco, api, usuarioId: usuario.id, agora: relogio.agora, aleatorio: () => 1, backoffBaseMs: 1000, backoffTetoMs: 4000,
    arquivos: { existe: async (u) => fotosPorUri.has(u), apagar: ctx.arquivos!.apagar },
  });
  const motor = novoMotor();
  const baixar = () => sincronizar(api, banco, { usuarioId: usuario.id, agora: relogio.agora });
  const estado = async () => (await carregarEstadoLocal(banco, usuario.id))!;
  /** Tira uma "foto" (guarda os bytes sob uma URI de mentira, como o arquivo comprimido no diretório do app). */
  const guardarFoto = (nome: string, marca = nome) => { const uri = `file:///fotos/${nome}.jpg`; fotosPorUri.set(uri, JPEG(marca)); return { uri, tamanho: JPEG(marca).length }; };
  /** Roda o motor até a fila esvaziar, deixando o relógio passar o tempo do backoff entre as voltas. */
  const drenar = async (m = motor, voltas = 12) => {
    for (let i = 0; i < voltas; i++) {
      const r = await m.executar();
      if (r.proximaTentativaEm === null && !r.semConexao) return r;
      relogio.avancar(60_000);
    }
    return m.executar();
  };
  const enfileirarCru = (nova: NovaOperacao) => enfileirar(banco, nova, relogio.agora());
  return { g, api, banco, ctx, motor, novoMotor, rede, relogio, flags, usuario, baixar, estado, guardarFoto, drenar, apagados, fotosPorUri, armazenamento, enfileirarCru };
};
export type App = Awaited<ReturnType<typeof criarApp>>;

/** Rascunho com todas as etapas obrigatórias respondidas, usando os catálogos reais baixados do servidor. */
export const rascunhoCompleto = async (app: App, fotoUuid: string, extra: Partial<Rascunho> = {}): Promise<Rascunho> => {
  const { dados } = await app.estado();
  return {
    ...rascunhoVazio(), descricao: 'Lançados 200 m de cabo entre PL-0932 e CEO-01; CEO vedada.', motivo_codigo: dados.motivos[0].codigo,
    local: { lat: -23.5445, lng: -46.3118, origem: 'gps', precisao_m: 6, capturado_em: new Date().toISOString() },
    checklist: Object.fromEntries(dados.checklist.map((i) => [i.codigo, i.tipo === 'boolean' ? true : i.tipo === 'number' ? '4' : 'Tudo certo'])),
    materiais_usados: true, materiais_retirados: true,
    retirados: [
      { chave: 'a', item_id: SEMENTE.ids.cabo, descricao: 'Cabo óptico ASU 12F', quantidade: '15,5', unidade: 'metros', condicao: 'usado' },
      { chave: 'b', item_id: null, descricao: 'Splitter 1:8 antigo', quantidade: '1', unidade: 'pecas', condicao: 'usado' },
    ],
    fotos: [fotoUuid], participantes: [SEMENTE.ids.apoio], ...extra,
  };
};

export const esperarAte = async (cond: () => boolean | Promise<boolean>, ms = 8000) => {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await cond()) return; await new Promise((r) => setTimeout(r, 50)); }
  throw new Error('esperarAte: tempo esgotado');
};
