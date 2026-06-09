(function () {

  // ── State ──────────────────────────────────────────────────────────────────
  let step         = 1;     // 1 = bag, 2 = address, 3 = payment
  let promoApplied = false;
  let paymentMode  = 'upi'; // default selected method

  const addr = { name:'', phone:'', line1:'', line2:'', city:'', state:'', pincode:'' };

  // ── Helpers ────────────────────────────────────────────────────────────────
  function totals() {
    const sub      = Cart.subtotal();
    const discount = promoApplied ? Math.round(sub * 0.1) : 0;
    const after    = sub - discount;
    const shipping = after >= 2499 ? 0 : 199;
    return { sub, discount, shipping, total: after + shipping };
  }

  // ── Step indicator ─────────────────────────────────────────────────────────
  function stepsHTML(active) {
    return `
      <div style="display:flex;align-items:center;gap:0;margin-bottom:48px;">
        ${['bag','address','payment'].map((l,i) => {
          const n=i+1, cur=n===active, done=n<active;
          const col = cur?'var(--hawt-ink)':done?'var(--hawt-sand)':'var(--hawt-ash)';
          const sep = i<2?`<span style="margin:0 14px;color:var(--hawt-hairline);font-size:18px;">→</span>`:'';
          return `<span style="font-family:var(--hawt-font-mono);font-size:11px;letter-spacing:0.14em;
            text-transform:uppercase;color:${col};font-weight:${cur?600:400};">${n}. ${l}</span>${sep}`;
        }).join('')}
      </div>`;
  }

  // ── Step 1 — Bag ───────────────────────────────────────────────────────────
  function renderBag(root, titleEl) {
    const items = Cart.get();
    if (!items.length) { renderEmpty(root, titleEl); return; }
    if (titleEl) titleEl.textContent = 'my bag';
    const { sub, discount, shipping, total } = totals();

    const rows = items.map(it => `
      <div class="cart-row">
        <div class="cart-row__img"><img src="${escapeHTML(it.image_url||'')}" alt="${escapeHTML(it.name)}" loading="lazy"></div>
        <div>
          <div class="cart-row__name">${escapeHTML(it.name)}</div>
          <div class="cart-row__sub">size ${escapeHTML(it.size)}${it.sub?' · '+escapeHTML(it.sub):''}</div>
          <div class="cart-qty">
            <button onclick="cpQty('${it.product_id}','${it.size}',-1)" aria-label="−">${icon('minus',13)}</button>
            <span>${it.quantity}</span>
            <button onclick="cpQty('${it.product_id}','${it.size}',1)" aria-label="+">${icon('plus',13)}</button>
          </div>
          <button class="cart-remove" onclick="cpRemove('${it.product_id}','${it.size}')">remove</button>
        </div>
        <div class="cart-row__price">${inr(it.price_at_purchase*it.quantity)}</div>
      </div>`).join('');

    root.innerHTML = `
      ${stepsHTML(1)}
      <div class="cart-page__layout">
        <div class="cart-items">${rows}</div>
        <div class="cart-summary">
          <div class="cart-summary__row">
            <span class="cart-summary__label">subtotal</span>
            <span class="cart-summary__value">${inr(sub)}</span>
          </div>
          ${discount?`<div class="cart-summary__row">
            <span class="cart-summary__label" style="color:#1a4731;">promo (HAWT10)</span>
            <span class="cart-summary__value" style="color:#1a4731;">−${inr(discount)}</span>
          </div>`:''}
          <div class="cart-summary__row">
            <span class="cart-summary__label">shipping</span>
            <span class="cart-summary__value">${shipping===0?'free':inr(shipping)}</span>
          </div>
          <div class="cart-summary__row" style="border-bottom:0;padding-top:16px;">
            <span class="cart-summary__total">total</span>
            <span class="cart-summary__total">${inr(total)}</span>
          </div>
          <div class="cart-summary__meta">taxes included · free shipping over ₹2,499</div>
          <div style="display:flex;gap:0;margin-bottom:8px;">
            <input type="text" id="promo-input" placeholder="discount code"
              style="flex:1;border:1px solid var(--hawt-hairline);background:transparent;
                     padding:11px 14px;font-family:var(--hawt-font-body);font-size:12px;
                     color:var(--hawt-ink);outline:none;letter-spacing:0.06em;"
              value="${promoApplied?'HAWT10':''}" ${promoApplied?'disabled':''}>
            <button onclick="applyPromo()"
              style="background:var(--hawt-ink);color:var(--hawt-bone);border:1px solid var(--hawt-ink);
                     padding:11px 18px;font-size:11px;font-weight:600;letter-spacing:0.12em;
                     text-transform:lowercase;cursor:pointer;white-space:nowrap;"
              ${promoApplied?'disabled':''}>apply</button>
          </div>
          <div id="promo-msg" style="font-size:12px;margin-bottom:12px;
            ${promoApplied?'display:block;color:#1a4731;':'display:none;'}">
            ${promoApplied?'10% off applied — HAWT10':''}
          </div>
          <button class="hawt-btn hawt-btn--primary cart-checkout-btn" onclick="cpGoAddress()">
            proceed to checkout →
          </button>
          <a href="./shop.html" class="hawt-link" style="display:block;text-align:center;margin-top:16px;">
            continue shopping →
          </a>
        </div>
      </div>`;
  }

  // ── Step 2 — Address ───────────────────────────────────────────────────────
  function renderAddress(root, titleEl) {
    if (titleEl) titleEl.textContent = 'delivery address';
    const v = k => addr[k]?`value="${addr[k].replace(/"/g,'&quot;')}"`:'' ;
    const field = (label,id,type='text',req=true,hint='') => `
      <div class="hawt-field">
        <label class="hawt-field__label" for="addr-${id}">
          ${label}${req?'':' <span style="font-weight:400;opacity:0.5;">(optional)</span>'}
        </label>
        <input class="hawt-input" type="${type}" id="addr-${id}"
          placeholder="${hint||label.toLowerCase()}" ${v(id)} ${req?'required':''}>
      </div>`;
    const states=['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
      'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
      'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
      'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
      'Uttar Pradesh','Uttarakhand','West Bengal',
      'Delhi','Jammu & Kashmir','Ladakh','Puducherry','Chandigarh'];

    root.innerHTML = `
      ${stepsHTML(2)}
      <div style="max-width:640px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
          ${field('Full Name','name','text',true,'as on ID')}
          ${field('Phone Number','phone','tel',true,'10-digit mobile')}
        </div>
        <div style="margin-top:24px;">${field('Address Line 1','line1','text',true,'house / flat / building')}</div>
        <div style="margin-top:24px;">${field('Address Line 2','line2','text',false,'street / area / landmark')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 120px;gap:24px;margin-top:24px;">
          ${field('City','city')}
          <div class="hawt-field">
            <label class="hawt-field__label" for="addr-state">State</label>
            <select id="addr-state" class="hawt-input" required
              style="border:0;border-bottom:1px solid var(--hawt-hairline);border-radius:0;
                     background:transparent;padding:12px 0;appearance:none;cursor:pointer;">
              <option value="">select</option>
              ${states.map(s=>`<option value="${s}" ${addr.state===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          ${field('Pincode','pincode','text',true,'6 digits')}
        </div>
        <div id="addr-error" style="color:#c0392b;font-size:12px;margin-top:16px;display:none;"></div>
        <div style="display:flex;gap:16px;margin-top:40px;">
          <button class="hawt-btn hawt-btn--secondary" onclick="cpGoBack(1)">← back to bag</button>
          <button class="hawt-btn hawt-btn--primary" onclick="cpSaveAddress()" style="flex:1;">
            continue to payment →
          </button>
        </div>
      </div>`;
  }

  // ── Step 3 — Payment ───────────────────────────────────────────────────────
  function renderPayment(root, titleEl) {
    if (titleEl) titleEl.textContent = 'payment';
    const { sub, discount, shipping, total } = totals();
    const items = Cart.get();

    const methods = [
      { id:'upi',     label:'UPI / Google Pay',    icon:'📲', sub:'PhonePe · GPay · Paytm · BHIM' },
      { id:'card',    label:'Credit / Debit Card',  icon:'💳', sub:'Visa · Mastercard · RuPay · Amex' },
      { id:'netbank', label:'Net Banking',           icon:'🏦', sub:'All major Indian banks' },
      { id:'cod',     label:'Cash on Delivery',      icon:'💵', sub:'Pay when your order arrives' },
    ];

    const methodsHTML = methods.map(m => `
      <label style="display:flex;align-items:center;gap:16px;padding:18px 20px;
                    border:1px solid ${paymentMode===m.id?'var(--hawt-ink)':'var(--hawt-hairline)'};
                    cursor:pointer;margin-bottom:8px;transition:border-color 0.15s;
                    background:${paymentMode===m.id?'var(--hawt-ink)':'transparent'};">
        <input type="radio" name="pay-method" value="${m.id}" ${paymentMode===m.id?'checked':''}
          onchange="cpSetPayment('${m.id}')"
          style="accent-color:var(--hawt-bone);width:16px;height:16px;flex-shrink:0;">
        <span style="font-size:20px;flex-shrink:0;">${m.icon}</span>
        <div>
          <div style="font-size:13px;font-weight:500;letter-spacing:0.04em;
                      color:${paymentMode===m.id?'var(--hawt-bone)':'var(--hawt-ink)'};">${m.label}</div>
          <div style="font-size:10px;margin-top:2px;
                      color:${paymentMode===m.id?'rgba(244,241,236,0.55)':'var(--hawt-ash)'};">${m.sub}</div>
        </div>
      </label>`).join('');

    const itemLines = items.slice(0,3).map(it =>
      `<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;
                   border-bottom:1px solid var(--hawt-hairline);">
         <span>${it.name} <span style="color:var(--hawt-ash);">×${it.quantity}</span></span>
         <span style="font-family:var(--hawt-font-mono);">${inr(it.price_at_purchase*it.quantity)}</span>
       </div>`).join('')
      + (items.length>3?`<div style="font-size:11px;color:var(--hawt-ash);padding:6px 0;">…and ${items.length-3} more</div>`:'');

    root.innerHTML = `
      ${stepsHTML(3)}
      <div style="display:grid;grid-template-columns:1fr 360px;gap:64px;align-items:start;">
        <div>
          <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;
                      color:var(--hawt-ash);margin-bottom:20px;">how would you like to pay?</div>
          ${methodsHTML}
          <div id="checkout-error" style="color:#c0392b;font-size:12px;margin-top:12px;display:none;"></div>
          <div style="display:flex;gap:16px;margin-top:32px;">
            <button class="hawt-btn hawt-btn--secondary" onclick="cpGoBack(2)">← back</button>
            <button id="place-order-btn" class="hawt-btn hawt-btn--primary" onclick="cpPlaceOrder()"
              style="flex:1;" id="place-order-btn">
              ${paymentMode==='cod'?'place order':'pay'} — ${inr(total)}
            </button>
          </div>
        </div>
        <div class="cart-summary" style="position:sticky;top:140px;">
          <div style="font-family:var(--hawt-font-mono);font-size:10px;letter-spacing:0.16em;
                      text-transform:uppercase;color:var(--hawt-ash);margin-bottom:16px;">order summary</div>
          ${itemLines}
          <div style="margin-top:16px;">
            <div class="cart-summary__row">
              <span class="cart-summary__label">subtotal</span>
              <span class="cart-summary__value">${inr(sub)}</span>
            </div>
            ${discount?`<div class="cart-summary__row">
              <span class="cart-summary__label" style="color:#1a4731;">promo discount</span>
              <span class="cart-summary__value" style="color:#1a4731;">−${inr(discount)}</span>
            </div>`:''}
            <div class="cart-summary__row">
              <span class="cart-summary__label">shipping</span>
              <span class="cart-summary__value">${shipping===0?'free':inr(shipping)}</span>
            </div>
            <div class="cart-summary__row" style="border-bottom:0;padding-top:16px;">
              <span class="cart-summary__total">total</span>
              <span class="cart-summary__total">${inr(total)}</span>
            </div>
            <div class="cart-summary__meta">taxes included</div>
          </div>
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--hawt-hairline);
                      font-size:11px;color:var(--hawt-ash);line-height:1.8;">
            <div>📍 ${escapeHTML(addr.line1)}${addr.line2?', '+escapeHTML(addr.line2):''}</div>
            <div>${escapeHTML(addr.city)}, ${escapeHTML(addr.state)} — ${escapeHTML(addr.pincode)}</div>
            <div style="margin-top:2px;">${escapeHTML(addr.name)} · ${escapeHTML(addr.phone)}</div>
          </div>
        </div>
      </div>`;
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  function renderEmpty(root, titleEl) {
    if (titleEl) titleEl.textContent = 'my bag';
    root.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty__title">your bag is empty.</div>
        <div class="cart-empty__sub">go pick something good.</div>
        <a href="./shop.html" class="hawt-btn hawt-btn--primary">continue shopping</a>
      </div>`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() {
    const root    = document.getElementById('cart-page-root');
    const titleEl = document.getElementById('cart-page-title');
    if (!root) return;
    if (Cart.get().length===0 && step===1) { renderEmpty(root,titleEl); return; }
    switch(step) {
      case 1: renderBag(root,titleEl);     break;
      case 2: renderAddress(root,titleEl); break;
      case 3: renderPayment(root,titleEl); break;
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  window.cpQty    = (id,size,d) => { Cart.updateQty(id,size,d); render(); };
  window.cpRemove = (id,size)   => { Cart.remove(id,size);      render(); };
  window.cpGoBack = (to)        => { step=to;                   render(); };

  window.cpSetPayment = function(mode) {
    paymentMode = mode; render();
  };

  window.cpGoAddress = function() {
    if (!API.isLoggedIn()) { window.location.href='./auth.html?redirect=cart.html'; return; }
    step=2; render();
  };

  window.cpSaveAddress = function() {
    ['name','phone','line1','line2','city','state','pincode'].forEach(k => {
      const el=document.getElementById(`addr-${k}`);
      if (el) addr[k]=el.value.trim();
    });
    const missing=['name','phone','line1','city','state','pincode'].filter(k=>!addr[k]);
    const errEl=document.getElementById('addr-error');
    if (missing.length) {
      if(errEl){errEl.textContent=`please fill in: ${missing.join(', ')}`;errEl.style.display='block';}
      return;
    }
    if (!/^\d{6}$/.test(addr.pincode)) {
      if(errEl){errEl.textContent='pincode must be 6 digits';errEl.style.display='block';}
      return;
    }
    if (!/^\d{10}$/.test(addr.phone.replace(/\D/g,''))) {
      if(errEl){errEl.textContent='phone must be a 10-digit number';errEl.style.display='block';}
      return;
    }
    step=3; render();
  };

  window.applyPromo = function() {
    const input=document.getElementById('promo-input');
    const msg  =document.getElementById('promo-msg');
    if (!input) return;
    if (input.value.trim().toUpperCase()==='HAWT10') {
      promoApplied=true; render();
    } else {
      if(msg){msg.textContent='invalid code. try HAWT10';msg.style.color='#c0392b';msg.style.display='block';}
    }
  };

  // ── Mock Payment Modal ─────────────────────────────────────────────────────
  // Shown only when Razorpay credentials are not configured (rzp_test_mock).
  // Simulates UPI / Card / Net Banking UI so the full flow is testable locally.
  function showMockModal(amountPaise, activeMethod) {
    return new Promise((resolve, reject) => {
      const amountStr = inr(amountPaise / 100);

      const el = document.createElement('div');
      el.id = 'hawt-mock-pay';
      el.style.cssText = `position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.65);
        display:flex;align-items:center;justify-content:center;padding:16px;`;

      const tabStyle = (active) =>
        `flex:1;padding:11px 4px;font-size:10px;font-weight:700;letter-spacing:0.1em;
         text-transform:uppercase;border:0;cursor:pointer;transition:all 0.15s;
         background:transparent;
         border-bottom:${active?'2px solid #0A0A0A':'2px solid transparent'};
         color:${active?'#0A0A0A':'#7A7873'};`;

      el.innerHTML = `
        <div style="background:#fff;width:100%;max-width:400px;
                    box-shadow:0 32px 80px rgba(0,0,0,0.4);overflow:hidden;">

          <!-- Header -->
          <div style="background:#0A0A0A;padding:14px 20px;
                      display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;
                          letter-spacing:0.06em;color:#F4F1EC;">
                HAWT<span style="color:#C9B79C;">!</span> pay
              </div>
              <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;
                          color:rgba(244,241,236,0.45);margin-top:2px;">
                test mode · no real charges
              </div>
            </div>
            <button id="mock-x" style="background:transparent;border:0;color:rgba(244,241,236,0.6);
              cursor:pointer;font-size:24px;padding:0;line-height:1;">×</button>
          </div>

          <!-- Amount banner -->
          <div style="padding:14px 20px;background:#F4F1EC;
                      border-bottom:1px solid #E8E4DE;display:flex;align-items:baseline;gap:10px;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:32px;
                        letter-spacing:0.02em;color:#0A0A0A;">${amountStr}</div>
            <div style="font-size:11px;color:#7A7873;">to pay</div>
          </div>

          <!-- Tabs -->
          <div style="display:flex;border-bottom:2px solid #E8E4DE;background:#fff;">
            <button class="mpay-tab" data-tab="upi"     style="${tabStyle(activeMethod==='upi')}">📲 UPI</button>
            <button class="mpay-tab" data-tab="card"    style="${tabStyle(activeMethod==='card')}">💳 Card</button>
            <button class="mpay-tab" data-tab="netbank" style="${tabStyle(activeMethod==='netbank')}">🏦 NetBank</button>
          </div>

          <!-- Dynamic content -->
          <div id="mpay-content" style="padding:22px 20px;"></div>

          <!-- Footer -->
          <div style="padding:10px 20px;background:#f7f6f3;border-top:1px solid #E8E4DE;
                      text-align:center;font-size:9px;letter-spacing:0.12em;
                      text-transform:uppercase;color:#7A7873;">
            🔒 secured · 256-bit encryption · test environment
          </div>
        </div>`;

      document.body.appendChild(el);
      document.body.style.overflow = 'hidden';

      // Close / cancel
      function closeModal(cancelled) {
        el.remove();
        document.body.style.overflow = '';
        if (cancelled) reject(new Error('cancelled'));
      }
      document.getElementById('mock-x').onclick = () => closeModal(true);
      el.addEventListener('click', e => { if (e.target===el) closeModal(true); });

      // Render tab content
      let curTab = activeMethod;

      function renderTab() {
        const c = document.getElementById('mpay-content');
        if (!c) return;

        const payBtn = `
          <button id="mpay-pay-btn" style="width:100%;padding:15px;margin-top:20px;
            background:#0A0A0A;color:#F4F1EC;border:0;font-size:12px;font-weight:700;
            letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;">
            pay ${amountStr}
          </button>
          <div id="mpay-err" style="color:#c0392b;font-size:11px;margin-top:8px;display:none;"></div>`;

        if (curTab === 'upi') {
          c.innerHTML = `
            <div style="text-align:center;margin-bottom:18px;">
              <!-- Simulated QR -->
              <div style="width:130px;height:130px;margin:0 auto 10px;
                          background:repeating-linear-gradient(0deg,#e8e4de 0,#e8e4de 2px,transparent 2px,transparent 8px),
                                     repeating-linear-gradient(90deg,#e8e4de 0,#e8e4de 2px,transparent 2px,transparent 8px);
                          border:2px solid #0A0A0A;display:flex;align-items:center;justify-content:center;">
                <div style="background:#fff;padding:6px;font-size:8px;text-align:center;
                            letter-spacing:0.06em;text-transform:uppercase;color:#7A7873;line-height:1.4;">
                  SCAN TO<br>PAY
                </div>
              </div>
              <div style="font-size:10px;color:#7A7873;letter-spacing:0.06em;">Open any UPI app and scan</div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
              <div style="flex:1;height:1px;background:#E8E4DE;"></div>
              <span style="font-size:10px;color:#7A7873;text-transform:uppercase;letter-spacing:0.1em;">or</span>
              <div style="flex:1;height:1px;background:#E8E4DE;"></div>
            </div>
            <label style="display:block;font-size:10px;font-weight:700;letter-spacing:0.12em;
                          text-transform:uppercase;color:#7A7873;margin-bottom:6px;">UPI ID</label>
            <div style="display:flex;gap:0;">
              <input id="mpay-upi" placeholder="yourname@bank"
                style="flex:1;border:1px solid #E8E4DE;padding:11px 14px;font-size:13px;
                       outline:none;font-family:inherit;" value="success@razorpay">
              <button style="background:#F4F1EC;border:1px solid #E8E4DE;border-left:0;
                padding:11px 14px;font-size:10px;font-weight:700;letter-spacing:0.08em;
                text-transform:uppercase;cursor:pointer;color:#0A0A0A;">Verify</button>
            </div>
            ${payBtn}`;
        } else if (curTab === 'card') {
          c.innerHTML = `
            <div style="margin-bottom:14px;">
              <label style="display:block;font-size:10px;font-weight:700;letter-spacing:0.12em;
                            text-transform:uppercase;color:#7A7873;margin-bottom:6px;">Card Number</label>
              <input id="mpay-cardnum" placeholder="4111 1111 1111 1111" maxlength="19"
                style="width:100%;box-sizing:border-box;border:1px solid #E8E4DE;padding:11px 14px;
                       font-size:14px;font-family:'JetBrains Mono',monospace;letter-spacing:0.12em;
                       outline:none;" value="4111 1111 1111 1111">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
              <div>
                <label style="display:block;font-size:10px;font-weight:700;letter-spacing:0.12em;
                              text-transform:uppercase;color:#7A7873;margin-bottom:6px;">Expiry</label>
                <input id="mpay-exp" placeholder="MM / YY" maxlength="7"
                  style="width:100%;box-sizing:border-box;border:1px solid #E8E4DE;padding:11px 14px;
                         font-size:13px;font-family:inherit;outline:none;" value="12 / 26">
              </div>
              <div>
                <label style="display:block;font-size:10px;font-weight:700;letter-spacing:0.12em;
                              text-transform:uppercase;color:#7A7873;margin-bottom:6px;">CVV</label>
                <input id="mpay-cvv" placeholder="•••" type="password" maxlength="4"
                  style="width:100%;box-sizing:border-box;border:1px solid #E8E4DE;padding:11px 14px;
                         font-size:13px;font-family:inherit;outline:none;" value="123">
              </div>
            </div>
            <div style="margin-bottom:6px;">
              <label style="display:block;font-size:10px;font-weight:700;letter-spacing:0.12em;
                            text-transform:uppercase;color:#7A7873;margin-bottom:6px;">Name on Card</label>
              <input id="mpay-name" placeholder="AS ON CARD"
                style="width:100%;box-sizing:border-box;border:1px solid #E8E4DE;padding:11px 14px;
                       font-size:13px;text-transform:uppercase;font-family:inherit;outline:none;"
                value="TEST USER">
            </div>
            ${payBtn}`;
        } else { // netbank
          const banks = [
            ['HDFC Bank','#E8F1FC'],['State Bank of India','#dff5e7'],
            ['ICICI Bank','#f5e9df'],['Axis Bank','#fef3e2'],
            ['Kotak Mahindra','#e8edfc'],['Yes Bank','#f0fcf3'],
            ['Punjab National','#fce8e8'],['Other Banks','#f5f5f5'],
          ];
          c.innerHTML = `
            <label style="display:block;font-size:10px;font-weight:700;letter-spacing:0.12em;
                          text-transform:uppercase;color:#7A7873;margin-bottom:12px;">Select your bank</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:4px;">
              ${banks.map(([name,bg],i) => `
                <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;
                              border:1px solid ${i===0?'#0A0A0A':'#E8E4DE'};
                              background:${i===0?bg:'#fff'};cursor:pointer;">
                  <input type="radio" name="mock-bank" value="${name}" ${i===0?'checked':''}
                    style="accent-color:#0A0A0A;flex-shrink:0;"
                    onchange="this.closest('[style]').style.border='1px solid #0A0A0A';
                      document.querySelectorAll('[name=mock-bank]').forEach(r=>{
                        if(r!==this) r.closest('[style]').style.border='1px solid #E8E4DE';
                      });">
                  <span style="font-size:11px;font-weight:500;">${name}</span>
                </label>`).join('')}
            </div>
            ${payBtn}`;
        }

        // Pay button handler
        const btn = document.getElementById('mpay-pay-btn');
        if (btn) btn.onclick = function() {
          btn.disabled = true;
          btn.textContent = 'processing…';
          const errEl = document.getElementById('mpay-err');
          if (errEl) errEl.style.display = 'none';
          // 1.5s simulated processing delay
          setTimeout(() => {
            closeModal(false);
            resolve({
              razorpay_order_id:   el.dataset.gatewayOrderId || 'mock_order',
              razorpay_payment_id: `pay_mock_${Date.now()}`,
              razorpay_signature:  'mock_signature',
            });
          }, 1500);
        };
      }

      // Tab switching
      el.addEventListener('click', e => {
        const tab = e.target.closest('.mpay-tab');
        if (!tab) return;
        curTab = tab.dataset.tab;
        el.querySelectorAll('.mpay-tab').forEach(t => {
          const active = t.dataset.tab === curTab;
          t.style.borderBottom = active ? '2px solid #0A0A0A' : '2px solid transparent';
          t.style.color        = active ? '#0A0A0A' : '#7A7873';
        });
        renderTab();
      });

      renderTab();

      // Expose setter for the gateway order ID
      el._setGatewayId = id => { el.dataset.gatewayOrderId = id; };
    });
  }

  // ── Razorpay helpers ───────────────────────────────────────────────────────
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load Razorpay SDK. Check your connection.'));
      document.head.appendChild(s);
    });
  }

  function openRazorpayModal(gateway, setErr, resetBtn) {
    return new Promise((resolve, reject) => {
      // Map our internal method name to Razorpay's method key
      const methodMap = { upi:'upi', card:'card', netbank:'netbanking' };

      const rzp = new window.Razorpay({
        key:         gateway.keyId,
        amount:      gateway.amount,
        currency:    gateway.currency,
        name:        'HAWT!',
        description: 'Secure checkout',
        order_id:    gateway.orderId,
        prefill:     { name: addr.name, contact: addr.phone },
        theme:       { color: '#0A0A0A' },
        // Pre-select the payment method the user already chose
        config: {
          display: {
            preferences: { show_default_blocks: true },
            hide:         Object.keys(methodMap)
                            .filter(k => k !== paymentMode && methodMap[k])
                            .map(k => ({ method: methodMap[k] })),
          },
        },

        handler: async function(response) {
          try {
            await API.post('/checkout/verify-payment', {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            });
            Cart.clear();
            window.location.href = './orders.html?success=1';
            resolve();
          } catch (err) {
            setErr(err.message || 'Payment verification failed. Contact support.');
            resetBtn();
            reject(err);
          }
        },

        modal: {
          ondismiss: function() {
            setErr('Payment cancelled. Your order is reserved for 15 min — click "Pay" to retry.');
            resetBtn();
            resolve();
          },
        },
      });
      rzp.open();
    });
  }

  // ── Place Order ────────────────────────────────────────────────────────────
  window.cpPlaceOrder = async function() {
    const btn   = document.getElementById('place-order-btn');
    const errEl = document.getElementById('checkout-error');
    const { total } = totals();

    function setErr(msg)   { if(errEl){errEl.textContent=msg;errEl.style.display='block';} }
    function resetBtn()    { if(btn){btn.disabled=false;btn.textContent=`${paymentMode==='cod'?'place order':'pay'} — ${inr(total)}`;} }
    function setStatus(t)  { if(btn) btn.textContent=t; }

    if (btn) { btn.disabled=true; btn.textContent='preparing…'; }
    if (errEl) errEl.style.display='none';

    try {
      const items = Cart.get();
      if (!items.length) { setErr('Your bag is empty.'); resetBtn(); return; }

      // 1. Look up variantId for every cart item — remove stale ones gracefully
      setStatus('syncing cart…');
      const productCache = {};
      const staleItems   = [];
      for (const item of items) {
        if (!productCache[item.product_id]) {
          try {
            productCache[item.product_id] = await API.get(`/products/${item.product_id}`);
          } catch (e) {
            staleItems.push(item);
          }
        }
      }
      if (staleItems.length) {
        staleItems.forEach(it => Cart.remove(it.product_id, it.size));
        render();
        throw new Error(
          `${staleItems.length} item(s) in your bag are no longer available and have been removed. ` +
          `Please review your bag and try again.`
        );
      }

      // 2. Push cart to DB (PUT = absolute qty, safe to retry)
      for (const item of items) {
        const variant = (productCache[item.product_id]?.variants||[]).find(v=>v.size===item.size);
        if (!variant) throw new Error(`Size ${item.size} is no longer available for "${item.name}".`);
        await API.put(`/cart/items/${variant.id}`, { quantity: item.quantity });
      }

      // 3. Create order + gateway intent
      setStatus('creating order…');
      const result = await API.post('/checkout', {
        paymentMethod: paymentMode,
        shippingAddress: {
          name: addr.name, phone: addr.phone,
          line1: addr.line1, line2: addr.line2||null,
          city: addr.city, state: addr.state, pincode: addr.pincode,
        },
      });

      const { gateway } = result.data;

      // 4a. COD — no payment step
      if (paymentMode === 'cod' || !gateway) {
        Cart.clear();
        window.location.href = './orders.html?success=1';
        return;
      }

      // 4b. Mock mode (no Razorpay keys) — show simulated payment UI
      if (gateway.keyId === 'rzp_test_mock') {
        const mockModal = showMockModal(gateway.amount, paymentMode);
        // Give the modal the real gateway order ID for verification
        setTimeout(() => {
          const el = document.getElementById('hawt-mock-pay');
          if (el && el._setGatewayId) el._setGatewayId(gateway.orderId);
        }, 0);

        setStatus(`${paymentMode==='cod'?'place order':'pay'} — ${inr(total)}`);
        if (btn) btn.disabled = false;

        let response;
        try {
          response = await mockModal;
        } catch (e) {
          if (e.message === 'cancelled') {
            setErr('Payment cancelled. Click "Pay" to retry.');
            resetBtn(); return;
          }
          throw e;
        }

        // Verify with backend
        if (btn) { btn.disabled=true; btn.textContent='verifying…'; }
        await API.post('/checkout/verify-payment', response);
        Cart.clear();
        window.location.href = './orders.html?success=1';
        return;
      }

      // 4c. Live Razorpay — load SDK and open modal
      setStatus('opening payment…');
      await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      await openRazorpayModal(gateway, setErr, resetBtn);

    } catch (err) {
      setErr(err.message || 'Something went wrong. Please try again.');
      resetBtn();
    }
  };

  render();
})();
