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
  var ListBrowse = window.ListBrowse;

  var state = {
    videoRecord: null,
    timelineFocusId: 'gpt.action.brief',
    nodesFocusId: 'gpt.summary.brief',
    currentTime: 0,
    durationSec: 0,
    nodesByLevel: null,
    nodeById: null,
    transcriptCues: null,
    transcriptPlain: null,
    listEntries: [],
    currentVideoObjectURL: null
  };

  var timeupdateThrottleMs = 150;
  var lastTimeupdate = 0;

  function getTimelineWidthPx() {
    var scrollEl = document.getElementById('timeline-tracks-scroll');
    if (scrollEl) return Math.max(200, scrollEl.clientWidth);
    if (timelineContainer) return Math.max(200, timelineContainer.clientWidth - 70);
    return 800;
  }

  function getSecondsInView() {
    var el = document.getElementById('timeline-sec-in-view');
    if (!el || el.value === '') return 30;
    var n = parseInt(el.value, 10);
    return Number.isNaN(n) || n < 5 ? 30 : Math.max(5, n);
  }

  function scrollTimelineToCurrentTime() {
    var scrollEl = document.getElementById('timeline-tracks-scroll');
    if (!scrollEl || !state.nodesByLevel || !state.nodesByLevel.size || state.durationSec <= 0) return;
    var secInView = getSecondsInView();
    var visibleW = getTimelineWidthPx();
    var pxPerSec = visibleW / secInView;
    var targetScroll = state.currentTime * pxPerSec - visibleW / 2;
    var maxScroll = Math.max(0, state.durationSec * pxPerSec - visibleW);
    scrollEl.scrollLeft = Math.max(0, Math.min(targetScroll, maxScroll));
  }

  var videoEl = document.getElementById('video');
  var nodesAnnotationEl = document.getElementById('nodes-annotation');
  var timelineAnnotationEl = document.getElementById('timeline-annotation');
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
  var pathModal = document.getElementById('path-modal');
  var pathModalBody = document.getElementById('path-modal-body');
  var pathModalClose = document.getElementById('path-modal-close');
  var btnAbout = document.getElementById('btn-about');
  var aboutModal = document.getElementById('about-modal');
  var aboutModalClose = document.getElementById('about-modal-close');
  var maxLevelSelect = document.getElementById('max-level');
  var listDrawer = document.getElementById('list-drawer');
  var listDrawerClose = document.getElementById('list-drawer-close');
  var btnHamburger = document.getElementById('btn-hamburger');
  var listEmpty = document.getElementById('list-empty');
  var listCount = document.getElementById('list-count');
  var listVirtualContainer = document.getElementById('list-virtual-container');
  var listVirtualInner = document.getElementById('list-virtual-inner');
  var sourceModal = document.getElementById('source-modal');
  var sourceModalClose = document.getElementById('source-modal-close');
  var sourceInputJson = document.getElementById('source-input-json');
  var sourceInputVideo = document.getElementById('source-input-video');
  var sourceBtnOpenVideo = document.getElementById('source-btn-open-video');
  var sourceJsonFilename = document.getElementById('source-json-filename');
  var sourceVideoFilename = document.getElementById('source-video-filename');
  var sourceInputVideosDir = document.getElementById('source-input-videos-dir');
  var sourceInputJsonDir = document.getElementById('source-input-json-dir');
  var sourceVideosDirname = document.getElementById('source-videos-dirname');
  var sourceJsonDirname = document.getElementById('source-json-dirname');
  var sourceFoldersSummary = document.getElementById('source-folders-summary');
  var sourceBtnOpenList = document.getElementById('source-btn-open-list');
  var btnChangeSource = document.getElementById('btn-change-source');
  var listRefreshFn = null;

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

  function revokeCurrentVideoURL() {
    if (state.currentVideoObjectURL) {
      URL.revokeObjectURL(state.currentVideoObjectURL);
      state.currentVideoObjectURL = null;
    }
    if (videoEl) videoEl.removeAttribute('src');
  }

  function openListDrawer() {
    if (listDrawer) {
      listDrawer.classList.add('list-drawer--open');
      listDrawer.setAttribute('aria-hidden', 'false');
      if (listRefreshFn) listRefreshFn();
    }
  }

  function closeListDrawer() {
    if (listDrawer) {
      listDrawer.classList.remove('list-drawer--open');
      listDrawer.setAttribute('aria-hidden', 'true');
    }
  }

  function toggleListDrawer() {
    if (listDrawer && listDrawer.classList.contains('list-drawer--open')) closeListDrawer();
    else openListDrawer();
  }

  function openSourceModal() {
    if (sourceModal) {
      sourceModal.hidden = false;
      sourceModal.removeAttribute('aria-hidden');
    }
  }

  function closeSourceModal() {
    if (sourceModal) {
      sourceModal.hidden = true;
      sourceModal.setAttribute('aria-hidden', 'true');
    }
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
    var transcript = meta.transcript != null ? meta.transcript : record.transcript;
    if (typeof transcript === 'string' && transcript.trim()) {
      var cues = Srt.parseSrt(transcript);
      if (cues.length >= 1) {
        state.transcriptCues = cues;
      } else {
        state.transcriptPlain = transcript;
      }
    } else if (Array.isArray(transcript) && transcript.length > 0) {
      // Array of { time, text } or { start, end, text } (e.g. Action100M raw_annotations)
      var cues = [];
      for (var i = 0; i < transcript.length; i++) {
        var seg = transcript[i];
        var text = seg && (seg.text != null) ? String(seg.text) : '';
        var startSec = Number(seg && (seg.start != null ? seg.start : seg.time));
        if (Number.isNaN(startSec) && seg && seg.time != null) startSec = Number(seg.time);
        if (Number.isNaN(startSec)) startSec = 0;
        var endSec = seg && (seg.end != null) ? Number(seg.end) : NaN;
        if (Number.isNaN(endSec) && i + 1 < transcript.length && transcript[i + 1] != null) {
          var nextStart = transcript[i + 1].start != null ? transcript[i + 1].start : transcript[i + 1].time;
          endSec = Number(nextStart);
        }
        if (Number.isNaN(endSec) || endSec <= startSec) endSec = startSec + 1;
        cues.push({ index: i + 1, startSec: startSec, endSec: endSec, text: text });
      }
      if (cues.length >= 1) state.transcriptCues = cues;
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
    var title = meta.title || (record && record.video_uid) || '—';
    if (videoLabel) videoLabel.textContent = 'Video: ' + (title || '—');

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
      var secInView = getSecondsInView();
      Timeline.renderTimeline(timelineContainer, state.nodesByLevel, state.durationSec, state.timelineFocusId, activeIds, state.nodeById, {
        timelineWidthPx: timelineW,
        secondsInView: secInView,
        maxLevel: maxLevel,
        onSegmentClick: onSegmentClick,
        onSegmentDetails: onSegmentDetails,
        getNodeLabel: getNodeLabel
      });
      scrollTimelineToCurrentTime();
      var hasOverlap = Action100MData.hasOverlappingSegments(state.nodesByLevel);
      timelineOverlapWarning.hidden = !hasOverlap;
    }

    // Nodes at current time
    var activeNodes = Action100MData.getNodesAtTime(nodes, state.currentTime);
    NodesPanel.renderNodesPanel(nodesPanel, activeNodes, state.nodesFocusId, state.nodeById, getNodeLabel, onSegmentDetails, openPathModal);

    // Transcript: one line when SRT, or "Transcript" button (popup) when plain
    if (transcriptCurrentLineEl) {
      transcriptCurrentLineEl.textContent = '';
    }
    if (btnTranscript) btnTranscript.hidden = true;
    if (state.transcriptCues && state.transcriptCues.length > 0) {
      var currentCue = Srt.getCurrentCue(state.transcriptCues, state.currentTime);
      if (transcriptCurrentLineEl && currentCue) {
        var ts = '[' + formatTime(currentCue.startSec) + '] ';
        transcriptCurrentLineEl.textContent = ts + (currentCue.text || '').trim();
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
      scrollTimelineToCurrentTime();
    }
  }

  function onSegmentDetails(node) {
    if (NodeModal) NodeModal.openNodeModal(node);
  }

  function openPathModal(node) {
    if (!pathModalBody) return;
    pathModalBody.innerHTML = '';
    var getPathToRoot = Action100MData && Action100MData.getPathToRoot;
    if (!getPathToRoot) {
      pathModalBody.textContent = 'Path not available.';
    } else {
      var path = getPathToRoot(state.nodeById, node);
      if (!path || path.length === 0) {
        pathModalBody.textContent = '(root)';
      } else {
        for (var i = 0; i < path.length; i++) {
          var n = path[i];
          var step = document.createElement('div');
          step.className = 'path-modal-step';
          var label = document.createElement('div');
          label.className = 'path-modal-step-label';
          label.textContent = getNodeLabel(n, state.nodesFocusId);
          step.appendChild(label);
          var meta = document.createElement('div');
          meta.className = 'path-modal-step-meta';
          var idStr = n.node_id != null ? String(n.node_id) : '—';
          var levelStr = n.level != null && !Number.isNaN(Number(n.level)) ? String(n.level) : '—';
          var startStr = n.start != null && !Number.isNaN(Number(n.start)) ? formatTime(Number(n.start)) : '—';
          var endStr = n.end != null && !Number.isNaN(Number(n.end)) ? formatTime(Number(n.end)) : '—';
          meta.textContent = 'id: ' + idStr + ' · level: ' + levelStr + ' · start: ' + startStr + ' · end: ' + endStr;
          step.appendChild(meta);
          pathModalBody.appendChild(step);
          if (i < path.length - 1) {
            var arrow = document.createElement('div');
            arrow.className = 'path-modal-arrow';
            arrow.textContent = '↓';
            pathModalBody.appendChild(arrow);
          }
        }
      }
    }
    if (pathModal) {
      pathModal.hidden = false;
      pathModal.removeAttribute('aria-hidden');
    }
  }

  function closePathModal() {
    if (pathModal) {
      pathModal.hidden = true;
      pathModal.setAttribute('aria-hidden', 'true');
    }
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
    NodesPanel.renderNodesPanel(nodesPanel, activeNodes, state.nodesFocusId, state.nodeById, getNodeLabel, onSegmentDetails, openPathModal);
    scrollTimelineToCurrentTime();

    if (state.transcriptCues && state.transcriptCues.length > 0 && transcriptCurrentLineEl) {
      var currentCue = Srt.getCurrentCue(state.transcriptCues, state.currentTime);
      if (currentCue) {
        var ts = '[' + formatTime(currentCue.startSec) + '] ';
        transcriptCurrentLineEl.textContent = ts + (currentCue.text || '').trim();
      } else {
        transcriptCurrentLineEl.textContent = '';
      }
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

  function openAboutModal() {
    if (aboutModal) {
      aboutModal.hidden = false;
      aboutModal.removeAttribute('aria-hidden');
    }
  }

  function closeAboutModal() {
    if (aboutModal) {
      aboutModal.hidden = true;
      aboutModal.setAttribute('aria-hidden', 'true');
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

  // ——— Source modal: single video + JSON ———
  function updateSingleOpenButton() {
    var hasJson = sourceInputJson && sourceInputJson.files && sourceInputJson.files[0];
    var hasVideo = sourceInputVideo && sourceInputVideo.files && sourceInputVideo.files[0];
    if (sourceBtnOpenVideo) sourceBtnOpenVideo.disabled = !hasJson || !hasVideo;
  }
  if (sourceInputJson) {
    sourceInputJson.addEventListener('change', function () {
      if (sourceJsonFilename) sourceJsonFilename.textContent = (sourceInputJson.files && sourceInputJson.files[0]) ? sourceInputJson.files[0].name : '—';
      updateSingleOpenButton();
    });
  }
  if (sourceInputVideo) {
    sourceInputVideo.addEventListener('change', function () {
      if (sourceVideoFilename) sourceVideoFilename.textContent = (sourceInputVideo.files && sourceInputVideo.files[0]) ? sourceInputVideo.files[0].name : '—';
      updateSingleOpenButton();
    });
  }
  if (sourceBtnOpenVideo) {
    sourceBtnOpenVideo.addEventListener('click', function () {
      var jsonFile = sourceInputJson && sourceInputJson.files && sourceInputJson.files[0];
      var videoFile = sourceInputVideo && sourceInputVideo.files && sourceInputVideo.files[0];
      if (!jsonFile || !videoFile) return;
      revokeCurrentVideoURL();
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var record = JSON.parse(reader.result);
          buildStateFromRecord(record);
          state.currentVideoObjectURL = URL.createObjectURL(videoFile);
          if (videoEl) videoEl.src = state.currentVideoObjectURL;
          closeSourceModal();
          renderAll();
        } catch (e) {
          alert('Invalid JSON: ' + e.message);
        }
      };
      reader.onerror = function () { alert('Failed to read JSON file.'); };
      reader.readAsText(jsonFile);
    });
  }

  // ——— Source modal: two folders ———
  function updateFoldersSummaryAndButton() {
    var videoFiles = sourceInputVideosDir && sourceInputVideosDir.files ? sourceInputVideosDir.files : [];
    var jsonFiles = sourceInputJsonDir && sourceInputJsonDir.files ? sourceInputJsonDir.files : [];
    if (videoFiles.length === 0 && jsonFiles.length === 0) {
      if (sourceFoldersSummary) { sourceFoldersSummary.hidden = true; sourceFoldersSummary.textContent = ''; }
      if (sourceBtnOpenList) sourceBtnOpenList.disabled = true;
      return;
    }
    var entries = ListBrowse && ListBrowse.buildListFromTwoFolders ? ListBrowse.buildListFromTwoFolders(videoFiles, jsonFiles) : [];
    var nVideos = 0, nJson = 0;
    for (var i = 0; i < videoFiles.length; i++) { if (videoFiles[i].name && /\.(mp4|webm|mov)$/i.test(videoFiles[i].name)) nVideos++; }
    for (var j = 0; j < jsonFiles.length; j++) { if (jsonFiles[j].name && /\.json$/i.test(jsonFiles[j].name)) nJson++; }
    if (sourceFoldersSummary) {
      sourceFoldersSummary.hidden = false;
      sourceFoldersSummary.textContent = nVideos + ' videos, ' + nJson + ' annotations, ' + entries.length + ' matched.';
    }
    if (sourceBtnOpenList) sourceBtnOpenList.disabled = entries.length === 0;
  }
  if (sourceInputVideosDir) {
    sourceInputVideosDir.addEventListener('change', function () {
      if (sourceVideosDirname) sourceVideosDirname.textContent = (sourceInputVideosDir.files && sourceInputVideosDir.files[0]) ? sourceInputVideosDir.files[0].webkitRelativePath.split('/')[0] || sourceInputVideosDir.files[0].name : '—';
      updateFoldersSummaryAndButton();
    });
  }
  if (sourceInputJsonDir) {
    sourceInputJsonDir.addEventListener('change', function () {
      if (sourceJsonDirname) sourceJsonDirname.textContent = (sourceInputJsonDir.files && sourceInputJsonDir.files[0]) ? sourceInputJsonDir.files[0].webkitRelativePath.split('/')[0] || sourceInputJsonDir.files[0].name : '—';
      updateFoldersSummaryAndButton();
    });
  }
  if (sourceBtnOpenList) {
    sourceBtnOpenList.addEventListener('click', function () {
      var videoFiles = sourceInputVideosDir && sourceInputVideosDir.files ? sourceInputVideosDir.files : [];
      var jsonFiles = sourceInputJsonDir && sourceInputJsonDir.files ? sourceInputJsonDir.files : [];
      var arrV = []; for (var i = 0; i < videoFiles.length; i++) arrV.push(videoFiles[i]);
      var arrJ = []; for (var j = 0; j < jsonFiles.length; j++) arrJ.push(jsonFiles[j]);
      state.listEntries = ListBrowse && ListBrowse.buildListFromTwoFolders ? ListBrowse.buildListFromTwoFolders(arrV, arrJ) : [];
      closeSourceModal();
      if (listCount) listCount.textContent = state.listEntries.length;
      if (listEmpty) listEmpty.hidden = state.listEntries.length > 0;
      if (listVirtualContainer) listVirtualContainer.hidden = state.listEntries.length === 0;
      if (ListBrowse && listVirtualContainer && listVirtualInner && state.listEntries.length > 0) {
        if (listRefreshFn) listRefreshFn = null;
        listRefreshFn = ListBrowse.setupVirtualList(listVirtualContainer, state.listEntries, {
          innerEl: listVirtualInner,
          onOpenVideo: onListOpenVideo,
          rowHeight: ListBrowse.ROW_HEIGHT || 40
        });
      }
      openListDrawer();
    });
  }

  function onListOpenVideo(index) {
    var entry = state.listEntries[index];
    if (!entry || !entry.jsonFile || !entry.videoFile) return;
    revokeCurrentVideoURL();
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var record = JSON.parse(reader.result);
        buildStateFromRecord(record);
        state.currentVideoObjectURL = URL.createObjectURL(entry.videoFile);
        if (videoEl) videoEl.src = state.currentVideoObjectURL;
        closeListDrawer();
        renderAll();
      } catch (e) {
        alert('Invalid JSON for this entry: ' + e.message);
      }
    };
    reader.onerror = function () { alert('Failed to read JSON file.'); };
    reader.readAsText(entry.jsonFile);
  }

  if (btnChangeSource) btnChangeSource.addEventListener('click', function () {
    revokeCurrentVideoURL();
    openSourceModal();
  });
  if (btnHamburger) btnHamburger.addEventListener('click', toggleListDrawer);
  if (listDrawerClose) listDrawerClose.addEventListener('click', closeListDrawer);
  if (listDrawer) {
    var listDrawerBackdrop = listDrawer.querySelector('.list-drawer-backdrop');
    if (listDrawerBackdrop) listDrawerBackdrop.addEventListener('click', closeListDrawer);
  }
  if (sourceModalClose) sourceModalClose.addEventListener('click', closeSourceModal);
  if (sourceModal) {
    var sourceBackdrop = sourceModal.querySelector('.modal-backdrop');
    if (sourceBackdrop) sourceBackdrop.addEventListener('click', closeSourceModal);
  }

  // ——— Annotation dropdowns (per section) ———
  function populateAnnotationSelect(selectEl, selectedId) {
    if (!selectEl || !Action100MData || !Action100MData.ANNOTATION_OPTIONS) return;
    selectEl.innerHTML = '';
    var opts = Action100MData.ANNOTATION_OPTIONS;
    for (var i = 0; i < opts.length; i++) {
      var opt = document.createElement('option');
      opt.value = opts[i].id;
      opt.textContent = opts[i].label;
      if (opts[i].id === selectedId) opt.selected = true;
      selectEl.appendChild(opt);
    }
  }
  populateAnnotationSelect(nodesAnnotationEl, state.nodesFocusId);
  populateAnnotationSelect(timelineAnnotationEl, state.timelineFocusId);
  if (nodesAnnotationEl) {
    nodesAnnotationEl.addEventListener('change', function () {
      state.nodesFocusId = nodesAnnotationEl.value || 'gpt.summary.brief';
      renderAll();
    });
  }
  if (timelineAnnotationEl) {
    timelineAnnotationEl.addEventListener('change', function () {
      state.timelineFocusId = timelineAnnotationEl.value || 'gpt.action.brief';
      renderAll();
    });
  }

  maxLevelSelect.addEventListener('change', function () {
    renderAll();
  });

  var timelineSecInViewEl = document.getElementById('timeline-sec-in-view');
  if (timelineSecInViewEl) timelineSecInViewEl.addEventListener('change', renderAll);

  if (btnMetadata) btnMetadata.addEventListener('click', openMetadataModal);
  if (btnTranscript) btnTranscript.addEventListener('click', openTranscriptModal);
  if (btnAbout) btnAbout.addEventListener('click', openAboutModal);
  if (metadataModalClose) metadataModalClose.addEventListener('click', closeMetadataModal);
  if (aboutModalClose) aboutModalClose.addEventListener('click', closeAboutModal);
  if (transcriptModalClose) transcriptModalClose.addEventListener('click', closeTranscriptModal);
  if (metadataModal) {
    var backdrop = metadataModal.querySelector('.modal-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeMetadataModal);
  }
  if (transcriptModal) {
    var transcriptBackdrop = transcriptModal.querySelector('.modal-backdrop');
    if (transcriptBackdrop) transcriptBackdrop.addEventListener('click', closeTranscriptModal);
  }
  if (pathModalClose) pathModalClose.addEventListener('click', closePathModal);
  if (pathModal) {
    var pathBackdrop = pathModal.querySelector('.modal-backdrop');
    if (pathBackdrop) pathBackdrop.addEventListener('click', closePathModal);
  }
  if (aboutModal) {
    var aboutBackdrop = aboutModal.querySelector('.modal-backdrop');
    if (aboutBackdrop) aboutBackdrop.addEventListener('click', closeAboutModal);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (listDrawer && listDrawer.classList.contains('list-drawer--open')) closeListDrawer();
      else if (sourceModal && !sourceModal.hidden) closeSourceModal();
      else if (metadataModal && !metadataModal.hidden) closeMetadataModal();
      else if (transcriptModal && !transcriptModal.hidden) closeTranscriptModal();
      else if (pathModal && !pathModal.hidden) closePathModal();
      else if (aboutModal && !aboutModal.hidden) closeAboutModal();
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
        var secInView = getSecondsInView();
        Timeline.renderTimeline(timelineContainer, state.nodesByLevel, state.durationSec, state.timelineFocusId, activeIds, state.nodeById, {
          timelineWidthPx: timelineW,
          secondsInView: secInView,
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
  if (listCount) listCount.textContent = '0';
  openSourceModal();
  renderAll();
})();
