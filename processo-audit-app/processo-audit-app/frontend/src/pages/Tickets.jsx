import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Trash2, MessageSquare, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ticketAPI, authAPI } from '../api/index.js';
import styles from './Tickets.module.css';

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };
const STATUS_LABELS   = { open: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido', closed: 'Fechado' };

const PRIORITY_COLORS = {
  low:    { bg: '#f0fdf4', color: '#16a34a' },
  medium: { bg: '#eff6ff', color: '#2563eb' },
  high:   { bg: '#fff7ed', color: '#ea580c' },
  urgent: { bg: '#fef2f2', color: '#dc2626' },
};
const STATUS_COLORS = {
  open:        { bg: '#eff6ff', color: '#2563eb' },
  in_progress: { bg: '#fff7ed', color: '#ea580c' },
  resolved:    { bg: '#f0fdf4', color: '#16a34a' },
  closed:      { bg: '#f1f5f9', color: '#64748b' },
};

const Badge = ({ type, value }) => {
  const map = type === 'priority' ? PRIORITY_COLORS : STATUS_COLORS;
  const label = type === 'priority' ? PRIORITY_LABELS : STATUS_LABELS;
  const c = map[value] || { bg: '#f1f5f9', color: '#64748b' };
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label[value] || value}
    </span>
  );
};

const fmtDate = v => {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const emptyForm = { title: '', description: '', priority: 'medium', assigned_to: '' };

export default function Tickets() {
  const { user } = useAuth();

  /* list state */
  const [tickets, setTickets]   = useState([]);
  const [total,   setTotal]     = useState(0);
  const [page,    setPage]      = useState(1);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState('');

  /* filters */
  const [filter,   setFilter]   = useState('');
  const [statusF,  setStatusF]  = useState('');
  const [priorityF,setPriorityF]= useState('');

  /* new ticket form */
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(emptyForm);
  const [saving,   setSaving]   = useState(false);

  /* users for assignee picker */
  const [users, setUsers] = useState([]);

  /* detail panel */
  const [selected,    setSelected]    = useState(null);
  const [detail,      setDetail]      = useState(null);
  const [detailLoad,  setDetailLoad]  = useState(false);
  const [detailError, setDetailError] = useState('');
  const [editStatus,  setEditStatus]  = useState('');
  const [editPrio,    setEditPrio]    = useState('');
  const [editAssign,  setEditAssign]  = useState('');
  const [commentText, setCommentText] = useState('');
  const [sendingC,    setSendingC]    = useState(false);
  const [deleteTarget,setDeleteTarget]= useState(null);

  const LIMIT = 20;
  const totalPages = Math.ceil(total / LIMIT) || 1;

  /* fetch users once */
  useEffect(() => {
    authAPI.listUsers('', 1, 500).then(d => setUsers(d.users || [])).catch(() => {});
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await ticketAPI.list({ status: statusF, priority: priorityF, filter, page, limit: LIMIT });
      setTickets(data.tickets || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter, statusF, priorityF, page]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  /* open detail */
  const openDetail = async (ticket) => {
    setSelected(ticket.id);
    setDetail(null);
    setDetailError('');
    setDetailLoad(true);
    setCommentText('');
    try {
      const d = await ticketAPI.get(ticket.id);
      setDetail(d);
      setEditStatus(d.status);
      setEditPrio(d.priority);
      setEditAssign(d.assigned_to ?? '');
    } catch (e) {
      setDetailError(e.message);
    } finally {
      setDetailLoad(false);
    }
  };

  const closeDetail = () => { setSelected(null); setDetail(null); };

  /* save new ticket */
  const handleCreate = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await ticketAPI.create({ ...form, assigned_to: form.assigned_to || null });
      setForm(emptyForm);
      setShowForm(false);
      fetchTickets();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  /* update status/priority/assignee from detail panel */
  const handleDetailUpdate = async (patch) => {
    if (!detail) return;
    try {
      await ticketAPI.update(detail.id, patch);
      const refreshed = await ticketAPI.get(detail.id);
      setDetail(refreshed);
      setEditStatus(refreshed.status);
      setEditPrio(refreshed.priority);
      setEditAssign(refreshed.assigned_to ?? '');
      fetchTickets();
    } catch (e) {
      setDetailError(e.message);
    }
  };

  /* add comment */
  const handleComment = async e => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSendingC(true);
    try {
      await ticketAPI.addComment(detail.id, commentText.trim());
      setCommentText('');
      const refreshed = await ticketAPI.get(detail.id);
      setDetail(refreshed);
      fetchTickets();
    } catch (e) {
      setDetailError(e.message);
    } finally {
      setSendingC(false);
    }
  };

  /* delete comment */
  const handleDeleteComment = async (commentId) => {
    try {
      await ticketAPI.deleteComment(detail.id, commentId);
      const refreshed = await ticketAPI.get(detail.id);
      setDetail(refreshed);
    } catch (e) {
      setDetailError(e.message);
    }
  };

  /* delete ticket */
  const handleDeleteTicket = async () => {
    if (!deleteTarget) return;
    try {
      await ticketAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      if (selected === deleteTarget.id) closeDetail();
      fetchTickets();
    } catch (e) {
      setError(e.message);
    }
  };

  const getUserName = id => {
    const u = users.find(x => String(x.id) === String(id));
    return u ? u.name : '—';
  };

  return (
    <div className={styles.page}>
      {/* ── Page Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Tickets</h1>
          <p className={styles.pageSubtitle}>Gerencie solicitações e chamados entre usuários</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setShowForm(v => !v)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancelar' : 'Novo Ticket'}
        </button>
      </div>

      {error && <div className={styles.alert}>{error}</div>}

      {/* ── New Ticket Form ── */}
      {showForm && (
        <div className={styles.formCard}>
          <h3 className={styles.formTitle}>Novo Ticket</h3>
          <form onSubmit={handleCreate}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>Título *</label>
                <input
                  className={styles.input}
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Descreva brevemente o problema ou solicitação"
                  required
                />
              </div>
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>Descrição</label>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Detalhes adicionais..."
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Prioridade</label>
                <select className={styles.select} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Atribuir para</label>
                <select className={styles.select} value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
                  <option value="">— Nenhum —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                {saving ? 'Salvando...' : 'Criar Ticket'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filters ── */}
      <div className={styles.filterBar}>
        <div className={styles.filterTabs}>
          {[['', 'Todos'], ['mine', 'Meus'], ['assigned', 'Atribuídos a mim']].map(([val, label]) => (
            <button
              key={val}
              className={`${styles.filterTab} ${filter === val ? styles.filterTabActive : ''}`}
              onClick={() => { setFilter(val); setPage(1); }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.filterSelects}>
          <select className={styles.select} value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }}>
            <option value="">Todos os status</option>
            <option value="open">Aberto</option>
            <option value="in_progress">Em andamento</option>
            <option value="resolved">Resolvido</option>
            <option value="closed">Fechado</option>
          </select>
          <select className={styles.select} value={priorityF} onChange={e => { setPriorityF(e.target.value); setPage(1); }}>
            <option value="">Todas as prioridades</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className={`${styles.mainArea} ${selected ? styles.splitView : ''}`}>
        {/* Ticket list */}
        <div className={styles.listPane}>
          {loading ? (
            <div className={styles.center}><div className="spinner" /></div>
          ) : tickets.length === 0 ? (
            <div className={styles.empty}>
              <MessageSquare size={40} color="var(--border-color)" />
              <p>Nenhum ticket encontrado.</p>
              <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>
                <Plus size={16} /> Criar Ticket
              </button>
            </div>
          ) : (
            <>
              <div className={styles.ticketList}>
                {tickets.map(t => (
                  <div
                    key={t.id}
                    className={`${styles.ticketCard} ${selected === t.id ? styles.ticketCardSelected : ''}`}
                    onClick={() => openDetail(t)}
                  >
                    <div className={styles.ticketCardTop}>
                      <span className={styles.ticketId}>#{t.id}</span>
                      <div className={styles.badges}>
                        <Badge type="priority" value={t.priority} />
                        <Badge type="status" value={t.status} />
                      </div>
                    </div>
                    <div className={styles.ticketTitle}>{t.title}</div>
                    <div className={styles.ticketMeta}>
                      <span>Por <strong>{t.created_by_name}</strong></span>
                      {t.assigned_to_name && <span>→ <strong>{t.assigned_to_name}</strong></span>}
                      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <MessageSquare size={12} /> {t.comment_count}
                      </span>
                      <span>{fmtDate(t.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage(1)}>«</button>
                  <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                  <span className={styles.pageInfo}>{page} / {totalPages}</span>
                  <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
                  <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className={styles.detailPane}>
            <div className={styles.detailHeader}>
              <span className={styles.detailId}>#{selected}</span>
              <button className={styles.closeBtn} onClick={closeDetail}><X size={18} /></button>
            </div>

            {detailLoad && <div className={styles.center}><div className="spinner" /></div>}
            {detailError && <div className={styles.alert}>{detailError}</div>}

            {detail && (
              <>
                <h2 className={styles.detailTitle}>{detail.title}</h2>
                {detail.description && <p className={styles.detailDesc}>{detail.description}</p>}

                {/* Controls */}
                <div className={styles.detailControls}>
                  <div className={styles.controlGroup}>
                    <label className={styles.label}>Status</label>
                    <select
                      className={styles.select}
                      value={editStatus}
                      onChange={e => { setEditStatus(e.target.value); handleDetailUpdate({ status: e.target.value }); }}
                    >
                      <option value="open">Aberto</option>
                      <option value="in_progress">Em andamento</option>
                      <option value="resolved">Resolvido</option>
                      <option value="closed">Fechado</option>
                    </select>
                  </div>
                  <div className={styles.controlGroup}>
                    <label className={styles.label}>Prioridade</label>
                    <select
                      className={styles.select}
                      value={editPrio}
                      onChange={e => { setEditPrio(e.target.value); handleDetailUpdate({ priority: e.target.value }); }}
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                  <div className={styles.controlGroup}>
                    <label className={styles.label}>Atribuído para</label>
                    <select
                      className={styles.select}
                      value={editAssign}
                      onChange={e => { setEditAssign(e.target.value); handleDetailUpdate({ assigned_to: e.target.value || null }); }}
                    >
                      <option value="">— Nenhum —</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className={styles.detailInfo}>
                  <span>Criado por <strong>{detail.created_by_name}</strong></span>
                  <span>{fmtDate(detail.created_at)}</span>
                </div>

                {/* Delete button (admin or creator) */}
                {(user.role === 'admin' || detail.created_by === user.id) && (
                  <button className={styles.btnDanger} onClick={() => setDeleteTarget(detail)} style={{ marginBottom: '1.25rem' }}>
                    <Trash2 size={14} /> Excluir Ticket
                  </button>
                )}

                {/* Comments */}
                <div className={styles.commentsSection}>
                  <h4 className={styles.commentsTitle}>
                    Comentários ({detail.comments?.length || 0})
                  </h4>

                  {detail.comments?.length === 0 && (
                    <p className={styles.noComments}>Nenhum comentário ainda.</p>
                  )}

                  <div className={styles.commentsList}>
                    {detail.comments?.map(c => (
                      <div key={c.id} className={styles.comment}>
                        <div className={styles.commentHeader}>
                          <div className={styles.commentAvatar}>
                            {c.user_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong className={styles.commentAuthor}>{c.user_name}</strong>
                            <span className={styles.commentDate}>{fmtDate(c.created_at)}</span>
                          </div>
                          {(user.role === 'admin' || c.user_id === user.id) && (
                            <button
                              className={styles.commentDeleteBtn}
                              onClick={() => handleDeleteComment(c.id)}
                              title="Excluir comentário"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                        <p className={styles.commentText}>{c.comment}</p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleComment} className={styles.commentForm}>
                    <textarea
                      className={styles.textarea}
                      rows={2}
                      placeholder="Adicionar comentário..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                    />
                    <button type="submit" className={styles.btnPrimary} disabled={sendingC || !commentText.trim()}>
                      <Send size={14} /> {sendingC ? 'Enviando...' : 'Comentar'}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Confirmar exclusão</h3>
            <p>Deseja excluir o ticket <strong>#{deleteTarget.id} — {deleteTarget.title}</strong>?<br />
              Esta ação não pode ser desfeita.</p>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button className={styles.btnDanger} onClick={handleDeleteTicket}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
