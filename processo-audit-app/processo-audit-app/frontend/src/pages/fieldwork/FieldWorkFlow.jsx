import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { FieldWorkProvider } from './state';
import FieldOrderList from './FieldOrderList';
import FieldOrderDetail from './FieldOrderDetail';
import FinalizationHub from './FinalizationHub';
import { DescriptionStep, ClosingReasonStep, InterventionLocationStep, ChecklistStep, CrewStep } from './steps/FormSteps';
import { RemovedMaterialsStep } from './steps/MaterialsStep';
import LaunchesStep from './steps/LaunchesStep';
import ServicePhotosStep from './steps/ServicePhotosStep';

/* Montado em /campo/*  —  lista → detalhe → finalização (hub) → etapa */
const FieldWorkFlow = () => (
  <FieldWorkProvider>
    <Routes>
      <Route index element={<FieldOrderList />} />
      <Route path=":orderId" element={<FieldOrderDetail />} />
      <Route path=":orderId/finalizar" element={<FinalizationHub />} />
      <Route path=":orderId/finalizar/description" element={<DescriptionStep />} />
      <Route path=":orderId/finalizar/closing-reason" element={<ClosingReasonStep />} />
      <Route path=":orderId/finalizar/intervention-location" element={<InterventionLocationStep />} />
      <Route path=":orderId/finalizar/checklists" element={<ChecklistStep />} />
      <Route path=":orderId/finalizar/used-materials" element={<LaunchesStep />} />
      <Route path=":orderId/finalizar/removed-materials" element={<RemovedMaterialsStep />} />
      <Route path=":orderId/finalizar/service-photos" element={<ServicePhotosStep />} />
      <Route path=":orderId/finalizar/crew" element={<CrewStep />} />
      <Route path="*" element={<Navigate to="/os" replace />} />
    </Routes>
  </FieldWorkProvider>
);
export default FieldWorkFlow;
