import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, X, Trash2, MessageSquare, Send, LayoutList, Columns,
  Bug, CheckSquare2, BookOpen, Zap, Calendar, Clock, Tag, Pencil, Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ticketAPI, labelAPI } from '../api/index.js';
import styles from './Tickets.module.css';

/* ── Constants ── */
const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };
const STATUS_LABELS   = { open: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido', closed: 'Fechado' };
const TYPE_LABELS     = { task: 'Tarefa', bug: 'Bug', story: 'História', feature: 'Feature' };
const STATUS_ORDER    = ['open', 'in_progress', 'resolved', 'closed'];

const PRIORITY_COLORS = {
  low:    { bg: '#f0fdf4', color: '#16a34a' },
  medium: { bg: '#eff6ff', color: '#2563eb' },
  high:   { bg: '#fff7ed', color: '#ea580c' },
  urgent: { bg: '#fef2f2', color: '#dc2626' },
};
const STATUS_COLORS = {
  open:        { bg: '#eff6ff', color: '#2563eb', accent: '#3b82f6' },
  in_progress: { bg: '#fffbeb', color: '#d97706', accent: '#f59e0b' },
  resolved:    { bg: '#f0fdf4', color: '#15803d', accent: '#0ba52b' },
  closed:      { bg: '#f8fafc', color: '#475569', accent: '#94a3b8' },
};
const TYPE_CONFIG = {
  task:    { color: '#2563eb', bg: '#eff6ff', Icon: CheckSquare2 },
  bug:     { color: '#dc2626', bg: '#fef2f2', Icon: Bug          },
  story:   { color: '#7c3aed', bg: '#f5f3ff', Icon: BookOpen     },
  feature: { color: '#d97706', bg: '#fffbeb', Icon: Zap          },
};
const PRIORITY_BORDER = { low: '#16a34a', medium: '#2563eb', high: '#ea580c', urgent: '#dc2626' };

const COLOR_PALETTE = [
  '#6366f1','#3b82f6','#0ba52b','#10b981','#f59e0b',
  '#ea580c','#dc2626','#ec4899','#8b5cf6','#0891b2',
  '#64748b','#1e293b',
];

const ACTIVITY_FIELD_LABELS = {
  status: 'status', priority: 'prioridade', type: 'tipo',
  due_date: 'data limite', assigned_to: 'atribuído para',
};

/* ── Helpers ── */
const fmtDate = v => {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};
const fmtDateShort = v => {
  if (!v) return null;
  return new Date(v + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};
const isOverdue  = (d, s) => !!d && s !== 'resolved' && s !== 'closed' && new Date(d + 'T23:59:59') < new Date();
const isDueSoon  = (d, s) => { if (!d || s === 'resolved' || s === 'closed') return false; const diff = new Date(d + 'T23:59:59') - new Date(); return diff >= 0 && diff < 86400 * 2 * 1000; };
const getDisplayLabel = (field, value) => {
  if (!value) return '';
  if (field === 'status')   return STATUS_LABELS[value] || value;
  if (field === 'priority') return PRIORITY_LABELS[value] || value;
  if (field === 'type')     return TYPE_LABELS[value] || value;
  if (field === 'due_date') return fmtDateShort(value) || value;
  return value;
};
const humanizeActivity = act => {
  const field = ACTIVITY_FIELD_LABELS[act.field] || act.field;
  if (act.action === 'created')   return 'criou este ticket';
  if (act.action === 'commented') return 'adicionou um comentário';
  if (act.action === 'changed') {
    const o = getDisplayLabel(act.field, act.old_value);
    const n = getDisplayLabel(act.field, act.new_value);
    if (!act.old_value) return `definiu ${field} como "${n}"`;
    if (!act.new_value) return `removeu ${field}`;
    return `alterou ${field} de "${o}" para "${n}"`;
  }
  return act.action;
};

/* ── Small UI pieces ── */
const Badge = ({ type, value }) => {
  const map   = type === 'priority' ? PRIORITY_COLORS : STATUS_COLORS;
  const label = type === 'priority' ? PRIORITY_LABELS : STATUS_LABELS;
  const c = map[value] || { bg: '#f1f5f9', color: '#64748b' };
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label[value] || value}
    </span>
  );
};

const TypeIcon = ({ type, size = 14 }) => {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.task;
  const { Icon } = cfg;
  return (
    <span title={TYPE_LABELS[type] || type} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size + 6, height: size + 6, borderRadius: 4,
      background: cfg.bg, color: cfg.color, flexShrink: 0,
    }}>
      <Icon size={size} strokeWidth={2.2} />
    </span>
  );
};

const Avatar = ({ name, size = 24 }) => {
  if (!name) return null;
  const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div title={name} style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #0ba52b, #058020)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.38), fontWeight: 700, flexShrink: 0,
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    }}>
      {initials}
    </div>
  );
};

const DueDateChip = ({ due_date, status }) => {
  if (!due_date) return null;
  const overdue = isOverdue(due_date, status);
  const soon    = isDueSoon(due_date, status);
  const color   = overdue ? '#dc2626' : soon ? '#d97706' : '#475569';
  const bg      = overdue ? '#fef2f2' : soon ? '#fffbeb' : '#f8fafc';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: bg, color, fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: 99, whiteSpace: 'nowrap' }}>
      <Calendar size={10} />{fmtDateShort(due_date)}{overdue && ' ⚠'}
    </span>
  );
};

const LabelChip = ({ label }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    background: label.color + '22', color: label.color,
    border: `1px solid ${label.color}55`,
    fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px',
    borderRadius: 99, whiteSpace: 'nowrap', letterSpacing: '0.01em',
  }}>
    {label.name}
  </span>
);

/* ══════════════════════════════════════════════════════════════
   LABEL MANAGER MODAL
══════════════════════════════════════════════════════════════ */
function LabelManager({ onClose, labels, onReload, currentUser }) {
  const [list,      setList]      = useState(labels);
  const [editingId, setEditingId] = useState(null);
  const [editName,  setEditName]  = useState('');
  const [editColor, setEditColor] = useState('#6366f1');
  const [newName,   setNewName]   = useState('');
  const [newColor,  setNewColor]  = useState('#6366f1');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => { setList(labels); }, [labels]);

  const startEdit = (label) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
    setError('');
  };

  const cancelEdit = () => { setEditingId(null); setError(''); };

  const saveEdit = async (id) => {
    if (!editName.trim()) return;
    setSaving(true);
    setError('');
    try {
      await labelAPI.update(id, { name: editName.trim(), color: editColor });
      setEditingId(null);
      await onReload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir esta label? Ela será removida de todos os tickets.')) return;
    try {
      await labelAPI.delete(id);
      await onReload();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError('');
    try {
      await labelAPI.create({ name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor('#6366f1');
      await onReload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.labelManagerModal}>
        <div className={styles.labelManagerHeader}>
          <div>
            <h3 className={styles.labelManagerTitle}>Gerenciar Labels</h3>
            <p className={styles.labelManagerSubtitle}>Crie e edite labels para organizar seus tickets</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className={styles.alert}>{error}</div>}

        {/* Existing labels */}
        <div className={styles.labelList}>
          {list.length === 0 && (
            <p className={styles.noComments}>Nenhuma label criada ainda.</p>
          )}
          {list.map(label => (
            <div key={label.id} className={styles.labelRow}>
              {editingId === label.id ? (
                <>
                  <div className={styles.labelEditForm}>
                    <div className={styles.colorPickerGroup}>
                      <input
                        type="color"
                        className={styles.colorInput}
                        value={editColor}
                        onChange={e => setEditColor(e.target.value)}
                        title="Escolha a cor"
                      />
                      <div className={styles.colorPalette}>
                        {COLOR_PALETTE.map(c => (
                          <button
                            key={c}
                            type="button"
                            className={`${styles.colorSwatch} ${editColor === c ? styles.colorSwatchActive : ''}`}
                            style={{ background: c }}
                            onClick={() => setEditColor(c)}
                          />
                        ))}
                      </div>
                    </div>
                    <input
                      className={styles.input}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Nome da label"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(label.id); if (e.key === 'Escape') cancelEdit(); }}
                    />
                  </div>
                  <div className={styles.labelEditActions}>
                    <button className={styles.btnPrimary} onClick={() => saveEdit(label.id)} disabled={saving || !editName.trim()}>
                      <Check size={13} /> Salvar
                    </button>
                    <button className={styles.btnSecondary} onClick={cancelEdit}>Cancelar</button>
                  </div>
                </>
              ) : (
                <>
                  <LabelChip label={label} />
                  <span className={styles.labelCreator}>{label.created_by_name || '—'}</span>
                  <div className={styles.labelActions}>
                    {(currentUser.role === 'admin' || label.created_by === currentUser.id) && (
                      <>
                        <button className={styles.iconBtn} onClick={() => startEdit(label)} title="Editar">
                          <Pencil size={13} />
                        </button>
                        <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => handleDelete(label.id)} title="Excluir">
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Create new label */}
        <div className={styles.labelCreateSection}>
          <h4 className={styles.labelCreateTitle}>Nova Label</h4>
          <form onSubmit={handleCreate} className={styles.labelCreateForm}>
            <div className={styles.colorPickerGroup}>
              <input
                type="color"
                className={styles.colorInput}
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                title="Escolha a cor"
              />
              <div className={styles.colorPalette}>
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.colorSwatch} ${newColor === c ? styles.colorSwatchActive : ''}`}
                    style={{ background: c }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className={styles.labelCreateRow}>
              <div className={styles.labelPreview}>
                <LabelChip label={{ name: newName || 'prévia', color: newColor }} />
              </div>
              <input
                className={styles.input}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nome da label"
                style={{ flex: 1 }}
              />
              <button type="submit" className={styles.btnPrimary} disabled={saving || !newName.trim()}>
                <Plus size={14} /> Criar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN TICKETS PAGE
══════════════════════════════════════════════════════════════ */
const emptyForm = { title: '', description: '', priority: 'medium', type: 'task', assigned_to: '', due_date: '', label_ids: [] };

export default function Tickets() {
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState('board');

  const [tickets,  setTickets]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const [filter,    setFilter]    = useState('');
  const [statusF,   setStatusF]   = useState('');
  const [priorityF, setPriorityF] = useState('');
  const [typeF,     setTypeF]     = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(emptyForm);
  const [saving,   setSaving]   = useState(false);

  const [users,         setUsers]         = useState([]);
  const [labels,        setLabels]        = useState([]);
  const [showLabelMgr,  setShowLabelMgr]  = useState(false);

  const [selected,        setSelected]        = useState(null);
  const [detail,          setDetail]          = useState(null);
  const [detailLoad,      setDetailLoad]      = useState(false);
  const [detailError,     setDetailError]     = useState('');
  const [editStatus,      setEditStatus]      = useState('');
  const [editPrio,        setEditPrio]        = useState('');
  const [editType,        setEditType]        = useState('');
  const [editAssign,      setEditAssign]      = useState('');
  const [editDueDate,     setEditDueDate]     = useState('');
  const [detailTab,       setDetailTab]       = useState('details');
  const [commentText,     setCommentText]     = useState('');
  const [sendingC,        setSendingC]        = useState(false);
  const [deleteTarget,    setDeleteTarget]    = useState(null);
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  const dragTicket  = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const LIMIT      = 20;
  const totalPages = Math.ceil(total / LIMIT) || 1;

  const fetchLabels = useCallback(async () => {
    try {
      const d = await labelAPI.list();
      setLabels(d.labels || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    ticketAPI.listAssignable().then(d => setUsers(d.users || [])).catch(() => {});
    fetchLabels();
  }, [fetchLabels]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const isBoard = viewMode === 'board';
      const data = await ticketAPI.list({
        status:   isBoard ? '' : statusF,
        priority: priorityF,
        type:     typeF,
        filter,
        page:     isBoard ? 1 : page,
        limit:    isBoard ? 500 : LIMIT,
      });
      setTickets(data.tickets || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter, statusF, priorityF, typeF, page, viewMode]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const boardColumns = STATUS_ORDER.map(status => ({
    status,
    tickets: tickets.filter(t => t.status === status),
  }));

  /* ── Drag-and-drop ── */
  const handleDragStart = (e, ticket) => {
    dragTicket.current = ticket;
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const ticket = dragTicket.current;
    dragTicket.current = null;
    if (!ticket || ticket.status === newStatus) return;
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: newStatus } : t));
    try {
      await ticketAPI.update(ticket.id, { status: newStatus });
      if (detail?.id === ticket.id) {
        const refreshed = await ticketAPI.get(ticket.id);
        setDetail(refreshed);
        setEditStatus(refreshed.status);
      }
    } catch {
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: ticket.status } : t));
    }
  };

  /* ── Detail panel ── */
  const openDetail = async (ticket) => {
    setSelected(ticket.id);
    setDetail(null);
    setDetailError('');
    setDetailLoad(true);
    setCommentText('');
    setDetailTab('details');
    setShowLabelPicker(false);
    try {
      const d = await ticketAPI.get(ticket.id);
      setDetail(d);
      setEditStatus(d.status);
      setEditPrio(d.priority);
      setEditType(d.type || 'task');
      setEditAssign(d.assigned_to ?? '');
      setEditDueDate(d.due_date ? String(d.due_date).slice(0, 10) : '');
    } catch (e) {
      setDetailError(e.message);
    } finally {
      setDetailLoad(false);
    }
  };
  const closeDetail = () => { setSelected(null); setDetail(null); setShowLabelPicker(false); };

  const handleDetailUpdate = async (patch) => {
    if (!detail) return;
    try {
      await ticketAPI.update(detail.id, patch);
      const refreshed = await ticketAPI.get(detail.id);
      setDetail(refreshed);
      setEditStatus(refreshed.status);
      setEditPrio(refreshed.priority);
      setEditType(refreshed.type || 'task');
      setEditAssign(refreshed.assigned_to ?? '');
      setEditDueDate(refreshed.due_date ? String(refreshed.due_date).slice(0, 10) : '');
      setTickets(prev => prev.map(t => t.id === detail.id ? { ...t, ...refreshed } : t));
    } catch (e) {
      setDetailError(e.message);
    }
  };

  const toggleDetailLabel = async (labelId) => {
    if (!detail) return;
    const has  = detail.labels?.some(l => l.id === labelId);
    const next = has
      ? detail.labels.filter(l => l.id !== labelId).map(l => l.id)
      : [...(detail.labels || []).map(l => l.id), labelId];
    await handleDetailUpdate({ labels: next });
  };

  /* ── Create ticket ── */
  const handleCreate = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await ticketAPI.create({
        title:       form.title,
        description: form.description,
        priority:    form.priority,
        type:        form.type,
        assigned_to: form.assigned_to || null,
        due_date:    form.due_date    || null,
        labels:      form.label_ids,
      });
      setForm(emptyForm);
      setShowForm(false);
      fetchTickets();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const toggleFormLabel = (id) => setForm(f => ({
    ...f,
    label_ids: f.label_ids.includes(id) ? f.label_ids.filter(x => x !== id) : [...f.label_ids, id],
  }));

  /* ── Comments ── */
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
  const handleDeleteComment = async (commentId) => {
    try {
      await ticketAPI.deleteComment(detail.id, commentId);
      const refreshed = await ticketAPI.get(detail.id);
      setDetail(refreshed);
    } catch (e) {
      setDetailError(e.message);
    }
  };

  /* ── Delete ticket ── */
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

  /* ── Detail panel JSX ── */
  const detailPanel = selected && (
    <div className={styles.detailPane}>
      <div className={styles.detailHeader}>
        <div className={styles.detailHeaderLeft}>
          {detail && <TypeIcon type={detail.type} size={13} />}
          <span className={styles.detailId}>#{selected}</span>
        </div>
        <button className={styles.closeBtn} onClick={closeDetail}><X size={18} /></button>
      </div>

      {detailLoad && <div className={styles.center}><div className="spinner" /></div>}
      {detailError && <div className={styles.alert}>{detailError}</div>}

      {detail && (
        <>
          <h2 className={styles.detailTitle}>{detail.title}</h2>
          {detail.description && <p className={styles.detailDesc}>{detail.description}</p>}

          {/* Labels row */}
          <div className={styles.labelsRow}>
            {detail.labels?.map(l => <LabelChip key={l.id} label={l} />)}
            <button className={styles.labelAddBtn} onClick={() => setShowLabelPicker(v => !v)}>
              <Tag size={11} /> {showLabelPicker ? 'Fechar' : 'Labels'}
            </button>
          </div>

          {showLabelPicker && (
            <div className={styles.labelPicker}>
              {labels.length === 0
                ? <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                    Nenhuma label criada.{' '}
                    <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, padding: 0 }}
                      onClick={() => { setShowLabelPicker(false); setShowLabelMgr(true); }}>
                      Criar labels →
                    </button>
                  </span>
                : labels.map(l => {
                    const active = detail.labels?.some(dl => dl.id === l.id);
                    return (
                      <button
                        key={l.id}
                        className={`${styles.labelPickerChip} ${active ? styles.labelPickerChipActive : ''}`}
                        style={{ '--lc': l.color }}
                        onClick={() => toggleDetailLabel(l.id)}
                      >
                        {active && '✓ '}{l.name}
                      </button>
                    );
                  })
              }
            </div>
          )}

          <div className={styles.detailControls}>
            <div className={styles.controlGroup}>
              <label className={styles.label}>Tipo</label>
              <select className={styles.select} value={editType}
                onChange={e => { setEditType(e.target.value); handleDetailUpdate({ type: e.target.value }); }}>
                <option value="task">Tarefa</option>
                <option value="bug">Bug</option>
                <option value="story">História</option>
                <option value="feature">Feature</option>
              </select>
            </div>
            <div className={styles.controlGroup}>
              <label className={styles.label}>Status</label>
              <select className={styles.select} value={editStatus}
                onChange={e => { setEditStatus(e.target.value); handleDetailUpdate({ status: e.target.value }); }}>
                <option value="open">Aberto</option>
                <option value="in_progress">Em andamento</option>
                <option value="resolved">Resolvido</option>
                <option value="closed">Fechado</option>
              </select>
            </div>
            <div className={styles.controlGroup}>
              <label className={styles.label}>Prioridade</label>
              <select className={styles.select} value={editPrio}
                onChange={e => { setEditPrio(e.target.value); handleDetailUpdate({ priority: e.target.value }); }}>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div className={styles.controlGroup}>
              <label className={styles.label}>Atribuído para</label>
              <select className={styles.select} value={editAssign}
                onChange={e => { setEditAssign(e.target.value); handleDetailUpdate({ assigned_to: e.target.value || null }); }}>
                <option value="">— Nenhum —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className={styles.controlGroup}>
              <label className={styles.label}>Data limite</label>
              <input type="date" className={styles.input} value={editDueDate}
                onChange={e => { setEditDueDate(e.target.value); handleDetailUpdate({ due_date: e.target.value || null }); }}
              />
            </div>
          </div>

          <div className={styles.detailInfo}>
            <span>Criado por <strong>{detail.created_by_name}</strong></span>
            <span>{fmtDate(detail.created_at)}</span>
            {detail.due_date && <DueDateChip due_date={String(detail.due_date).slice(0, 10)} status={detail.status} />}
          </div>

          {(user.role === 'admin' || detail.created_by === user.id) && (
            <button className={styles.btnDanger} onClick={() => setDeleteTarget(detail)} style={{ marginBottom: '1.25rem' }}>
              <Trash2 size={14} /> Excluir Ticket
            </button>
          )}

          {/* Tabs */}
          <div className={styles.detailTabs}>
            <button className={`${styles.detailTab} ${detailTab === 'details'  ? styles.detailTabActive : ''}`} onClick={() => setDetailTab('details')}>
              <MessageSquare size={13} /> Comentários ({detail.comments?.length || 0})
            </button>
            <button className={`${styles.detailTab} ${detailTab === 'activity' ? styles.detailTabActive : ''}`} onClick={() => setDetailTab('activity')}>
              <Clock size={13} /> Atividade ({detail.activity?.length || 0})
            </button>
          </div>

          {detailTab === 'details' && (
            <div className={styles.commentsSection}>
              {detail.comments?.length === 0 && <p className={styles.noComments}>Nenhum comentário ainda.</p>}
              <div className={styles.commentsList}>
                {detail.comments?.map(c => (
                  <div key={c.id} className={styles.comment}>
                    <div className={styles.commentHeader}>
                      <div className={styles.commentAvatar}>{c.user_name?.charAt(0).toUpperCase()}</div>
                      <div>
                        <strong className={styles.commentAuthor}>{c.user_name}</strong>
                        <span className={styles.commentDate}>{fmtDate(c.created_at)}</span>
                      </div>
                      {(user.role === 'admin' || c.user_id === user.id) && (
                        <button className={styles.commentDeleteBtn} onClick={() => handleDeleteComment(c.id)} title="Excluir comentário">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <p className={styles.commentText}>{c.comment}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleComment} className={styles.commentForm}>
                <textarea className={styles.textarea} rows={2} placeholder="Adicionar comentário..." value={commentText} onChange={e => setCommentText(e.target.value)} />
                <button type="submit" className={styles.btnPrimary} disabled={sendingC || !commentText.trim()}>
                  <Send size={14} /> {sendingC ? 'Enviando...' : 'Comentar'}
                </button>
              </form>
            </div>
          )}

          {detailTab === 'activity' && (
            <div className={styles.activityFeed}>
              {(!detail.activity || detail.activity.length === 0) && <p className={styles.noComments}>Nenhuma atividade registrada.</p>}
              {detail.activity?.map(act => (
                <div key={act.id} className={styles.activityItem}>
                  <div className={styles.activityAvatar}>{act.user_name?.charAt(0).toUpperCase()}</div>
                  <div className={styles.activityContent}>
                    <span className={styles.activityUser}>{act.user_name}</span>{' '}
                    <span className={styles.activityText}>{humanizeActivity(act)}</span>
                  </div>
                  <span className={styles.activityDate}>{fmtDate(act.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Tickets</h1>
          <p className={styles.pageSubtitle}>Gerencie solicitações e chamados entre usuários</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => setShowLabelMgr(true)}>
            <Tag size={14} /> Labels
          </button>
          <div className={styles.viewToggle}>
            <button className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleActive : ''}`} onClick={() => setViewMode('list')}>
              <LayoutList size={15} /> Lista
            </button>
            <button className={`${styles.viewToggleBtn} ${viewMode === 'board' ? styles.viewToggleActive : ''}`} onClick={() => setViewMode('board')}>
              <Columns size={15} /> Quadro
            </button>
          </div>
          <button className={styles.btnPrimary} onClick={() => setShowForm(v => !v)}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancelar' : 'Novo Ticket'}
          </button>
        </div>
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
                <input className={styles.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Descreva brevemente o problema ou solicitação" required />
              </div>
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>Descrição</label>
                <textarea className={styles.textarea} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Detalhes adicionais..." />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Tipo</label>
                <select className={styles.select} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="task">Tarefa</option>
                  <option value="bug">Bug</option>
                  <option value="story">História</option>
                  <option value="feature">Feature</option>
                </select>
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
              <div className={styles.formGroup}>
                <label className={styles.label}>Data limite</label>
                <input type="date" className={styles.input} value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
              {labels.length > 0 && (
                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label className={styles.label}>Labels</label>
                  <div className={styles.labelPickerInline}>
                    {labels.map(l => {
                      const active = form.label_ids.includes(l.id);
                      return (
                        <button key={l.id} type="button"
                          className={`${styles.labelPickerChip} ${active ? styles.labelPickerChipActive : ''}`}
                          style={{ '--lc': l.color }}
                          onClick={() => toggleFormLabel(l.id)}
                        >
                          {active && '✓ '}{l.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Salvando...' : 'Criar Ticket'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filters ── */}
      <div className={styles.filterBar}>
        <div className={styles.filterTabs}>
          {[['', 'Todos'], ['mine', 'Meus'], ['assigned', 'Atribuídos a mim']].map(([val, lbl]) => (
            <button key={val} className={`${styles.filterTab} ${filter === val ? styles.filterTabActive : ''}`} onClick={() => { setFilter(val); setPage(1); }}>{lbl}</button>
          ))}
        </div>
        <div className={styles.filterSelects}>
          {viewMode === 'list' && (
            <select className={styles.select} value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }}>
              <option value="">Todos os status</option>
              <option value="open">Aberto</option>
              <option value="in_progress">Em andamento</option>
              <option value="resolved">Resolvido</option>
              <option value="closed">Fechado</option>
            </select>
          )}
          <select className={styles.select} value={typeF} onChange={e => { setTypeF(e.target.value); setPage(1); }}>
            <option value="">Todos os tipos</option>
            <option value="task">Tarefa</option>
            <option value="bug">Bug</option>
            <option value="story">História</option>
            <option value="feature">Feature</option>
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

      {/* ── BOARD VIEW ── */}
      {viewMode === 'board' && (
        <div className={`${styles.boardWrapper} ${selected ? styles.boardWithDetail : ''}`}>
          <div className={styles.kanbanBoard}>
            {loading ? (
              <div className={styles.center} style={{ gridColumn: '1/-1' }}><div className="spinner" /></div>
            ) : (
              boardColumns.map(col => {
                const sc = STATUS_COLORS[col.status];
                const isOver = dragOverCol === col.status;
                return (
                  <div key={col.status}
                    className={`${styles.kanbanColumn} ${isOver ? styles.kanbanColumnOver : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOverCol(col.status); }}
                    onDrop={e => handleDrop(e, col.status)}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null); }}
                  >
                    <div className={styles.kanbanColHeader}>
                      <div className={styles.kanbanColTitleRow}>
                        <div className={styles.kanbanColDot} style={{ background: sc.accent }} />
                        <span className={styles.kanbanColTitle}>{STATUS_LABELS[col.status]}</span>
                      </div>
                      <span className={styles.kanbanColCount} style={{ background: sc.bg, color: sc.color }}>{col.tickets.length}</span>
                    </div>
                    <div className={styles.kanbanCards}>
                      {col.tickets.length === 0 ? (
                        <div className={`${styles.kanbanEmpty} ${isOver ? styles.kanbanEmptyOver : ''}`}>Arraste tickets aqui</div>
                      ) : (
                        col.tickets.map(ticket => (
                          <div key={ticket.id}
                            className={`${styles.kanbanCard} ${selected === ticket.id ? styles.kanbanCardSelected : ''}`}
                            style={{ borderLeft: `3px solid ${PRIORITY_BORDER[ticket.priority] || '#e5e7eb'}` }}
                            draggable
                            onDragStart={e => handleDragStart(e, ticket)}
                            onDragEnd={() => { dragTicket.current = null; setDragOverCol(null); }}
                            onClick={() => openDetail(ticket)}
                          >
                            <div className={styles.kanbanCardTop}>
                              <TypeIcon type={ticket.type} size={12} />
                              <span className={styles.kanbanCardId}>#{ticket.id}</span>
                            </div>
                            <div className={styles.kanbanCardTitle}>{ticket.title}</div>
                            {ticket.labels?.length > 0 && (
                              <div className={styles.kanbanCardLabels}>
                                {ticket.labels.slice(0, 3).map(l => <LabelChip key={l.id} label={l} />)}
                                {ticket.labels.length > 3 && <span style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>+{ticket.labels.length - 3}</span>}
                              </div>
                            )}
                            <div className={styles.kanbanCardFooter}>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                                <Badge type="priority" value={ticket.priority} />
                                <DueDateChip due_date={ticket.due_date ? String(ticket.due_date).slice(0, 10) : null} status={ticket.status} />
                              </div>
                              <div className={styles.kanbanCardMeta}>
                                {ticket.comment_count > 0 && <span className={styles.kanbanCommentCount}><MessageSquare size={11} />{ticket.comment_count}</span>}
                                {ticket.assigned_to_name && <Avatar name={ticket.assigned_to_name} size={22} />}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {detailPanel}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === 'list' && (
        <div className={`${styles.mainArea} ${selected ? styles.splitView : ''}`}>
          <div className={styles.listPane}>
            {loading ? (
              <div className={styles.center}><div className="spinner" /></div>
            ) : tickets.length === 0 ? (
              <div className={styles.empty}>
                <MessageSquare size={40} color="var(--border-color)" />
                <p>Nenhum ticket encontrado.</p>
                <button className={styles.btnPrimary} onClick={() => setShowForm(true)}><Plus size={16} /> Criar Ticket</button>
              </div>
            ) : (
              <>
                <div className={styles.ticketList}>
                  {tickets.map(t => (
                    <div key={t.id}
                      className={`${styles.ticketCard} ${selected === t.id ? styles.ticketCardSelected : ''}`}
                      onClick={() => openDetail(t)}
                    >
                      <div className={styles.ticketCardTop}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <TypeIcon type={t.type} size={12} />
                          <span className={styles.ticketId}>#{t.id}</span>
                        </div>
                        <div className={styles.badges}>
                          <Badge type="priority" value={t.priority} />
                          <Badge type="status"   value={t.status} />
                          <DueDateChip due_date={t.due_date ? String(t.due_date).slice(0, 10) : null} status={t.status} />
                        </div>
                      </div>
                      <div className={styles.ticketTitle}>{t.title}</div>
                      {t.labels?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                          {t.labels.map(l => <LabelChip key={l.id} label={l} />)}
                        </div>
                      )}
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
                    <button className={styles.pageBtn} disabled={page === 1}          onClick={() => setPage(1)}>«</button>
                    <button className={styles.pageBtn} disabled={page === 1}          onClick={() => setPage(p => p - 1)}>‹</button>
                    <span className={styles.pageInfo}>{page} / {totalPages}</span>
                    <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
                    <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
                  </div>
                )}
              </>
            )}
          </div>
          {detailPanel}
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Confirmar exclusão</h3>
            <p>Deseja excluir o ticket <strong>#{deleteTarget.id} — {deleteTarget.title}</strong>?<br />Esta ação não pode ser desfeita.</p>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button className={styles.btnDanger}    onClick={handleDeleteTicket}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Label Manager Modal ── */}
      {showLabelMgr && (
        <LabelManager
          labels={labels}
          currentUser={user}
          onClose={() => setShowLabelMgr(false)}
          onReload={async () => { await fetchLabels(); fetchTickets(); }}
        />
      )}
    </div>
  );
}
