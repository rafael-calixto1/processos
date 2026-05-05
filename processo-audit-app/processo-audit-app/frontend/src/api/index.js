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

  listUsers: async () => {
    const res = await fetch(`${API_URL}/auth/users`, {
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
  list: async (departmentId = null, status = null) => {
    let url = `${API_URL}/processes`;
    const params = new URLSearchParams();
    if (departmentId) params.append('department_id', departmentId);
    if (status) params.append('status', status);
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
  }
};
