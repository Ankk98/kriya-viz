/**
 * Timeline rendering: one row per level, segments, highlight by current time, click to seek.
 * Per docs/plan.md §16.
 */

(function (global) {
  'use strict';

  var Action100MData = global.Action100MData;

  /**
   * Render full timeline into container (scrollable).
   * options: { timelineWidthPx, secondsInView, maxLevel, onSegmentClick, onSegmentDetails, currentTime, formatTime, onRulerClick }
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
    var currentTime = options.currentTime != null ? Number(options.currentTime) : 0;
    if (Number.isNaN(currentTime)) currentTime = 0;
    var formatTime = options.formatTime || function (s) { return Math.floor(s) + 's'; };
    var onRulerClick = options.onRulerClick || null;

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

    var labelsCol = document.createElement('div');
    labelsCol.className = 'timeline-labels';

    var tracksScroll = document.createElement('div');
    tracksScroll.id = 'timeline-tracks-scroll';
    tracksScroll.className = 'timeline-tracks-scroll';

    var tracksInner = document.createElement('div');
    tracksInner.className = 'timeline-tracks-inner';
    tracksInner.style.width = totalWidthPx + 'px';

    // Time ruler row: label in labels column
    var rulerLabel = document.createElement('div');
    rulerLabel.className = 'timeline-row-label timeline-ruler-label';
    rulerLabel.textContent = 'Time';
    labelsCol.appendChild(rulerLabel);

    // Time ruler: ticks and labels
    var rulerRow = document.createElement('div');
    rulerRow.className = 'timeline-row timeline-ruler-row';
    var ruler = document.createElement('div');
    ruler.className = 'timeline-ruler' + (onRulerClick ? ' timeline-ruler--clickable' : '');
    ruler.style.width = totalWidthPx + 'px';
    ruler.title = onRulerClick ? 'Click to seek to time' : '';

    var intervalSec = Math.max(5, Math.ceil(secondsInView / 6));
    var t = 0;
    while (t <= duration) {
      var tick = document.createElement('div');
      tick.className = 'timeline-ruler-tick';
      tick.style.left = (t * pxPerSec) + 'px';
      var label = document.createElement('span');
      label.className = 'timeline-ruler-time';
      label.textContent = formatTime(t);
      tick.appendChild(label);
      ruler.appendChild(tick);
      t += intervalSec;
    }
    rulerRow.appendChild(ruler);
    tracksInner.appendChild(rulerRow);

    if (onRulerClick) {
      ruler.addEventListener('click', function (ev) {
        var scrollEl = container.querySelector('#timeline-tracks-scroll');
        if (!scrollEl) return;
        var scrollLeft = scrollEl.scrollLeft;
        var scrollRect = scrollEl.getBoundingClientRect();
        var offsetFromVisibleLeft = ev.clientX - scrollRect.left;
        var x = scrollLeft + offsetFromVisibleLeft;
        var sec = Math.max(0, Math.min(duration, x / pxPerSec));
        onRulerClick(sec);
      });
    }

    // Playhead (vertical line at current time)
    var playhead = document.createElement('div');
    playhead.className = 'timeline-playhead';
    playhead.setAttribute('aria-hidden', 'true');
    playhead.style.left = (currentTime * pxPerSec) + 'px';
    tracksInner.appendChild(playhead);

    for (var l = 0; l < levels.length; l++) {
      var level = levels[l];
      var nodes = nodesByLevel.get(level) || [];

      var label = document.createElement('div');
      label.className = 'timeline-row-label';
      label.textContent = 'Level ' + level;
      labelsCol.appendChild(label);

      var row = document.createElement('div');
      row.className = 'timeline-row';
      row.setAttribute('data-level', level);

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

        (function (capturedNode) {
          seg.addEventListener('click', function (ev) {
            if (ev.detail === 2) {
              if (onSegmentDetails) onSegmentDetails(capturedNode);
            } else {
              onSegmentClick(capturedNode);
            }
          });

          var detailsBtn = document.createElement('button');
          detailsBtn.type = 'button';
          detailsBtn.className = 'timeline-segment-details';
          detailsBtn.textContent = '{ }';
          detailsBtn.title = 'View node JSON';
          detailsBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            onSegmentDetails(capturedNode);
          });
          seg.appendChild(detailsBtn);
        })(node);

        track.appendChild(seg);
      }
      row.appendChild(track);
      tracksInner.appendChild(row);
    }

    tracksScroll.appendChild(tracksInner);
    container.appendChild(labelsCol);
    container.appendChild(tracksScroll);
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

  /**
   * Move the playhead to the given time (px = currentTime * pxPerSec).
   */
  function updatePlayhead(container, currentTime, pxPerSec) {
    var playhead = container && container.querySelector('.timeline-playhead');
    if (!playhead || pxPerSec <= 0) return;
    var t = Number(currentTime);
    if (Number.isNaN(t) || t < 0) t = 0;
    playhead.style.left = (t * pxPerSec) + 'px';
  }

  global.Timeline = {
    renderTimeline: renderTimeline,
    updateTimelineActiveState: updateTimelineActiveState,
    updatePlayhead: updatePlayhead
  };
})(typeof window !== 'undefined' ? window : this);
