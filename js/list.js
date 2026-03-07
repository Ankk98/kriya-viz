/**
 * List browse: two-folder discovery by filename stem, virtual list.
 * Per docs/list-browse-v2.md §6.3, §6.5.
 */

(function (global) {
  'use strict';

  var VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'];
  var ROW_HEIGHT = 40;
  var BUFFER_ROWS = 5;

  function getStem(filename) {
    if (!filename || typeof filename !== 'string') return '';
    var lastDot = filename.lastIndexOf('.');
    if (lastDot <= 0) return filename;
    return filename.slice(0, lastDot);
  }

  function hasVideoExtension(filename) {
    var lower = filename.toLowerCase();
    for (var i = 0; i < VIDEO_EXTENSIONS.length; i++) {
      if (lower.endsWith(VIDEO_EXTENSIONS[i])) return true;
    }
    return false;
  }

  function hasJsonExtension(filename) {
    return filename && typeof filename === 'string' && filename.toLowerCase().endsWith('.json');
  }

  /**
   * Build stem -> File map from file list; for videos use only video extensions, for JSON only .json.
   * Duplicate stems: use first encountered.
   */
  function stemMapFromFiles(files, isVideo) {
    var map = Object.create(null);
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (!f || !f.name) continue;
      if (isVideo && !hasVideoExtension(f.name)) continue;
      if (!isVideo && !hasJsonExtension(f.name)) continue;
      var stem = getStem(f.name);
      if (!stem) continue;
      if (!map[stem]) map[stem] = f;
    }
    return map;
  }

  /**
   * Natural sort: human-friendly order (1, 2, 10, 20 not 1, 10, 2, 20).
   */
  var collator = typeof Intl !== 'undefined' && Intl.Collator
    ? new Intl.Collator(undefined, { numeric: true })
    : null;

  function compareStems(a, b) {
    if (collator) return collator.compare(a, b);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  /**
   * Input: two arrays of File (from folder picker FileLists).
   * Output: array of { stem, videoFile, jsonFile } sorted by stem (natural sort).
   */
  function buildListFromTwoFolders(videoFiles, jsonFiles) {
    var videoArr = [];
    if (videoFiles && videoFiles.length) {
      for (var i = 0; i < videoFiles.length; i++) videoArr.push(videoFiles[i]);
    }
    var jsonArr = [];
    if (jsonFiles && jsonFiles.length) {
      for (var j = 0; j < jsonFiles.length; j++) jsonArr.push(jsonFiles[j]);
    }
    var videoByStem = stemMapFromFiles(videoArr, true);
    var jsonByStem = stemMapFromFiles(jsonArr, false);
    var stems = [];
    for (var s in videoByStem) {
      if (Object.prototype.hasOwnProperty.call(videoByStem, s) && jsonByStem[s]) {
        stems.push(s);
      }
    }
    stems.sort(compareStems);
    var listEntries = [];
    for (var k = 0; k < stems.length; k++) {
      var stem = stems[k];
      listEntries.push({
        stem: stem,
        videoFile: videoByStem[stem],
        jsonFile: jsonByStem[stem]
      });
    }
    return listEntries;
  }

  /**
   * Virtual list: only visible rows in DOM.
   * container: scrollable element (list-virtual-container)
   * listEntries: array of { stem, videoFile, jsonFile }
   * opts: { onOpenVideo: function(index) {}, innerEl, rowHeight }
   */
  function renderList(container, listEntries, opts) {
    var innerEl = opts.innerEl;
    var onOpenVideo = opts.onOpenVideo || function () {};
    var rowHeight = opts.rowHeight != null ? opts.rowHeight : ROW_HEIGHT;
    if (!innerEl || !container) return;

    var total = listEntries.length;
    var containerHeight = container.clientHeight || 400;
    var scrollTop = container.scrollTop || 0;
    var startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - BUFFER_ROWS);
    var visibleCount = Math.ceil(containerHeight / rowHeight) + 2 * BUFFER_ROWS;
    var endIndex = Math.min(total - 1, startIndex + visibleCount - 1);
    if (endIndex < startIndex) endIndex = startIndex;

    var totalHeight = total * rowHeight;
    innerEl.style.height = totalHeight + 'px';
    innerEl.style.minHeight = totalHeight + 'px';

    var fragment = document.createDocumentFragment();
    for (var i = startIndex; i <= endIndex && i < total; i++) {
      var entry = listEntries[i];
      var row = document.createElement('div');
      row.className = 'list-row';
      row.dataset.index = String(i);
      row.style.height = rowHeight + 'px';
      row.style.top = i * rowHeight + 'px';

      var colIndex = document.createElement('span');
      colIndex.className = 'list-col-index';
      colIndex.textContent = i;
      row.appendChild(colIndex);

      var colStem = document.createElement('span');
      colStem.className = 'list-col-stem';
      colStem.textContent = entry.stem || '—';
      row.appendChild(colStem);

      var colAction = document.createElement('span');
      colAction.className = 'list-col-action';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'list-open-btn';
      btn.textContent = 'Open';
      (function (idx) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          onOpenVideo(idx);
        });
      })(i);
      colAction.appendChild(btn);
      row.appendChild(colAction);

      (function (idx) {
        row.addEventListener('click', function () { onOpenVideo(idx); });
      })(i);

      fragment.appendChild(row);
    }

    innerEl.innerHTML = '';
    innerEl.appendChild(fragment);
  }

  /**
   * Setup virtual list: bind scroll/resize and initial render.
   * Returns a function to call when listEntries or container size might have changed.
   */
  function setupVirtualList(container, listEntries, opts) {
    if (!container) return function () {};
    var innerEl = opts.innerEl;
    if (!innerEl) return function () {};

    function refresh() {
      renderList(container, listEntries, opts);
    }

    container.addEventListener('scroll', refresh);
    window.addEventListener('resize', refresh);
    refresh();
    return refresh;
  }

  global.ListBrowse = {
    buildListFromTwoFolders: buildListFromTwoFolders,
    renderList: renderList,
    setupVirtualList: setupVirtualList,
    ROW_HEIGHT: ROW_HEIGHT
  };
})(typeof window !== 'undefined' ? window : this);
