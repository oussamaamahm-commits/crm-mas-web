// Cliente HTTP: sesión por cookie httpOnly + token CSRF en cabecera. Nunca guarda secretos en el navegador.

let csrfToken = null;
let onUnauthorized = () => {};

export const setCsrfToken = (token) => {
  csrfToken = token;
};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || `Error ${status}`);
    this.status = status;
    this.fields = data?.fields ?? {};
    this.data = data ?? {};
  }
}

async function request(method, path, body, { form = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, { error: 'No se pudo conectar con el servidor. Comprueba tu conexión.' });
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
    throw new ApiError(res.status, data);
  }
  return data;
}

export const api = {
  get: (path, params) => {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString() : '';
    return request('GET', qs ? `${path}?${qs}` : path);
  },
  post: (path, body = {}) => request('POST', path, body),
  put: (path, body = {}) => request('PUT', path, body),
  patch: (path, body = {}) => request('PATCH', path, body),
  del: (path, body) => request('DELETE', path, body),
  upload: (path, formData) => request('POST', path, formData, { form: true }),
};

/** Descarga autenticada (PDF, documentos, copias) sin exponer enlaces públicos. */
export async function download(path, fallbackName = 'archivo') {
  const res = await fetch(`/api${path}`, { credentials: 'same-origin' });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Abre un PDF autenticado en una pestaña nueva. */
export async function openPdf(path) {
  const win = window.open('', '_blank');
  const res = await fetch(`/api${path}`, { credentials: 'same-origin' });
  if (!res.ok) {
    win?.close();
    throw new ApiError(res.status, await res.json().catch(() => null));
  }
  const url = URL.createObjectURL(await res.blob());
  if (win) win.location.href = url;
  else window.location.href = url;
}

/** Notifica a las vistas abiertas que los datos han cambiado. */
export const emitRefresh = () => window.dispatchEvent(new Event('wp:refresh'));
