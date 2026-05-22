import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play, StopCircle, Building2 } from 'lucide-react';
import styles from './VisualProcesses.module.css';

const DEPT_PALETTE = {
  suporte:        { color: '#2563eb', bg: '#dbeafe' },
  financeiro:     { color: '#16a34a', bg: '#dcfce7' },
  vendas:         { color: '#d97706', bg: '#fef3c7' },
  comercial:      { color: '#d97706', bg: '#fef3c7' },
  infraestrutura: { color: '#7c3aed', bg: '#ede9fe' },
  infra:          { color: '#7c3aed', bg: '#ede9fe' },
  diretoria:      { color: '#dc2626', bg: '#fee2e2' },
  rh:             { color: '#0891b2', bg: '#cffafe' },
  ti:             { color: '#0369a1', bg: '#e0f2fe' },
  marketing:      { color: '#c026d3', bg: '#fae8ff' },
  operações:      { color: '#ea580c', bg: '#ffedd5' },
  operacoes:      { color: '#ea580c', bg: '#ffedd5' },
};

const getDeptStyle = (dept) => {
  if (!dept) return null;
  const key = dept.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const match = Object.keys(DEPT_PALETTE).find(k => key.includes(k));
  return match ? DEPT_PALETTE[match] : { color: '#6b7280', bg: '#f3f4f6' };
};

const SRC_HANDLE_STYLE = { width: 10, height: 10, border: '2px solid white' };
const TGT_HANDLE_STYLE = { width: 10, height: 10, border: '2px solid white' };

export const StartNode = memo(({ data, selected }) => (
  <div className={`${styles.customNode} ${styles.startNode} ${selected ? styles.nodeSelected : ''}`}>
    <div className={styles.nodeIconWrap}>
      <Play size={16} fill="currentColor" />
    </div>
    <div className={styles.nodeBody}>
      <div className={styles.nodeLabel}>{data.label || 'Início'}</div>
      {data.description && (
        <div className={styles.nodeDesc}>{data.description}</div>
      )}
    </div>
    <Handle
      type="source"
      position={Position.Bottom}
      style={{ ...SRC_HANDLE_STYLE, background: '#0ba52b' }}
    />
  </div>
));

export const ProcessNode = memo(({ data, selected }) => {
  const deptStyle = getDeptStyle(data.department);
  return (
    <div className={`${styles.customNode} ${styles.processNode} ${selected ? styles.nodeSelected : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ ...TGT_HANDLE_STYLE, background: '#2563eb' }}
      />
      <div className={styles.nodeBody}>
        <div className={styles.nodeLabel}>{data.label || 'Etapa'}</div>
        {data.description && (
          <div className={styles.nodeDesc}>{data.description}</div>
        )}
        {data.department && deptStyle && (
          <div
            className={styles.nodeBadge}
            style={{ color: deptStyle.color, background: deptStyle.bg }}
          >
            <Building2 size={9} />
            {data.department}
          </div>
        )}
        {data.image_url && (
          <div className={styles.nodeThumb}>
            <img src={data.image_url} alt="" />
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ ...SRC_HANDLE_STYLE, background: '#2563eb' }}
      />
    </div>
  );
});

export const EndNode = memo(({ data, selected }) => (
  <div className={`${styles.customNode} ${styles.endNode} ${selected ? styles.nodeSelected : ''}`}>
    <Handle
      type="target"
      position={Position.Top}
      style={{ ...TGT_HANDLE_STYLE, background: '#dc2626' }}
    />
    <div className={styles.nodeBody}>
      <div className={styles.nodeLabel}>{data.label || 'Fim'}</div>
      {data.description && (
        <div className={styles.nodeDesc}>{data.description}</div>
      )}
    </div>
    <div className={styles.nodeIconWrap}>
      <StopCircle size={16} fill="currentColor" />
    </div>
  </div>
));
