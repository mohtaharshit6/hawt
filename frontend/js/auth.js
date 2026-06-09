const Auth = (() => {
  function updateHeaderState() {
    const user = API.getUser();
    const accountBtn = document.getElementById('header-account');
    if (!accountBtn) return;
    if (user) {
      accountBtn.href  = './account.html';
      accountBtn.title = `my account — ${user.name}`;
      accountBtn.setAttribute('aria-label', 'my account');
    } else {
      accountBtn.href  = './auth.html';
      accountBtn.title = 'sign in';
      accountBtn.setAttribute('aria-label', 'sign in');
    }
  }

  async function login(email, password) {
    const data = await API.post('/auth/login', { email, password });
    API.setToken(data.token);
    API.setUser(data.user);
    updateHeaderState();
    return data;
  }

  async function register(name, email, password) {
    const data = await API.post('/auth/register', { name, email, password });
    API.setToken(data.token);
    API.setUser(data.user);
    updateHeaderState();
    return data;
  }

  function logout() {
    API.clearToken();
    updateHeaderState();
    window.location.href = './index.html';
  }

  return { login, register, logout, updateHeaderState };
})();
