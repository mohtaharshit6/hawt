(async function () {
  let products = [];
  let fetchFailed = false;

  try {
    const res = await API.get('/products');
    products = res.data || res;
  } catch (e) {
    console.error('Could not load products', e);
    fetchFailed = true;
  }

  window.__hawt_productMap = window.__hawt_productMap || {};
  products.forEach(p => { window.__hawt_productMap[p.id] = p; });

  function tileHTML(p) {
    const priceHTML = p.sale_price
      ? `<span class="hawt-tile__price-sale">${inr(p.sale_price)}</span><span class="hawt-tile__price-orig">${inr(p.base_price)}</span>`
      : inr(p.base_price);

    const badge = p.badge ? `<div class="hawt-tile__badge">${p.badge}</div>` : '';
    const altImg = p.alt_image_url
      ? `<img class="hawt-tile__img hawt-tile__img--alt" src="${p.alt_image_url}" alt="" loading="lazy">`
      : '';

    const qaContent = Array.isArray(p.sizes) && p.sizes.length
      ? p.sizes.map(s =>
          `<button class="hawt-tile__qa-btn" onclick="tileAddToCart(event,'${p.id}','${s}')">${s}</button>`
        ).join('')
      : `<span class="hawt-tile__qa-text">view product</span>`;

    return `
      <div class="hawt-tile">
        <a href="./product.html?id=${p.id}" class="hawt-tile__link">
          <div class="hawt-tile__image">
            <img class="hawt-tile__img hawt-tile__img--main" src="${p.image_url || ''}" alt="${p.name}">
            ${altImg}
            ${badge}
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

  const featured = products.slice(0, 4);
  const featuredEl = document.getElementById('featured-grid');

  if (featuredEl) {
    if (fetchFailed) {
      featuredEl.innerHTML = `
        <div style="grid-column:1/-1;padding:60px 0;text-align:center;color:var(--hawt-ash);">
          <div style="font-family:var(--hawt-font-display);font-size:40px;text-transform:uppercase;margin-bottom:12px;">couldn't load products</div>
          <div style="font-size:13px;">make sure the server is running at <code style="font-family:var(--hawt-font-mono);background:rgba(0,0,0,0.06);padding:2px 6px;">http://localhost:3000</code></div>
        </div>`;
    } else {
      featuredEl.innerHTML = featured.map(tileHTML).join('');
    }
  }
})();
