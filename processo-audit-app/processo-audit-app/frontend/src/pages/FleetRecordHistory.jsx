// Botão "Histórico" de um lançamento da Frota: os dados atuais do registro e, para admin e gerente,
// tudo o que aconteceu com ele (cadastro, edições com antes/depois, inativações), do mais antigo ao mais novo.
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './Fleet.module.css';
import a from './AuditoriaIndicacoes.module.css';
import { fleetFetch } from './fleetFetch';
import { TOM, fmtDataHora, TabelaDados, TabelaAlteracoes } from './fleetAuditoriaView';

const quem = (i) => i.usuario_nome || i.usuario_email || 'Usuário desconhecido';

function Evento({ item, dados }) {
  const temAlteracoes = !!item.campos_alterados;
  return (
    <li className={styles.historyEvent}>
      <div className={styles.historyEventHead}>
        <span className={`${a.acao} ${a[TOM[item.acao] ?? 'neutro']}`}>{dados.acoes?.[item.acao] ?? item.acao}</span>
        <span className={styles.historyEventWhen}>{fmtDataHora(item.created_at)}</span>
      </div>
      <div className={styles.historyEventWho}>
        {quem(item)}{item.ip ? <span> · IP {item.ip}</span> : null}
      </div>
      {temAlteracoes && <TabelaAlteracoes item={item} dados={dados} />}
      {!temAlteracoes && item.acao === 'criado' && item.dados_depois && (
        <details className={styles.historyDetails}>
          <summary>Ver dados cadastrados</summary>
          <TabelaDados titulo="Dados cadastrados" valores={item.dados_depois} dados={dados} />
        </details>
      )}
      {!temAlteracoes && item.acao === 'editado' && (
        <div className={styles.historyEventWho}>Salvo sem alterações.</div>
      )}
    </li>
  );
}

/** `entidade`: código da auditoria ('abastecimento', 'manutencao', ...); `titulo`: o que aparece no topo. */
export default function FleetRecordHistory({ entidade, id, titulo, onClose }) {
  const [dados,   setDados]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res  = await fleetFetch(`/api/fleet/historico/${entidade}/${id}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(res.status === 404 && !json.error ? 'Histórico ainda não disponível no servidor.' : json.error || `HTTP ${res.status}`);
        if (vivo) setDados(json);
      } catch (e) {
        if (vivo) setError('Erro ao carregar o histórico: ' + e.message);
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => { vivo = false; };
  }, [entidade, id]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modal}
        style={{ maxWidth: 760, width: '95%' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label={`Histórico: ${titulo}`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Histórico</h3>
            <div className={styles.historyEventWho}>{titulo}</div>
          </div>
          <button onClick={onClose} title="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
            <X size={18} />
          </button>
        </div>

        {loading && <div className={styles.loadingState}><div className="spinner" /><span>Carregando...</span></div>}
        {error && <div className={styles.errorState}>{error}</div>}

        {dados && (
          <>
            <TabelaDados titulo="Dados do lançamento" valores={dados.registro} dados={dados} />

            <div className={a.bloco} style={{ marginTop: '1.25rem' }}>
              <span className={a.blocoTitulo}>O que aconteceu com ele</span>
              {dados.historico === null ? (
                <p className={styles.historyNote}>Só administradores e gerentes veem quem cadastrou e alterou cada lançamento.</p>
              ) : dados.historico.length === 0 ? (
                <p className={styles.historyNote}>
                  Sem registros: este lançamento é de antes de 14/10/2026, quando a auditoria da Frota começou.
                </p>
              ) : (
                <ol className={styles.historyList}>
                  {dados.historico.map(item => <Evento key={item.id} item={item} dados={dados} />)}
                </ol>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
