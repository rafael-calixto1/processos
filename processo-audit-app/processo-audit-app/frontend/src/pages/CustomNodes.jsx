import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play, Square, StopCircle } from 'lucide-react';
import styles from './VisualProcesses.module.css';

const handleStyle = { width: 8, height: 8, background: '#555' };

export const StartNode = memo(({ data }) => {
  return (
    <div className={`${styles.customNode} ${styles.startNode}`}>
      <div className={styles.nodeIcon}><Play size={16} fill="currentColor" /></div>
      <div className={styles.nodeBody}>
        <div className={styles.nodeLabel}>{data.label}</div>
        {data.image_url && (
          <div className={styles.nodeImage}>
            <img src={data.image_url} alt="Etapa" />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
});

export const ProcessNode = memo(({ data }) => {
  return (
    <div className={`${styles.customNode} ${styles.processNode}`}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div className={styles.nodeBody}>
        <div className={styles.nodeLabel}>{data.label}</div>
        {data.department && (
          <div className={styles.nodeSubtitle}>{data.department}</div>
        )}
        {data.image_url && (
          <div className={styles.nodeImage}>
            <img src={data.image_url} alt="Etapa" />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
});

export const EndNode = memo(({ data }) => {
  return (
    <div className={`${styles.customNode} ${styles.endNode}`}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div className={styles.nodeBody}>
        <div className={styles.nodeLabel}>{data.label}</div>
        {data.image_url && (
          <div className={styles.nodeImage}>
            <img src={data.image_url} alt="Etapa" />
          </div>
        )}
      </div>
      <div className={styles.nodeIcon}><StopCircle size={16} fill="currentColor" /></div>
    </div>
  );
});
