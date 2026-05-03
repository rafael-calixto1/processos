import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { visualProcessAPI } from '../api/index';
import '@xyflow/react/dist/style.css';
import styles from './VisualProcesses.module.css';

const defaultNodes = [
  {
    id: 'node-1',
    type: 'input',
    data: { label: 'Início do Processo' },
    position: { x: 250, y: 50 },
    style: { background: '#0ba52b', color: '#fff', borderRadius: '8px', padding: '10px' },
  },
];

const VisualProcesses = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [flows, setFlows] = useState([]);
  const [selectedFlowId, setSelectedFlowId] = useState(null);
  const [title, setTitle] = useState('Novo Fluxo');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    try {
      const data = await visualProcessAPI.list();
      setFlows(data);
    } catch (err) {
      console.error('Erro ao carregar fluxos:', err);
    }
  };

  const loadFlow = async (id) => {
    if (!id) {
      setNodes(defaultNodes);
      setEdges([]);
      setSelectedFlowId(null);
      setTitle('Novo Fluxo');
      return;
    }

    setLoading(true);
    try {
      const flow = await visualProcessAPI.get(id);
      setNodes(flow.nodes || []);
      setEdges(flow.edges || []);
      setTitle(flow.title);
      setSelectedFlowId(flow.id);
    } catch (err) {
      alert('Erro ao carregar o fluxo');
    } finally {
      setLoading(false);
    }
  };

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onAddNode = useCallback(() => {
    const newNode = {
      id: `node-${Date.now()}`,
      data: { label: `Nova Etapa` },
      position: {
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  const onSave = useCallback(async () => {
    setSaving(true);
    try {
      const flowData = { title, nodes, edges };
      if (selectedFlowId) {
        await visualProcessAPI.update(selectedFlowId, flowData);
        alert('Fluxo atualizado com sucesso!');
      } else {
        const result = await visualProcessAPI.create(flowData);
        setSelectedFlowId(result.id);
        alert('Fluxo criado com sucesso!');
        loadFlows();
      }
    } catch (err) {
      alert('Erro ao salvar o fluxo');
    } finally {
      setSaving(false);
    }
  }, [title, nodes, edges, selectedFlowId]);

  const onDelete = async () => {
    if (!selectedFlowId || !window.confirm('Tem certeza que deseja excluir este fluxo?')) return;
    
    try {
      await visualProcessAPI.delete(selectedFlowId);
      alert('Fluxo excluído!');
      loadFlow(null);
      loadFlows();
    } catch (err) {
      alert('Erro ao excluir');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.titleInput}
            placeholder="Título do Fluxo"
          />
          <select
            value={selectedFlowId || ''}
            onChange={(e) => loadFlow(e.target.value)}
            className={styles.flowSelect}
          >
            <option value="">+ Criar Novo Fluxo</option>
            {flows.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </div>
        <p>Desenhe e gerencie o fluxo dos seus processos de auditoria.</p>
      </div>

      <div className={styles.flowWrapper}>
        {loading ? (
          <div className={styles.loading}>Carregando...</div>
        ) : (
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
                <button onClick={onSave} className={styles.saveBtn} disabled={saving}>
                  {saving ? 'Salvando...' : '💾 Salvar Fluxo'}
                </button>
                {selectedFlowId && (
                  <button onClick={onDelete} className={styles.deleteBtn}>
                    🗑️ Excluir
                  </button>
                )}
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>
    </div>
  );
};

export default VisualProcesses;
