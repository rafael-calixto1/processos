import type { ApiClient } from './client';
import type { Bootstrap, DetalheOS } from '@/domain/tipos';
import type { SugestaoEndereco } from '@/domain/localizacao';
import type { CorpoFinalizar, PayloadLancamento } from '@/domain/operacoes';

export interface Usuario { id: number; email: string; name: string; role: string }
export interface Sessao { token: string; refresh_token: string; expires_in: number; user: Usuario }
export interface Iniciada { status: 'em_andamento'; iniciado_em: string; repetida?: boolean }
export interface RespostaLancamento {
  id: number; descricao: string; trecho: string | null; quantidade: number; repetida?: boolean;
  materiais: Array<{ movimentacao_id: number; lote_codigo: string; quantidade: number; saldo_lote: number }>;
}
export interface RespostaFoto { id: number; client_uuid: string; mime: string; tamanho: number; repetida?: boolean }
export interface RespostaFinalizar { status: 'concluida'; fechamento_id: number; finalizado_em: string; repetida?: boolean }

/** Arquivo local a enviar. Quem monta o corpo multipart (`criarFormulario`) sabe lê-lo no celular; nos testes é substituído. */
export interface ArquivoUpload { uri: string; nome: string; mime: string }
export interface PontoGeocodificado { latitude: number | null; longitude: number | null; aproximado?: boolean }
export type CriarFormulario = (campos: Record<string, string>, arquivo: ArquivoUpload) => Promise<FormData>;

/** Tempo para subir uma foto em rede ruim (as chamadas JSON usam o padrão, menor). */
export const TIMEOUT_UPLOAD_MS = 120_000;

/** Contrato do backend usado pelo app (ver docs/APP_MOBILE_API.md). */
export const criarApi = (c: ApiClient, deps: { criarFormulario?: CriarFormulario } = {}) => ({
  login: (email: string, password: string, dispositivo: string) =>
    c.request<Sessao>('POST', '/auth/login', { body: { email, password, dispositivo }, auth: false }),
  renovar: (refreshToken: string, dispositivo: string) =>
    c.request<Sessao>('POST', '/auth/refresh', { body: { refresh_token: refreshToken, dispositivo }, auth: false }),
  sair: (refreshToken: string) =>
    c.request<{ message: string }>('POST', '/auth/logout', { body: { refresh_token: refreshToken }, auth: false, timeoutMs: 5000 }),
  bootstrap: () => c.request<Bootstrap>('GET', '/mobile/bootstrap'),
  detalheOS: (id: number) => c.request<Omit<DetalheOS, 'baixado_em'>>('GET', `/os/${id}`),
  iniciarOS: (id: number, iniciadoEm: string, chave: string) =>
    c.request<Iniciada>('POST', `/os/${id}/iniciar`, { body: { iniciado_em: iniciadoEm }, idempotencyKey: chave }),
  lancar: (id: number, corpo: PayloadLancamento['corpo'], chave: string) =>
    c.request<RespostaLancamento>('POST', `/os/${id}/lancamentos`, { body: corpo, idempotencyKey: chave }),
  enviarFoto: (id: number, arquivo: ArquivoUpload, campos: Record<string, string>, chave: string) => {
    const criar = deps.criarFormulario;
    if (!criar) throw new Error('Envio de fotos não configurado neste ambiente.');
    return c.request<RespostaFoto>('POST', `/os/${id}/fotos`, { formulario: () => criar(campos, arquivo), idempotencyKey: chave, timeoutMs: TIMEOUT_UPLOAD_MS });
  },
  removerFoto: (id: number, fotoId: number) => c.request<{ ok: boolean }>('DELETE', `/os/${id}/fotos/${fotoId}`),
  finalizar: (id: number, corpo: CorpoFinalizar, chave: string) =>
    c.request<RespostaFinalizar>('POST', `/os/${id}/finalizar`, { body: corpo, idempotencyKey: chave }),
  /** Busca de endereço (CEP, "lat, lng" ou rua com número). O servidor consulta ViaCEP e OpenStreetMap, por isso o prazo maior. */
  buscarEndereco: (texto: string) => c.request<SugestaoEndereco[]>('GET', `/geo/search?q=${encodeURIComponent(texto)}`, { timeoutMs: 30_000 }),
  geocodificar: (e: { street: string; numero: string; city: string; uf: string; cep: string; bairro: string }) =>
    c.request<PontoGeocodificado>('GET', `/geo/geocode?${new URLSearchParams(e).toString()}`, { timeoutMs: 30_000 }),
  salvarRascunho: (id: number, rascunho: Record<string, unknown>) =>
    c.request<{ ok: boolean }>('PUT', `/os/${id}/rascunho`, { body: { rascunho } }),
});

export type Api = ReturnType<typeof criarApi>;
