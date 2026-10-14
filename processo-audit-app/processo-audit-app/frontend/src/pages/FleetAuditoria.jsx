import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Search, RefreshCw, ChevronDown, ChevronRight, User } from 'lucide-react';
import styles from './Fleet.module.css';
import a from './AuditoriaIndicacoes.module.css';
import f from './FleetAuditoria.module.css';
import { fleetFetch } from './fleetFetch';

// Códigos de ação e entidade vêm de src/services/fleet/auditoria.js
const GRUPOS = [
  { id: 'criado',     label: 'Cadastros' },
  { id: 'editado',    label: 'Edições' },
  { id: 'excluido',   label: 'Exclusões' },
  { id: 'cupom_lido', label: 'Cupons lidos' },
];

const TOM = { criado: 'novo', editado: 'edicao', excluido: 'perigo', cupom_lido: 'neutro' };

const CAMPOS = {
  make: 'Marca', model: 'Modelo', license_plate: 'Placa', current_kilometers: 'Km atual',
  next_tire_change: 'Próxima troca de pneu (km)', next_oil_change: 'Próxima troca de óleo (km)',
  driver_id: 'Motorista', status: 'Situação', name: 'Nome', license_number: 'Nº CNH',
  car_id: 'Veículo', fuel_date: 'Data', fueling_kilometers: 'Km no abastecimento', fuel_amount: 'Valor abastecido',
  liters_quantity: 'Litros', price_per_liter: 'Preço por litro', total_cost: 'Custo total', fuel_type: 'Combustível',
  observation: 'Observação', oil_change_date: 'Data', oil_change_kilometers: 'Km', tire_change_date: 'Data',
  tire_change_kilometers: 'Km', maintenance_type_id: 'Tipo de manutenção', maintenance_date: 'Data',
  maintenance_kilometers: 'Km', recurrence_mode: 'Recorrência por', recurrency: 'A cada (km)', recurrency_date: 'A cada (dias)',
  apagados_junto: 'Apagado junto', veiculos_ficaram_sem_motorista: 'Veículos que ficaram sem motorista',
  manutencoes_ficaram_sem_tipo: 'Manutenções que ficaram sem tipo',
};

const APAGADOS = { abastecimentos: 'abastecimento(s)', manutencoes: 'manutenção(ões)', trocas_oleo: 'troca(s) de óleo', trocas_pneu: 'troca(s) de pneu' };

const DINHEIRO = new Set(['fuel_amount', 'price_per_liter', 'total_cost']);
const SITUACAO = { active: 'Ativo', inactive: 'Inativo' };
const MODO = { km: 'Quilometragem', date: 'Tempo', both: 'Km e tempo' };

const FILTRO_VAZIO = { acao: '', entidade: '', usuario_id: '', veiculo_id: '', ip: '', de: '', ate: '', q: '' };
const POR_PAGINA = 50;

const fmtDataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '—');

function fmtCampo(campo, v, dados) {
  if (v === null || v === undefined || v === '') return '—';
  if (campo === 'apagados_junto' && typeof v === 'object') {
    const partes = Object.entries(v).filter(([, n]) => Number(n) > 0).map(([k, n]) => `${n} ${APAGADOS[k] ?? k}`);
    return partes.length ? partes.join(', ') : 'nada';
  }
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  const id = String(v);
  if (campo === 'car_id') return dados?.veiculos?.find(x => String(x.id) === id)?.nome ?? `Veículo #${id}`;
  if (campo === 'driver_id') return dados?.nomes?.motoristas?.[id] ?? `Motorista #${id}`;
  if (campo === 'maintenance_type_id') return dados?.nomes?.tipos?.[id] ?? `Tipo #${id}`;
  if (campo === 'status') return SITUACAO[v] ?? id;
  if (campo === 'recurrence_mode') return MODO[v] ?? id;
  if (DINHEIRO.has(campo) && Number.isFinite(Number(v))) return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
  const d = id.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) return `${d[3]}/${d[2]}/${d[1]}`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(id)) return fmtDataHora(id);
  return id;
}

// Tabela "campo / valor" para cadastros e exclusões (mais legível que JSON cru)
function TabelaDados({ titulo, valores, dados }) {
  const linhas = Object.entries(valores ?? {}).filter(([k]) => k !== 'id');
  if (!linhas.length) return null;
  return (
    <div className={a.bloco}>
      <span className={a.blocoTitulo}>{titulo}</span>
      <table className={a.diff}>
        <tbody>
          {linhas.map(([k, v]) => (
            <tr key={k}>
              <td>{k === 'created_at' ? 'Cadastrado em' : CAMPOS[k] ?? k.replace(/_/g, ' ')}</td>
              <td>{fmtCampo(k, v, dados)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Detalhes({ item, dados, onFiltrarIp, onFiltrarVeiculo }) {
  const campos = item.campos_alterados ? item.campos_alterados.split(',') : [];
  return (
    <div className={a.detalhes}>
      {campos.length > 0 && (
        <table className={a.diff}>
          <thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
          <tbody>
            {campos.map(c => (
              <tr key={c}>
                <td>{CAMPOS[c] ?? c}</td>
                <td className={a.antes}>{fmtCampo(c, item.dados_antes?.[c], dados)}</td>
                <td className={a.depois}>{fmtCampo(c, item.dados_depois?.[c], dados)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {campos.length === 0 && item.acao !== 'cupom_lido' && (
        <TabelaDados titulo={item.acao === 'excluido' ? 'Dados apagados' : item.acao === 'editado' ? 'Registro (nada mudou)' : 'Dados cadastrados'}
          valores={item.dados_antes ?? item.dados_depois} dados={dados} />
      )}
      {item.acao === 'cupom_lido' && item.dados_depois && (
        <div className={a.bloco}>
          <span className={a.blocoTitulo}>O que foi lido do cupom</span>
          <pre className={a.json}>{JSON.stringify(item.dados_depois, null, 2)}</pre>
        </div>
      )}
      <dl className={a.meta}>
        <dt>Registro</dt><dd>#{item.id} · {fmtDataHora(item.created_at)}</dd>
        <dt>Usuário</dt><dd>{item.usuario_nome || item.usuario_email ? `${item.usuario_nome ?? ''} ${item.usuario_email ? `<${item.usuario_email}>` : ''}` : '—'}</dd>
        <dt>IP</dt>
        <dd>
          {item.ip ? <button type="button" className={a.link} onClick={() => onFiltrarIp(item.ip)}>{item.ip}</button> : '—'}
          {item.ip_cadeia && <span className={a.cadeia}> (cadeia: {item.ip_cadeia})</span>}
        </dd>
        <dt>Navegador</dt><dd className={a.ua}>{item.user_agent || '—'}</dd>
        {item.veiculo_id && (
          <>
            <dt>Veículo</dt>
            <dd><button type="button" className={a.link} onClick={() => onFiltrarVeiculo(item.veiculo_id)}>ver tudo deste veículo</button></dd>
          </>
        )}
      </dl>
    </div>
  );
}

export default function FleetAuditoria() {
  const [filtro, setFiltro]   = useState(FILTRO_VAZIO);
  const [busca, setBusca]     = useState('');
  const [pagina, setPagina]   = useState(1);
  const [dados, setDados]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [aberto, setAberto]   = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries({ ...filtro, pagina, por_pagina: POR_PAGINA })) if (v !== '') qs.set(k, String(v));
      const res = await fleetFetch(`/api/fleet/auditoria?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (res.status === 404) throw new Error('A auditoria ainda não está ativa no servidor (falta reiniciar o backend).');
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar a auditoria');
      setDados(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtro, pagina]);

  useEffect(() => { carregar(); }, [carregar]);

  // a busca em texto só dispara depois que a pessoa para de digitar
  useEffect(() => {
    const t = setTimeout(() => setFiltro(x => (x.q === busca ? x : { ...x, q: busca })), 400);
    return () => clearTimeout(t);
  }, [busca]);
  useEffect(() => { setPagina(1); }, [filtro]);

  const muda = (campo) => (e) => setFiltro(x => ({ ...x, [campo]: e.target.value }));
  const temFiltro = Object.values(filtro).some(v => v !== '');
  const total = dados?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className={f.card}>
      <div className={a.filtros}>
        <div className={f.grupos} role="group" aria-label="Tipo de ação">
          <button type="button" className={`${f.chip} ${filtro.acao === '' ? f.chipAtivo : ''}`}
            onClick={() => setFiltro(x => ({ ...x, acao: '' }))}>Todas</button>
          {GRUPOS.map(g => (
            <button key={g.id} type="button" className={`${f.chip} ${filtro.acao === g.id ? f.chipAtivo : ''}`}
              onClick={() => setFiltro(x => ({ ...x, acao: g.id }))}>{g.label}</button>
          ))}
        </div>

        <div className={a.linha}>
          <label className={a.campo}>
            <span>O quê</span>
            <select className={styles.select} value={filtro.entidade} onChange={muda('entidade')}>
              <option value="">Tudo</option>
              {Object.entries(dados?.entidades ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className={a.campo}>
            <span>Veículo</span>
            <select className={styles.select} value={filtro.veiculo_id} onChange={muda('veiculo_id')}>
              <option value="">Todos os veículos</option>
              {(dados?.veiculos ?? []).map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </label>
          <label className={a.campo}>
            <span>Quem fez</span>
            <select className={styles.select} value={filtro.usuario_id} onChange={muda('usuario_id')}>
              <option value="">Todos os usuários</option>
              {(dados?.usuarios ?? []).map(u => <option key={u.id} value={u.id}>{u.nome || u.email}</option>)}
            </select>
          </label>
          <label className={a.campo}>
            <span>De</span>
            <input type="date" className={styles.input} value={filtro.de} onChange={muda('de')} />
          </label>
          <label className={a.campo}>
            <span>Até</span>
            <input type="date" className={styles.input} value={filtro.ate} onChange={muda('ate')} />
          </label>
          <label className={a.campo}>
            <span>IP</span>
            <input className={styles.input} value={filtro.ip} onChange={muda('ip')} placeholder="ex.: 10.100" />
          </label>
        </div>

        <div className={a.linha}>
          <div className={f.busca}>
            <Search size={15} />
            <input className={styles.input} placeholder="Buscar no resumo, usuário ou dados (placa, nome, observação...)"
              value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          {temFiltro && (
            <button type="button" className={styles.btnSecondary} onClick={() => { setFiltro(FILTRO_VAZIO); setBusca(''); }}>Limpar filtros</button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={carregar} title="Atualizar" aria-label="Atualizar">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {loading && !dados ? (
        <div className={styles.loadingState}><div className="spinner" /><span>Carregando...</span></div>
      ) : error ? (
        <div className={`${styles.errorState} ${f.erro}`}>{error}</div>
      ) : dados.itens.length === 0 ? (
        <div className={f.vazio}>
          <ShieldCheck size={36} strokeWidth={1.2} />
          <p>Nenhum registro {temFiltro ? 'com esses filtros' : 'ainda'}</p>
          <span>As ações na Frota passam a ser registradas a partir da instalação da auditoria</span>
        </div>
      ) : (
        <ul className={a.itens} style={{ opacity: loading ? 0.6 : 1 }}>
          {dados.itens.map(item => {
            const expandido = aberto === item.id;
            return (
              <li key={item.id} className={a.item}>
                <button type="button" className={a.resumoLinha} onClick={() => setAberto(expandido ? null : item.id)} aria-expanded={expandido}>
                  {expandido ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <span className={a.quando}>{fmtDataHora(item.created_at)}</span>
                  {(() => {
                    const rotulo = `${dados.acoes[item.acao] ?? item.acao}${item.entidade !== 'cupom' ? ` · ${dados.entidades[item.entidade] ?? item.entidade}` : ''}`;
                    return <span className={`${a.acao} ${a[TOM[item.acao] ?? 'neutro']}`} title={rotulo}>{rotulo}</span>;
                  })()}
                  <span className={a.texto}>{item.resumo}</span>
                  <span className={a.quem}>
                    <User size={13} />
                    {item.usuario_nome || item.usuario_email || '—'}
                    {item.ip && <span className={a.ip}>{item.ip}</span>}
                  </span>
                </button>
                {expandido && (
                  <Detalhes
                    item={item}
                    dados={dados}
                    onFiltrarIp={(ip) => setFiltro(x => ({ ...x, ip }))}
                    onFiltrarVeiculo={(id) => setFiltro(x => ({ ...x, veiculo_id: String(id) }))}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {dados && total > 0 && (
        <div className={f.rodape}>
          <span>{(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total} registros</span>
          <div>
            <button className={styles.paginationBtn} disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
            <button className={styles.paginationBtn} disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)}>Próxima</button>
          </div>
        </div>
      )}
    </div>
  );
}
