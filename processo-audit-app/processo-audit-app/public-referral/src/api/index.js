const API_URL = '/api';

export const referralAPI = {
  getReferrerInfo: async (cpf) => {
    const res = await fetch(`${API_URL}/referral/public/referrer-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao buscar indicador');
    // Returns: { codigo_cliente, nome, servicos: [{id_cliente_servico, nome, valor, status, status_prefixo}] }
    return data;
  },
  registerIndication: async (formData) => {
    const res = await fetch(`${API_URL}/referral/public/register-indication`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao registrar indicação');
    return data;
  },
  getMyIndications: async (cpf) => {
    const res = await fetch(`${API_URL}/referral/public/my-indications/${cpf}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao buscar suas indicações');
    return data;
  }
};
