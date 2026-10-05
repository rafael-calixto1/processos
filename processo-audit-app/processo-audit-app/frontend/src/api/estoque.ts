// Cliente da API de Estoque / OS / Cadastros / Painel (mesmo padrão do index.ts).
const API_URL = '/api';

type Body = Record<string, unknown> | undefined;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const request = async (method: string, path: string, body?: Body) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error || 'Erro inesperado. Tente novamente.');
  return data;
};

const qs = (p: Record<string, unknown> = {}) => {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') s.append(k, String(v)); });
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const estoqueAPI = {
  itens: (p?: Record<string, unknown>) => request('GET', `/estoque/itens${qs(p)}`),
  item: (id: number | string) => request('GET', `/estoque/itens/${id}`),
  criarItem: (b: Body) => request('POST', '/estoque/itens', b),
  atualizarItem: (id: number, b: Body) => request('PUT', `/estoque/itens/${id}`, b),
  compras: () => request('GET', '/estoque/compras'),
  criarCompra: (b: Body) => request('POST', '/estoque/compras', b),
  lotesDaCompra: (id: number) => request('GET', `/estoque/compras/${id}/lotes`),
  lote: (codigo: string) => request('GET', `/estoque/lotes/${encodeURIComponent(codigo.trim())}`),
  retirar: (b: Body) => request('POST', '/estoque/retiradas', b),
  devolver: (b: Body) => request('POST', '/estoque/devolucoes', b),
  posse: () => request('GET', '/estoque/posse'),
  minhaPosse: () => request('GET', '/estoque/posse/minha'),
  fichaTecnico: (id: number | string) => request('GET', `/estoque/posse/${id}`),
};

export const osAPI = {
  list: (p?: Record<string, unknown>) => request('GET', `/os${qs(p)}`),
  get: (id: number | string) => request('GET', `/os/${id}`),
  criar: (b: Body) => request('POST', '/os', b),
  atualizar: (id: number, b: Body) => request('PUT', `/os/${id}`, b),
  adicionarMaterial: (id: number, b: Body) => request('POST', `/os/${id}/materiais`, b),
  fechar: (id: number) => request('POST', `/os/${id}/fechar`),
  cancelar: (id: number) => request('POST', `/os/${id}/cancelar`),
  estornar: (id: number, b: Body) => request('POST', `/os/${id}/estornos`, b),
};

export const cadastrosAPI = {
  tecnicos: () => request('GET', '/tecnicos'),
  usuariosDisponiveis: () => request('GET', '/tecnicos/usuarios-disponiveis'),
  criarTecnico: (b: Body) => request('POST', '/tecnicos', b),
  atualizarTecnico: (id: number, b: Body) => request('PUT', `/tecnicos/${id}`, b),
  fornecedores: () => request('GET', '/fornecedores'),
  criarFornecedor: (b: Body) => request('POST', '/fornecedores', b),
  atualizarFornecedor: (id: number, b: Body) => request('PUT', `/fornecedores/${id}`, b),
  equipamentos: () => request('GET', '/equipamentos'),
  criarEquipamento: (b: Body) => request('POST', '/equipamentos', b),
  saidaEquipamento: (id: number, b: Body) => request('POST', `/equipamentos/${id}/saida`, b),
  devolucaoEquipamento: (id: number, b: Body) => request('POST', `/equipamentos/${id}/devolucao`, b),
};

export const painelAPI = {
  uso: (p?: Record<string, unknown>) => request('GET', `/painel/uso${qs(p)}`),
};
