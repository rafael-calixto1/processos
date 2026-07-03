const API_URL = '/api';

const getToken = () => localStorage.getItem('token');

const headers = (token) => ({
  'Content-Type': 'application/json',
  ...(token && { 'Authorization': `Bearer ${token}` })
});

// ======== AUTENTICAÇÃO ========
export const authAPI = {
  login: async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  register: async (email, password, name) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, password, name })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  listUsers: async (search = '', page = 1, limit = 10) => {
    let url = `${API_URL}/auth/users?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    
    const res = await fetch(url, {
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  createUser: async (data) => {
    const res = await fetch(`${API_URL}/auth/users`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  updateUser: async (id, data) => {
    const res = await fetch(`${API_URL}/auth/users/${id}`, {
      method: 'PUT',
      headers: headers(getToken()),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  deleteUser: async (id) => {
    const res = await fetch(`${API_URL}/auth/users/${id}`, {
      method: 'DELETE',
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  changePassword: async (currentPassword, newPassword) => {
    const res = await fetch(`${API_URL}/auth/change-password`, {
      method: 'PUT',
      headers: headers(getToken()),
      body: JSON.stringify({ currentPassword, newPassword })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

// ======== PROCESSOS ========
export const processAPI = {
  list: async (departmentId = null, status = null, search = '', page = 1, limit = 10) => {
    let url = `${API_URL}/processes`;
    const params = new URLSearchParams();
    if (departmentId) params.append('department_id', departmentId);
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    params.append('page', page);
    params.append('limit', limit);
    
    if (params.toString()) url += '?' + params.toString();

    const res = await fetch(url, {
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  get: async (id) => {
    const res = await fetch(`${API_URL}/processes/${id}`, {
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  create: async (data) => {
    const res = await fetch(`${API_URL}/processes`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_URL}/processes/${id}`, {
      method: 'PUT',
      headers: headers(getToken()),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_URL}/processes/${id}`, {
      method: 'DELETE',
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getAudit: async (id) => {
    const res = await fetch(`${API_URL}/processes/${id}/audit`, {
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  uploadStepPhoto: async (formData) => {
    const res = await fetch(`${API_URL}/processes/upload-step-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

// ======== DEPARTAMENTOS ========
export const departmentAPI = {
  list: async () => {
    const res = await fetch(`${API_URL}/departments`, {
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  get: async (id) => {
    const res = await fetch(`${API_URL}/departments/${id}`, {
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  create: async (data) => {
    const res = await fetch(`${API_URL}/departments`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_URL}/departments/${id}`, {
      method: 'PUT',
      headers: headers(getToken()),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_URL}/departments/${id}`, {
      method: 'DELETE',
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

// ======== BRANDING ========
export const brandingAPI = {
  get: async () => {
    const res = await fetch(`${API_URL}/branding`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  update: async (data) => {
    const res = await fetch(`${API_URL}/branding`, {
      method: 'PUT',
      headers: headers(getToken()),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getAudit: async () => {
    const res = await fetch(`${API_URL}/branding/audit`, {
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  uploadImage: async (formData) => {
    const res = await fetch(`${API_URL}/branding/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

// ======== PROCESSOS VISUAIS ========
export const visualProcessAPI = {
  list: async () => {
    const res = await fetch(`${API_URL}/visual-processes`, {
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  get: async (id) => {
    const res = await fetch(`${API_URL}/visual-processes/${id}`, {
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  create: async (data) => {
    const res = await fetch(`${API_URL}/visual-processes`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_URL}/visual-processes/${id}`, {
      method: 'PUT',
      headers: headers(getToken()),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_URL}/visual-processes/${id}`, {
      method: 'DELETE',
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  uploadStageImage: async (formData) => {
    const res = await fetch(`${API_URL}/visual-processes/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

// ======== EXECUÇÕES ========
export const executionAPI = {
  start: async (processId) => {
    const res = await fetch(`${API_URL}/executions/start/${processId}`, {
      method: 'POST',
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  get: async (executionId) => {
    const res = await fetch(`${API_URL}/executions/${executionId}`, {
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  completeStep: async (stepExecutionId, data) => {
    const isFormData = data instanceof FormData;
    const res = await fetch(`${API_URL}/step-executions/${stepExecutionId}/complete`, {
      method: 'PUT',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        'Authorization': `Bearer ${getToken()}`
      },
      body: isFormData ? data : JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  complete: async (executionId) => {
    const res = await fetch(`${API_URL}/executions/${executionId}/complete`, {
      method: 'PUT',
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  cancel: async (executionId) => {
    const res = await fetch(`${API_URL}/executions/${executionId}/cancel`, {
      method: 'PUT',
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  listMine: async () => {
    const res = await fetch(`${API_URL}/executions/user/me`, {
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

// ======== TICKETS ========
export const ticketAPI = {
  listAssignable: async () => {
    const res = await fetch(`${API_URL}/tickets/users`, { headers: headers(getToken()) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  list: async ({ status, priority, type, department_id, filter, page = 1, limit = 20 } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (status)        params.append('status', status);
    if (priority)      params.append('priority', priority);
    if (type)          params.append('type', type);
    if (department_id) params.append('department_id', department_id);
    if (filter)        params.append('filter', filter);
    const res = await fetch(`${API_URL}/tickets?${params}`, { headers: headers(getToken()) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  get: async (id) => {
    const res = await fetch(`${API_URL}/tickets/${id}`, { headers: headers(getToken()) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  create: async (data) => {
    const res = await fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_URL}/tickets/${id}`, {
      method: 'PUT',
      headers: headers(getToken()),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_URL}/tickets/${id}`, {
      method: 'DELETE',
      headers: headers(getToken()),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  addComment: async (id, comment) => {
    const res = await fetch(`${API_URL}/tickets/${id}/comments`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify({ comment }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  deleteComment: async (ticketId, commentId) => {
    const res = await fetch(`${API_URL}/tickets/${ticketId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: headers(getToken()),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

// ======== HUBSOFT ========
export const hubsoftAPI = {
  graphql: async (query, variables) => {
    const res = await fetch(`${API_URL}/hubsoft/graphql`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  listTecnicos: async (params = {}) => {
    const searchParams = new URLSearchParams(params);
    const url = `${API_URL}/hubsoft/tecnicos${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const res = await fetch(url, {
      headers: headers(getToken()),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  get: async (path, params = {}) => {
    const searchParams = new URLSearchParams(params);
    const url = `${API_URL}/hubsoft/proxy/${path}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const res = await fetch(url, {
      headers: headers(getToken()),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

// ======== LABELS ========
export const labelAPI = {
  list: async () => {
    const res = await fetch(`${API_URL}/labels`, { headers: headers(getToken()) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  create: async ({ name, color }) => {
    const res = await fetch(`${API_URL}/labels`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  update: async (id, { name, color }) => {
    const res = await fetch(`${API_URL}/labels/${id}`, {
      method: 'PUT',
      headers: headers(getToken()),
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_URL}/labels/${id}`, {
      method: 'DELETE',
      headers: headers(getToken()),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

// ======== ARQUIVOS ========
export const fileAPI = {
  list: async (folderId = null) => {
    let url = `${API_URL}/files`;
    if (folderId) url += `?folder_id=${folderId}`;
    const res = await fetch(url, {
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  createFolder: async (name, parentId = null) => {
    const res = await fetch(`${API_URL}/files/folders`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify({ name, parent_id: parentId })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  renameFolder: async (id, name) => {
    const res = await fetch(`${API_URL}/files/folders/${id}`, {
      method: 'PUT',
      headers: headers(getToken()),
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  deleteFolder: async (id) => {
    const res = await fetch(`${API_URL}/files/folders/${id}`, {
      method: 'DELETE',
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  upload: async (formData) => {
    const res = await fetch(`${API_URL}/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  deleteFile: async (id) => {
    const res = await fetch(`${API_URL}/files/${id}`, {
      method: 'DELETE',
      headers: headers(getToken())
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  renameFile: async (id, name) => {
    const res = await fetch(`${API_URL}/files/${id}`, {
      method: 'PUT',
      headers: headers(getToken()),
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  move: async (type, id, target_folder_id) => {
    const res = await fetch(`${API_URL}/files/move`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify({ type, id, target_folder_id })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  copy: async (type, id, target_folder_id) => {
    const res = await fetch(`${API_URL}/files/copy`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify({ type, id, target_folder_id })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  downloadFolder: async (id) => {
    const res = await fetch(`${API_URL}/files/folders/${id}/download`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.blob();
  },

  downloadFile: async (id) => {
    const res = await fetch(`${API_URL}/files/${id}/download`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.blob();
  }
};

// ======== INDIQUE E GANHE ========
export const referralAPI = {
  list: async (status) => {
    let url = `${API_URL}/referral/indicacoes`;
    if (status) url += `?status=${encodeURIComponent(status)}`;
    const res = await fetch(url, { headers: headers(getToken()) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  create: async (data) => {
    const res = await fetch(`${API_URL}/referral/indicacao`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  cancel: async (id) => {
    const res = await fetch(`${API_URL}/referral/indicacao/${id}`, {
      method: 'DELETE',
      headers: headers(getToken()),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_URL}/referral/indicacao/${id}`, {
      method: 'PUT',
      headers: headers(getToken()),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  remove: async (id) => {
    const res = await fetch(`${API_URL}/referral/indicacoes/${id}`, {
      method: 'DELETE',
      headers: headers(getToken()),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  descontoManual: async (data) => {
    const res = await fetch(`${API_URL}/referral/desconto-manual`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getCliente: async (id) => {
    const res = await fetch(`${API_URL}/referral/cliente/${id}`, { headers: headers(getToken()) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getReferrerInfo: async (cpf) => {
    const res = await fetch(`${API_URL}/referral/public/referrer-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao buscar indicador');
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
  getLeads: async () => {
    const res = await fetch(`${API_URL}/referral/leads`, { headers: headers(getToken()) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  setPrimeiroBoleto: async (id, pago) => {
    const res = await fetch(`${API_URL}/referral/leads/${id}/primeiro-boleto`, {
      method: 'PATCH',
      headers: headers(getToken()),
      body: JSON.stringify({ pago }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getHubsoftCRMs: async () => {
    const res = await fetch(`${API_URL}/referral/hubsoft/crms`, { headers: headers(getToken()) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getCRMEtapas: async (id_crm) => {
    const res = await fetch(`${API_URL}/referral/crm/${id_crm}/etapas`, { headers: headers(getToken()) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  addCRMEtapa: async (id_crm, { id_etapa, nome }) => {
    const res = await fetch(`${API_URL}/referral/crm/${id_crm}/etapas`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify({ id_etapa, nome }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  deleteCRMEtapa: async (id_crm, id) => {
    const res = await fetch(`${API_URL}/referral/crm/${id_crm}/etapas/${id}`, {
      method: 'DELETE',
      headers: headers(getToken()),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  sendLeadToCRM: async (formData) => {
    const res = await fetch(`${API_URL}/referral/leads/send-to-crm`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao enviar lead para o CRM');
    return data;
  },

  createProspect: async (data) => {
    const res = await fetch(`${API_URL}/hubsoft/prospecto`, {
      method: 'POST',
      headers: headers(getToken()),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const error = await res.json().catch(async () => ({ error: await res.text() }));
      throw new Error(error.message || error.error || 'Failed to create prospect');
    }
    return res.json();
  },
  getProspecto: async (id) => {
    const res = await fetch(`${API_URL}/referral/prospecto/${id}`, { headers: headers(getToken()) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getConfig: async () => {
    const res = await fetch(`${API_URL}/referral/config`, { headers: headers(getToken()) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  saveConfig: async (data) => {
    // data may contain desconto_valor and/or regra_ativacao
    const res = await fetch(`${API_URL}/referral/config`, {
      method: 'PUT',
      headers: headers(getToken()),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
