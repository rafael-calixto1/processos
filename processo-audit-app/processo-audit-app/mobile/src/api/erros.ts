export interface DetalheErro { campo: string; mensagem: string }

/** Resposta de erro do servidor (a mensagem já vem em pt-BR). */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly detalhes?: DetalheErro[];
  readonly retryAfter?: number; // segundos (429)
  constructor(status: number, message: string, extra: { code?: string; detalhes?: DetalheErro[]; retryAfter?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = extra.code;
    this.detalhes = extra.detalhes;
    this.retryAfter = extra.retryAfter;
  }
}

/** Não foi possível falar com o servidor (sem rede, servidor fora do ar, tempo esgotado). Nunca significa "sessão inválida". */
export class NetworkError extends Error {
  constructor(message = 'Sem conexão com o servidor. Verifique a internet e tente de novo.') {
    super(message);
    this.name = 'NetworkError';
  }
}

/** O arquivo da foto não está mais no aparelho (apagado pelo sistema ou pelo usuário). Reenviar não adianta. */
export class ArquivoAusenteError extends Error {
  constructor(message = 'A foto não está mais guardada no aparelho.') {
    super(message);
    this.name = 'ArquivoAusenteError';
  }
}

export const mensagemDeErro = (e: unknown): string => (e instanceof Error ? e.message : 'Erro inesperado. Tente novamente.');
