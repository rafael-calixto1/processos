import { getToken, invalidateToken } from './hubsoftAuth.js';

function baseUrl() {
  return process.env.HUBSOFT_API_URL.replace(/\/$/, '');
}

async function request(method, path, { body, params } = {}) {
  let token = await getToken();

  let url = `${baseUrl()}/${path.replace(/^\//, '')}`;
  if (params && Object.keys(params).length > 0) {
    url += `?${new URLSearchParams(params)}`;
  }

  const buildOptions = (t) => ({
    method,
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  let response = await fetch(url, buildOptions(token));

  // Reactive refresh on 401
  if (response.status === 401) {
    console.warn('[HubSoft] 401 — invalidating token and retrying');
    invalidateToken();
    token = await getToken();
    response = await fetch(url, buildOptions(token));
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HubSoft [${response.status}] ${method} ${path}: ${text}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

export const hubsoft = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
  graphql: (query, variables) => request('POST', 'graphql/v1', { body: { query, variables } }),
  createProspect: async (data) => {
    return request('POST', 'api/v1/clientes/prospectos', { body: data });
  }
};
