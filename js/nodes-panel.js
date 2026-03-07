/**
 * Nodes at current time: breadcrumb path, detail, Details button.
 * Per docs/plan.md §10.3, §11.3.
 */

(function (global) {
  'use strict';

  var Action100MData = global.Action100MData;

  /**
   * Render nodes panel. activeNodes sorted by duration (longest first).
   * onDetailsClick(node) for opening JSON modal.
   * onPathClick(node) optional – opens path/breadcrumb modal; if provided, breadcrumb is not shown inline.
   */
  function renderNodesPanel(container, activeNodes, focusId, nodeById, getNodeLabel, onDetailsClick, onPathClick) {
    var emptyEl = container.querySelector('.nodes-empty');
    if (emptyEl) emptyEl.hidden = true;

    var content = container.querySelector('.nodes-panel-content');
    if (content) content.remove();

    if (!activeNodes || activeNodes.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    getNodeLabel = getNodeLabel || (Action100MData && Action100MData.getNodeLabel) || function () { return '(no label)'; };

    var wrap = document.createElement('div');
    wrap.className = 'nodes-panel-content';

    for (var i = 0; i < activeNodes.length; i++) {
      var node = activeNodes[i];
      var start = Number(node.start);
      var end = Number(node.end);
      var timeStr = (Number.isNaN(start) ? '?' : formatTime(start)) + ' – ' + (Number.isNaN(end) ? '?' : formatTime(end));
      var label = getNodeLabel(node, focusId);
      var noGpt = Action100MData && !Action100MData.hasGptAnnotation(node);

      var block = document.createElement('div');
      block.className = 'nodes-block' + (noGpt ? ' nodes-block--no-gpt' : '');

      var topRow = document.createElement('div');
      topRow.className = 'nodes-meta-row';
      var timeEl = document.createElement('span');
      timeEl.className = 'nodes-time-range';
      timeEl.textContent = timeStr;
      timeEl.title = 'Start – End';
      topRow.appendChild(timeEl);
      var rightPart = document.createElement('span');
      rightPart.className = 'nodes-meta-right';
      var metaEl = document.createElement('span');
      metaEl.className = 'nodes-meta';
      metaEl.textContent = node.node_id || '';
      rightPart.appendChild(metaEl);
      var actions = document.createElement('span');
      actions.className = 'nodes-meta-actions';
      if (onPathClick) {
        var pathBtn = document.createElement('button');
        pathBtn.type = 'button';
        pathBtn.className = 'nodes-details-btn';
        pathBtn.textContent = 'Path';
        pathBtn.addEventListener('click', (function (n) {
          return function () { onPathClick(n); };
        })(node));
        actions.appendChild(pathBtn);
      }
      var detailsBtn = document.createElement('button');
      detailsBtn.type = 'button';
      detailsBtn.className = 'nodes-details-btn';
      detailsBtn.textContent = 'Details';
      detailsBtn.addEventListener('click', (function (n) {
        return function () { if (onDetailsClick) onDetailsClick(n); };
      })(node));
      actions.appendChild(detailsBtn);
      rightPart.appendChild(actions);
      topRow.appendChild(rightPart);
      block.appendChild(topRow);

      var textEl = document.createElement('div');
      textEl.className = 'nodes-detail-text';
      textEl.textContent = label;
      block.appendChild(textEl);

      wrap.appendChild(block);
    }
    container.appendChild(wrap);
  }

  function formatTime(sec) {
    var s = Math.floor(Number(sec));
    if (Number.isNaN(s) || s < 0) return '0:00';
    var m = Math.floor(s / 60);
    s = s % 60;
    var h = Math.floor(m / 60);
    m = m % 60;
    if (h > 0) return h + ':' + pad(m) + ':' + pad(s);
    return m + ':' + pad(s);
  }
  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  global.NodesPanel = {
    renderNodesPanel: renderNodesPanel
  };
})(typeof window !== 'undefined' ? window : this);
