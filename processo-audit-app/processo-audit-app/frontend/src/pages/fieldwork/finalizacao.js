/**
 * Regras puras da finalização de OS no web (sem React): etapas, o que conta como "concluída", o corpo de `POST /os/:id/finalizar`
 * e a leitura segura de rascunhos antigos. Os catálogos (motivos, checklist, participantes, itens, regras) vêm do servidor
 * (`GET /os/catalogos-fechamento`), os mesmos do app do celular. Testado em `tests/web_finalizacao.test.js`.
 */

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

/** Usadas só até os catálogos chegarem do servidor. */
export const REGRAS_PADRAO = { descricao_min_caracteres: 11, descricao_max_caracteres: 5000, fotos_min: 1, fotos_max: 30, foto_max_bytes: 8 * 1024 * 1024, participantes_max: 20, retirados_max: 50 };

export const num = (v) => (v === '' || v === null || v === undefined || typeof v === 'boolean' ? NaN : Number(String(v).replace(',', '.')));
export const unidadeCurta = (u) => (u === 'metros' ? 'm' : 'un');
export const ehLinhaLivre = (l) => typeof l.inventoryId === 'string' && l.inventoryId.startsWith('livre-');

/** Resposta de um item do checklist do catálogo. Texto vazio e número negativo não valem; sim/não precisa ser mesmo verdadeiro/falso. */
export const respostaValida = (item, v) => {
  if (item.tipo === 'boolean') return typeof v === 'boolean';
  if (item.tipo === 'number') { const n = num(v); return Number.isFinite(n) && n >= 0; }
  return typeof v === 'string' && v.trim() !== '';
};

/** Uma linha de "material retirado": quantidade válida para a unidade, condição escolhida e, se for item livre, descrição. */
export const linhaRetiradaValida = (l) => {
  const q = num(l.quantity);
  if (!(q > 0)) return false;
  if (l.unit === 'pecas' && !Number.isInteger(q)) return false;
  if (l.unit === 'metros' && Math.round(q * 100) / 100 !== q) return false;
  if (!['novo', 'usado'].includes(l.condition)) return false;
  if (ehLinhaLivre(l) && String(l.name || '').trim().length < 2) return false;
  return true;
};
const retiradosPronto = (b) => b.wereRemoved === false || (b.wereRemoved === true && b.lines.length > 0 && b.lines.every(linhaRetiradaValida));

/** Quais etapas estão concluídas. Etapas que dependem dos catálogos do servidor só concluem depois de eles chegarem. */
export const getStepCompletion = (d, order, catalogs) => {
  const regras = catalogs?.regras ?? REGRAS_PADRAO;
  return {
    'description': d.description.trim().length >= regras.descricao_min_caracteres,
    'closing-reason': Boolean(d.closingReasonId) && (!catalogs || catalogs.motivos.some((m) => m.codigo === d.closingReasonId)),
    'intervention-location': Boolean(d.interventionLocation),
    'checklists': catalogs ? catalogs.checklist.filter((i) => i.obrigatorio).every((i) => respostaValida(i, d.checklistAnswers[i.codigo])) : false,
    // Materiais usados vêm dos lançamentos (servidor). "Não usou" só vale se nenhum lançamento foi feito.
    'used-materials': (order?.launches?.length || 0) > 0 || d.usedMaterials.wereUsed === false,
    'removed-materials': retiradosPronto(d.removedMaterials),
    // As fotos moram no servidor (enviadas na hora em que são tiradas): vale o que ele tem
    'service-photos': (order?.photos?.length || 0) >= regras.fotos_min,
    'crew': d.crewMemberIds.length > 0,
  };
};

export const canFinalize = (d, order, catalogs) => {
  const done = getStepCompletion(d, order, catalogs);
  return FINALIZATION_STEPS.filter((s) => s.required).every((s) => done[s.key]);
};

/**
 * Corpo de `POST /os/:id/finalizar` (ver docs/APP_MOBILE_API.md). `draft.finalizeUuid` identifica ESTA finalização: um reenvio
 * depois de uma falha de rede usa o mesmo e o servidor devolve o resultado sem refazer nada.
 */
export const montarCorpoFinalizacao = ({ order, draft, catalogs, agora = new Date(), dispositivo = '' }) => {
  const checklist = {};
  for (const item of catalogs.checklist) {
    const v = draft.checklistAnswers[item.codigo];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) continue; // não respondido (opcional)
    checklist[item.codigo] = item.tipo === 'number' ? num(v) : item.tipo === 'text' ? String(v).trim() : v;
  }
  const retirou = draft.removedMaterials.wereRemoved === true;
  const loc = draft.interventionLocation;
  return {
    client_uuid: draft.finalizeUuid,
    descricao: draft.description.trim(),
    motivo_codigo: draft.closingReasonId,
    local: {
      lat: loc.lat, lng: loc.lng, precisao_m: loc.accuracyMeters ?? null, origem: loc.source, endereco: loc.address ?? null,
      aproximado: Boolean(loc.approximate), ...(loc.capturedAt && { capturado_em: loc.capturedAt }),
    },
    checklist,
    materiais_usados: (order.launches?.length || 0) > 0,
    materiais_retirados: retirou,
    retirados: retirou ? draft.removedMaterials.lines.map((l) => (ehLinhaLivre(l)
      ? { descricao: l.name.trim(), quantidade: num(l.quantity), unidade: l.unit, condicao: l.condition }
      : { item_id: l.inventoryId, quantidade: num(l.quantity), condicao: l.condition })) : [],
    participantes: draft.crewMemberIds,
    fotos_esperadas: (order.photos || []).map((p) => p.client_uuid).filter(Boolean),
    iniciado_em: draft.startedAt ?? null,
    finalizado_em: agora.toISOString(),
    dispositivo: String(dispositivo).slice(0, 160),
    versao_app: 'web',
  };
};

/** O que vai para o rascunho no servidor (cópia de segurança do progresso). As fotos não vão: já estão no servidor. */
export const rascunhoParaSalvar = (draft) => {
  const { servicePhotos, ...resto } = draft; // eslint-disable-line no-unused-vars
  return { versao: 2, origem: 'web', ...resto };
};

/**
 * Lê um rascunho vindo do servidor. Ignora o do app do celular (formato diferente) e limpa o que versões antigas do web guardavam
 * e não vale mais: fotos em data URL, itens de estoque de mentira ("inv-cab-asu12") e participantes de mentira ("cr-01").
 */
export const lerRascunho = (bruto, vazio) => {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null;
  if (bruto.origem && bruto.origem !== 'web') return null;
  const { versao, origem, servicePhotos, ...resto } = bruto; // eslint-disable-line no-unused-vars
  const rem = resto.removedMaterials && typeof resto.removedMaterials === 'object' ? resto.removedMaterials : vazio.removedMaterials;
  const linhasOk = Array.isArray(rem.lines) ? rem.lines.filter((l) => l && (Number.isInteger(l.inventoryId) || ehLinhaLivre(l))) : [];
  return {
    ...vazio, ...resto,
    removedMaterials: { ...vazio.removedMaterials, ...rem, lines: linhasOk },
    crewMemberIds: Array.isArray(resto.crewMemberIds) ? resto.crewMemberIds.filter(Number.isInteger) : [],
    checklistAnswers: resto.checklistAnswers && typeof resto.checklistAnswers === 'object' ? resto.checklistAnswers : {},
  };
};

/* OS do backend -> modelo do fluxo de campo. POP, rota e poste só existem quando o backend os informar. `launches` e `photos` só vêm no detalhe da OS. */
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
  hasDraft: Boolean(os.tem_rascunho),
  // Lançamentos: linhas de serviço por trecho com os materiais baixados nelas (só vêm no detalhe da OS)
  launches: Array.isArray(os.servicos)
    ? os.servicos.map((sv) => ({
      id: sv.id, description: sv.descricao, segment: sv.trecho || '', route: sv.rota_trecho || null,
      materials: (os.materiais || []).filter((m) => m.servico_id === sv.id && !m.estorno_id).map((m) => ({ id: m.id, name: m.item_nome, lot: m.lote_codigo, quantity: Number(m.quantidade), unit: m.unidade })),
    })).filter((l) => l.materials.length > 0)
    : [],
  // Fotos do serviço que o servidor já tem (só no detalhe)
  photos: Array.isArray(os.fotos) ? os.fotos.map((f) => ({ id: f.id, client_uuid: f.client_uuid || null, takenAt: f.tirada_em || null })) : [],
  detailLoaded: Array.isArray(os.servicos),
});
