import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Play, StopCircle, Building2, GitBranch,
  CheckCircle2, AlertCircle, Info, Upload, Download,
  Search, Settings, Database, Wifi, WifiOff, Shield,
  Clock, Mail, Phone, Zap, Lock, User, Wrench, Eye, Star,
} from 'lucide-react';
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

export const ICON_OPTIONS = [
  { key: 'check',    label: 'Verificação',  Icon: CheckCircle2 },
  { key: 'alert',    label: 'Alerta',       Icon: AlertCircle  },
  { key: 'info',     label: 'Informação',   Icon: Info         },
  { key: 'search',   label: 'Análise',      Icon: Search       },
  { key: 'settings', label: 'Configuração', Icon: Settings     },
  { key: 'database', label: 'Dados',        Icon: Database     },
  { key: 'shield',   label: 'Segurança',    Icon: Shield       },
  { key: 'clock',    label: 'Aguardar',     Icon: Clock        },
  { key: 'mail',     label: 'Comunicação',  Icon: Mail         },
  { key: 'phone',    label: 'Telefone',     Icon: Phone        },
  { key: 'upload',   label: 'Upload',       Icon: Upload       },
  { key: 'download', label: 'Download',     Icon: Download     },
  { key: 'zap',      label: 'Ação rápida',  Icon: Zap          },
  { key: 'lock',     label: 'Bloqueio',     Icon: Lock         },
  { key: 'user',     label: 'Usuário',      Icon: User         },
  { key: 'wrench',   label: 'Manutenção',   Icon: Wrench       },
  { key: 'wifi',     label: 'Online',       Icon: Wifi         },
  { key: 'wifiOff',  label: 'Offline',      Icon: WifiOff      },
  { key: 'eye',      label: 'Monitorar',    Icon: Eye          },
  { key: 'star',     label: 'Destaque',     Icon: Star         },
];

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map(o => [o.key, o.Icon]));

const getDeptStyle = (dept) => {
  if (!dept) return null;
  const key = dept.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const match = Object.keys(DEPT_PALETTE).find(k => key.includes(k));
  return match ? DEPT_PALETTE[match] : { color: '#6b7280', bg: '#f3f4f6' };
};

const HDL = { width: 10, height: 10, border: '2px solid white' };

export const StartNode = memo(({ data, selected }) => (
  <div className={`${styles.customNode} ${styles.startNode} ${selected ? styles.nodeSelected : ''}`}>
    <div className={styles.nodeIconWrap}>
      <Play size={16} fill="currentColor" />
    </div>
    <div className={styles.nodeBody}>
      <div className={styles.nodeLabel}>{data.label || 'Início'}</div>
      {data.description && <div className={styles.nodeDesc}>{data.description}</div>}
    </div>
    <Handle type="source" position={Position.Bottom} style={{ ...HDL, background: '#0ba52b' }} />
  </div>
));

export const ProcessNode = memo(({ data, selected }) => {
  const deptStyle = getDeptStyle(data.department);
  const NodeIcon = data.icon ? ICON_MAP[data.icon] : null;
  return (
    <div className={`${styles.customNode} ${styles.processNode} ${selected ? styles.nodeSelected : ''}`}>
      <Handle type="target" position={Position.Top} style={{ ...HDL, background: '#2563eb' }} />
      {NodeIcon && (
        <div className={styles.nodeIconWrap} style={{ color: '#2563eb', opacity: 1 }}>
          <NodeIcon size={14} />
        </div>
      )}
      <div className={styles.nodeBody}>
        <div className={styles.nodeLabel}>{data.label || 'Etapa'}</div>
        {data.description && <div className={styles.nodeDesc}>{data.description}</div>}
        {data.department && deptStyle && (
          <div className={styles.nodeBadge} style={{ color: deptStyle.color, background: deptStyle.bg }}>
            <Building2 size={9} />
            {data.department}
          </div>
        )}
        {data.image_url && <div className={styles.nodeHasImage} title="Esta etapa tem uma imagem" />}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ ...HDL, background: '#2563eb' }} />
    </div>
  );
});

export const EndNode = memo(({ data, selected }) => (
  <div className={`${styles.customNode} ${styles.endNode} ${selected ? styles.nodeSelected : ''}`}>
    <Handle type="target" position={Position.Top} style={{ ...HDL, background: '#dc2626' }} />
    <div className={styles.nodeBody}>
      <div className={styles.nodeLabel}>{data.label || 'Fim'}</div>
      {data.description && <div className={styles.nodeDesc}>{data.description}</div>}
    </div>
    <div className={styles.nodeIconWrap}>
      <StopCircle size={16} fill="currentColor" />
    </div>
  </div>
));

export const GatewayNode = memo(({ data, selected }) => (
  <div className={`${styles.gatewayOuter} ${selected ? styles.gatewaySelected : ''}`}>
    <div className={styles.gatewayDiamond} />
    <div className={styles.gatewayContent}>
      <GitBranch size={13} strokeWidth={2.5} />
      <span className={styles.gatewayLabel}>{data.label || 'Decisão'}</span>
      {data.description && <div className={styles.gatewayDesc}>{data.description}</div>}
    </div>
    <Handle type="target"  position={Position.Top}    style={{ ...HDL, background: '#d97706' }} />
    <Handle type="source"  position={Position.Bottom} id="bottom" style={{ ...HDL, background: '#d97706' }} />
    <Handle type="source"  position={Position.Left}   id="left"   style={{ ...HDL, background: '#d97706' }} />
    <Handle type="source"  position={Position.Right}  id="right"  style={{ ...HDL, background: '#d97706' }} />
  </div>
));
