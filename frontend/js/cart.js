const Cart = (() => {
  const KEY = 'hawt_cart';

  function get() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    updateBadge();
  }

  function add(product, size) {
    const items = get();
    const idx = items.findIndex(x => x.product_id === product.id && x.size === size);
    if (idx >= 0) {
      items[idx].quantity += 1;
    } else {
      items.push({
        product_id: product.id,
        name: product.name,
        sub: product.sub || '',
        price_at_purchase: parseFloat(product.sale_price ?? product.base_price),
        image_url: product.image_url,
        size,
        quantity: 1,
      });
    }
    save(items);
  }

  function remove(product_id, size) {
    save(get().filter(x => !(x.product_id === product_id && x.size === size)));
  }

  function updateQty(product_id, size, delta) {
    const items = get()
      .map(x => x.product_id === product_id && x.size === size
        ? { ...x, quantity: Math.max(0, x.quantity + delta) }
        : x)
      .filter(x => x.quantity > 0);
    save(items);
  }

  function clear() {
    localStorage.removeItem(KEY);
    updateBadge();
  }

  function count() {
    return get().reduce((sum, x) => sum + x.quantity, 0);
  }

  function subtotal() {
    return get().reduce((sum, x) => sum + x.price_at_purchase * x.quantity, 0);
  }

  function inr(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  function updateBadge() {
    const n = count();
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      el.textContent = n > 0 ? `(${n})` : '';
    });
    document.querySelectorAll('[data-cart-badge]').forEach(el => {
      el.textContent = n;
      el.style.display = n > 0 ? 'inline-flex' : 'none';
    });
  }

  return { get, add, remove, updateQty, clear, count, subtotal, inr, updateBadge };
})();

// Shared quick-add handler — called from inline onclick on product tile size buttons.
// Reads product data from window.__hawt_productMap (populated by shop.js / home.js / product.js).
window.tileAddToCart = function (event, productId, size) {
  event.preventDefault();
  event.stopPropagation();
  const map = window.__hawt_productMap;
  if (!map || !map[productId]) {
    window.location.href = './product.html?id=' + productId;
    return;
  }
  Cart.add(map[productId], size);
  const btn = event.currentTarget;
  const original = btn.textContent;
  btn.textContent = '✓';
  btn.classList.add('is-added');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('is-added');
  }, 1200);
  if (typeof openCart === 'function') setTimeout(openCart, 180);
};
