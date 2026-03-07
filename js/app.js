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
    focusId: 'gpt.summary.brief',
    currentTime: 0,
    durationSec: 0,
    nodesByLevel: null,
    nodeById: null,
    transcriptCues: null,
    transcriptPlain: null
  };

  var TIMELINE_WIDTH_PX = 800;
  var timeupdateThrottleMs = 150;
  var lastTimeupdate = 0;

  var videoEl = document.getElementById('video');
  var inputJson = document.getElementById('input-json');
  var inputVideo = document.getElementById('input-video');
  var annotationFocus = document.getElementById('annotation-focus');
  var videoLabel = document.getElementById('video-label');
  var currentTimeEl = document.getElementById('current-time');
  var durationEl = document.getElementById('duration');
  var timelineContainer = document.getElementById('timeline-container');
  var timelineEmpty = document.getElementById('timeline-empty');
  var timelineSeekBar = document.getElementById('timeline-seek-bar');
  var timelineOverlapWarning = document.getElementById('timeline-overlap-warning');
  var nodesPanel = document.getElementById('nodes-panel');
  var nodesTimeEl = document.getElementById('nodes-time');
  var metadataPanel = document.getElementById('metadata-panel');
  var transcriptPanel = document.getElementById('transcript-panel');
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

    // Time display
    durationEl.textContent = formatTime(state.durationSec);
    currentTimeEl.textContent = formatTime(state.currentTime);
    nodesTimeEl.textContent = '(' + formatTime(state.currentTime) + ')';

    // Timeline
    if (!state.nodesByLevel || !state.nodesByLevel.size || state.durationSec <= 0) {
      timelineEmpty.hidden = false;
      timelineContainer.innerHTML = '';
      timelineSeekBar.style.display = 'none';
      timelineOverlapWarning.hidden = true;
    } else {
      timelineEmpty.hidden = true;
      var activeNodes = Action100MData.getNodesAtTime(nodes, state.currentTime);
      var activeIds = activeNodes.map(function (n) { return n.node_id; });
      var maxLevel = maxLevelSelect.value || null;
      if (maxLevel === '') maxLevel = null;
      Timeline.renderTimeline(timelineContainer, state.nodesByLevel, state.durationSec, state.focusId, activeIds, state.nodeById, {
        timelineWidthPx: TIMELINE_WIDTH_PX,
        maxLevel: maxLevel,
        onSegmentClick: onSegmentClick,
        onSegmentDetails: onSegmentDetails,
        getNodeLabel: getNodeLabel
      });
      Timeline.renderSeekBar(timelineSeekBar, state.currentTime, state.durationSec, TIMELINE_WIDTH_PX);
      var hasOverlap = Action100MData.hasOverlappingSegments(state.nodesByLevel);
      timelineOverlapWarning.hidden = !hasOverlap;
    }

    // Nodes at current time
    var activeNodes = Action100MData.getNodesAtTime(nodes, state.currentTime);
    NodesPanel.renderNodesPanel(nodesPanel, activeNodes, state.focusId, state.nodeById, getNodeLabel, onSegmentDetails);

    // Metadata & transcript
    if (state.transcriptCues && state.transcriptCues.length > 0) {
      Metadata.renderMetadata(metadataPanel, transcriptPanel, meta, state.transcriptCues, {
        currentTime: state.currentTime,
        onCueClick: function (startSec) {
          if (videoEl) {
            videoEl.currentTime = startSec;
            state.currentTime = startSec;
            onTimeupdate();
          }
        }
      });
      var currentCue = Srt.getCurrentCue(state.transcriptCues, state.currentTime);
      Metadata.updateTranscriptHighlight(transcriptPanel, currentCue);
    } else if (state.transcriptPlain != null) {
      Metadata.renderMetadata(metadataPanel, transcriptPanel, meta, [], {});
      Metadata.renderTranscriptPlain(transcriptPanel, state.transcriptPlain);
    } else {
      Metadata.renderMetadata(metadataPanel, transcriptPanel, meta, [], {});
      var emptyT = transcriptPanel.querySelector('.transcript-empty');
      if (emptyT) {
        emptyT.textContent = 'No transcript.';
        emptyT.hidden = false;
      }
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

    currentTimeEl.textContent = formatTime(state.currentTime);
    nodesTimeEl.textContent = '(' + formatTime(state.currentTime) + ')';

    var nodes = state.videoRecord && state.videoRecord.nodes ? state.videoRecord.nodes : [];
    var activeNodes = Action100MData.getNodesAtTime(nodes, state.currentTime);
    var activeIds = activeNodes.map(function (n) { return n.node_id; });

    Timeline.updateTimelineActiveState(timelineContainer, activeIds);
    Timeline.renderSeekBar(timelineSeekBar, state.currentTime, state.durationSec, TIMELINE_WIDTH_PX);
    NodesPanel.renderNodesPanel(nodesPanel, activeNodes, state.focusId, state.nodeById, getNodeLabel, onSegmentDetails);

    if (state.transcriptCues && state.transcriptCues.length > 0) {
      var currentCue = Srt.getCurrentCue(state.transcriptCues, state.currentTime);
      Metadata.updateTranscriptHighlight(transcriptPanel, currentCue);
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
    state.focusId = annotationFocus.value || 'gpt.summary.brief';
    renderAll();
  });

  maxLevelSelect.addEventListener('change', function () {
    renderAll();
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
      durationEl.textContent = formatTime(d);
    }
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
