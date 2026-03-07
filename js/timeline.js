/**
 * Timeline rendering: one row per level, segments, highlight by current time, click to seek.
 * Per docs/plan.md §16.
 */

(function (global) {
  'use strict';

  var Action100MData = global.Action100MData;

  /**
   * Render full timeline into container (scrollable).
   * options: { timelineWidthPx, secondsInView, maxLevel, onSegmentClick, onSegmentDetails }
   * secondsInView: how many seconds fit in the visible width; scale so full duration is one long strip.
   */
  function renderTimeline(container, nodesByLevel, durationSec, focusId, activeNodeIds, nodeById, options) {
    options = options || {};
    var visibleWidthPx = options.timelineWidthPx != null ? options.timelineWidthPx : 800;
    var secondsInView = options.secondsInView != null ? Math.max(5, Number(options.secondsInView)) : 60;
    if (Number.isNaN(secondsInView)) secondsInView = 60;
    var maxLevel = options.maxLevel != null ? options.maxLevel : null;
    var onSegmentClick = options.onSegmentClick || function () {};
    var onSegmentDetails = options.onSegmentDetails || function () {};
    var getNodeLabel = options.getNodeLabel || (Action100MData && Action100MData.getNodeLabel) || function () { return '(no label)'; };

    container.innerHTML = '';
    if (!nodesByLevel || !nodesByLevel.size || durationSec <= 0) return;

    var duration = Math.max(durationSec, 1);
    var pxPerSec = visibleWidthPx / secondsInView;
    var totalWidthPx = duration * pxPerSec;

    var levels = Array.from(nodesByLevel.keys()).sort(function (a, b) { return a - b; });
    if (maxLevel != null && maxLevel !== '') {
      var cap = parseInt(maxLevel, 10);
      if (!Number.isNaN(cap)) levels = levels.filter(function (l) { return l <= cap; });
    }

    var activeSet = new Set();
    if (activeNodeIds && activeNodeIds.length) {
      for (var i = 0; i < activeNodeIds.length; i++) activeSet.add(String(activeNodeIds[i]));
    }

    for (var l = 0; l < levels.length; l++) {
      var level = levels[l];
      var nodes = nodesByLevel.get(level) || [];
      var row = document.createElement('div');
      row.className = 'timeline-row';
      row.setAttribute('data-level', level);

      var label = document.createElement('div');
      label.className = 'timeline-row-label';
      label.textContent = 'Level ' + level;
      row.appendChild(label);

      var track = document.createElement('div');
      track.className = 'timeline-track';
      track.style.width = totalWidthPx + 'px';

      for (var n = 0; n < nodes.length; n++) {
        var node = nodes[n];
        var start = Number(node.start);
        var end = Number(node.end);
        if (Number.isNaN(start) || Number.isNaN(end)) continue;
        var leftPx = Math.max(0, start * pxPerSec);
        var widthPx = Math.max(2, (end - start) * pxPerSec);
        var isActive = activeSet.has(String(node.node_id));
        var noGpt = Action100MData && !Action100MData.hasGptAnnotation(node);

        var seg = document.createElement('button');
        seg.type = 'button';
        seg.className = 'timeline-segment' + (isActive ? ' timeline-segment--active' : '') + (noGpt ? ' timeline-segment--no-gpt' : '');
        seg.style.left = leftPx + 'px';
        seg.style.width = widthPx + 'px';
        seg.title = getNodeLabel(node, focusId);
        seg.setAttribute('data-node-id', node.node_id);

        var labelSpan = document.createElement('span');
        labelSpan.className = 'timeline-segment-label';
        var fullLabel = getNodeLabel(node, focusId);
        labelSpan.textContent = fullLabel.length > 40 ? fullLabel.substring(0, 37) + '…' : fullLabel;
        seg.appendChild(labelSpan);

        seg.addEventListener('click', function (ev) {
          if (ev.detail === 2) {
            if (onSegmentDetails) onSegmentDetails(node);
          } else {
            onSegmentClick(node);
          }
        });

        var detailsBtn = document.createElement('button');
        detailsBtn.type = 'button';
        detailsBtn.className = 'timeline-segment-details';
        detailsBtn.textContent = '{ }';
        detailsBtn.title = 'View node JSON';
        detailsBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          onSegmentDetails(node);
        });
        seg.appendChild(detailsBtn);

        track.appendChild(seg);
      }
      row.appendChild(track);
      container.appendChild(row);
    }
  }

  /**
   * Update only the active state of segments (avoid full re-render on timeupdate).
   */
  function updateTimelineActiveState(container, activeNodeIds) {
    var activeSet = new Set();
    if (activeNodeIds && activeNodeIds.length) {
      for (var i = 0; i < activeNodeIds.length; i++) activeSet.add(String(activeNodeIds[i]));
    }
    var segments = container.querySelectorAll('.timeline-segment');
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var nodeId = seg.getAttribute('data-node-id');
      if (activeSet.has(nodeId)) seg.classList.add('timeline-segment--active');
      else seg.classList.remove('timeline-segment--active');
    }
  }

  global.Timeline = {
    renderTimeline: renderTimeline,
    updateTimelineActiveState: updateTimelineActiveState
  };
})(typeof window !== 'undefined' ? window : this);
