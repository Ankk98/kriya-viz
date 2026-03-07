/**
 * Node JSON modal: open, pretty-print, Copy, close on X or Escape.
 * Per docs/plan.md §10.4, §11.5.
 */

(function (global) {
  'use strict';

  var modalEl = null;
  var jsonEl = null;
  var closeBtn = null;
  var copyBtn = null;
  var currentNode = null;

  function getElements() {
    if (!modalEl) modalEl = document.getElementById('node-modal');
    if (!jsonEl) jsonEl = document.getElementById('modal-json');
    if (!closeBtn) closeBtn = document.getElementById('modal-close');
    if (!copyBtn) copyBtn = document.getElementById('modal-copy');
    return modalEl && jsonEl;
  }

  function openNodeModal(node) {
    if (!node) return;
    if (!getElements()) return;
    currentNode = node;
    try {
      jsonEl.textContent = JSON.stringify(node, null, 2);
    } catch (e) {
      jsonEl.textContent = String(e);
    }
    modalEl.hidden = false;
    modalEl.removeAttribute('aria-hidden');
    closeBtn.focus();
    document.addEventListener('keydown', onKeydown);
  }

  function closeNodeModal() {
    if (!getElements()) return;
    modalEl.hidden = true;
    modalEl.setAttribute('aria-hidden', 'true');
    currentNode = null;
    document.removeEventListener('keydown', onKeydown);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeNodeModal();
    }
  }

  function initModal() {
    if (!getElements()) return;
    closeBtn.addEventListener('click', closeNodeModal);
    copyBtn.addEventListener('click', function () {
      if (!jsonEl || !jsonEl.textContent) return;
      navigator.clipboard.writeText(jsonEl.textContent).then(function () {
        copyBtn.textContent = 'Copied!';
        setTimeout(function () {
          copyBtn.textContent = 'Copy JSON';
        }, 1500);
      }).catch(function () {
        copyBtn.textContent = 'Copy failed';
        setTimeout(function () {
          copyBtn.textContent = 'Copy JSON';
        }, 1500);
      });
    });
    var backdrop = modalEl.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', closeNodeModal);
    }
  }

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModal);
  } else if (typeof document !== 'undefined') {
    initModal();
  }

  global.NodeModal = {
    openNodeModal: openNodeModal,
    closeNodeModal: closeNodeModal
  };
})(typeof window !== 'undefined' ? window : this);
