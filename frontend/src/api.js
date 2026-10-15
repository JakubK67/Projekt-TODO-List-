import axios from 'axios';

let csrfToken = '';
let redirectingForSession = false;

export function setCsrfToken(token) {
  csrfToken = typeof token === 'string' ? token : '';
}

axios.defaults.withCredentials = true;
axios.interceptors.request.use(config => {
  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method) && csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
  return config;
});
axios.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && !redirectingForSession) {
    redirectingForSession = true;
    window.location.assign('/');
  }
  return Promise.reject(error);
});

export async function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  const response = await fetch(path, { ...options, method, headers, credentials: 'same-origin' });
  if (response.status === 401 && !redirectingForSession) {
    redirectingForSession = true;
    window.location.assign('/');
  }
  return response;
}
