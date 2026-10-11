import React, { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { osAPI } from '../../api/estoque';
import { Modal, fmtDataHora, fmtNum, fmtQtd, styles as s } from './ui';

const ORIGEM_LOCAL = { gps: 'GPS do aparelho', address: 'Endereço pesquisado', pole_reference: 'Coordenadas do poste' };

const duracao = (ini, fim) => {
  const min = ini && fim ? Math.round((new Date(fim) - new Date(ini)) / 60000) : null;
  if (min === null || min < 0) return null;
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
};

const resposta = (c) => {
  if (c.tipo === 'boolean') return c.resposta ? 'Sim' : 'Não';
  if (c.tipo === 'number') return `${fmtNum(c.resposta)}${c.unidade ? ` ${c.unidade}` : ''}`;
  return c.resposta;
};

/* As fotos são privadas: só saem pela API com o token, então viram um blob local para o <img>. */
const Foto = ({ osId, foto, onAbrir }) => {
  const [url, setUrl] = useState(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let vivo = true; let criada = null;
    osAPI.fotoUrl(osId, foto.id)
      .then((u) => { criada = u; if (vivo) setUrl(u); else URL.revokeObjectURL(u); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; if (criada) URL.revokeObjectURL(criada); };
  }, [osId, foto.id]);
  return (
    <button type="button" className={s.fotoThumb} disabled={!url} onClick={() => onAbrir(url)} aria-label={`Ampliar foto${foto.legenda ? `: ${foto.legenda}` : ''}`}>
      {url ? <img src={url} alt={foto.legenda || 'Foto do serviço'} />
        : erro ? <span title="Não foi possível carregar a foto"><ImageOff size={24} aria-label="Foto indisponível" /></span>
          : <Loader2 size={22} aria-label="Carregando foto" style={{ animation: 'spin 0.8s linear infinite' }} />}
    </button>
  );
};

/* O que o técnico informou ao finalizar pelo app: fechamento, checklist, materiais retirados da rede e fotos (somente leitura). */
const FechamentoCard = ({ os }) => {
  const f = os.fechamento;
  const fotos = os.fotos || [];
  const retirados = os.materiais_retirados || [];
  const [ampliada, setAmpliada] = useState(null);
  if (!f && fotos.length === 0) return null;
  const tempo = f && duracao(f.iniciado_em, f.finalizado_em);

  return (
    <>
      {f && (
        <div className={s.card}>
          <h2 className={s.cardTitle}>Fechamento em campo</h2>
          <dl className={s.detailGrid}>
            <div><dt>Motivo</dt><dd>{f.motivo}</dd></div>
            <div><dt>Finalizado por</dt><dd>{f.finalizado_por_nome || '—'}</dd></div>
            <div><dt>Finalizado em</dt><dd>{fmtDataHora(f.finalizado_em || f.criado_em)}{tempo && <small className={s.sub}> · execução de {tempo}</small>}</dd></div>
            <div><dt>Materiais usados</dt><dd>{f.materiais_usados ? 'Sim' : 'Não'}</dd></div>
            <div style={{ gridColumn: '1 / -1' }}><dt>Descrição do que foi executado</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{f.descricao}</dd></div>
            <div style={{ gridColumn: '1 / -1' }}><dt>Local da intervenção</dt>
              <dd>
                <a href={`https://www.google.com/maps/search/?api=1&query=${f.local.lat},${f.local.lng}`} target="_blank" rel="noreferrer">{f.local.lat.toFixed(6)}, {f.local.lng.toFixed(6)}</a>
                <small className={s.sub}> · {ORIGEM_LOCAL[f.local.origem] || f.local.origem}{f.local.precisao_m != null ? ` (±${f.local.precisao_m} m)` : ''}{f.local.aproximado ? ' · posição aproximada' : ''}</small>
                {f.local.endereco && <div>{f.local.endereco}</div>}
              </dd></div>
            <div style={{ gridColumn: '1 / -1' }}><dt>Participantes</dt><dd>{f.participantes.length ? f.participantes.map((p) => p.nome).join(', ') : 'Nenhum além do responsável'}</dd></div>
            {f.dispositivo && <div style={{ gridColumn: '1 / -1' }}><dt>Enviado de</dt><dd>{f.dispositivo}{f.versao_app ? ` · app ${f.versao_app}` : ''}</dd></div>}
          </dl>
        </div>
      )}

      {f && f.checklist.length > 0 && (
        <div className={s.card}>
          <h2 className={s.cardTitle}>Checklist</h2>
          <div className={s.tableWrap}><table className={s.table}>
            <thead><tr><th>Item</th><th>Resposta</th></tr></thead>
            <tbody>{f.checklist.map((c) => (
              <tr key={c.codigo}><td data-label="Item">{c.rotulo}</td><td data-label="Resposta"><b>{resposta(c)}</b></td></tr>))}</tbody></table></div>
        </div>
      )}

      {f && (
        <div className={s.card}>
          <h2 className={s.cardTitle}>Materiais retirados da rede</h2>
          {retirados.length === 0 ? <p className={s.sub} style={{ margin: 0 }}>Nenhum material retirado.</p> : (
            <>
              <div className={s.tableWrap}><table className={s.table}>
                <thead><tr><th>Material</th><th>Qtd</th><th>Condição</th></tr></thead>
                <tbody>{retirados.map((r) => (
                  <tr key={r.id}><td data-label="Material">{r.descricao}</td><td data-label="Qtd">{fmtQtd(r.quantidade, r.unidade)}</td><td data-label="Condição">{r.condicao === 'novo' ? 'Novo' : 'Usado'}</td></tr>))}</tbody></table></div>
              <p className={s.sub}>Informação do técnico: não altera o saldo do estoque.</p>
            </>
          )}
        </div>
      )}

      {fotos.length > 0 && (
        <div className={s.card}>
          <h2 className={s.cardTitle}>Fotos do serviço ({fotos.length})</h2>
          <div className={s.fotoGrid}>{fotos.map((foto) => <Foto key={foto.id} osId={os.id} foto={foto} onAbrir={setAmpliada} />)}</div>
        </div>
      )}
      {ampliada && <Modal title="Foto do serviço" onClose={() => setAmpliada(null)}><img className={s.fotoFull} src={ampliada} alt="Foto do serviço ampliada" /></Modal>}
    </>
  );
};
export default FechamentoCard;
