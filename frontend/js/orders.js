(async function () {
  const root = document.getElementById('orders-root');
  if (!root) return;

  // Success banner after checkout
  const params = new URLSearchParams(window.location.search);
  if (params.get('success') === '1') {
    const banner = document.createElement('div');
    banner.className = 'success-banner';
    banner.innerHTML =
      '<span>order placed. you\'re in the system.</span>' +
      '<button class="success-banner__close" id="banner-close" aria-label="dismiss">' + icon('x', 16) + '</button>';
    root.before(banner);
    window.history.replaceState({}, '', window.location.pathname);
    document.getElementById('banner-close').addEventListener('click', function () {
      banner.remove();
    });
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDelivery(date) {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function deliveryLine(order) {
    var status = (order.status || '').toUpperCase();
    if (status === 'CANCELLED' || status === 'REFUNDED') return '';

    var orderDate = new Date(order.created_at);
    var estDate   = new Date(orderDate.getTime() + 4 * 24 * 60 * 60 * 1000);
    var today     = new Date(); today.setHours(0, 0, 0, 0);
    var estDay    = new Date(estDate); estDay.setHours(0, 0, 0, 0);
    var estStr    = fmtDelivery(estDate);

    var msg, cls;
    if (status === 'FULFILLED') {
      msg = 'delivered on ' + estStr;
      cls = 'order-delivery order-delivery--done';
    } else if (today >= estDay) {
      msg = 'arriving a bit late — sorry for the slight delay!';
      cls = 'order-delivery order-delivery--late';
    } else {
      msg = 'shipped — expected by ' + estStr;
      cls = 'order-delivery order-delivery--transit';
    }

    return '<div class="' + cls + '">' + msg + '</div>';
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────
  let orderArray = [];
  try {
    const res = await API.get('/checkout/orders');

    if (Array.isArray(res)) {
      orderArray = res;
    } else if (Array.isArray(res?.data)) {
      orderArray = res.data;
    } else if (Array.isArray(res?.data?.data)) {
      orderArray = res.data.data;
    } else {
      orderArray = [];
    }
  } catch (e) {
    root.innerHTML = '<div style="color:#c0392b;font-size:14px;padding:20px;">could not load orders. ' + e.message + '</div>';
    return;
  }

  // ── Hide abandoned / superseded orders ──────────────────────────────────────
  // A cancelled order here is always an abandoned/failed/superseded checkout
  // attempt (there's no user-initiated cancel), and a PENDING_PAYMENT order
  // left untouched for 30+ min is effectively dead (the stale-order worker
  // cancels it). Surfacing either just clutters history with confusing
  // duplicates — e.g. the old "one processing + one pending payment" pair.
  var HIDE_PENDING_MIN = 30;
  orderArray = orderArray.filter(function (o) {
    var st = (o.status || '').toUpperCase();
    if (st === 'CANCELLED') return false;
    if (st === 'PENDING_PAYMENT') {
      var ageMin = (Date.now() - new Date(o.created_at).getTime()) / 60000;
      return ageMin < HIDE_PENDING_MIN;
    }
    return true;
  });

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!orderArray.length) {
    root.innerHTML =
      '<div class="orders-empty">' +
        '<div class="orders-empty__title">nothing here yet.</div>' +
        '<div style="color:var(--hawt-ash);margin-bottom:32px;">go shop.</div>' +
        '<a href="./shop.html" class="hawt-btn hawt-btn--primary">shop the line</a>' +
      '</div>';
    return;
  }

  // ── Render list ────────────────────────────────────────────────────────────
  try {
    const cards = orderArray.map(function (order, idx) {
      const itemsHTML = (order.items || []).map(function (it) {
        return '<div class="order-item">' +
          '<div class="order-item__img"><img src="' + escapeHTML(it.image_url || '') + '" alt="' + escapeHTML(it.product_name || '') + '" loading="lazy"></div>' +
          '<div>' +
            '<div class="order-item__name">' + escapeHTML(it.product_name || '') + '</div>' +
            '<div class="order-item__sub">' + (it.size ? 'size ' + escapeHTML(it.size) + ' · ' : '') + 'qty ' + (it.quantity || 1) + '</div>' +
          '</div>' +
          '<div class="order-item__price">' + inr((it.price_at_purchase || 0) * (it.quantity || 1)) + '</div>' +
        '</div>';
      }).join('');

      const status = order.status || 'PROCESSING';
      const statusClass = ['PAID', 'FULFILLED', 'PROCESSING'].includes(status) ? 'order-chip--completed' : '';
      const shortId = (order.id || '').split('-')[0].toUpperCase();
      const pieceCount = (order.items || []).length;

      return '<div class="order-card" data-order-idx="' + idx + '" tabindex="0" role="button" aria-label="View order ' + shortId + '">' +
        '<div class="order-card__head">' +
          '<div class="order-card__num">order #' + shortId + '</div>' +
          '<div class="order-card__meta">' +
            '<span class="order-card__date">' + fmtDate(order.created_at) + '</span>' +
            '<span class="order-chip ' + statusClass + '">' + escapeHTML(status) + '</span>' +
          '</div>' +
        '</div>' +
        deliveryLine(order) +
        '<div class="order-items">' + itemsHTML + '</div>' +
        '<div class="order-card__foot">' +
          '<span style="font-size:12px;color:var(--hawt-ash);">' + pieceCount + ' piece' + (pieceCount !== 1 ? 's' : '') + '</span>' +
          '<span class="order-card__total">' + inr(order.total_amount || 0) + '</span>' +
        '</div>' +
      '</div>';
    });

    root.innerHTML = cards.join('');

    // Attach click listeners after render (no inline onclick — CSP safe)
    root.querySelectorAll('.order-card').forEach(function (card) {
      card.addEventListener('click', function () {
        openModal(orderArray[parseInt(card.dataset.orderIdx, 10)]);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openModal(orderArray[parseInt(card.dataset.orderIdx, 10)]);
        }
      });
    });

  } catch (e) {
    root.innerHTML = '<h2 style="color:red;padding:20px;">Render Error: ' + e.message + '</h2>';
  }

  // ── Modal ──────────────────────────────────────────────────────────────────
  var backdrop  = document.getElementById('od-backdrop');
  var closeBtn  = document.getElementById('od-close');
  var odId      = document.getElementById('od-id');
  var odDate    = document.getElementById('od-date');
  var odStatus  = document.getElementById('od-status');
  var odItems   = document.getElementById('od-items');
  var odBreak   = document.getElementById('od-breakdown');

  if (closeBtn) {
    closeBtn.innerHTML = icon('x', 18);
    closeBtn.addEventListener('click', closeModal);
  }

  if (backdrop) {
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  function openModal(order) {
    if (!backdrop) return;

    var status   = order.status || 'PROCESSING';
    var shortId  = (order.id || '').split('-')[0].toUpperCase();
    var isGreen  = ['PAID', 'FULFILLED', 'PROCESSING'].includes(status);

    odId.textContent    = 'order #' + shortId;
    odDate.textContent  = fmtDate(order.created_at);
    odStatus.textContent = status;
    odStatus.className  = 'od-chip' + (isGreen ? ' od-chip--green' : '');

    var odDelivery = document.getElementById('od-delivery');
    if (odDelivery) odDelivery.innerHTML = deliveryLine(order);

    // Items
    odItems.innerHTML = (order.items || []).map(function (it) {
      return '<div class="od-item">' +
        '<div class="od-item__img"><img src="' + escapeHTML(it.image_url || '') + '" alt="' + escapeHTML(it.product_name || '') + '" loading="lazy"></div>' +
        '<div>' +
          '<div class="od-item__name">' + escapeHTML(it.product_name || 'Unknown item') + '</div>' +
          '<div class="od-item__sub">' +
            (it.size ? 'size ' + escapeHTML(it.size) + ' · ' : '') +
            'qty ' + (it.quantity || 1) +
          '</div>' +
        '</div>' +
        '<div class="od-item__price">' + inr((it.price_at_purchase || 0) * (it.quantity || 1)) + '</div>' +
      '</div>';
    }).join('') || '<div style="color:var(--hawt-ash);font-size:13px;">no items found.</div>';

    // Price breakdown
    var subtotal    = parseFloat(order.subtotal)         || 0;
    var couponDisc  = parseFloat(order.coupon_discount)  || 0;
    var payDisc     = parseFloat(order.payment_discount) || 0;
    var tax         = parseFloat(order.tax_amount)       || 0;
    var shipping    = parseFloat(order.shipping_amount)  || 0;
    var total       = parseFloat(order.total_amount)     || 0;

    var rows = '';
    rows += '<div class="od-row"><span>subtotal</span><span>' + inr(subtotal) + '</span></div>';
    if (couponDisc > 0) {
      rows += '<div class="od-row od-row--discount"><span>coupon discount</span><span>- ' + inr(couponDisc) + '</span></div>';
    }
    if (payDisc > 0) {
      rows += '<div class="od-row od-row--discount"><span>payment discount</span><span>- ' + inr(payDisc) + '</span></div>';
    }
    if (tax > 0) {
      rows += '<div class="od-row"><span>taxes & fees</span><span>' + inr(tax) + '</span></div>';
    }
    rows += '<div class="od-row"><span>shipping</span><span>' + (shipping === 0 ? 'free' : inr(shipping)) + '</span></div>';
    rows += '<div class="od-row od-row--total"><span>total</span><span>' + inr(total) + '</span></div>';

    odBreak.innerHTML = rows;

    backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    // Focus the close button for keyboard accessibility
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!backdrop) return;
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
  }

})();
