import React, { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import styles from './VisualProcesses.module.css';

const initialNodes = [
  {
    id: 'node-1',
    type: 'input',
    data: { label: 'Início do Processo' },
    position: { x: 250, y: 50 },
    style: { background: '#0ba52b', color: '#fff', borderRadius: '8px', padding: '10px' },
  },
  {
    id: 'node-2',
    data: { label: 'Etapa de Verificação' },
    position: { x: 250, y: 150 },
  },
  {
    id: 'node-3',
    data: { label: 'Aprovação Final' },
    position: { x: 250, y: 250 },
  },
];

const initialEdges = [
  { id: 'e1-2', source: 'node-1', target: 'node-2', animated: true },
  { id: 'e2-3', source: 'node-2', target: 'node-3' },
];

const VisualProcesses = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onAddNode = useCallback(() => {
    const newNode = {
      id: `node-${nodes.length + 1}`,
      data: { label: `Nova Etapa ${nodes.length + 1}` },
      position: {
        x: Math.random() * 400,
        y: Math.random() * 400,
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [nodes, setNodes]);

  const onSave = useCallback(() => {
    console.log('Salvando Fluxo de Processo:');
    console.log('Nódulos:', nodes);
    console.log('Conexões:', edges);
    alert('Processo salvo no console!');
  }, [nodes, edges]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Processos Visuais</h1>
        <p>Desenhe e gerencie o fluxo dos seus processos de auditoria.</p>
      </div>

      <div className={styles.flowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background variant="dots" gap={12} size={1} />
          
          <Panel position="top-right">
            <div className={styles.panel}>
              <button onClick={onAddNode} className={styles.addBtn}>
                + Adicionar Etapa
              </button>
              <button onClick={onSave} className={styles.saveBtn}>
                💾 Salvar Fluxo
              </button>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
};

export default VisualProcesses;
