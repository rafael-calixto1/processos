// Chamadas à API da Frota com o token do usuário logado: o backend exige login e registra na auditoria quem fez cada ação
export const fleetFetch = (url, opts = {}) => {
  const token = localStorage.getItem('token');
  return fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
};
