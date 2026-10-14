import { ApiError, NetworkError, type DetalheErro } from './erros';

/** O cliente HTTP não conhece o armazenamento de sessão: pede o token e a renovação por esta interface. */
export interface FonteDeToken {
  tokenDeAcesso(): string | null;
  /** Renova a sessão. Devolve false se ela não vale mais; lança NetworkError se não deu para saber (offline). */
  renovar(): Promise<boolean>;
  /** A sessão acabou (renovação recusada): quem ouvir deve voltar ao login. */
  sessaoPerdida(): void;
}

export interface OpcoesCliente {
  baseUrl: () => string;
  tokens: FonteDeToken;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface OpcoesRequisicao {
  body?: unknown;
  /** Corpo multipart. É uma função porque cada tentativa (inclusive a repetida depois de renovar o token) monta o seu. */
  formulario?: () => Promise<FormData>;
  auth?: boolean; // padrão true
  idempotencyKey?: string;
  timeoutMs?: number;
}

const CODIGOS_DE_TOKEN = ['token_expirado', 'token_invalido'];

export class ApiClient {
  private readonly opts: OpcoesCliente;
  constructor(opts: OpcoesCliente) { this.opts = opts; }

  async request<T>(method: string, caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
    const auth = opcoes.auth !== false;
    let r = await this.enviar(method, caminho, opcoes, auth);
    // Token vencido (403 com code) ou sessão sem token (401): renova uma vez e repete. Um 403 de regra de negócio não renova.
    if (auth && this.tokenRecusado(r)) {
      if (!(await this.opts.tokens.renovar())) {
        this.opts.tokens.sessaoPerdida();
        throw new ApiError(401, 'Sua sessão expirou. Entre novamente.', { code: 'sessao_expirada' });
      }
      r = await this.enviar(method, caminho, opcoes, auth);
      if (this.tokenRecusado(r)) {
        this.opts.tokens.sessaoPerdida();
        throw new ApiError(401, 'Sua sessão expirou. Entre novamente.', { code: 'sessao_expirada' });
      }
    }
    if (r.status >= 200 && r.status < 300) return r.dados as T;
    throw this.erroDe(r);
  }

  private tokenRecusado(r: Resposta): boolean {
    return r.status === 401 || (r.status === 403 && CODIGOS_DE_TOKEN.includes(r.dados?.code));
  }

  private async enviar(method: string, caminho: string, o: OpcoesRequisicao, auth: boolean): Promise<Resposta> {
    // X-Cliente: a auditoria das OS no servidor separa o que veio do app do que veio do web
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Cliente': 'cw-campo' };
    let corpo: string | FormData | undefined;
    if (o.formulario) corpo = await o.formulario(); // sem Content-Type: o fetch acrescenta o boundary
    else if (o.body !== undefined) { headers['Content-Type'] = 'application/json'; corpo = JSON.stringify(o.body); }
    if (o.idempotencyKey) headers['Idempotency-Key'] = o.idempotencyKey;
    const token = auth ? this.opts.tokens.tokenDeAcesso() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    const controle = new AbortController();
    const tempo = setTimeout(() => controle.abort(), o.timeoutMs ?? this.opts.timeoutMs ?? 20000);
    let res: Response;
    try {
      res = await (this.opts.fetchImpl ?? fetch)(`${this.opts.baseUrl()}${caminho}`, {
        method, headers, body: corpo, signal: controle.signal,
      });
    } catch (e) {
      throw new NetworkError(controle.signal.aborted ? 'O servidor demorou demais para responder. Tente de novo.' : undefined);
    } finally {
      clearTimeout(tempo);
    }
    const texto = await res.text().catch(() => '');
    let dados: any = null;
    try { dados = texto ? JSON.parse(texto) : null; } catch { dados = null; }
    return { status: res.status, dados, retryAfter: Number(res.headers.get('retry-after')) || undefined };
  }

  private erroDe(r: Resposta): ApiError {
    const msg = typeof r.dados?.error === 'string' ? r.dados.error : `Erro inesperado do servidor (${r.status}). Tente novamente.`;
    return new ApiError(r.status, msg, {
      code: r.dados?.code,
      detalhes: Array.isArray(r.dados?.detalhes) ? (r.dados.detalhes as DetalheErro[]) : undefined,
      retryAfter: r.retryAfter,
    });
  }
}

interface Resposta { status: number; dados: any; retryAfter?: number }
