import {
  BarChart3, Package, PackagePlus, PackageMinus, Undo2, ClipboardList, HardHat, Contact, Drill,
  ScanSearch, CheckSquare,
} from 'lucide-react';

// Visibilidade por perfil (o backend aplica as mesmas regras)
export const STAFF = ['admin', 'estoque'];

// Tudo que é de estoque — aparece na página /estoque
export const estoqueItems = [
  { label: 'Painel de estoque', path: '/estoque/painel', group: 'Consulta e painéis', Icon: BarChart3, roles: STAFF },
  { label: 'Patrimônio', path: '/estoque/patrimonio', group: 'Consulta e painéis', Icon: ScanSearch, roles: STAFF },
  { label: 'Itens', path: '/estoque/itens', group: 'Consulta e painéis', Icon: Package, roles: STAFF },
  { label: 'Entrada / Compra', path: '/estoque/entrada', group: 'Movimentações', Icon: PackagePlus, roles: STAFF },
  { label: 'Retirada', path: '/estoque/retirada', group: 'Movimentações', Icon: PackageMinus, roles: STAFF },
  { label: 'Devolução', path: '/estoque/devolucao', group: 'Movimentações', Icon: Undo2, roles: [...STAFF, 'tecnico'] },
  { label: 'Aprovar devoluções', path: '/estoque/devolucoes', group: 'Movimentações', Icon: CheckSquare, roles: STAFF },
  { label: 'Estoque por técnico', path: '/estoque/posse', group: 'Técnicos e equipamentos', Icon: HardHat, roles: [...STAFF, 'tecnico'], labelByRole: { tecnico: 'Minha posse' } },
  { label: 'Equipamentos', path: '/estoque/equipamentos', group: 'Técnicos e equipamentos', Icon: Drill, roles: STAFF },
  { label: 'Cadastros', path: '/estoque/cadastros', group: 'Cadastros', Icon: Contact, roles: STAFF },
];

// Menu lateral: um item "Estoque" e a seção de OS
export const estoqueMenu = { label: 'Estoque', path: '/estoque', Icon: Package, roles: [...STAFF, 'tecnico'] };
export const osItems = [
  { label: 'Ordens de Serviço', path: '/os', Icon: ClipboardList, roles: [...STAFF, 'tecnico'], labelByRole: { tecnico: 'Minhas OS' } },
  { label: 'Painel de OS', path: '/os/painel', Icon: BarChart3, roles: STAFF },
];
