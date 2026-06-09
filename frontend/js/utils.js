'use strict';

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

function inr(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}
