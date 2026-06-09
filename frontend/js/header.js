// Header interactions: scroll blur, cart drawer, mobile nav, auth state.
(function () {
  const wrap = document.getElementById('header-wrap');
  const header = document.getElementById('main-header');
  const cartScrim = document.getElementById('cart-scrim');
  const cartDrawer = document.getElementById('cart-drawer');
  const cartClose = document.getElementById('cart-close');
  const openCartBtns = document.querySelectorAll('[data-open-cart]');
  const isHome = document.body.dataset.page === 'home';

  // Scroll: add blur to header
  function onScroll() {
    const scrolled = window.scrollY > 32;
    if (header) {
      header.style.backdropFilter = scrolled ? 'blur(20px)' : 'none';
      if (isHome) {
        header.style.background = scrolled
          ? 'var(--hawt-ink-blur)'
          : 'transparent';
        if (wrap) wrap.style.color = scrolled ? 'var(--hawt-bone)' : 'var(--hawt-bone)';
      } else {
        header.style.background = scrolled ? 'var(--hawt-bone-blur)' : 'transparent';
      }
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Cart drawer open/close
  function openCart() {
    if (!cartDrawer) return;
    cartDrawer.classList.add('is-open');
    if (cartScrim) cartScrim.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    renderCartDrawer();
  }

  function closeCart() {
    if (!cartDrawer) return;
    cartDrawer.classList.remove('is-open');
    if (cartScrim) cartScrim.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  openCartBtns.forEach(btn => btn.addEventListener('click', openCart));
  if (cartClose) cartClose.addEventListener('click', closeCart);
  if (cartScrim) cartScrim.addEventListener('click', closeCart);

  window.openCart = openCart;
  window.closeCart = closeCart;

  // Mobile nav
  const mobileNav    = document.getElementById('mobile-nav');
  const mobileBtn    = document.getElementById('mobile-menu-btn');
  const mobileScrim  = document.getElementById('mobile-nav-scrim');
  const mobileClose  = document.getElementById('mobile-nav-close');

  function openMobileNav() {
    if (!mobileNav) return;
    mobileNav.classList.add('is-open');
    mobileNav.setAttribute('aria-hidden', 'false');
    if (mobileBtn) { mobileBtn.classList.add('is-open'); mobileBtn.setAttribute('aria-expanded', 'true'); }
    document.body.style.overflow = 'hidden';
  }
  function closeMobileNav() {
    if (!mobileNav) return;
    mobileNav.classList.remove('is-open');
    mobileNav.setAttribute('aria-hidden', 'true');
    if (mobileBtn) { mobileBtn.classList.remove('is-open'); mobileBtn.setAttribute('aria-expanded', 'false'); }
    document.body.style.overflow = '';
  }
  if (mobileBtn) mobileBtn.addEventListener('click', openMobileNav);
  if (mobileClose) mobileClose.addEventListener('click', closeMobileNav);
  if (mobileScrim) mobileScrim.addEventListener('click', closeMobileNav);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileNav(); });

  // Auth state
  if (typeof Auth !== 'undefined') Auth.updateHeaderState();
  Cart.updateBadge();

  // Scroll reveal
  const revealEls = document.querySelectorAll('.hawt-reveal');
  if (revealEls.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); observer.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    revealEls.forEach(el => observer.observe(el));
  }
})();

function renderCartDrawer() {
  const body = document.getElementById('cart-body');
  const title = document.getElementById('cart-title');
  const footer = document.getElementById('cart-footer');
  if (!body) return;

  const items = Cart.get();
  const n = items.length;

  if (title) title.textContent = n === 0 ? "bag's empty." : `${n} piece${n > 1 ? 's' : ''}`;

  if (n === 0) {
    body.innerHTML = `
      <div class="hawt-cart__empty">
        <p>nothing in here yet.</p>
        <p class="hawt-cart__empty-sub">go pick something.</p>
      </div>`;
    if (footer) footer.innerHTML = '';
    return;
  }

  body.innerHTML = items.map(it => `
    <div class="hawt-cart__row">
      <div class="hawt-cart__row-img">
        <img src="${escapeHTML(it.image_url)}" alt="${escapeHTML(it.name)}" loading="lazy">
      </div>
      <div class="hawt-cart__row-info">
        <div class="hawt-cart__row-name">${escapeHTML(it.name)}</div>
        <div class="hawt-cart__row-sub">size ${escapeHTML(it.size)} · ${escapeHTML(it.sub)}</div>
        <div class="hawt-cart__qty">
          <button onclick="cartQty('${it.product_id}','${it.size}',-1)" aria-label="decrease">${icon('minus', 12)}</button>
          <span>${it.quantity}</span>
          <button onclick="cartQty('${it.product_id}','${it.size}',1)" aria-label="increase">${icon('plus', 12)}</button>
        </div>
        <button class="hawt-cart__remove" onclick="cartRemove('${it.product_id}','${it.size}')">remove</button>
      </div>
      <div class="hawt-cart__row-price">${Cart.inr(it.price_at_purchase * it.quantity)}</div>
    </div>`).join('');

  const sub = Cart.subtotal();
  if (footer) {
    footer.innerHTML = `
      <div class="hawt-cart__totals">
        <div><span>subtotal</span><span>${Cart.inr(sub)}</span></div>
        <div class="hawt-cart__totals-meta">shipping calculated at checkout · taxes included</div>
      </div>
      <button class="hawt-btn hawt-btn--primary hawt-cart__checkout" onclick="cartCheckout()">
        checkout — ${Cart.inr(sub)}
      </button>
      <button class="hawt-link hawt-cart__continue" onclick="closeCart()">continue browsing →</button>`;
  }
}

function cartQty(id, size, delta) {
  Cart.updateQty(id, size, delta);
  renderCartDrawer();
}

function cartRemove(id, size) {
  Cart.remove(id, size);
  renderCartDrawer();
}

function cartCheckout() {
  if (!API.isLoggedIn()) {
    window.location.href = './auth.html?redirect=cart.html';
    return;
  }
  window.location.href = './cart.html';
  closeCart();
}
