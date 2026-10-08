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
  if ((res.status === 401 || (res.status === 403 && /^Token /.test((data as { error?: string }).error || ''))) && token) {
    // Sessão expirada: limpa o token e volta ao login
    localStorage.removeItem('token');
    window.location.assign('/');
  }
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
  detalheCompra: (ids: number[]) => request('GET', `/estoque/compras/detalhe?ids=${ids.join(',')}`),
  patrimonio: (p: Record<string, unknown>) => request('GET', `/estoque/patrimonio${qs(p)}`),
  patrimonioSugestoes: (tipo: string, q: string) => request('GET', `/estoque/patrimonio/sugestoes${qs({ tipo, q })}`),
  historicoLote: (id: number) => request('GET', `/estoque/lotes/${id}/historico`),
  lotesDaCompra: (id: number) => request('GET', `/estoque/compras/${id}/lotes`),
  lote: (codigo: string) => request('GET', `/estoque/lotes/${encodeURIComponent(codigo.trim())}`),
  editarLote: (id: number, b: Body) => request('PUT', `/estoque/lotes/${id}`, b),
  descartarLote: (id: number, b: Body) => request('POST', `/estoque/lotes/${id}/descartar`, b),
  excluirLote: (id: number) => request('DELETE', `/estoque/lotes/${id}`),
  retirar: (b: Body) => request('POST', '/estoque/retiradas', b),
  devolver: (b: Body) => request('POST', '/estoque/devolucoes', b),
  devolucoes: (p?: Record<string, unknown>) => request('GET', `/estoque/devolucoes${qs(p)}`),
  aprovarDevolucao: (id: number, b?: Body) => request('POST', `/estoque/devolucoes/${id}/aprovar`, b),
  negarDevolucao: (id: number, b?: Body) => request('POST', `/estoque/devolucoes/${id}/negar`, b),
  posse: () => request('GET', '/estoque/posse'),
  minhaPosse: () => request('GET', '/estoque/posse/minha'),
  fichaTecnico: (id: number | string) => request('GET', `/estoque/posse/${id}`),
};

export const osAPI = {
  tiposServico: () => request('GET', '/os/tipos-servico'),
  criarTipoServico: (nome: string) => request('POST', '/os/tipos-servico', { nome }),
  list: (p?: Record<string, unknown>) => request('GET', `/os${qs(p)}`),
  get: (id: number | string) => request('GET', `/os/${id}`),
  criar: (b: Body) => request('POST', '/os', b),
  atualizar: (id: number, b: Body) => request('PUT', `/os/${id}`, b),
  adicionarMaterial: (id: number, b: Body) => request('POST', `/os/${id}/materiais`, b),
  lancar: (id: number | string, b: Body) => request('POST', `/os/${id}/lancamentos`, b),
  adicionarServico: (id: number, b: Body) => request('POST', `/os/${id}/servicos`, b),
  removerServico: (id: number, servicoId: number) => request('DELETE', `/os/${id}/servicos/${servicoId}`),
  sugestoesServicos: () => request('GET', '/os/servicos/sugestoes'),
  rascunho: (id: number | string) => request('GET', `/os/${id}/rascunho`) as Promise<{ rascunho: Record<string, unknown> | null }>,
  salvarRascunho: (id: number | string, rascunho: Record<string, unknown>) => request('PUT', `/os/${id}/rascunho`, { rascunho }),
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
  estoque: (p?: Record<string, unknown>) => request('GET', `/painel/estoque${qs(p)}`),
  os: (p?: Record<string, unknown>) => request('GET', `/painel/os${qs(p)}`),
};

// Busca de endereço: CEP, "lat, lng" ou texto livre
export type AddressSuggestion = {
  label: string; logradouro: string; numero: string; bairro: string; cidade: string; uf: string; cep: string;
  latitude: number | null; longitude: number | null;
};
export const popsAPI = {
  list: (): Promise<{ id: number; nome: string }[]> => request('GET', '/hubsoft/pops') as Promise<{ id: number; nome: string }[]>,
};

export const geoAPI = {
  geocode: (p: Record<string, string>): Promise<{ latitude: number | null; longitude: number | null; aproximado?: boolean }> => request('GET', `/geo/geocode${qs(p)}`) as Promise<{ latitude: number | null; longitude: number | null; aproximado?: boolean }>,
  search: (q: string): Promise<AddressSuggestion[]> => request('GET', `/geo/search${qs({ q })}`) as Promise<AddressSuggestion[]>,
};
