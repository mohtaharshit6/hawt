// Wishlist — save products to buy later. Backend-persisted per logged-in user.
// Mirrors the Cart module's role, but talks to /api/wishlist and is per-product.
const Wishlist = (() => {
  let ids    = new Set();   // product ids currently saved
  let loaded = false;

  function isAuthed() {
    return typeof API !== 'undefined' && API.isLoggedIn();
  }

  // Load the saved set from the server. Returns the full product list
  // (used by wishlist.html). Guests resolve to an empty list.
  async function load() {
    if (!isAuthed()) { ids = new Set(); loaded = true; refreshUI(); return []; }
    try {
      const res  = await API.get('/wishlist');
      const list = Array.isArray(res?.data) ? res.data : [];
      ids = new Set(list.map(p => p.id));
      loaded = true;
      refreshUI();
      return list;
    } catch (e) {
      ids = new Set(); loaded = true; refreshUI();
      return [];
    }
  }

  function has(id) { return ids.has(id); }

  // Toggle saved state. Guests are sent to sign in (then back here).
  async function toggle(productId) {
    if (!isAuthed()) {
      const here = encodeURIComponent(location.pathname.split('/').pop() + location.search);
      location.href = './auth.html?redirect=' + here;
      return;
    }
    try {
      if (ids.has(productId)) {
        await API.delete('/wishlist/' + productId);
        ids.delete(productId);
      } else {
        await API.post('/wishlist', { productId });
        ids.add(productId);
      }
      refreshUI();
    } catch (e) {
      // Non-fatal — leave UI as-is.
    }
  }

  function updateHearts() {
    document.querySelectorAll('[data-wish-id]').forEach(el => {
      const saved = ids.has(el.dataset.wishId);
      el.classList.toggle('is-saved', saved);
      el.setAttribute('aria-pressed', saved ? 'true' : 'false');
    });
  }

  function updateBadge() {
    const n = ids.size;
    document.querySelectorAll('[data-wish-count]').forEach(el => {
      el.textContent = n;
      el.style.display = n > 0 ? 'inline-flex' : 'none';
    });
  }

  function refreshUI() { updateHearts(); updateBadge(); }

  // Turn the header heart icon into a link to the wishlist page + a count badge.
  function wireHeaderIcon() {
    const heartSpan = document.getElementById('icon-heart');
    const btn = heartSpan
      ? heartSpan.closest('button, a')
      : document.querySelector('[aria-label="wishlist"]');
    if (!btn) return;
    btn.classList.add('hawt-header__icon--wish');
    if (btn.tagName === 'A') {
      btn.setAttribute('href', './wishlist.html');
    } else {
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', () => { location.href = './wishlist.html'; });
    }
    if (!btn.querySelector('[data-wish-count]')) {
      const badge = document.createElement('span');
      badge.className = 'hawt-header__wish-count';
      badge.setAttribute('data-wish-count', '');
      badge.style.display = 'none';
      btn.appendChild(badge);
    }
  }

  function init() {
    wireHeaderIcon();
    load();
  }

  return { init, load, has, toggle, updateHearts, updateBadge, refreshUI, isAuthed };
})();

// Shared heart handler for product tiles (inline onclick, like tileAddToCart).
window.tileToggleWish = function (event, productId) {
  event.preventDefault();
  event.stopPropagation();
  Wishlist.toggle(productId);
};
