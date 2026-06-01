import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  MarkerType,
} from '@xyflow/react';
import {
  Save, Trash2, Undo2, Redo2, PlayCircle, Box, StopCircle,
  X, Copy, Plus, CheckCircle2, AlertCircle, Info, ChevronDown,
  GitBranch, Magnet, LayoutGrid, Layers, ExternalLink, Maximize2, Minimize2, Menu, MoveRight,
} from 'lucide-react';
import { visualProcessAPI, departmentAPI } from '../api/index';
import { StartNode, ProcessNode, EndNode, GatewayNode, SubFlowNode, LinkedFlowNode, ICON_OPTIONS } from './CustomNodes';
import '@xyflow/react/dist/style.css';
import styles from './VisualProcesses.module.css';

const nodeTypes = { startNode: StartNode, processNode: ProcessNode, endNode: EndNode, gatewayNode: GatewayNode, subFlowNode: SubFlowNode, linkedFlowNode: LinkedFlowNode };

const DEFAULT_NODES = [
  {
    id: 'node-1',
    type: 'startNode',
    data: { label: 'Início', description: '', department: '' },
    position: { x: 260, y: 60 },
  },
];

const EDGE_DEFAULTS = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#9ca3af' },
  style: { strokeWidth: 2, stroke: '#9ca3af' },
  labelStyle: { fontSize: 11, fontWeight: 600, fill: '#374151' },
  labelBgStyle: { fill: '#ffffff', fillOpacity: 1 },
  labelBgPadding: [6, 10],
  labelBgBorderRadius: 6,
};

const NODE_LABELS = { startNode: 'Início', endNode: 'Fim', processNode: 'Nova Etapa', gatewayNode: 'Decisão', subFlowNode: 'Sub-fluxo', linkedFlowNode: 'Chamar Fluxo' };

export default function VisualProcesses() {
  const [nodes, setNodes, onNodesChange] = useNodesState(DEFAULT_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [flows, setFlows] = useState([]);
  const [selectedFlowId, setSelectedFlowId] = useState(null);
  const [title, setTitle] = useState('Novo Fluxo');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 768);

  // Undo / Redo
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  // Stale-closure-safe ref for keyboard handler
  const selectedRef = useRef(null);
  selectedRef.current = selectedElement;

  // ── Toast ──────────────────────────────────────────────
  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ── History ─────────────────────────────────────────────
  const takeSnapshot = useCallback(() => {
    setPast(p => {
      const snap = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      };
      return [...p, snap].slice(-40);
    });
    setFuture([]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setFuture(f => [{ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }, ...f].slice(0, 40));
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setPast(p => p.slice(0, -1));
    setSelectedElement(null);
  }, [past, nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future[0];
    setPast(p => [...p, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }].slice(-40));
    setNodes(next.nodes);
    setEdges(next.edges);
    setFuture(f => f.slice(1));
    setSelectedElement(null);
  }, [future, nodes, edges, setNodes, setEdges]);

  // ── Auto-layout ──────────────────────────────────────────
  const autoLayout = useCallback(() => {
    takeSnapshot();
    // Only layout top-level non-group nodes; children move with their parent
    const layoutNodes = nodes.filter(n => !n.parentId && n.type !== 'subFlowNode');
    const layoutIds   = new Set(layoutNodes.map(n => n.id));
    const inDegree = {};
    const adjacency = {};
    layoutNodes.forEach(n => { inDegree[n.id] = 0; adjacency[n.id] = []; });
    edges.forEach(e => {
      if (!layoutIds.has(e.source) || !layoutIds.has(e.target)) return;
      if (inDegree[e.target] !== undefined) inDegree[e.target]++;
      if (adjacency[e.source] !== undefined) adjacency[e.source].push(e.target);
    });
    const levels = {};
    const nodeLevel = {};
    const visited = new Set();
    let queue = layoutNodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
    let lvl = 0;
    while (queue.length > 0) {
      levels[lvl] = queue;
      queue.forEach(id => { nodeLevel[id] = lvl; visited.add(id); });
      const nextSet = new Set();
      const next = [];
      queue.forEach(id => {
        (adjacency[id] || []).forEach(tgt => {
          if (!visited.has(tgt)) {
            inDegree[tgt]--;
            if (inDegree[tgt] <= 0 && !nextSet.has(tgt)) { next.push(tgt); nextSet.add(tgt); }
          }
        });
      });
      queue = next;
      lvl++;
    }
    layoutNodes.forEach(n => {
      if (!visited.has(n.id)) {
        if (!levels[lvl]) levels[lvl] = [];
        levels[lvl].push(n.id);
        nodeLevel[n.id] = lvl++;
      }
    });
    const LEVEL_H = 200, NODE_W = 260, BASE_X = 280, BASE_Y = 60;
    setNodes(nds => nds.map(n => {
      if (n.parentId || n.type === 'subFlowNode') return n;
      const l = nodeLevel[n.id] ?? 0;
      const row = levels[l] || [n.id];
      const i = row.indexOf(n.id);
      const total = row.length;
      return { ...n, position: { x: BASE_X - ((total - 1) * NODE_W) / 2 + i * NODE_W, y: BASE_Y + l * LEVEL_H } };
    }));
    showToast('Fluxo organizado!', 'info');
  }, [nodes, edges, setNodes, takeSnapshot, showToast]);

  // ── Auto-layout lateral (left → right) ──────────────────
  const autoLayoutLR = useCallback(() => {
    takeSnapshot();
    const layoutNodes = nodes.filter(n => !n.parentId && n.type !== 'subFlowNode');
    const layoutIds   = new Set(layoutNodes.map(n => n.id));
    const inDegree = {};
    const adjacency = {};
    layoutNodes.forEach(n => { inDegree[n.id] = 0; adjacency[n.id] = []; });
    edges.forEach(e => {
      if (!layoutIds.has(e.source) || !layoutIds.has(e.target)) return;
      if (inDegree[e.target] !== undefined) inDegree[e.target]++;
      if (adjacency[e.source] !== undefined) adjacency[e.source].push(e.target);
    });
    const levels = {};
    const nodeLevel = {};
    const visited = new Set();
    let queue = layoutNodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
    let lvl = 0;
    while (queue.length > 0) {
      levels[lvl] = queue;
      queue.forEach(id => { nodeLevel[id] = lvl; visited.add(id); });
      const nextSet = new Set();
      const next = [];
      queue.forEach(id => {
        (adjacency[id] || []).forEach(tgt => {
          if (!visited.has(tgt)) {
            inDegree[tgt]--;
            if (inDegree[tgt] <= 0 && !nextSet.has(tgt)) { next.push(tgt); nextSet.add(tgt); }
          }
        });
      });
      queue = next;
      lvl++;
    }
    layoutNodes.forEach(n => {
      if (!visited.has(n.id)) {
        if (!levels[lvl]) levels[lvl] = [];
        levels[lvl].push(n.id);
        nodeLevel[n.id] = lvl++;
      }
    });
    const LEVEL_W = 280, NODE_H = 160, BASE_X = 60, BASE_Y = 280;
    setNodes(nds => nds.map(n => {
      if (n.parentId || n.type === 'subFlowNode') return n;
      const l = nodeLevel[n.id] ?? 0;
      const row = levels[l] || [n.id];
      const i = row.indexOf(n.id);
      const total = row.length;
      return { ...n, position: { x: BASE_X + l * LEVEL_W, y: BASE_Y - ((total - 1) * NODE_H) / 2 + i * NODE_H } };
    }));
    showToast('Fluxo organizado lateralmente!', 'info');
  }, [nodes, edges, setNodes, takeSnapshot, showToast]);

  // ── Delete element ───────────────────────────────────────
  const deleteElement = useCallback((id, isEdge) => {
    takeSnapshot();
    if (isEdge) {
      setEdges(eds => eds.filter(e => e.id !== id));
    } else {
      const refPrefix = `_ref_${id}_`;
      setNodes(nds => {
        const deleted = nds.find(n => n.id === id);
        return nds
          .filter(n => n.id !== id && !n.id.startsWith(refPrefix))
          .map(n => {
            if (n.parentId !== id) return n;
            // Unparent sub-flow container children: convert relative → absolute
            const { parentId: _p, extent: _e, ...rest } = n;
            return {
              ...rest,
              position: {
                x: (n.position.x || 0) + (deleted?.position?.x || 0),
                y: (n.position.y || 0) + (deleted?.position?.y || 0),
              },
            };
          });
      });
      setEdges(eds => eds.filter(e =>
        e.source !== id && e.target !== id && !e.id.startsWith(refPrefix)
      ));
    }
    setSelectedElement(null);
  }, [takeSnapshot, setEdges, setNodes]);

  // ── Keyboard shortcuts ───────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      const editing = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' && !editing) {
        const el = selectedRef.current;
        if (el) deleteElement(el.id, el.source !== undefined);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, deleteElement]);

  // ── Mobile detection ────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setPanelOpen(!mobile);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Load ────────────────────────────────────────────────
  useEffect(() => {
    loadFlows();
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const data = await departmentAPI.list();
      setDepartments(Array.isArray(data) ? data : []);
    } catch { /* optional */ }
  };

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
      setNodes(DEFAULT_NODES);
      setEdges([]);
      setSelectedFlowId(null);
      setTitle('Novo Fluxo');
      setSelectedElement(null);
      setPast([]);
      setFuture([]);
      return;
    }
    setLoading(true);
    try {
      const flow = await visualProcessAPI.get(id);
      let rn = flow.nodes, re = flow.edges;
      if (typeof rn === 'string') try { rn = JSON.parse(rn); } catch { rn = []; }
      if (typeof re === 'string') try { re = JSON.parse(re); } catch { re = []; }
      const vNodes = (Array.isArray(rn) ? rn : [])
        .map(n => ({ ...n, position: n.position || { x: Math.random() * 300, y: Math.random() * 300 } }))
        .filter(n => n?.id);
      const vEdges = (Array.isArray(re) ? re : [])
        .map(e => ({ ...EDGE_DEFAULTS, ...e }))
        .filter(e => e?.source && e?.target);
      setNodes(vNodes);
      setEdges(vEdges);
      setTitle(flow.title || 'Fluxo sem título');
      setSelectedFlowId(flow.id);
      setSelectedElement(null);
      setPast([]);
      setFuture([]);
    } catch (err) {
      showToast('Erro ao carregar: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Smart node position ──────────────────────────────────
  const getSmartPosition = useCallback(() => {
    if (!nodes.length) return { x: 260, y: 60 };
    const maxY = Math.max(...nodes.map(n => (n.position?.y ?? 0) + 80));
    const avgX = nodes.reduce((s, n) => s + (n.position?.x ?? 0), 0) / nodes.length;
    return { x: avgX + (Math.random() - 0.5) * 80, y: maxY + 100 };
  }, [nodes]);

  // ── Add / Duplicate nodes ────────────────────────────────
  const onAddNode = useCallback((type = 'processNode') => {
    takeSnapshot();
    const newNode = {
      id: `node-${Date.now()}`,
      type,
      data: {
        label: NODE_LABELS[type],
        description: '',
        department: type === 'processNode' ? (departments[0]?.name ?? '') : '',
      },
      position: getSmartPosition(),
    };
    if (type === 'subFlowNode') {
      newNode.style = { width: 420, height: 320 };
      // Prepend so parent renders before its children
      setNodes(nds => [newNode, ...nds]);
      return;
    }
    setNodes(nds => [...nds, newNode]);
  }, [setNodes, takeSnapshot, getSmartPosition, departments]);

  const duplicateNode = useCallback(() => {
    const el = selectedRef.current;
    if (!el || el.source !== undefined) return;
    takeSnapshot();
    const dup = {
      ...el,
      id: `node-${Date.now()}`,
      position: { x: (el.position?.x ?? 0) + 50, y: (el.position?.y ?? 0) + 50 },
      data: { ...el.data },
      selected: false,
    };
    setNodes(nds => [...nds, dup]);
    setSelectedElement(dup);
  }, [takeSnapshot, setNodes]);

  // ── Assign node to group / unparent ─────────────────────
  const assignToGroup = useCallback((nodeId, newParentId) => {
    takeSnapshot();
    setNodes(nds => {
      const parentNode = newParentId ? nds.find(n => n.id === newParentId) : null;
      const childNode  = nds.find(n => n.id === nodeId);
      if (!childNode) return nds;

      let newPos = { ...childNode.position };
      if (newParentId && parentNode) {
        // absolute → relative to new parent
        newPos = {
          x: childNode.position.x - parentNode.position.x,
          y: childNode.position.y - parentNode.position.y,
        };
      } else if (!newParentId && childNode.parentId) {
        // relative → absolute (convert back on unassign)
        const oldParent = nds.find(n => n.id === childNode.parentId);
        if (oldParent) {
          newPos = {
            x: childNode.position.x + oldParent.position.x,
            y: childNode.position.y + oldParent.position.y,
          };
        }
      }

      const updated = nds.map(n => {
        if (n.id !== nodeId) return n;
        if (newParentId) {
          return { ...n, position: newPos, parentId: newParentId, extent: 'parent' };
        }
        const { parentId: _p, extent: _e, ...rest } = n;
        return { ...rest, position: newPos };
      });

      // Parent must appear before child in nodes array
      if (newParentId) {
        const pi = updated.findIndex(n => n.id === newParentId);
        const ci = updated.findIndex(n => n.id === nodeId);
        if (pi > ci) {
          const arr = [...updated];
          const [par] = arr.splice(pi, 1);
          arr.splice(ci, 0, par);
          return arr;
        }
      }
      return updated;
    });
    setSelectedElement(prev => {
      if (!prev || prev.id !== nodeId) return prev;
      if (newParentId) return { ...prev, parentId: newParentId, extent: 'parent' };
      const { parentId: _p, extent: _e, ...rest } = prev;
      return rest;
    });
  }, [takeSnapshot, setNodes]);

  // ── Expand / collapse linked flow inline ─────────────────
  const expandLinkedFlow = useCallback(async (node) => {
    const refId = node.data?.ref_flow_id;
    if (!refId || node.data?.expanded) return;
    setLoading(true);
    try {
      const flow = await visualProcessAPI.get(refId);
      let subNodes = flow.nodes;
      let subEdges = flow.edges;
      if (typeof subNodes === 'string') try { subNodes = JSON.parse(subNodes); } catch { subNodes = []; }
      if (typeof subEdges === 'string') try { subEdges = JSON.parse(subEdges); } catch { subEdges = []; }
      subNodes = (Array.isArray(subNodes) ? subNodes : []).filter(n => n?.id && !n.parentId);
      subEdges = (Array.isArray(subEdges) ? subEdges : []).filter(e => e?.source && e?.target);

      if (!subNodes.length) { showToast('O fluxo referenciado está vazio.', 'info'); return; }
      takeSnapshot();

      const PREFIX     = `_ref_${node.id}_`;
      const PADDING    = 40;
      const HEADER_H   = 36;
      const H_BY_TYPE  = { gatewayNode: 160 };

      // Bounding box of sub-flow nodes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      subNodes.forEach(n => {
        const x = n.position?.x ?? 0, y = n.position?.y ?? 0;
        const w = n.style?.width  ?? 220;
        const h = n.style?.height ?? (H_BY_TYPE[n.type] ?? 80);
        if (x     < minX) minX = x;
        if (y     < minY) minY = y;
        if (x + w > maxX) maxX = x + w;
        if (y + h > maxY) maxY = y + h;
      });
      if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 600; maxY = 400; }

      const containerW = Math.max(maxX - minX + PADDING * 2, 420);
      const containerH = Math.max(maxY - minY + PADDING * 2 + HEADER_H, 300);

      // Namespace IDs so they don't collide with the parent flow
      const idMap = {};
      const childNodes = subNodes.map(n => {
        const newId = `${PREFIX}${n.id}`;
        idMap[n.id] = newId;
        return {
          ...n,
          id: newId,
          parentId: node.id,
          extent: 'parent',
          position: {
            x: (n.position?.x ?? 0) - minX + PADDING,
            y: (n.position?.y ?? 0) - minY + PADDING + HEADER_H,
          },
          draggable:   false,
          selectable:  false,
          connectable: false,
          deletable:   false,
          focusable:   false,
        };
      });

      const childEdges = subEdges.map(e => ({
        ...EDGE_DEFAULTS,
        ...e,
        id:       `${PREFIX}${e.id || `${e.source}-${e.target}`}`,
        source:   idMap[e.source] ?? `${PREFIX}${e.source}`,
        target:   idMap[e.target] ?? `${PREFIX}${e.target}`,
        deletable:  false,
        focusable:  false,
        selectable: false,
      }));

      setNodes(nds => {
        const updated = nds.map(n => n.id !== node.id ? n : {
          ...n,
          style: { width: containerW, height: containerH },
          data:  { ...n.data, expanded: true },
        });
        const pi = updated.findIndex(n => n.id === node.id);
        updated.splice(pi + 1, 0, ...childNodes);
        return updated;
      });
      setEdges(eds => [...eds, ...childEdges]);
      setSelectedElement(prev => prev?.id === node.id
        ? { ...prev, data: { ...prev.data, expanded: true }, style: { width: containerW, height: containerH } }
        : prev
      );
      showToast('Sub-processo expandido!', 'success');
    } catch (err) {
      showToast('Erro ao expandir: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [takeSnapshot, setNodes, setEdges, showToast]);

  const collapseLinkedFlow = useCallback((node) => {
    if (!node.data?.expanded) return;
    takeSnapshot();
    const PREFIX = `_ref_${node.id}_`;
    setNodes(nds => nds
      .filter(n => !n.id.startsWith(PREFIX))
      .map(n => {
        if (n.id !== node.id) return n;
        const { style: _s, ...rest } = n;
        return { ...rest, data: { ...n.data, expanded: false } };
      })
    );
    setEdges(eds => eds.filter(e => !e.id.startsWith(PREFIX)));
    setSelectedElement(prev => {
      if (!prev || prev.id !== node.id) return prev;
      const { style: _s, ...rest } = prev;
      return { ...rest, data: { ...prev.data, expanded: false } };
    });
    showToast('Sub-processo recolhido.', 'info');
  }, [takeSnapshot, setNodes, setEdges, showToast]);

  // ── Connections ──────────────────────────────────────────
  const onConnect = useCallback((params) => {
    takeSnapshot();
    setEdges(eds => addEdge({ ...EDGE_DEFAULTS, ...params }, eds));
  }, [setEdges, takeSnapshot]);

  // ── Selection ────────────────────────────────────────────
  const onElementClick = useCallback((_, el) => setSelectedElement(el), []);
  const onPaneClick = useCallback(() => setSelectedElement(null), []);

  // ── Update data ──────────────────────────────────────────
  const updateNodeData = useCallback((id, patch) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
    setSelectedElement(prev => prev?.id === id ? { ...prev, data: { ...prev.data, ...patch } } : prev);
  }, [setNodes]);

  const updateEdgeLabel = useCallback((id, label) => {
    setEdges(eds => eds.map(e => e.id === id ? { ...e, label } : e));
    setSelectedElement(prev => prev?.id === id ? { ...prev, label } : prev);
  }, [setEdges]);

  // ── Image upload ─────────────────────────────────────────
  const handleImageUpload = async (e, id) => {
    const file = e.target.files[0];
    if (!file) return;
    takeSnapshot();
    setUploadingImage(true);
    const fd = new FormData();
    fd.append('image', file);
    try {
      const { url } = await visualProcessAPI.uploadStageImage(fd);
      updateNodeData(id, { image_url: url });
    } catch (err) {
      showToast('Erro ao enviar imagem: ' + err.message, 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  // ── Save / Delete flow ───────────────────────────────────
  const onSave = useCallback(async () => {
    if (!title.trim()) { showToast('O fluxo precisa de um título.', 'error'); return; }
    setSaving(true);
    try {
      // Strip inline-expanded ref children — save linkedFlowNodes in collapsed form
    const saveNodes = nodes
      .filter(n => !n.id.startsWith('_ref_'))
      .map(n => {
        if (n.type !== 'linkedFlowNode' || !n.data?.expanded) return n;
        const { style: _s, ...rest } = n;
        return { ...rest, data: { ...n.data, expanded: false } };
      });
    const saveEdges = edges.filter(e => !e.id.startsWith('_ref_'));
    const payload = { title, nodes: saveNodes, edges: saveEdges };
      if (selectedFlowId) {
        await visualProcessAPI.update(selectedFlowId, payload);
        showToast('Fluxo salvo com sucesso!');
      } else {
        const res = await visualProcessAPI.create(payload);
        setSelectedFlowId(res.id);
        showToast('Fluxo criado com sucesso!');
      }
      loadFlows();
    } catch {
      showToast('Erro ao salvar o fluxo.', 'error');
    } finally {
      setSaving(false);
    }
  }, [title, nodes, edges, selectedFlowId, showToast]);

  const onDeleteFlow = async () => {
    if (!selectedFlowId) return;
    if (!window.confirm(`Inativar "${title}"?`)) return;
    try {
      await visualProcessAPI.delete(selectedFlowId);
      showToast('Fluxo inativado.');
      loadFlow(null);
      loadFlows();
    } catch {
      showToast('Erro ao inativar o fluxo.', 'error');
    }
  };

  // ── Derived ──────────────────────────────────────────────
  const isEdge = selectedElement?.source !== undefined && selectedElement?.source !== null;
  const selectedNodeType = selectedElement?.type;

  return (
    <div className={styles.container}>
      {/* ── Top header ── */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.titleInput}
            placeholder="Título do fluxo..."
          />
          <div className={styles.flowControls}>
            <div className={styles.selectWrap}>
              <select
                value={selectedFlowId || ''}
                onChange={(e) => e.target.value && loadFlow(e.target.value)}
                className={styles.flowSelect}
              >
                <option value="" disabled>Abrir fluxo...</option>
                {flows.map(f => (
                  <option key={f.id} value={f.id}>{f.title}</option>
                ))}
              </select>
              <ChevronDown size={14} className={styles.selectIcon} />
            </div>
            <button
              className={styles.newFlowBtn}
              onClick={() => loadFlow(null)}
              title="Criar novo fluxo em branco"
            >
              <Plus size={14} />
              Novo
            </button>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.metaChip}>
            <span className={styles.metaDot} style={{ background: '#0ba52b' }} />
            {nodes.length} nós
          </span>
          <span className={styles.metaChip}>
            <span className={styles.metaDot} style={{ background: '#9ca3af' }} />
            {edges.length} conexões
          </span>
          <span className={styles.metaHint}>
            Arraste nós para conectar · Clique para editar · <kbd>Del</kbd> remove · <kbd>Ctrl+Z</kbd> desfaz
          </span>
        </div>
      </div>

      {/* ── Toolbar (desktop) ── */}
      {!isMobile && (
        <div className={styles.toolbar}>
          <div className={styles.tbGroup}>
            <button className={`${styles.tbNode} ${styles.tbNodeStart}`} onClick={() => onAddNode('startNode')} title="Adicionar nó Início">
              <PlayCircle size={13} /> Início
            </button>
            <button className={`${styles.tbNode} ${styles.tbNodeStep}`} onClick={() => onAddNode('processNode')} title="Adicionar etapa">
              <Box size={13} /> Etapa
            </button>
            <button className={`${styles.tbNode} ${styles.tbNodeGateway}`} onClick={() => onAddNode('gatewayNode')} title="Adicionar decisão">
              <GitBranch size={13} /> Decisão
            </button>
            <button className={`${styles.tbNode} ${styles.tbNodeEnd}`} onClick={() => onAddNode('endNode')} title="Adicionar nó Fim">
              <StopCircle size={13} /> Fim
            </button>
            <button className={`${styles.tbNode} ${styles.tbNodeSub}`} onClick={() => onAddNode('subFlowNode')} title="Adicionar sub-fluxo (contêiner)">
              <Layers size={13} /> Sub-fluxo
            </button>
            <button className={`${styles.tbNode} ${styles.tbNodeLinked}`} onClick={() => onAddNode('linkedFlowNode')} title="Chamar outro fluxo">
              <ExternalLink size={13} /> Chamar Fluxo
            </button>
          </div>

          <div className={styles.tbDivider} />

          <div className={styles.tbGroup}>
            <button className={styles.tbTool} onClick={undo} disabled={!past.length} title="Desfazer (Ctrl+Z)">
              <Undo2 size={13} /> Desfazer
            </button>
            <button className={styles.tbTool} onClick={redo} disabled={!future.length} title="Refazer (Ctrl+Y)">
              <Redo2 size={13} /> Refazer
            </button>
          </div>

          <div className={styles.tbDivider} />

          <div className={styles.tbGroup}>
            <button
              className={`${styles.tbTool} ${snapToGrid ? styles.tbToolActive : ''}`}
              onClick={() => setSnapToGrid(v => !v)}
              title="Encaixar ao grid durante arraste"
            >
              <Magnet size={13} /> Snap
            </button>
            <button className={styles.tbTool} onClick={autoLayout} title="Organizar nós de cima para baixo">
              <LayoutGrid size={13} /> Vertical
            </button>
            <button className={styles.tbTool} onClick={autoLayoutLR} title="Organizar nós da esquerda para direita">
              <MoveRight size={13} /> Lateral
            </button>
          </div>

          <div className={styles.tbDivider} />

          <div className={styles.tbGroup}>
            <button className={styles.tbSave} onClick={onSave} disabled={saving}>
              <Save size={13} /> {saving ? 'Salvando…' : 'Salvar'}
            </button>
            {selectedFlowId && (
              <button className={styles.tbDelete} onClick={onDeleteFlow}>
                <Trash2 size={13} /> Inativar
              </button>
            )}
          </div>

          <div className={styles.tbSpacer} />

          <div className={styles.tbHints}>
            <span><kbd>Del</kbd> remover</span>
            <span><kbd>Ctrl+Z/Y</kbd> desfazer/refazer</span>
          </div>
        </div>
      )}

      {/* ── Canvas area ── */}
      <div className={styles.mainArea}>
        <div className={styles.flowWrapper}>
          {loading ? (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner} />
              <span>Carregando fluxo...</span>
            </div>
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
              onNodeDragStop={takeSnapshot}
              onNodesDelete={takeSnapshot}
              onEdgesDelete={takeSnapshot}
              defaultEdgeOptions={EDGE_DEFAULTS}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              deleteKeyCode={null}
              snapToGrid={snapToGrid}
              snapGrid={[16, 16]}
            >
              <Controls showInteractive={false} />
              {!isMobile && (
                <MiniMap
                  nodeStrokeWidth={3}
                  zoomable
                  pannable
                  style={{ borderRadius: 8 }}
                />
              )}
              <Background variant="dots" gap={18} size={1} color="#d1d5db" />

              {/* ── Side panel (mobile only) ── */}
              {isMobile && (
                <Panel position="top-right">
                  {!panelOpen ? (
                    <button
                      className={styles.panelFab}
                      onClick={() => setPanelOpen(true)}
                      title="Abrir menu"
                    >
                      <Menu size={20} />
                    </button>
                  ) : (
                    <div className={styles.panel}>
                      <div className={styles.panelMobileHeader}>
                        <span className={styles.panelMobileTitle}>Menu</span>
                        <button
                          className={styles.panelCloseBtn}
                          onClick={() => setPanelOpen(false)}
                          title="Fechar"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className={styles.panelSection}>
                        <p className={styles.panelLabel}>Histórico</p>
                        <div className={styles.row}>
                          <button className={styles.toolBtn} onClick={undo} disabled={!past.length} title="Desfazer (Ctrl+Z)">
                            <Undo2 size={13} /> Desfazer
                          </button>
                          <button className={styles.toolBtn} onClick={redo} disabled={!future.length} title="Refazer (Ctrl+Y)">
                            Refazer <Redo2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div className={styles.panelDivider} />

                      <div className={styles.panelSection}>
                        <p className={styles.panelLabel}>Adicionar nó</p>
                        <button className={styles.addStartBtn} onClick={() => onAddNode('startNode')}><PlayCircle size={13} /> Início</button>
                        <button className={styles.addBtn} onClick={() => onAddNode('processNode')}><Box size={13} /> Etapa</button>
                        <button className={styles.addGatewayBtn} onClick={() => onAddNode('gatewayNode')}><GitBranch size={13} /> Decisão</button>
                        <button className={styles.addEndBtn} onClick={() => onAddNode('endNode')}><StopCircle size={13} /> Fim</button>
                        <button className={styles.addSubFlowBtn} onClick={() => onAddNode('subFlowNode')}><Layers size={13} /> Sub-fluxo</button>
                        <button className={styles.addLinkedFlowBtn} onClick={() => onAddNode('linkedFlowNode')}><ExternalLink size={13} /> Chamar Fluxo</button>
                      </div>

                      <div className={styles.panelDivider} />

                      <div className={styles.panelSection}>
                        <p className={styles.panelLabel}>Canvas</p>
                        <button className={`${styles.toolBtn} ${snapToGrid ? styles.toolBtnActive : ''}`} onClick={() => setSnapToGrid(v => !v)}>
                          <Magnet size={13} /> Snap ao Grid
                        </button>
                        <button className={styles.toolBtn} onClick={autoLayout}><LayoutGrid size={13} /> Organizar Vertical</button>
                        <button className={styles.toolBtn} onClick={autoLayoutLR}><MoveRight size={13} /> Organizar Lateral</button>
                      </div>

                      <div className={styles.panelDivider} />

                      <div className={styles.panelSection}>
                        <p className={styles.panelLabel}>Fluxo</p>
                        <button className={styles.saveBtn} onClick={onSave} disabled={saving}><Save size={13} /> {saving ? 'Salvando...' : 'Salvar Fluxo'}</button>
                        {selectedFlowId && (
                          <button className={styles.deletePanelBtn} onClick={onDeleteFlow}><Trash2 size={13} /> Inativar Fluxo</button>
                        )}
                      </div>

                      <div className={styles.panelDivider} />
                      <div className={styles.panelHints}>
                        <span><kbd>Del</kbd> remover selecionado</span>
                        <span><kbd>Ctrl+Z / Y</kbd> desfazer/refazer</span>
                      </div>
                    </div>
                  )}
                </Panel>
              )}
            </ReactFlow>
          )}
        </div>

        {/* ── Properties sidebar ── */}
        {selectedElement && (
          <aside className={styles.sidebar}>
            {/* Header */}
            <div className={styles.sidebarHead}>
              <div className={styles.sidebarHeadLeft}>
                <span className={`${styles.typePill} ${isEdge ? styles.pillEdge : styles[`pill_${selectedNodeType}`]}`}>
                  {isEdge ? 'Conexão' : selectedNodeType === 'startNode' ? 'Início' : selectedNodeType === 'endNode' ? 'Fim' : selectedNodeType === 'gatewayNode' ? 'Decisão' : selectedNodeType === 'subFlowNode' ? 'Sub-fluxo' : selectedNodeType === 'linkedFlowNode' ? 'Sub-processo' : 'Etapa'}
                </span>
                <span className={styles.sidebarHeadTitle}>Propriedades</span>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedElement(null)}>
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className={styles.sidebarBody}>
              {!isEdge ? (
                <>
                  <div className={styles.sidebarGroup}>
                    <label>Título</label>
                    <input
                      type="text"
                      value={selectedElement.data?.label || ''}
                      onChange={(e) => updateNodeData(selectedElement.id, { label: e.target.value })}
                      onFocus={takeSnapshot}
                      placeholder="Nome da etapa"
                    />
                  </div>

                  <div className={styles.sidebarGroup}>
                    <label>Descrição</label>
                    <textarea
                      rows={4}
                      value={selectedElement.data?.description || ''}
                      onChange={(e) => updateNodeData(selectedElement.id, { description: e.target.value })}
                      onFocus={takeSnapshot}
                      placeholder="Detalhe as atividades desta etapa..."
                    />
                  </div>

                  {selectedNodeType === 'linkedFlowNode' && (
                    <div className={styles.sidebarGroup}>
                      <label>Fluxo referenciado</label>
                      <select
                        value={selectedElement.data?.ref_flow_id || ''}
                        onChange={(e) => {
                          const picked = flows.find(f => String(f.id) === e.target.value);
                          if (picked) {
                            updateNodeData(selectedElement.id, {
                              ref_flow_id: picked.id,
                              ref_flow_title: picked.title,
                              label: picked.title,
                            });
                          } else {
                            updateNodeData(selectedElement.id, { ref_flow_id: null, ref_flow_title: null });
                          }
                        }}
                      >
                        <option value="">— Selecionar fluxo —</option>
                        {flows
                          .filter(f => f.id !== selectedFlowId)
                          .map(f => (
                            <option key={f.id} value={f.id}>{f.title}</option>
                          ))
                        }
                      </select>
                      <p className={styles.fieldHint}>
                        Este nó representa a chamada de outro fluxo. Use o botão abaixo para navegar até ele.
                      </p>
                    </div>
                  )}

                  {selectedNodeType === 'subFlowNode' && (
                    <p className={styles.fieldHint}>
                      Selecione este nó para ver as alças de redimensionamento nas bordas.
                      Arraste outros nós para dentro do grupo e use o seletor "Grupo pai" nas
                      propriedades deles para vinculá-los.
                    </p>
                  )}

                  {selectedNodeType !== 'subFlowNode' && selectedNodeType !== 'linkedFlowNode' && nodes.some(n => n.type === 'subFlowNode') && (
                    <div className={styles.sidebarGroup}>
                      <label>Grupo pai</label>
                      <select
                        value={selectedElement?.parentId || ''}
                        onChange={(e) => assignToGroup(selectedElement.id, e.target.value || null)}
                      >
                        <option value="">— Nenhum —</option>
                        {nodes
                          .filter(n => n.type === 'subFlowNode' && n.id !== selectedElement?.id)
                          .map(n => (
                            <option key={n.id} value={n.id}>{n.data?.label || 'Sub-fluxo'}</option>
                          ))
                        }
                      </select>
                      <p className={styles.fieldHint}>Agrupar este nó dentro de um sub-fluxo.</p>
                    </div>
                  )}

                  {selectedNodeType === 'processNode' && (
                    <div className={styles.sidebarGroup}>
                      <label>Ícone</label>
                      <div className={styles.iconGrid}>
                        <button
                          className={`${styles.iconCell} ${!selectedElement.data?.icon ? styles.iconCellActive : ''}`}
                          onClick={() => updateNodeData(selectedElement.id, { icon: null })}
                          title="Sem ícone"
                        >—</button>
                        {ICON_OPTIONS.map(({ key, label, Icon }) => (
                          <button
                            key={key}
                            className={`${styles.iconCell} ${selectedElement.data?.icon === key ? styles.iconCellActive : ''}`}
                            onClick={() => updateNodeData(selectedElement.id, { icon: key })}
                            title={label}
                          >
                            <Icon size={13} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedNodeType === 'processNode' && (
                    <div className={styles.sidebarGroup}>
                      <label>Departamento</label>
                      <select
                        value={selectedElement.data?.department || ''}
                        onChange={(e) => updateNodeData(selectedElement.id, { department: e.target.value })}
                        onFocus={takeSnapshot}
                      >
                        <option value="">— Nenhum —</option>
                        {departments.length > 0 ? (
                          departments.map(d => (
                            <option key={d.id} value={d.name}>{d.name}</option>
                          ))
                        ) : (
                          <>
                            <option value="Suporte">Suporte Técnico</option>
                            <option value="Financeiro">Financeiro</option>
                            <option value="Vendas">Vendas / Comercial</option>
                            <option value="Infraestrutura">Infraestrutura</option>
                            <option value="Diretoria">Diretoria</option>
                          </>
                        )}
                      </select>
                    </div>
                  )}

                  {selectedNodeType !== 'subFlowNode' && selectedNodeType !== 'linkedFlowNode' && <div className={styles.sidebarGroup}>
                    <label>Imagem da Etapa</label>
                    {selectedElement.data?.image_url ? (
                      <div className={styles.imagePreviewWrap}>
                        <img
                          src={selectedElement.data.image_url}
                          alt="Prévia"
                          className={styles.imagePreview}
                          onClick={() => setLightboxUrl(selectedElement.data.image_url)}
                        />
                        <button
                          className={styles.removeImgBtn}
                          onClick={() => { takeSnapshot(); updateNodeData(selectedElement.id, { image_url: '' }); }}
                        >
                          <X size={12} /> Remover
                        </button>
                      </div>
                    ) : (
                      <label className={styles.uploadLabel}>
                        {uploadingImage ? 'Enviando…' : '↑ Selecionar imagem'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, selectedElement.id)}
                          disabled={uploadingImage}
                          hidden
                        />
                      </label>
                    )}
                  </div>}
                </>
              ) : (
                <div className={styles.sidebarGroup}>
                  <label>Label / Condição</label>
                  <input
                    type="text"
                    value={selectedElement.label || ''}
                    onChange={(e) => updateEdgeLabel(selectedElement.id, e.target.value)}
                    onFocus={takeSnapshot}
                    placeholder="Ex: Sim, Não, Sucesso, Falha"
                  />
                  <p className={styles.fieldHint}>Aparece sobre a seta de conexão.</p>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className={styles.sidebarFoot}>
              {selectedNodeType === 'linkedFlowNode' && selectedElement.data?.ref_flow_id && (
                <>
                  {selectedElement.data?.expanded ? (
                    <button
                      className={styles.collapseLinkedFlowBtn}
                      onClick={() => collapseLinkedFlow(selectedElement)}
                    >
                      <Minimize2 size={13} /> Recolher sub-processo
                    </button>
                  ) : (
                    <button
                      className={styles.expandLinkedFlowBtn}
                      onClick={() => expandLinkedFlow(selectedElement)}
                    >
                      <Maximize2 size={13} /> Expandir sub-processo
                    </button>
                  )}
                  <button
                    className={styles.openLinkedFlowBtn}
                    onClick={() => loadFlow(selectedElement.data.ref_flow_id)}
                  >
                    <ExternalLink size={13} /> Abrir em tela cheia
                  </button>
                </>
              )}
              {!isEdge && selectedNodeType !== 'linkedFlowNode' && (
                <button className={styles.duplicateBtn} onClick={duplicateNode}>
                  <Copy size={13} /> Duplicar nó
                </button>
              )}
              <button
                className={styles.sidebarDeleteBtn}
                onClick={() => deleteElement(selectedElement.id, isEdge)}
              >
                <Trash2 size={13} />
                Remover {isEdge ? 'conexão' : 'etapa'}
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <div className={styles.modal} onClick={() => setLightboxUrl(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setLightboxUrl(null)}>&times;</button>
            <img src={lightboxUrl} alt="Ampliado" className={styles.modalImage} />
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      <div className={styles.toastStack}>
        {toasts.map(t => (
          <div key={t.id} className={`${styles.toast} ${styles[`toast_${t.type}`]}`}>
            {t.type === 'success' && <CheckCircle2 size={15} />}
            {t.type === 'error' && <AlertCircle size={15} />}
            {t.type === 'info' && <Info size={15} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
