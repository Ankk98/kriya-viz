/**
 * App entry: state, file inputs, video events, wire timeline, nodes panel, metadata, modal.
 * Per docs/plan.md §17, §19.
 */

(function () {
  'use strict';

  var Action100MData = window.Action100MData;
  var Srt = window.Srt;
  var Timeline = window.Timeline;
  var NodesPanel = window.NodesPanel;
  var Metadata = window.Metadata;
  var NodeModal = window.NodeModal;

  var state = {
    videoRecord: null,
    focusId: 'gpt.action.brief',
    currentTime: 0,
    durationSec: 0,
    nodesByLevel: null,
    nodeById: null,
    transcriptCues: null,
    transcriptPlain: null
  };

  var timeupdateThrottleMs = 150;
  var lastTimeupdate = 0;

  function getTimelineWidthPx() {
    if (!timelineContainer) return 800;
    var containerWidth = timelineContainer.clientWidth;
    var labelAndPadding = 90;
    return Math.max(200, containerWidth - labelAndPadding);
  }

  var videoEl = document.getElementById('video');
  var inputJson = document.getElementById('input-json');
  var inputVideo = document.getElementById('input-video');
  var annotationFocus = document.getElementById('annotation-focus');
  var videoLabel = document.getElementById('video-label');
  var timelineContainer = document.getElementById('timeline-container');
  var timelineEmpty = document.getElementById('timeline-empty');
  var timelineOverlapWarning = document.getElementById('timeline-overlap-warning');
  var nodesPanel = document.getElementById('nodes-panel');
  var nodesTimeEl = document.getElementById('nodes-time');
  var transcriptCurrentLineEl = document.getElementById('transcript-current-line');
  var btnMetadata = document.getElementById('btn-metadata');
  var btnTranscript = document.getElementById('btn-transcript');
  var metadataModal = document.getElementById('metadata-modal');
  var metadataModalBody = document.getElementById('metadata-modal-body');
  var metadataModalClose = document.getElementById('metadata-modal-close');
  var transcriptModal = document.getElementById('transcript-modal');
  var transcriptModalBody = document.getElementById('transcript-modal-body');
  var transcriptModalClose = document.getElementById('transcript-modal-close');
  var maxLevelSelect = document.getElementById('max-level');

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

  function getNodeLabel(node, focusId) {
    return Action100MData ? Action100MData.getNodeLabel(node, focusId) : '(no label)';
  }

  function buildStateFromRecord(record) {
    if (!record) return;
    var nodes = record.nodes && Array.isArray(record.nodes) ? record.nodes : [];
    state.videoRecord = record;
    state.nodesByLevel = Action100MData.buildNodesByLevel(nodes);
    state.nodeById = Action100MData.buildNodeById(nodes);
    state.transcriptCues = null;
    state.transcriptPlain = null;
    var meta = record.metadata || {};
    var transcript = meta.transcript;
    if (typeof transcript === 'string' && transcript.trim()) {
      var cues = Srt.parseSrt(transcript);
      if (cues.length >= 1) {
        state.transcriptCues = cues;
      } else {
        state.transcriptPlain = transcript;
      }
    }
    var dur = meta.duration;
    if (typeof dur === 'number' && !Number.isNaN(dur) && dur > 0) {
      state.durationSec = dur;
    } else if (nodes.length > 0) {
      var maxEnd = 0;
      for (var i = 0; i < nodes.length; i++) {
        var e = Number(nodes[i].end);
        if (!Number.isNaN(e) && e > maxEnd) maxEnd = e;
      }
      state.durationSec = maxEnd;
    } else {
      state.durationSec = 0;
    }
  }

  function renderAll() {
    var record = state.videoRecord;
    var nodes = record && record.nodes ? record.nodes : [];
    var meta = record && record.metadata ? record.metadata : {};

    // Video label
    var title = meta.title || record.video_uid || '—';
    videoLabel.textContent = 'Video: ' + (title || '—');

    nodesTimeEl.textContent = '(' + formatTime(state.currentTime) + ')';

    // Timeline
    if (!state.nodesByLevel || !state.nodesByLevel.size || state.durationSec <= 0) {
      timelineEmpty.hidden = false;
      timelineContainer.innerHTML = '';
      timelineOverlapWarning.hidden = true;
    } else {
      timelineEmpty.hidden = true;
      var activeNodes = Action100MData.getNodesAtTime(nodes, state.currentTime);
      var activeIds = activeNodes.map(function (n) { return n.node_id; });
      var maxLevel = maxLevelSelect.value || null;
      if (maxLevel === '') maxLevel = null;
      var timelineW = getTimelineWidthPx();
      Timeline.renderTimeline(timelineContainer, state.nodesByLevel, state.durationSec, state.focusId, activeIds, state.nodeById, {
        timelineWidthPx: timelineW,
        maxLevel: maxLevel,
        onSegmentClick: onSegmentClick,
        onSegmentDetails: onSegmentDetails,
        getNodeLabel: getNodeLabel
      });
      var hasOverlap = Action100MData.hasOverlappingSegments(state.nodesByLevel);
      timelineOverlapWarning.hidden = !hasOverlap;
    }

    // Nodes at current time
    var activeNodes = Action100MData.getNodesAtTime(nodes, state.currentTime);
    NodesPanel.renderNodesPanel(nodesPanel, activeNodes, state.focusId, state.nodeById, getNodeLabel, onSegmentDetails);

    // Transcript: one line when SRT, or "Transcript" button (popup) when plain
    if (transcriptCurrentLineEl) {
      transcriptCurrentLineEl.textContent = '';
    }
    if (btnTranscript) btnTranscript.hidden = true;
    if (state.transcriptCues && state.transcriptCues.length > 0) {
      var currentCue = Srt.getCurrentCue(state.transcriptCues, state.currentTime);
      if (transcriptCurrentLineEl && currentCue) {
        transcriptCurrentLineEl.textContent = currentCue.text || '';
      }
    } else if (state.transcriptPlain != null && state.transcriptPlain.trim() !== '') {
      if (btnTranscript) btnTranscript.hidden = false;
    }
  }

  function onSegmentClick(node) {
    var t = Number(node.start);
    if (Number.isNaN(t)) return;
    if (videoEl) {
      videoEl.currentTime = t;
      state.currentTime = t;
      onTimeupdate();
    }
  }

  function onSegmentDetails(node) {
    if (NodeModal) NodeModal.openNodeModal(node);
  }

  function onTimeupdate() {
    if (!videoEl) return;
    state.currentTime = videoEl.currentTime;
    var now = Date.now();
    if (now - lastTimeupdate < timeupdateThrottleMs) return;
    lastTimeupdate = now;

    nodesTimeEl.textContent = '(' + formatTime(state.currentTime) + ')';

    var nodes = state.videoRecord && state.videoRecord.nodes ? state.videoRecord.nodes : [];
    var activeNodes = Action100MData.getNodesAtTime(nodes, state.currentTime);
    var activeIds = activeNodes.map(function (n) { return n.node_id; });

    Timeline.updateTimelineActiveState(timelineContainer, activeIds);
    NodesPanel.renderNodesPanel(nodesPanel, activeNodes, state.focusId, state.nodeById, getNodeLabel, onSegmentDetails);

    if (state.transcriptCues && state.transcriptCues.length > 0 && transcriptCurrentLineEl) {
      var currentCue = Srt.getCurrentCue(state.transcriptCues, state.currentTime);
      transcriptCurrentLineEl.textContent = currentCue ? (currentCue.text || '') : '';
    }
  }

  function openMetadataModal() {
    var meta = state.videoRecord && state.videoRecord.metadata ? state.videoRecord.metadata : {};
    var title = (meta.title != null && meta.title !== '') ? String(meta.title) : '';
    var desc = (meta.description != null && meta.description !== '') ? String(meta.description) : '';
    if (!metadataModalBody) return;
    metadataModalBody.innerHTML = '';
    if (title) {
      var h = document.createElement('p');
      h.className = 'metadata-title';
      h.textContent = title;
      metadataModalBody.appendChild(h);
    }
    if (desc) {
      var d = document.createElement('p');
      d.className = 'metadata-description';
      d.textContent = desc;
      metadataModalBody.appendChild(d);
    }
    if (!title && !desc) metadataModalBody.textContent = 'No title or description.';
    if (metadataModal) {
      metadataModal.hidden = false;
      metadataModal.removeAttribute('aria-hidden');
    }
  }

  function closeMetadataModal() {
    if (metadataModal) {
      metadataModal.hidden = true;
      metadataModal.setAttribute('aria-hidden', 'true');
    }
  }

  function openTranscriptModal() {
    if (!transcriptModalBody) return;
    transcriptModalBody.textContent = state.transcriptPlain != null ? state.transcriptPlain : 'No transcript.';
    if (transcriptModal) {
      transcriptModal.hidden = false;
      transcriptModal.removeAttribute('aria-hidden');
    }
  }

  function closeTranscriptModal() {
    if (transcriptModal) {
      transcriptModal.hidden = true;
      transcriptModal.setAttribute('aria-hidden', 'true');
    }
  }

  function onLoadedMetadata() {
    if (!videoEl) return;
    var d = videoEl.duration;
    if (typeof d === 'number' && !Number.isNaN(d) && d > 0 && (!state.durationSec || state.durationSec <= 0)) {
      state.durationSec = d;
    }
    renderAll();
  }

  // ——— File inputs ———
  inputJson.addEventListener('change', function () {
    var file = inputJson.files && inputJson.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var record = JSON.parse(reader.result);
        buildStateFromRecord(record);
        if (record.video_src && typeof record.video_src === 'string') {
          videoEl.src = record.video_src;
        }
        renderAll();
      } catch (e) {
        alert('Invalid JSON: ' + e.message);
      }
    };
    reader.readAsText(file);
  });

  inputVideo.addEventListener('change', function () {
    var file = inputVideo.files && inputVideo.files[0];
    if (!file) return;
    videoEl.src = URL.createObjectURL(file);
  });

  // ——— Annotation dropdown ———
  if (Action100MData && Action100MData.ANNOTATION_OPTIONS) {
    var opts = Action100MData.ANNOTATION_OPTIONS;
    for (var i = 0; i < opts.length; i++) {
      var opt = document.createElement('option');
      opt.value = opts[i].id;
      opt.textContent = opts[i].label;
      if (opts[i].id === state.focusId) opt.selected = true;
      annotationFocus.appendChild(opt);
    }
  }
  annotationFocus.addEventListener('change', function () {
    state.focusId = annotationFocus.value || 'gpt.action.brief';
    renderAll();
  });

  maxLevelSelect.addEventListener('change', function () {
    renderAll();
  });

  if (btnMetadata) btnMetadata.addEventListener('click', openMetadataModal);
  if (btnTranscript) btnTranscript.addEventListener('click', openTranscriptModal);
  if (metadataModalClose) metadataModalClose.addEventListener('click', closeMetadataModal);
  if (transcriptModalClose) transcriptModalClose.addEventListener('click', closeTranscriptModal);
  if (metadataModal) {
    var backdrop = metadataModal.querySelector('.modal-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeMetadataModal);
  }
  if (transcriptModal) {
    var transcriptBackdrop = transcriptModal.querySelector('.modal-backdrop');
    if (transcriptBackdrop) transcriptBackdrop.addEventListener('click', closeTranscriptModal);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (metadataModal && !metadataModal.hidden) closeMetadataModal();
      else if (transcriptModal && !transcriptModal.hidden) closeTranscriptModal();
    }
  });

  // ——— Video events ———
  videoEl.addEventListener('timeupdate', onTimeupdate);
  videoEl.addEventListener('loadedmetadata', onLoadedMetadata);

  // Initial duration from video when only video is loaded first
  videoEl.addEventListener('loadedmetadata', function () {
    if (state.videoRecord) return;
    var d = videoEl.duration;
    if (typeof d === 'number' && !Number.isNaN(d) && d > 0) {
      state.durationSec = d;
    }
  });

  // ——— Resize: re-render timeline to use new width ———
  var resizeThrottle;
  window.addEventListener('resize', function () {
    if (resizeThrottle) clearTimeout(resizeThrottle);
    resizeThrottle = setTimeout(function () {
      resizeThrottle = null;
      if (state.videoRecord && state.nodesByLevel && state.nodesByLevel.size && state.durationSec > 0) {
        var nodes = state.videoRecord.nodes || [];
        var activeNodes = Action100MData.getNodesAtTime(nodes, state.currentTime);
        var activeIds = activeNodes.map(function (n) { return n.node_id; });
        var maxLevel = maxLevelSelect.value || null;
        if (maxLevel === '') maxLevel = null;
        var timelineW = getTimelineWidthPx();
        Timeline.renderTimeline(timelineContainer, state.nodesByLevel, state.durationSec, state.focusId, activeIds, state.nodeById, {
          timelineWidthPx: timelineW,
          maxLevel: maxLevel,
          onSegmentClick: onSegmentClick,
          onSegmentDetails: onSegmentDetails,
          getNodeLabel: getNodeLabel
        });
      }
    }, 150);
  });

  // ——— Keyboard ———
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === ' ') {
      e.preventDefault();
      if (videoEl.paused) videoEl.play(); else videoEl.pause();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      videoEl.currentTime = Math.max(0, videoEl.currentTime - 5);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 5);
    }
  });

  // ——— Init ———
  renderAll();
})();
