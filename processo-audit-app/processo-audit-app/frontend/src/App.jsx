import React from 'react';
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
              <Dashboard />
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
