import { ApiError } from '@/api/erros';
import type { FonteDeToken } from '@/api/client';
import type { Api, Sessao, Usuario } from '@/api/endpoints';
import type { Armazenamento } from './armazenamento';

export type EstadoSessao =
  | { status: 'carregando' }
  | { status: 'deslogado'; motivo?: 'expirada' | 'saiu' }
  | { status: 'logado'; usuario: Usuario };

const K = { access: 'os.sessao.access', refresh: 'os.sessao.refresh', usuario: 'os.sessao.usuario' } as const;

interface Dependencias {
  armazenamento: Armazenamento;
  api: () => Api; // preguiçoso: o cliente HTTP depende deste gerenciador, e ele do cliente
  dispositivo: () => string;
}

/**
 * Sessão do técnico: guarda os tokens no cofre, renova o token de acesso (uma renovação por vez, mesmo com várias
 * requisições falhando juntas, porque o servidor trata reuso do refresh token como roubo) e NUNCA derruba a sessão
 * por falta de rede: só uma recusa explícita do servidor encerra o login.
 */
export class GerenciadorSessao implements FonteDeToken {
  private estado: EstadoSessao = { status: 'carregando' };
  private access: string | null = null;
  private refresh: string | null = null;
  private renovando: Promise<boolean> | null = null;
  private readonly ouvintes = new Set<() => void>();
  private readonly deps: Dependencias;

  constructor(deps: Dependencias) { this.deps = deps; }

  getEstado = (): EstadoSessao => this.estado;
  assinar = (ouvinte: () => void): (() => void) => { this.ouvintes.add(ouvinte); return () => { this.ouvintes.delete(ouvinte); }; };
  tokenDeAcesso(): string | null { return this.access; }

  private definir(e: EstadoSessao) { this.estado = e; this.ouvintes.forEach((o) => o()); }

  async restaurar(): Promise<void> {
    const [access, refresh, usuario] = await Promise.all([this.deps.armazenamento.get(K.access), this.deps.armazenamento.get(K.refresh), this.deps.armazenamento.get(K.usuario)]);
    let user: Usuario | null = null;
    try { user = usuario ? (JSON.parse(usuario) as Usuario) : null; } catch { user = null; }
    if (refresh && user) {
      this.access = access; this.refresh = refresh;
      this.definir({ status: 'logado', usuario: user });
    } else {
      await this.limpar();
      this.definir({ status: 'deslogado' });
    }
  }

  async entrar(email: string, senha: string): Promise<Usuario> {
    const sessao = await this.deps.api().login(email.trim(), senha, this.deps.dispositivo());
    if (sessao.user.role !== 'tecnico') throw new ApiError(403, 'Este aplicativo é exclusivo para técnicos');
    await this.persistir(sessao);
    this.definir({ status: 'logado', usuario: sessao.user });
    return sessao.user;
  }

  /** Uma renovação por vez; quem chegar enquanto ela roda espera o mesmo resultado. */
  renovar(): Promise<boolean> {
    if (!this.renovando) this.renovando = this.executarRenovacao().finally(() => { this.renovando = null; });
    return this.renovando;
  }

  private async executarRenovacao(): Promise<boolean> {
    const refresh = this.refresh;
    if (!refresh) return false;
    let sessao: Sessao;
    try {
      sessao = await this.deps.api().renovar(refresh, this.deps.dispositivo());
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return false; // o servidor recusou: sessão acabou
      throw e; // sem rede, 429 ou 5xx: continua logado e tenta de novo depois
    }
    if (sessao.user.role !== 'tecnico') return false;
    await this.persistir(sessao);
    return true;
  }

  sessaoPerdida(): void {
    if (this.estado.status !== 'logado') return;
    void this.encerrarLocal('expirada');
  }

  /** Sair de verdade: avisa o servidor (se der) para revogar a sessão e apaga os tokens do aparelho. */
  async sair(): Promise<void> {
    const refresh = this.refresh;
    if (refresh) await this.deps.api().sair(refresh).catch(() => undefined); // offline: o token expira sozinho em 30 dias
    await this.encerrarLocal('saiu');
  }

  private async encerrarLocal(motivo: 'expirada' | 'saiu') {
    await this.limpar();
    this.definir({ status: 'deslogado', motivo });
  }

  private async persistir(s: Sessao) {
    // o refresh primeiro: é ele que não pode se perder depois de o servidor tê-lo trocado
    await this.deps.armazenamento.set(K.refresh, s.refresh_token);
    await this.deps.armazenamento.set(K.access, s.token);
    await this.deps.armazenamento.set(K.usuario, JSON.stringify(s.user));
    this.refresh = s.refresh_token;
    this.access = s.token;
  }

  private async limpar() {
    this.access = null; this.refresh = null;
    await Promise.all(Object.values(K).map((k) => this.deps.armazenamento.remove(k)));
  }
}
