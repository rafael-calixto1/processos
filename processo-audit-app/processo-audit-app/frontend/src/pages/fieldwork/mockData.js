/* Dados mock do fluxo de campo (rede externa / outside plant). Sem clientes: o foco são os elementos de rede. */

/* Dados auxiliares do fluxo de campo. As OS vêm do backend (osAPI). */

export const CLOSING_REASONS = [
  { id: 'route_launched', label: 'Rota lançada com sucesso' },
  { id: 'splice_enclosure_serviced', label: 'Caixa de emenda (CEO) reparada / vedada' },
  { id: 'pop_maintenance_done', label: 'Manutenção de POP concluída' },
  { id: 'pole_obstructed', label: 'Poste obstruído / sem acesso' },
  { id: 'route_rerouted', label: 'Rota redirecionada por impedimento' },
  { id: 'no_pole_permit', label: 'Sem autorização da concessionária do poste' },
];

/* Checklist de planta externa. type: boolean | number | text */
export const OUTSIDE_PLANT_CHECKLIST = [
  { id: 'fiberLaunchedMeters', type: 'number', unit: 'm', label: 'Metros de fibra lançados?', required: true },
  { id: 'spliceEnclosureSealed', type: 'boolean', label: 'A caixa de emenda foi vedada corretamente?', required: true },
  { id: 'dropClampsUsed', type: 'number', unit: 'un', label: 'Quantidade de ferragens/alças de drop usadas?', required: true },
  { id: 'slackLoopsLeft', type: 'number', unit: 'un', label: 'Reservas técnicas (loops) deixadas no poste?', required: true },
  { id: 'fiberTagged', type: 'boolean', label: 'Cabo identificado com plaqueta de rota?', required: true },
  { id: 'opticalPowerOk', type: 'boolean', label: 'Potência óptica dentro do orçamento de perda?', required: true },
  { id: 'fieldNotes', type: 'text', label: 'Observações da rota (opcional)', required: false },
];

export const NETWORK_INVENTORY = [
  { id: 'inv-cab-asu12', name: 'Cabo óptico ASU 12F', category: 'cable', unit: 'm' },
  { id: 'inv-cab-asu06', name: 'Cabo óptico ASU 06F', category: 'cable', unit: 'm' },
  { id: 'inv-cab-drop', name: 'Cabo drop 1F', category: 'cable', unit: 'm' },
  { id: 'inv-spl-18', name: 'Splitter PLC 1:8', category: 'splitter', unit: 'un' },
  { id: 'inv-spl-116', name: 'Splitter PLC 1:16', category: 'splitter', unit: 'un' },
  { id: 'inv-ceo-24', name: 'Caixa de emenda CEO 24F', category: 'splice_box', unit: 'un' },
  { id: 'inv-cto-16', name: 'Caixa de terminação CTO 16P', category: 'splice_box', unit: 'un' },
  { id: 'inv-clamp', name: 'Alça preformada / ferragem de drop', category: 'hardware', unit: 'un' },
  { id: 'inv-bap', name: 'Braçadeira BAP', category: 'hardware', unit: 'un' },
];

export const INVENTORY_CATEGORIES = {
  cable: 'Cabos', splitter: 'Splitters', splice_box: 'Caixas de emenda', hardware: 'Ferragens',
};

export const CREW_DIRECTORY = [
  { id: 'cr-01', name: 'Anderson Souza', role: 'Auxiliar de lançamento' },
  { id: 'cr-02', name: 'Bruno Teixeira', role: 'Fusionista' },
  { id: 'cr-03', name: 'Carla Menezes', role: 'Técnica de rede' },
  { id: 'cr-04', name: 'Diego Ramos', role: 'Auxiliar de poste' },
  { id: 'cr-05', name: 'Eduardo Pires', role: 'Motorista / apoio' },
];
