import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Processes from './pages/Processes';
import ProcessDetail from './pages/ProcessDetail';
import ProcessEdit from './pages/ProcessEdit';
import Departments from './pages/Departments';
import Branding from './pages/Branding';
import Users from './pages/Users';
import Settings from './pages/Settings';
import VisualProcesses from './pages/VisualProcesses';
import ProcessExecution from './pages/ProcessExecution';
import MyExecutions from './pages/MyExecutions';
import Files from './pages/Files';
import Fleet from './pages/Fleet';
import Tickets from './pages/Tickets';
import HotspotGoogleSheets from './pages/HotspotGoogleSheets';
import HotspotMikrotikConfig from './pages/HotspotMikrotikConfig';
import HubsoftTecnicos from './pages/HubsoftTecnicos';
import HubsoftExplorer from './pages/HubsoftExplorer';
import HubsoftLoginSearch from './pages/HubsoftLoginSearch';
import ConsultaFatura from './pages/ConsultaFatura';
import Referral from './pages/Referral';
import Leads from './pages/Leads';
const EstoqueItens = lazy(() => import('./pages/EstoqueItens'));
const EstoqueEntrada = lazy(() => import('./pages/EstoqueEntrada'));
const EstoqueRetirada = lazy(() => import('./pages/EstoqueRetirada'));
const EstoqueDevolucao = lazy(() => import('./pages/EstoqueDevolucao'));
const EstoquePosse = lazy(() => import('./pages/EstoquePosse'));
const EstoqueCadastros = lazy(() => import('./pages/EstoqueCadastros'));
const EstoqueEquipamentos = lazy(() => import('./pages/EstoqueEquipamentos'));
const PainelEstoque = lazy(() => import('./pages/PainelEstoque'));
const OrdensServico = lazy(() => import('./pages/OrdensServico'));
const OrdemServicoDetalhe = lazy(() => import('./pages/OrdemServicoDetalhe'));
import './styles/global.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Restringe a rota a perfis específicos (o backend aplica as mesmas regras)
const RoleRoute = ({ roles, children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={user.role === 'tecnico' ? '/os' : '/dashboard'} replace />;
  return <Layout><Suspense fallback={<div className="spinner" />}>{children}</Suspense></Layout>;
};

const STAFF = ['admin', 'estoque'];
const WITH_TECNICO = ['admin', 'estoque', 'tecnico'];
const stockRoutes = [
  ['/estoque/painel', PainelEstoque, STAFF],
  ['/estoque/itens', EstoqueItens, STAFF],
  ['/estoque/entrada', EstoqueEntrada, STAFF],
  ['/estoque/retirada', EstoqueRetirada, STAFF],
  ['/estoque/devolucao', EstoqueDevolucao, WITH_TECNICO],
  ['/estoque/posse', EstoquePosse, WITH_TECNICO],
  ['/estoque/posse/:id', EstoquePosse, STAFF],
  ['/estoque/equipamentos', EstoqueEquipamentos, STAFF],
  ['/estoque/cadastros', EstoqueCadastros, STAFF],
  ['/os', OrdensServico, WITH_TECNICO],
  ['/os/:id', OrdemServicoDetalhe, WITH_TECNICO],
];

function AppContent() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Rotas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Rotas protegidas */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Navigate to="/dashboard" replace />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              {user?.role === 'tecnico' ? <Navigate to="/os" replace /> : <Dashboard />}
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/processos"
        element={
          <ProtectedRoute>
            <Layout>
              <Processes />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/processos-visual"
        element={
          <ProtectedRoute>
            <Layout>
              <VisualProcesses />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/arquivos"
        element={
          <ProtectedRoute>
            <Layout>
              <Files />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/processos/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <ProcessDetail />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/processos/:id/edit"
        element={
          <ProtectedRoute>
            <Layout>
              <ProcessEdit />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/departamentos"
        element={
          <ProtectedRoute>
            <Layout>
              <Departments />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/execucoes"
        element={
          <ProtectedRoute>
            <Layout>
              <MyExecutions />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/execucoes/novo/:processId"
        element={
          <ProtectedRoute>
            <Layout>
              <ProcessExecution />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/execucoes/:executionId"
        element={
          <ProtectedRoute>
            <Layout>
              <ProcessExecution />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/branding"
        element={
          <AdminRoute>
            <Layout>
              <Branding />
            </Layout>
          </AdminRoute>
        }
      />

      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute>
            <Layout>
              <Settings />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <AdminRoute>
            <Layout>
              <Users />
            </Layout>
          </AdminRoute>
        }
      />

      <Route
        path="/frota"
        element={
          <ProtectedRoute>
            <Layout>
              <Fleet />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tickets"
        element={
          <ProtectedRoute>
            <Layout>
              <Tickets />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ferramentas/hotspot-google-sheets"
        element={
          <ProtectedRoute>
            <Layout>
              <HotspotGoogleSheets />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ferramentas/criar-config-hotspot"
        element={
          <ProtectedRoute>
            <Layout>
              <HotspotMikrotikConfig />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ferramentas/hubsoft-login-search"
        element={
          <ProtectedRoute>
            <Layout>
              <HubsoftLoginSearch />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ferramentas/consulta-fatura"
        element={
          <ProtectedRoute>
            <Layout>
              <ConsultaFatura />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/hubsoft/tecnicos"
        element={
          <ProtectedRoute>
            <Layout>
              <HubsoftTecnicos />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/hubsoft/explorer"
        element={
          <AdminRoute>
            <Layout>
              <HubsoftExplorer />
            </Layout>
          </AdminRoute>
        }
      />

      <Route
        path="/indique-e-ganhe"
        element={
          <ProtectedRoute>
            <Layout>
              <Referral />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <Layout>
              <Leads />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Estoque e Ordens de Serviço */}
      {stockRoutes.map(([path, Page, roles]) => (
        <Route key={path} path={path} element={<RoleRoute roles={roles}><Page /></RoleRoute>} />
      ))}

      {/* Rotas não encontradas */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BrandingProvider>
          <AppContent />
        </BrandingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
