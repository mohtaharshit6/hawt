(async function () {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { window.location.href = './shop.html'; return; }

  let product, allProducts;
  try {
    const [productRes, allRes] = await Promise.all([
      API.get(`/products/${id}`),
      API.get('/products'),
    ]);
    product     = productRes;
    allProducts = allRes.data || allRes;
  } catch (e) {
    document.getElementById('pdp-root').innerHTML =
      `<div style="padding:120px var(--hawt-page-x);text-align:center;color:var(--hawt-ash);">this fit doesn't exist. <a href="./shop.html" style="color:var(--hawt-ink);">back to the line →</a></div>`;
    return;
  }

  document.title = `${product.name} — HAWT!`;

  // Expose to window so tileAddToCart works for related-product tiles
  window.__hawt_productMap = window.__hawt_productMap || {};
  allProducts.forEach(p => { window.__hawt_productMap[p.id] = p; });

  // Derive sizes and out-of-stock from variants returned by the updated API
  const variants   = product.variants || [];
  const sizes      = variants.map(v => v.size);
  const outOfStock = variants.filter(v => v.stock_qty - v.reserved_qty <= 0).map(v => v.size);
  const totalATS   = variants.reduce((sum, v) => sum + Math.max(0, v.stock_qty - v.reserved_qty), 0);

  const gallery  = [product.image_url, product.alt_image_url].filter(Boolean);
  const related  = allProducts.filter(p =>
    p.id !== product.id &&
    (p.category || '').toLowerCase().trim() === (product.category || '').toLowerCase().trim()
  ).slice(0, 4);
  let selectedSize = null;

  const SPECS = {
    'Dresses':     [['Fabric','Soft woven · breathable blend'],['Occasion','Casual / Semi-formal'],['Care','Machine wash cold, gentle cycle']],
    'Shirts':      [['Fabric','100% Cotton · 240 GSM'],['Occasion','Casual / Streetwear'],['Sleeve','Half Sleeve'],['Neckline','Round Neck'],['Care','Machine wash cold']],
    'Bottoms':     [['Fabric','Stretch twill · cotton blend'],['Occasion','Casual / Everyday'],['Care','Machine wash cold, inside out']],
    'Co-ords':     [['Fabric','Textured fabric · poly-cotton blend'],['Occasion','Casual / Party'],['Care','Dry clean recommended']],
    'Accessories': null,
    'New In':      [['Fabric','Premium cotton blend'],['Occasion','Versatile'],['Care','Machine wash cold']],
    'Sale':        [['Fabric','Varies by style'],['Care','See garment label']],
    'Clearance':   [['Fabric','Varies by style'],['Care','See garment label']],
  };

  function specsHTML() {
    const rows = SPECS[product.category];
    if (!rows) return '';
    return `
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:12px;">
        <tbody>
          ${rows.map(([k,v]) => `
          <tr style="border-bottom:1px solid var(--hawt-hairline);">
            <td style="padding:10px 0;color:var(--hawt-ash);font-weight:600;letter-spacing:0.1em;text-transform:uppercase;font-size:10px;width:40%;">${k}</td>
            <td style="padding:10px 0;color:var(--hawt-ink);">${v}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  function priceHTML() {
    if (product.sale_price) {
      const discLabel = product.discount_percentage > 0
        ? ` <span style="background:#c0392b;color:#fff;font-family:var(--hawt-font-mono);font-size:10px;letter-spacing:0.08em;padding:3px 7px;margin-left:8px;">${product.discount_percentage}% OFF</span>`
        : '';
      return `<span style="color:#c0392b;">${inr(product.sale_price)}</span>
              <span style="text-decoration:line-through;opacity:0.45;font-size:15px;margin-left:6px;">${inr(product.base_price)}</span>${discLabel}`;
    }
    return inr(product.base_price);
  }

  function thumbsHTML() {
    return gallery.map((src, i) => `
      <button class="hawt-pdp__thumb ${i === 0 ? 'is-sel' : ''}" data-shot="${i}" onclick="selectShot(${i})">
        <img src="${src}" alt="" loading="lazy">
      </button>`).join('');
  }

  function shotsHTML() {
    return gallery.map((src, i) => `
      <div class="hawt-pdp__shot ${i === 0 ? 'is-active' : ''}" id="shot-${i}">
        <div style="width:100%;aspect-ratio:4/5;overflow:hidden;background:var(--hawt-pure);">
          <img src="${src}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;" loading="${i === 0 ? 'eager' : 'lazy'}">
        </div>
      </div>`).join('');
  }

  function sizesHTML() {
    if (!sizes.length) {
      return `<div style="font-size:12px;color:var(--hawt-ash);">one size</div>`;
    }
    return sizes.map(s => {
      const out = outOfStock.includes(s);
      return `<button
        class="hawt-chip ${out ? 'hawt-chip--out' : ''}"
        data-size="${s}"
        ${out ? 'disabled' : ''}
        onclick="selectSize('${s}')"
      >${s}</button>`;
    }).join('');
  }

  function tileHTML(p) {
    const priceH = p.sale_price
      ? `<span class="hawt-tile__price-sale">${inr(p.sale_price)}</span><span class="hawt-tile__price-orig">${inr(p.base_price)}</span>`
      : inr(p.base_price);
    const qaContent = Array.isArray(p.sizes) && p.sizes.length
      ? p.sizes.map(s => `<button class="hawt-tile__qa-btn" onclick="tileAddToCart(event,'${p.id}','${s}')">${s}</button>`).join('')
      : `<span class="hawt-tile__qa-text">view product</span>`;
    return `
      <div class="hawt-tile">
        <a href="./product.html?id=${p.id}" class="hawt-tile__link">
          <div class="hawt-tile__image">
            <img class="hawt-tile__img hawt-tile__img--main" src="${p.image_url || ''}" alt="${p.name}">
            ${p.alt_image_url ? `<img class="hawt-tile__img hawt-tile__img--alt" src="${p.alt_image_url}" alt="" loading="lazy">` : ''}
            ${p.badge ? `<div class="hawt-tile__badge">${p.badge}</div>` : ''}
            ${p.discount_percentage > 0 ? `<div class="hawt-tile__disc-chip">${p.discount_percentage}% OFF</div>` : ''}
            <div class="hawt-tile__qa">${qaContent}</div>
          </div>
        </a>
        <div class="hawt-tile__meta">
          <div class="hawt-tile__name">${p.name}</div>
          <div class="hawt-tile__price">${priceH}</div>
        </div>
        ${p.sub ? `<div class="hawt-tile__sub">${p.sub}</div>` : ''}
      </div>`;
  }

  const urgencyHTML = totalATS > 0 && totalATS < 20
    ? `<div style="font-size:12px;font-weight:600;color:#c0392b;letter-spacing:0.06em;margin-bottom:16px;">Only ${totalATS} left in stock — order soon.</div>`
    : '';

  const REVIEW_POOL = [
    { rating: '4.5', stars: '★★★★½', count: '38 reviews · 81% five-star', items: [
      {name:'Priya S.',     stars:'★★★★★', text:'Absolutely love it! The fit is perfect and the fabric quality is amazing. Wore it to a dinner and got so many compliments.',date:'12 May 2026'},
      {name:'Arjun M.',     stars:'★★★★☆', text:'Great quality, slightly larger than expected but still a great buy. The colour is exactly as shown.',date:'3 May 2026'},
      {name:'Ritu K.',      stars:'★★★★★', text:'Best purchase of the year. Super comfortable and the material is so soft. Fits true to size.',date:'28 Apr 2026'},
    ]},
    { rating: '4.2', stars: '★★★★☆', count: '24 reviews · 71% five-star', items: [
      {name:'Meera T.',     stars:'★★★★★', text:'Stunning piece — the cut is very flattering and the colour is rich. Delivery was fast too!',date:'18 May 2026'},
      {name:'Karan D.',     stars:'★★★☆☆', text:'Nice design, the fabric is a bit thin for the price but overall a decent purchase.',date:'10 May 2026'},
      {name:'Sneha R.',     stars:'★★★★★', text:'Ordered for a wedding and everyone asked where I got it. Will definitely buy more from HAWT!',date:'1 May 2026'},
    ]},
    { rating: '4.7', stars: '★★★★★', count: '52 reviews · 88% five-star', items: [
      {name:'Ishaan V.',    stars:'★★★★★', text:'Premium feel, amazing stitching. This is the kind of quality I was hoping for and it exceeded expectations.',date:'20 May 2026'},
      {name:'Ananya P.',    stars:'★★★★★', text:'Fits like a dream. I sized down and it is perfect. Fast shipping, great packaging.',date:'15 May 2026'},
      {name:'Rahul N.',     stars:'★★★★☆', text:'Really happy with the quality. The fabric does not wrinkle easily and is comfortable all day.',date:'5 May 2026'},
    ]},
  ];

  const reviewSet = REVIEW_POOL[product.id.charCodeAt(0) % 3];

  const reviewsHTML = `
    <section style="padding:48px var(--hawt-page-x);border-top:1px solid var(--hawt-hairline);background:var(--hawt-bone);">
      <div style="max-width:760px;margin:0 auto;">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:32px;">
          <div style="font-family:var(--hawt-font-display);font-size:48px;line-height:1;">${reviewSet.rating}</div>
          <div>
            <div style="color:var(--hawt-sand);font-size:18px;letter-spacing:2px;">${reviewSet.stars}</div>
            <div style="font-size:12px;color:var(--hawt-ash);margin-top:2px;font-family:var(--hawt-font-mono);">${reviewSet.count}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:20px;">
          ${reviewSet.items.map(r => `
          <div style="padding:20px;border:1px solid var(--hawt-hairline);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div>
                <span style="font-weight:600;font-size:13px;">${r.name}</span>
                <span style="color:var(--hawt-sand);margin-left:8px;font-size:13px;">${r.stars}</span>
              </div>
              <span style="font-size:11px;color:var(--hawt-ash);font-family:var(--hawt-font-mono);">${r.date}</span>
            </div>
            <p style="font-size:13px;color:var(--hawt-ink);line-height:1.6;margin:0;">${r.text}</p>
          </div>`).join('')}
        </div>
      </div>
    </section>`;

  const relatedHTML = related.length
    ? `<section class="hawt-section hawt-section--bone">
        <div class="hawt-section__head">
          <div class="hawt-meta">— you might also like</div>
          <h2 class="hawt-display-lg">related pieces</h2>
        </div>
        <div class="related-grid">${related.map(tileHTML).join('')}</div>
       </section>`
    : '';

  document.getElementById('pdp-root').innerHTML = `
    <div class="hawt-pdp__crumb">
      <a href="./shop.html" style="color:var(--hawt-ash);text-decoration:none;">shop</a>
      <span class="hawt-pdp__crumb-sep">/</span>
      <a href="./shop.html?cat=${encodeURIComponent(product.category)}" style="color:var(--hawt-ash);text-decoration:none;">${product.category}</a>
      <span class="hawt-pdp__crumb-sep">/</span>
      <span class="hawt-pdp__crumb-now">${product.name}</span>
    </div>

    <div class="hawt-pdp__main">
      <div class="hawt-pdp__gallery">
        <div class="hawt-pdp__thumbs">${thumbsHTML()}</div>
        <div class="hawt-pdp__shots">${shotsHTML()}</div>
      </div>

      <aside class="hawt-pdp__info">
        <div class="hawt-pdp__info-stick">
          <div class="hawt-meta">— drop / 03 · ${product.category}</div>
          <h1 class="hawt-pdp__title">${product.name}</h1>
          <div class="hawt-pdp__sub">${product.sub || ''}</div>
          <div class="hawt-pdp__price-row">
            <div class="hawt-pdp__price">${priceHTML()}</div>
            <div class="hawt-pdp__tax">inclusive of all taxes</div>
          </div>

          ${urgencyHTML}

          <div class="hawt-pdp__size-head">
            <div class="hawt-pdp__size-label">select size</div>
            <button class="hawt-pdp__guide">size guide</button>
          </div>
          <div class="hawt-pdp__sizes">${sizesHTML()}</div>
          <div id="size-error" style="font-size:12px;color:#c0392b;margin-bottom:12px;display:none;">select a size to continue</div>

          <button class="hawt-btn hawt-btn--primary hawt-pdp__add" id="add-btn" onclick="handleAddToBag()">
            add to bag
          </button>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:20px 0;text-align:center;">
            <div style="border:1px solid var(--hawt-hairline);padding:12px 8px;">
              <div style="font-size:18px;margin-bottom:4px;">🚚</div>
              <div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--hawt-ink);">Free Shipping</div>
              <div style="font-size:10px;color:var(--hawt-ash);margin-top:2px;">over ₹2,499</div>
            </div>
            <div style="border:1px solid var(--hawt-hairline);padding:12px 8px;">
              <div style="font-size:18px;margin-bottom:4px;">💵</div>
              <div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--hawt-ink);">Cash on Delivery</div>
              <div style="font-size:10px;color:var(--hawt-ash);margin-top:2px;">available</div>
            </div>
            <div style="border:1px solid var(--hawt-hairline);padding:12px 8px;">
              <div style="font-size:18px;margin-bottom:4px;">↩️</div>
              <div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--hawt-ink);">14-Day Returns</div>
              <div style="font-size:10px;color:var(--hawt-ash);margin-top:2px;">no questions</div>
            </div>
          </div>

          <div class="hawt-pdp__pin">
            <div class="hawt-meta" style="margin-bottom:10px;">check delivery</div>
            <form onsubmit="checkPin(event)">
              <input type="text" inputmode="numeric" maxlength="6" placeholder="enter pincode" id="pin-input">
              <button type="submit">check</button>
            </form>
            <div id="pin-result" class="hawt-pdp__pin-result"></div>
          </div>

          <hr class="hawt-hr">

          <p class="hawt-pdp__desc">${product.description || ''}</p>

          ${specsHTML()}

          <div class="hawt-acc">
            <button class="hawt-acc__head" onclick="toggleAcc(this)">
              <span>product details</span>
              <span class="hawt-acc__sign">+</span>
            </button>
            <div class="hawt-acc__body" style="display:none;">
              <p>${product.description || 'No additional details.'}</p>
            </div>
          </div>
          <div class="hawt-acc">
            <button class="hawt-acc__head" onclick="toggleAcc(this)">
              <span>shipping &amp; returns</span>
              <span class="hawt-acc__sign">+</span>
            </button>
            <div class="hawt-acc__body" style="display:none;">
              <p>free shipping on orders above ₹2,499. standard delivery 4–7 business days.</p>
              <p>14-day returns. items must be unworn and in original packaging.</p>
            </div>
          </div>
          <div class="hawt-acc">
            <button class="hawt-acc__head" onclick="toggleAcc(this)">
              <span>care instructions</span>
              <span class="hawt-acc__sign">+</span>
            </button>
            <div class="hawt-acc__body" style="display:none;">
              <p>machine wash cold, gentle cycle. do not tumble dry. iron inside out on low heat.</p>
            </div>
          </div>
        </div>
      </aside>
    </div>

    ${reviewsHTML}

    ${relatedHTML}

    <footer class="hawt-footer">
      <div class="hawt-footer-cols5">
        <div><div class="hawt-footer-cols5__head">About HAWT!</div><a href="#">brand story</a><a href="#">made in tirupur</a></div>
        <div><div class="hawt-footer-cols5__head">Help</div><a href="./orders.html">track order</a><a href="#">returns</a><a href="#">shipping</a></div>
        <div><div class="hawt-footer-cols5__head">Services</div><a href="#">faq</a><a href="#">size guide</a></div>
        <div><div class="hawt-footer-cols5__head">Explore</div><a href="#">our story</a><a href="#">lookbook</a></div>
        <div><div class="hawt-footer-cols5__head">Follow Us</div><a href="#">instagram</a><a href="#">tiktok</a></div>
      </div>
      <div class="hawt-footer__bottom" style="border-top:1px solid rgba(244,241,236,0.15);padding:24px var(--hawt-page-x);">
        <div class="hawt-footer__bottom-left"><span>© hawt 2026</span><span class="hawt-footer__dot">·</span><span style="color:rgba(244,241,236,0.4);font-size:12px;">made in tirupur</span></div>
        <div class="hawt-footer__social">
          <a class="hawt-footer__social-text" style="cursor:pointer;">INSTAGRAM</a>
          <a class="hawt-footer__social-text" style="cursor:pointer;">TIKTOK</a>
        </div>
      </div>
      <div class="hawt-footer__wordmark">HAWT<span>!</span></div>
    </footer>`;

  window.selectShot = function (i) {
    document.querySelectorAll('.hawt-pdp__thumb').forEach((t, idx) => t.classList.toggle('is-sel', idx === i));
    document.querySelectorAll('.hawt-pdp__shot').forEach((s, idx) => s.classList.toggle('is-active', idx === i));
  };

  window.selectSize = function (s) {
    selectedSize = s;
    document.querySelectorAll('[data-size]').forEach(btn => btn.classList.toggle('hawt-chip--sel', btn.dataset.size === s));
    document.getElementById('size-error').style.display = 'none';
  };

  window.handleAddToBag = function () {
    if (!sizes.length) {
      // No variants (one-size item) — add directly
      Cart.add(product, 'One Size');
    } else {
      if (!selectedSize) {
        document.getElementById('size-error').style.display = 'block';
        return;
      }
      Cart.add(product, selectedSize);
    }
    const btn = document.getElementById('add-btn');
    btn.textContent = 'added!';
    setTimeout(() => { btn.textContent = 'add to bag'; }, 1800);
    if (typeof openCart === 'function') openCart();
  };

  window.checkPin = function (e) {
    e.preventDefault();
    const val = document.getElementById('pin-input').value.trim();
    const res = document.getElementById('pin-result');
    if (val.length === 6 && /^\d+$/.test(val)) {
      const d1 = new Date(); d1.setDate(d1.getDate() + 4);
      const d2 = new Date(); d2.setDate(d2.getDate() + 7);
      const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      res.style.color = 'var(--hawt-ink)';
      res.textContent = `delivered between ${fmt(d1)} – ${fmt(d2)}`;
    } else {
      res.style.color = '#c0392b';
      res.textContent = 'enter a valid 6-digit pincode';
    }
  };

  window.toggleAcc = function (btn) {
    const body = btn.nextElementSibling;
    const sign = btn.querySelector('.hawt-acc__sign');
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    if (sign) sign.textContent = open ? '+' : '−';
  };
})();
