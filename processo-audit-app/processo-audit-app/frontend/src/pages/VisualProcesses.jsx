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
  const [selectedNode, setSelectedNode] = useState(null);

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
      setSelectedNode(null);
      return;
    }

    setLoading(true);
    try {
      const flow = await visualProcessAPI.get(id);
      
      let rawNodes = flow.nodes;
      let rawEdges = flow.edges;

      if (typeof rawNodes === 'string') {
        try { rawNodes = JSON.parse(rawNodes); } catch (e) { rawNodes = []; }
      }
      
      if (typeof rawEdges === 'string') {
        try { rawEdges = JSON.parse(rawEdges); } catch (e) { rawEdges = []; }
      }

      const validatedNodes = (Array.isArray(rawNodes) ? rawNodes : []).map(node => ({
        ...node,
        position: node.position || { x: Math.random() * 200, y: Math.random() * 200 }
      })).filter(node => node && node.id);

      const validatedEdges = (Array.isArray(rawEdges) ? rawEdges : []).filter(edge => edge && edge.source && edge.target);

      setNodes(validatedNodes);
      setEdges(validatedEdges);
      setTitle(flow.title || 'Fluxo sem título');
      setSelectedFlowId(flow.id);
      setSelectedNode(null);
    } catch (err) {
      console.error('Erro ao carregar o fluxo:', err);
      alert('Erro ao carregar o fluxo: ' + err.message);
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

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const updateNodeLabel = (id, label) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, label } };
        }
        return node;
      })
    );
    if (selectedNode?.id === id) {
      setSelectedNode(prev => ({ ...prev, data: { ...prev.data, label } }));
    }
  };

  const onSave = useCallback(async () => {
    setSaving(true);
    try {
      const flowData = { title, nodes, edges };
      if (selectedFlowId) {
        await visualProcessAPI.update(selectedFlowId, flowData);
        alert('Fluxo atualizado com sucesso!');
        loadFlows(); // Refresh list to get updated title
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

  const deleteNode = (id) => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    setSelectedNode(null);
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

      <div className={styles.mainArea}>
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
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
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

        {selectedNode && (
          <aside className={styles.sidebar}>
            <h3>Editar Etapa</h3>
            <div className={styles.sidebarGroup}>
              <label>Nome da Etapa</label>
              <input
                type="text"
                value={selectedNode.data.label}
                onChange={(e) => updateNodeLabel(selectedNode.id, e.target.value)}
              />
            </div>
            <div className={styles.sidebarActions}>
              <button 
                onClick={() => deleteNode(selectedNode.id)} 
                className={styles.sidebarDeleteBtn}
              >
                Remover Etapa
              </button>
              <button 
                onClick={() => setSelectedNode(null)} 
                className={styles.sidebarCloseBtn}
              >
                Fechar
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default VisualProcesses;
