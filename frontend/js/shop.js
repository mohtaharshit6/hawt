(async function () {
  let allProducts = [];
  let fetchFailed = false;
  let activeFilter = 'all';

  // Read preset category from URL (?cat=Shirts, ?cat=New%20In, etc.)
  const params = new URLSearchParams(window.location.search);
  const urlCat = (params.get('cat') || '').trim();
  if (urlCat) activeFilter = urlCat;

  try {
    const res = await API.get('/products');
    allProducts = res.data || res;
  } catch (e) {
    console.error('Could not load products', e);
    fetchFailed = true;
  }

  window.__hawt_productMap = {};
  allProducts.forEach(p => { window.__hawt_productMap[p.id] = p; });

  function tileHTML(p) {
    const priceHTML = p.sale_price
      ? `<span class="hawt-tile__price-sale">${inr(p.sale_price)}</span><span class="hawt-tile__price-orig">${inr(p.base_price)}</span>`
      : inr(p.base_price);

    let badgeText = p.badge || '';
    if (!badgeText && p.is_new_in) badgeText = 'New In';
    if (!badgeText && p.is_on_sale) badgeText = 'Sale';
    if (!badgeText && p.is_clearance) badgeText = 'Clearance';
    const badge = badgeText ? `<div class="hawt-tile__badge">${badgeText}</div>` : '';
    const discChip = p.discount_percentage > 0
      ? `<div class="hawt-tile__disc-chip">${p.discount_percentage}% OFF</div>`
      : '';
    const altImg = p.alt_image_url
      ? `<img class="hawt-tile__img hawt-tile__img--alt" src="${p.alt_image_url}" alt="" loading="lazy">`
      : '';

    const qaContent = Array.isArray(p.sizes) && p.sizes.length
      ? p.sizes.map(s =>
          `<button class="hawt-tile__qa-btn" onclick="tileAddToCart(event,'${p.id}','${s}')">${s}</button>`
        ).join('')
      : `<span class="hawt-tile__qa-text">view product</span>`;

    return `
      <div class="hawt-tile hawt-reveal">
        <a href="./product.html?id=${p.id}" class="hawt-tile__link">
          <div class="hawt-tile__image">
            <img class="hawt-tile__img hawt-tile__img--main" src="${p.image_url || ''}" alt="${p.name}">
            ${altImg}
            ${badge}
            ${discChip}
            <button class="hawt-tile__wish" data-wish-id="${p.id}" onclick="tileToggleWish(event,'${p.id}')" aria-label="save to wishlist" aria-pressed="false">${icon('heart', 18)}</button>
            <div class="hawt-tile__qa">${qaContent}</div>
          </div>
        </a>
        <div class="hawt-tile__meta">
          <div class="hawt-tile__name">${p.name}</div>
          <div class="hawt-tile__price">${priceHTML}</div>
        </div>
        ${p.sub ? `<div class="hawt-tile__sub">${p.sub}</div>` : ''}
      </div>`;
  }

  function normalise(str) {
    return (str || '').toLowerCase().trim();
  }

  function render() {
    const filter = normalise(activeFilter);
    let visible;
    if (filter === 'all') {
      visible = allProducts;
    } else if (filter === 'new in') {
      visible = allProducts.filter(p => p.is_new_in);
    } else if (filter === 'sale') {
      visible = allProducts.filter(p => p.is_on_sale);
    } else if (filter === 'clearance') {
      visible = allProducts.filter(p => p.is_clearance);
    } else {
      visible = allProducts.filter(p => normalise(p.category) === filter);
    }

    const grid    = document.getElementById('shop-grid');
    const countEl = document.getElementById('product-count');

    if (grid) {
      if (fetchFailed) {
        grid.innerHTML = `
          <div style="grid-column:1/-1;padding:80px 0;text-align:center;color:var(--hawt-ash);">
            <div style="font-family:var(--hawt-font-display);font-size:48px;text-transform:uppercase;margin-bottom:16px;">couldn't load products</div>
            <div style="font-size:14px;">make sure the server is running at <code style="font-family:var(--hawt-font-mono);background:rgba(0,0,0,0.06);padding:2px 6px;">http://localhost:3000</code></div>
          </div>`;
      } else if (visible.length === 0 && filter !== 'all') {
        grid.innerHTML = `
          <div style="grid-column:1/-1;padding:80px 0;text-align:center;color:var(--hawt-ash);">
            <div style="font-family:var(--hawt-font-display);font-size:48px;text-transform:uppercase;margin-bottom:16px;">no products found</div>
            <div style="font-size:14px;">nothing in this category right now. <a href="./shop.html" style="color:var(--hawt-ink);text-decoration:underline;">view all →</a></div>
          </div>`;
      } else {
        grid.innerHTML = visible.map(tileHTML).join('');
      }
    }
    if (countEl) countEl.textContent = visible.length;
    if (typeof Wishlist !== 'undefined') Wishlist.updateHearts();

    // Make newly injected tiles visible (hawt-reveal starts at opacity:0)
    document.querySelectorAll('.hawt-reveal:not(.is-in)').forEach(el => {
      setTimeout(() => el.classList.add('is-in'), 50);
    });
  }

  // Wire up filter pills
  document.querySelectorAll('[data-filter]').forEach(btn => {
    if (normalise(btn.dataset.filter) === normalise(activeFilter)) {
      btn.classList.add('hawt-pill--sel');
    }

    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('hawt-pill--sel'));
      btn.classList.add('hawt-pill--sel');
      render();
    });
  });

  render();
})();
