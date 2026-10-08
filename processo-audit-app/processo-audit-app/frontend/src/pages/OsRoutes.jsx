import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import OrdensServico from './OrdensServico';
import OrdemServicoDetalhe from './OrdemServicoDetalhe';
import PainelOs from './PainelOs';
import FieldWorkFlow from './fieldwork/FieldWorkFlow';

/* /os/*: técnico usa o fluxo de campo; admin/estoque mantêm criação e gestão das OS. */
const OsRoutes = () => {
  const { user } = useAuth();
  if (user?.role === 'tecnico') return <FieldWorkFlow />;
  return (
    <Routes>
      <Route path="painel" element={<PainelOs />} />
      <Route index element={<OrdensServico />} />
      <Route path=":id" element={<OrdemServicoDetalhe />} />
    </Routes>
  );
};
export default OsRoutes;
