import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { osAPI } from '../../api/estoque';
import { FINALIZATION_STEPS, canFinalize, getStepCompletion, lerRascunho, rascunhoParaSalvar, toFieldOrder } from './finalizacao';

export { FINALIZATION_STEPS, canFinalize, getStepCompletion, toFieldOrder };

/* ── Rascunho de execução de uma OS ── */
const emptyDraft = () => ({
  status: 'pending', // pending | in_execution | closed
  startedAt: null,
  closedAt: null,
  description: '',
  closingReasonId: null, // código do motivo (catálogo do servidor)
  interventionLocation: null, // { lat, lng, accuracyMeters, source: 'gps' | 'address' | 'pole_reference', address, approximate, capturedAt }
  checklistAnswers: {}, // por código do item do catálogo
  usedMaterials: { wereUsed: null, lines: [] }, // wereUsed: null (não respondeu) | true | false
  removedMaterials: { wereRemoved: null, lines: [] }, // linhas: { inventoryId (id do item ou "livre-…"), name, unit, quantity, condition }
  crewMemberIds: [], // ids de técnicos/equipes do servidor
  finalizeUuid: null, // identifica a finalização: um reenvio depois de falha de rede usa o mesmo
});

const EMPTY_DRAFT = emptyDraft();
const initialState = { orders: [], loading: true, error: null, drafts: {}, catalogs: null, catalogsError: null };

const upd = (state, orderId, patch) => {
  const cur = state.drafts[orderId] || EMPTY_DRAFT;
  return { ...state, drafts: { ...state.drafts, [orderId]: { ...cur, ...patch(cur) } } };
};

const reducer = (state, a) => {
  switch (a.type) {
    case 'ORDERS_LOADING': return { ...state, loading: true, error: null };
    case 'ORDERS_LOADED': return {
      ...state, loading: false, drafts: { ...a.drafts, ...state.drafts },
      // a lista não traz lançamentos nem fotos: quem já foi detalhado não os perde numa recarga
      orders: a.orders.map((n) => { const old = state.orders.find((o) => o.id === n.id); return old?.detailLoaded && !n.detailLoaded ? { ...n, launches: old.launches, photos: old.photos, detailLoaded: true } : n; }),
    };
    case 'ORDERS_FAILED': return { ...state, loading: false, error: a.error };
    case 'ORDER_DETAIL_LOADED': return { ...state, orders: state.orders.map((o) => (o.id === a.order.id ? { ...o, ...a.order } : o)) };
    case 'CATALOGS_LOADED': return { ...state, catalogs: a.catalogs, catalogsError: null };
    case 'CATALOGS_FAILED': return { ...state, catalogsError: a.error };
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
      [a.bucket]: { ...d[a.bucket], lines: d[a.bucket].lines.map((l) => (l.inventoryId === a.inventoryId ? { ...l, ...a.patch } : l)) },
    }));
    case 'MATERIAL_LINE_REMOVED': return upd(state, a.orderId, (d) => ({
      [a.bucket]: { ...d[a.bucket], lines: d[a.bucket].lines.filter((l) => l.inventoryId !== a.inventoryId) },
    }));
    case 'CREW_MEMBER_TOGGLED': return upd(state, a.orderId, (d) => ({
      crewMemberIds: d.crewMemberIds.includes(a.memberId) ? d.crewMemberIds.filter((m) => m !== a.memberId) : [...d.crewMemberIds, a.memberId],
    }));
    case 'FINALIZE_UUID_SET': return upd(state, a.orderId, (d) => (d.finalizeUuid ? {} : { finalizeUuid: a.uuid }));
    case 'ORDER_CLOSED': return upd(state, a.orderId, () => ({ status: 'closed', closedAt: new Date().toISOString() }));
    default: return state;
  }
};

/* ── Context ── */
const Ctx = createContext(null);

export const FieldWorkProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const saved = useRef({}); // último JSON de rascunho gravado no banco, por OS
  const reload = useCallback(async () => {
    dispatch({ type: 'ORDERS_LOADING' });
    try {
      const rows = await osAPI.list();
      const orders = rows.map(toFieldOrder);
      // Rascunhos salvos no banco (progresso da finalização), só das OS que têm um
      const drafts = {};
      await Promise.all(orders.filter((o) => o.hasDraft).map(async (o) => {
        try {
          const { rascunho } = await osAPI.rascunho(o.id);
          const lido = lerRascunho(rascunho, emptyDraft()); // ignora o do app do celular e limpa sobras de versões antigas
          if (lido) { drafts[o.id] = lido; saved.current[o.id] = JSON.stringify(rascunhoParaSalvar(lido)); }
        } catch { /* sem rascunho: segue vazio */ }
      }));
      dispatch({ type: 'ORDERS_LOADED', orders, drafts });
    } catch (e) {
      // Técnico sem cadastro vinculado não tem OS: lista vazia em vez de erro.
      if (/vinculado/i.test(e.message)) dispatch({ type: 'ORDERS_LOADED', orders: [] });
      else dispatch({ type: 'ORDERS_FAILED', error: e.message });
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  // Catálogos da finalização (motivos, checklist, participantes, itens, regras): os mesmos do app do celular
  const reloadCatalogs = useCallback(() => osAPI.catalogosFechamento()
    .then((catalogs) => dispatch({ type: 'CATALOGS_LOADED', catalogs }))
    .catch((e) => dispatch({ type: 'CATALOGS_FAILED', error: e.message })), []);
  useEffect(() => { reloadCatalogs(); }, [reloadCatalogs]);

  // Salva o rascunho no banco (com pequeno atraso) sempre que a OS em execução muda
  const draftsRef = useRef(state.drafts);
  draftsRef.current = state.drafts;
  const flush = useCallback(() => {
    Object.entries(draftsRef.current).forEach(([id, d]) => {
      if (d.status !== 'in_execution') return;
      const copia = rascunhoParaSalvar(d);
      const json = JSON.stringify(copia);
      if (saved.current[id] === json) return;
      saved.current[id] = json;
      osAPI.salvarRascunho(id, copia).catch(() => { delete saved.current[id]; });
    });
  }, []);
  useEffect(() => {
    const t = setTimeout(flush, 700);
    return () => clearTimeout(t);
  }, [state.drafts, flush]);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush); flush(); };
  }, [flush]);
  const value = useMemo(() => ({ state, dispatch, reload, reloadCatalogs }), [state, reload, reloadCatalogs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

/* Hook por OS: devolve o pedido, o rascunho, as etapas e um dispatch já vinculado ao orderId */
export const useServiceOrder = (orderId) => {
  const { state, dispatch } = useContext(Ctx);
  const order = state.orders.find((o) => o.id === orderId) || null;
  const draft = order ? state.drafts[orderId] || EMPTY_DRAFT : null;
  return useMemo(() => ({
    order, draft, loading: state.loading, catalogs: state.catalogs, catalogsError: state.catalogsError,
    completion: draft ? getStepCompletion(draft, order, state.catalogs) : {},
    canFinalize: draft ? canFinalize(draft, order, state.catalogs) : false,
    act: (type, payload = {}) => dispatch({ type, orderId, ...payload }),
  }), [order, draft, orderId, dispatch, state.loading, state.catalogs, state.catalogsError]);
};

/* Pendentes = abertas ou em andamento no backend */
export const usePendingOrders = () => {
  const { state, reload } = useContext(Ctx);
  const orders = state.orders.filter((o) => ['aberta', 'em_andamento'].includes(o.backendStatus) && state.drafts[o.id]?.status !== 'closed');
  return { orders, loading: state.loading, error: state.error, reload };
};

export const useFieldWork = () => useContext(Ctx);

/* Catálogos da finalização + como tentar de novo se não vieram */
export const useCatalogs = () => {
  const { state, reloadCatalogs } = useContext(Ctx);
  return { catalogs: state.catalogs, error: state.catalogsError, reload: reloadCatalogs };
};

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
