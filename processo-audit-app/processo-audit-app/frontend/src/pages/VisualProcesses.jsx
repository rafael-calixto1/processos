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
import { StartNode, ProcessNode, EndNode } from './CustomNodes';
import '@xyflow/react/dist/style.css';
import styles from './VisualProcesses.module.css';

const nodeTypes = {
  startNode: StartNode,
  processNode: ProcessNode,
  endNode: EndNode,
};

const defaultNodes = [
  {
    id: 'node-1',
    type: 'startNode',
    data: { label: 'Início', description: 'Ponto de partida do processo', department: '' },
    position: { x: 250, y: 50 },
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);

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
      setSelectedElement(null);
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

      const validatedEdges = (Array.isArray(rawEdges) ? rawEdges : []).map(edge => ({
        ...edge,
        type: 'smoothstep'
      })).filter(edge => edge && edge.source && edge.target);

      setNodes(validatedNodes);
      setEdges(validatedEdges);
      setTitle(flow.title || 'Fluxo sem título');
      setSelectedFlowId(flow.id);
      setSelectedElement(null);
    } catch (err) {
      console.error('Erro ao carregar o fluxo:', err);
      alert('Erro ao carregar o fluxo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep' }, eds)),
    [setEdges]
  );

  const onAddNode = useCallback((type = 'processNode') => {
    const newNode = {
      id: `node-${Date.now()}`,
      type: type,
      data: { 
        label: type === 'endNode' ? 'Fim' : type === 'startNode' ? 'Início' : `Nova Etapa`,
        description: '',
        department: type === 'processNode' ? 'Suporte' : ''
      },
      position: {
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  const onElementClick = useCallback((event, element) => {
    setSelectedElement(element);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedElement(null);
  }, []);

  const updateNodeData = (id, newData) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
    if (selectedElement?.id === id) {
      setSelectedElement(prev => ({ ...prev, data: { ...prev.data, ...newData } }));
    }
  };

  const handleNodeImageUpload = async (e, id) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const { url } = await visualProcessAPI.uploadStageImage(formData);
      updateNodeData(id, { image_url: url });
    } catch (err) {
      alert('Erro ao carregar imagem: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const updateEdgeData = (id, label) => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === id) {
          return { ...edge, label };
        }
        return edge;
      })
    );
    if (selectedElement?.id === id) {
      setSelectedElement(prev => ({ ...prev, label }));
    }
  };

  const onSave = useCallback(async () => {
    setSaving(true);
    try {
      const flowData = { title, nodes, edges };
      if (selectedFlowId) {
        await visualProcessAPI.update(selectedFlowId, flowData);
        alert('Fluxo atualizado com sucesso!');
        loadFlows();
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

  const deleteElement = (id) => {
    if (selectedElement?.source) {
      setEdges((eds) => eds.filter((edge) => edge.id !== id));
    } else {
      setNodes((nds) => nds.filter((node) => node.id !== id));
      setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    }
    setSelectedElement(null);
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
        <p>Mapeamento profissional de processos de telecomunicações.</p>
      </div>

      <div className={styles.mainArea}>
        <div className={styles.flowWrapper}>
          {loading ? (
            <div className={styles.loading}>Carregando...</div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onElementClick}
              onEdgeClick={onElementClick}
              onPaneClick={onPaneClick}
              defaultEdgeOptions={{ type: 'smoothstep' }}
              fitView
            >
              <Controls />
              <MiniMap />
              <Background variant="dots" gap={12} size={1} />
              
              <Panel position="top-right">
                <div className={styles.panel}>
                  <div className={styles.addButtons}>
                    <button onClick={() => onAddNode('startNode')} className={styles.addStartBtn}>+ Início</button>
                    <button onClick={() => onAddNode('processNode')} className={styles.addBtn}>+ Etapa</button>
                    <button onClick={() => onAddNode('endNode')} className={styles.addEndBtn}>+ Fim</button>
                  </div>
                  <div className={styles.actionButtons}>
                    <button onClick={onSave} className={styles.saveBtn} disabled={saving}>
                      {saving ? 'Salvando...' : '💾 Salvar Fluxo'}
                    </button>
                    {selectedFlowId && (
                      <button onClick={onDelete} className={styles.deleteBtn}>
                        🗑️ Excluir
                      </button>
                    )}
                  </div>
                </div>
              </Panel>
            </ReactFlow>
          )}
        </div>

        {selectedElement && (
          <aside className={styles.sidebar}>
            <h3>Propriedades</h3>
            
            {!selectedElement.source ? (
              <>
                <div className={styles.sidebarGroup}>
                  <label>Título da Etapa</label>
                  <input
                    type="text"
                    value={selectedElement.data.label || ''}
                    onChange={(e) => updateNodeData(selectedElement.id, { label: e.target.value })}
                  />
                </div>
                
                <div className={styles.sidebarGroup}>
                  <label>Descrição / Instruções</label>
                  <textarea
                    rows={4}
                    value={selectedElement.data.description || ''}
                    onChange={(e) => updateNodeData(selectedElement.id, { description: e.target.value })}
                    placeholder="Detalhe as atividades desta etapa..."
                  />
                </div>

                {selectedElement.type === 'processNode' && (
                  <div className={styles.sidebarGroup}>
                    <label>Departamento Responsável</label>
                    <select
                      value={selectedElement.data.department || ''}
                      onChange={(e) => updateNodeData(selectedElement.id, { department: e.target.value })}
                    >
                      <option value="Suporte">Suporte Técnico</option>
                      <option value="Financeiro">Financeiro</option>
                      <option value="Vendas">Vendas / Comercial</option>
                      <option value="Infraestrutura">Infraestrutura</option>
                      <option value="Diretoria">Diretoria</option>
                    </select>
                  </div>
                )}

                <div className={styles.sidebarGroup}>
                  <label>Imagem da Etapa (Opcional)</label>
                  <div className={styles.sidebarImageUpload}>
                    {selectedElement.data.image_url ? (
                      <div className={styles.sidebarImagePreview}>
                        <img src={selectedElement.data.image_url} alt="Preview" />
                        <button 
                          onClick={() => updateNodeData(selectedElement.id, { image_url: '' })}
                          className={styles.removeImageBtn}
                        >
                          Remover Imagem
                        </button>
                      </div>
                    ) : (
                      <label className={styles.sidebarUploadBtn}>
                        {uploadingImage ? 'Enviando...' : 'Fazer Upload de Imagem'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleNodeImageUpload(e, selectedElement.id)}
                          disabled={uploadingImage}
                          hidden
                        />
                      </label>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.sidebarGroup}>
                <label>Condição / Label da Conexão</label>
                <input
                  type="text"
                  value={selectedElement.label || ''}
                  onChange={(e) => updateEdgeData(selectedElement.id, e.target.value)}
                  placeholder="Ex: Sucesso, Falha, Sim, Não"
                />
              </div>
            )}

            <div className={styles.sidebarActions}>
              <button 
                onClick={() => deleteElement(selectedElement.id)} 
                className={styles.sidebarDeleteBtn}
              >
                Remover {selectedElement.source ? 'Conexão' : 'Etapa'}
              </button>
              <button 
                onClick={() => setSelectedElement(null)} 
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
