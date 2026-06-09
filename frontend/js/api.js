const API = (() => {
  const BASE = '/api';

  function getToken() {
    return localStorage.getItem('hawt_token');
  }
  function setToken(t) {
    localStorage.setItem('hawt_token', t);
  }
  function clearToken() {
    localStorage.removeItem('hawt_token');
    localStorage.removeItem('hawt_user');
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem('hawt_user')); } catch { return null; }
  }
  function setUser(u) {
    localStorage.setItem('hawt_user', JSON.stringify(u));
  }

  function headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    const token = getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  let _refreshing = false;
  let _refreshPromise = null;

  async function tryRefresh() {
    if (_refreshing) return _refreshPromise;
    _refreshing = true;
    _refreshPromise = fetch(BASE + '/auth/refresh', {
      method: 'POST',
      headers: headers(),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.token) setToken(data.token);
        else clearToken();
        return !!data?.token;
      })
      .catch(() => { clearToken(); return false; })
      .finally(() => { _refreshing = false; });
    return _refreshPromise;
  }

  async function request(method, path, body, retry = true) {
    const res = await fetch(BASE + path, {
      method,
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;

    if (res.status === 401 && retry && getToken() && path !== '/auth/refresh') {
      const refreshed = await tryRefresh();
      if (refreshed) return request(method, path, body, false);
      window.location.href = './auth.html';
      throw new Error('session expired');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'request failed');
    return data;
  }

  return {
    get:    (path)        => request('GET',    path),
    post:   (path, body)  => request('POST',   path, body),
    put:    (path, body)  => request('PUT',    path, body),
    delete: (path)        => request('DELETE', path),
    getToken,
    setToken,
    clearToken,
    getUser,
    setUser,
    isLoggedIn: () => !!getToken(),
  };
})();
