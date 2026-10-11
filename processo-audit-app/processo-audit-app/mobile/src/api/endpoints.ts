import type { ApiClient } from './client';
import type { Bootstrap } from '@/domain/tipos';

export interface Usuario { id: number; email: string; name: string; role: string }
export interface Sessao { token: string; refresh_token: string; expires_in: number; user: Usuario }
export interface Iniciada { status: 'em_andamento'; iniciado_em: string; repetida?: boolean }

/** Contrato do backend usado pelo app (ver docs/APP_MOBILE_API.md). */
export const criarApi = (c: ApiClient) => ({
  login: (email: string, password: string, dispositivo: string) =>
    c.request<Sessao>('POST', '/auth/login', { body: { email, password, dispositivo }, auth: false }),
  renovar: (refreshToken: string, dispositivo: string) =>
    c.request<Sessao>('POST', '/auth/refresh', { body: { refresh_token: refreshToken, dispositivo }, auth: false }),
  sair: (refreshToken: string) =>
    c.request<{ message: string }>('POST', '/auth/logout', { body: { refresh_token: refreshToken }, auth: false, timeoutMs: 5000 }),
  bootstrap: () => c.request<Bootstrap>('GET', '/mobile/bootstrap'),
  iniciarOS: (id: number, iniciadoEm: string, chave: string) =>
    c.request<Iniciada>('POST', `/os/${id}/iniciar`, { body: { iniciado_em: iniciadoEm }, idempotencyKey: chave }),
});

export type Api = ReturnType<typeof criarApi>;
