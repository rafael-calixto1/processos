import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { osAPI } from '../../api/estoque';
import { OUTSIDE_PLANT_CHECKLIST } from './mockData';

/* ── Rascunho de execução de uma OS de infraestrutura ── */
const emptyDraft = () => ({
  status: 'pending', // pending | in_execution | closed
  startedAt: null,
  closedAt: null,
  description: '',
  closingReasonId: null,
  interventionLocation: null, // { lat, lng, accuracyMeters, source: 'gps' | 'pole_reference', capturedAt }
  checklistAnswers: {},
  usedMaterials: { wereUsed: null, lines: [] }, // wereUsed: null (não respondeu) | true | false
  removedMaterials: { wereRemoved: null, lines: [] },
  servicePhotos: [], // { id, url, caption, takenAt }
  crewMemberIds: [],
});

const EMPTY_DRAFT = emptyDraft();
const initialState = { orders: [], loading: true, error: null, drafts: {} };

const upd = (state, orderId, patch) => {
  const cur = state.drafts[orderId] || EMPTY_DRAFT;
  return { ...state, drafts: { ...state.drafts, [orderId]: { ...cur, ...patch(cur) } } };
};

/* OS do backend -> modelo do fluxo de campo. POP, rota e poste só existem quando o backend os informar. */
export const toFieldOrder = (os) => ({
  id: String(os.id),
  code: `OS-${os.numero}`,
  kind: os.cliente,
  priority: os.prioridade === 'alta' ? 'high' : 'normal',
  serviceType: os.tipo_servico || '',
  pop: os.pop_nome ? { id: os.pop_nome, name: os.pop_nome } : null,
  route: os.rota_id ? { id: os.rota_id, label: '' } : null,
  // Ponto no mapa: o poste informado, ou o local da OS quando só há coordenadas
  pole: os.latitude != null ? { id: os.poste_id || 'Local da OS', lat: Number(os.latitude), lng: Number(os.longitude) } : (os.poste_id ? { id: os.poste_id, lat: null, lng: null } : null),
  address: os.endereco || '',
  slaDeadline: os.prazo ? `${String(os.prazo).slice(0, 10)}T23:59:59` : null,
  openedBy: { name: os.criado_por_nome || '—', role: '' },
  openedAt: os.criado_em,
  summary: os.descricao || '',
  backendStatus: os.status,
  // Lançamentos: linhas de serviço por trecho com os materiais baixados nelas (só vêm no detalhe da OS)
  launches: Array.isArray(os.servicos)
    ? os.servicos.map((sv) => ({
      id: sv.id, description: sv.descricao, segment: sv.trecho || '',
      materials: (os.materiais || []).filter((m) => m.servico_id === sv.id && !m.estorno_id).map((m) => ({ id: m.id, name: m.item_nome, lot: m.lote_codigo, quantity: Number(m.quantidade), unit: m.unidade })),
    })).filter((l) => l.materials.length > 0)
    : [],
});

const reducer = (state, a) => {
  switch (a.type) {
    case 'ORDERS_LOADING': return { ...state, loading: true, error: null };
    case 'ORDERS_LOADED': return { ...state, loading: false, orders: a.orders };
    case 'ORDERS_FAILED': return { ...state, loading: false, error: a.error };
    case 'ORDER_DETAIL_LOADED': return { ...state, orders: state.orders.map((o) => (o.id === a.order.id ? { ...o, ...a.order } : o)) };
    case 'EXECUTION_STARTED': return upd(state, a.orderId, (d) => (d.status === 'pending' ? { status: 'in_execution', startedAt: new Date().toISOString() } : {}));
    case 'DESCRIPTION_CHANGED': return upd(state, a.orderId, () => ({ description: a.value }));
    case 'CLOSING_REASON_SELECTED': return upd(state, a.orderId, () => ({ closingReasonId: a.reasonId }));
    case 'INTERVENTION_LOCATION_SET': return upd(state, a.orderId, () => ({ interventionLocation: { ...a.location, capturedAt: new Date().toISOString() } }));
    case 'CHECKLIST_ANSWERED': return upd(state, a.orderId, (d) => ({ checklistAnswers: { ...d.checklistAnswers, [a.itemId]: a.value } }));
    case 'MATERIALS_FLAG_SET': return upd(state, a.orderId, (d) => {
      const key = a.bucket; const flag = a.bucket === 'usedMaterials' ? 'wereUsed' : 'wereRemoved';
      return { [key]: { ...d[key], [flag]: a.value, lines: a.value ? d[key].lines : [] } };
    });
    case 'MATERIAL_LINE_ADDED': return upd(state, a.orderId, (d) => {
      const b = d[a.bucket];
      if (b.lines.some((l) => l.inventoryId === a.line.inventoryId)) return {};
      return { [a.bucket]: { ...b, lines: [...b.lines, a.line] } };
    });
    case 'MATERIAL_LINE_CHANGED': return upd(state, a.orderId, (d) => ({
      [a.bucket]: { ...d[a.bucket], lines: d[a.bucket].lines.map((l) => (l.inventoryId === a.inventoryId ? { ...l, quantity: a.quantity } : l)) },
    }));
    case 'MATERIAL_LINE_REMOVED': return upd(state, a.orderId, (d) => ({
      [a.bucket]: { ...d[a.bucket], lines: d[a.bucket].lines.filter((l) => l.inventoryId !== a.inventoryId) },
    }));
    case 'PHOTO_ADDED': return upd(state, a.orderId, (d) => ({ servicePhotos: [...d.servicePhotos, a.photo] }));
    case 'PHOTO_REMOVED': return upd(state, a.orderId, (d) => ({ servicePhotos: d.servicePhotos.filter((p) => p.id !== a.photoId) }));
    case 'CREW_MEMBER_TOGGLED': return upd(state, a.orderId, (d) => ({
      crewMemberIds: d.crewMemberIds.includes(a.memberId) ? d.crewMemberIds.filter((m) => m !== a.memberId) : [...d.crewMemberIds, a.memberId],
    }));
    case 'ORDER_CLOSED': return upd(state, a.orderId, () => ({ status: 'closed', closedAt: new Date().toISOString() }));
    default: return state;
  }
};

/* ── Etapas obrigatórias da finalização (ordem exibida na tela) ── */
export const FINALIZATION_STEPS = [
  { key: 'description', label: 'Descrição', required: true },
  { key: 'closing-reason', label: 'Motivo de Fechamento', required: true },
  { key: 'intervention-location', label: 'Local do Endereço', required: true },
  { key: 'checklists', label: 'Checklists', required: true },
  { key: 'used-materials', label: 'Materiais Utilizados', required: true },
  { key: 'removed-materials', label: 'Materiais Retirados', required: true },
  { key: 'service-photos', label: 'Fotos do Serviço', required: true },
  { key: 'crew', label: 'Participantes', required: false },
];

const materialsDone = (b, flag) => b[flag] === false || (b[flag] === true && b.lines.length > 0 && b.lines.every((l) => Number(l.quantity) > 0));

/* Seletor puro: quais etapas estão concluídas */
export const getStepCompletion = (d, order) => ({
  'description': d.description.trim().length >= 10,
  'closing-reason': Boolean(d.closingReasonId),
  'intervention-location': Boolean(d.interventionLocation),
  'checklists': OUTSIDE_PLANT_CHECKLIST.filter((i) => i.required).every((i) => {
    const v = d.checklistAnswers[i.id];
    return i.type === 'boolean' ? typeof v === 'boolean' : v !== undefined && v !== '' && Number(v) >= 0;
  }),
  // Materiais usados vêm dos lançamentos (servidor). "Não usou" só vale se nenhum lançamento foi feito.
  'used-materials': (order?.launches?.length || 0) > 0 || d.usedMaterials.wereUsed === false,
  'removed-materials': materialsDone(d.removedMaterials, 'wereRemoved'),
  'service-photos': d.servicePhotos.length > 0,
  'crew': d.crewMemberIds.length > 0,
});

export const canFinalize = (d, order) => {
  const done = getStepCompletion(d, order);
  return FINALIZATION_STEPS.filter((s) => s.required).every((s) => done[s.key]);
};

/* ── Context ── */
const Ctx = createContext(null);

export const FieldWorkProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const reload = useCallback(async () => {
    dispatch({ type: 'ORDERS_LOADING' });
    try {
      const rows = await osAPI.list();
      dispatch({ type: 'ORDERS_LOADED', orders: rows.map(toFieldOrder) });
    } catch (e) {
      // Técnico sem cadastro vinculado não tem OS: lista vazia em vez de erro.
      if (/vinculado/i.test(e.message)) dispatch({ type: 'ORDERS_LOADED', orders: [] });
      else dispatch({ type: 'ORDERS_FAILED', error: e.message });
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const value = useMemo(() => ({ state, dispatch, reload }), [state, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

/* Hook por OS: devolve o pedido, o rascunho, as etapas e um dispatch já vinculado ao orderId */
export const useServiceOrder = (orderId) => {
  const { state, dispatch } = useContext(Ctx);
  const order = state.orders.find((o) => o.id === orderId) || null;
  const draft = order ? state.drafts[orderId] || EMPTY_DRAFT : null;
  return useMemo(() => ({
    order, draft,
    completion: draft ? getStepCompletion(draft, order) : {},
    canFinalize: draft ? canFinalize(draft, order) : false,
    act: (type, payload = {}) => dispatch({ type, orderId, ...payload }),
  }), [order, draft, orderId, dispatch]);
};

/* Pendentes = abertas ou em andamento no backend */
export const usePendingOrders = () => {
  const { state, reload } = useContext(Ctx);
  const orders = state.orders.filter((o) => ['aberta', 'em_andamento'].includes(o.backendStatus) && state.drafts[o.id]?.status !== 'closed');
  return { orders, loading: state.loading, error: state.error, reload };
};

export const useFieldWork = () => useContext(Ctx);

/* Carrega o detalhe da OS (descrição, lançamentos e materiais) e devolve um reload */
export const useOrderDetail = (orderId) => {
  const { dispatch, state } = useContext(Ctx);
  const reloadDetail = useCallback(
    () => osAPI.get(orderId).then((os) => dispatch({ type: 'ORDER_DETAIL_LOADED', order: toFieldOrder(os) })),
    [orderId, dispatch],
  );
  const known = state.orders.some((o) => o.id === orderId);
  useEffect(() => { if (known) reloadDetail().catch(() => {}); }, [known, reloadDetail]);
  return reloadDetail;
};
