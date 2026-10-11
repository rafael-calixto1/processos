import type { Bootstrap, OS } from '@/domain/tipos';

export const criarOS = (n: number, sobrescrever: Partial<OS> = {}): OS => ({
  id: 100 + n, numero: n, cliente: `Rota PL-${900 + n} → CEO-0${n}`, endereco: `Estrada Takashi Kobata, ${570 + n}, Suzano/SP`, prazo: '2026-10-20',
  prioridade: 'normal', status: 'aberta', descricao: null, criado_em: '2026-10-10T12:00:00.000Z', atualizado_em: '2026-10-10T12:00:00.000Z',
  iniciado_em: null, concluida_em: null, tipo_servico: 'Lançamento de rota', cep: null, logradouro: null, numero_endereco: null, complemento: null,
  bairro: null, cidade: null, uf: null, latitude: -23.5445, longitude: -46.3118, pop_nome: null, rota_id: null, poste_id: `PL-0${900 + n}`,
  criado_por_nome: 'Maria do Estoque', tem_rascunho: false, ...sobrescrever,
});

export const criarBootstrap = (sobrescrever: Partial<Bootstrap> = {}): Bootstrap => ({
  gerado_em: '2026-10-11T13:30:00.000Z',
  tecnico: { id: 1, nome: 'João Técnico', tipo: 'interno', empresa: null },
  os: [criarOS(1, { status: 'em_andamento', iniciado_em: '2026-10-11T12:00:00.000Z' }), criarOS(2, { prioridade: 'alta', prazo: '2026-10-12' }), criarOS(3, { status: 'concluida', concluida_em: '2026-10-09T18:00:00.000Z' })],
  posse: [
    { lote_id: 11, lote_codigo: 'LOTE-BOB-0001', item_id: 1, item_nome: 'Cabo óptico ASU 12F', unidade: 'metros', quantidade: 449.5 },
    { lote_id: 21, lote_codigo: 'LOTE-UNI-0001', item_id: 2, item_nome: 'Conector SC/APC', unidade: 'pecas', quantidade: 30 },
    { lote_id: 22, lote_codigo: 'LOTE-UNI-0002', item_id: 2, item_nome: 'Conector SC/APC', unidade: 'pecas', quantidade: 20 },
  ],
  motivos: [{ id: 1, codigo: 'route_launched', rotulo: 'Rota lançada com sucesso', tipo_servico_id: null }],
  checklist: [{ id: 1, codigo: 'fiberLaunchedMeters', rotulo: 'Metros de fibra lançados?', tipo: 'number', unidade: 'm', obrigatorio: true, tipo_servico_id: null }],
  sugestoes_servicos: ['Lançamento de cabo ASU 12F'], tipos_servico: [{ id: 1, nome: 'Lançamento de rota' }],
  tecnicos: [{ id: 2, nome: 'Equipe Apoio', tipo: 'terceirizado', empresa: 'Apoio Ltda' }],
  itens: [{ id: 1, nome: 'Cabo óptico ASU 12F', categoria: 'Cabos', unidade: 'metros' }],
  regras: { descricao_min_caracteres: 11, descricao_max_caracteres: 5000, fotos_min: 1, fotos_max: 30, foto_max_bytes: 8388608, participantes_max: 20, retirados_max: 50 },
  ...sobrescrever,
});
