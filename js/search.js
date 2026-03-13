(function (global) {
  'use strict';

  var Action100MData = global.Action100MData;

  function safeLower(str) {
    if (str == null) return '';
    return String(str).toLowerCase();
  }

  function getAllAnnotationText(node) {
    if (!node) return '';
    var parts = [];

    if (Action100MData && Action100MData.getNodeLabel) {
      var label = Action100MData.getNodeLabel(node, 'gpt.summary.brief');
      if (label && label !== '(no label)') parts.push(label);
    }

    var gpt = node.gpt || {};
    var gptSummary = gpt.summary || {};
    var gptAction = gpt.action || {};

    if (gptSummary.brief != null) parts.push(String(gptSummary.brief));
    if (gptSummary.detailed != null) parts.push(String(gptSummary.detailed));
    if (gptAction.brief != null) parts.push(String(gptAction.brief));
    if (gptAction.detailed != null) parts.push(String(gptAction.detailed));
    if (gptAction.actor != null) parts.push(String(gptAction.actor));

    if (node.plm_caption != null) parts.push(String(node.plm_caption));
    if (node.plm_action != null) parts.push(String(node.plm_action));
    if (node.llama3_caption != null) parts.push(String(node.llama3_caption));

    if (parts.length === 0) return '';
    return parts.join(' ====== ');
  }

  function buildIndex(nodes) {
    var index = [];
    if (!Array.isArray(nodes)) return index;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node) continue;
      var text = getAllAnnotationText(node);
      if (!text) continue;
      index.push({
        node: node,
        text: safeLower(text)
      });
    }
    return index;
  }

  function escapeForRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function search(index, query, options) {
    options = options || {};

    var trimmed = query != null ? String(query).trim() : '';
    if (!trimmed) return [];

    var useRegex = !!options.regex;
    var lowerQuery = safeLower(trimmed);
    var regex = null;

    if (useRegex) {
      try {
        regex = new RegExp(trimmed, 'gi');
      } catch (e) {
        return [];
      }
    } else {
      regex = new RegExp(escapeForRegex(lowerQuery), 'gi');
    }

    var results = [];
    for (var i = 0; i < index.length; i++) {
      var entry = index[i];
      var text = entry.text;
      if (!text) continue;

      var match;
      var totalMatched = 0;
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        var len = match[0] != null ? String(match[0]).length : 0;
        if (len === 0) {
          regex.lastIndex++;
          continue;
        }
        totalMatched += len;
        if (!useRegex && totalMatched >= lowerQuery.length) break;
      }

      if (totalMatched <= 0) continue;

      var node = entry.node;
      var start = Number(node.start);
      var end = Number(node.end);
      var duration = (!Number.isNaN(end) && !Number.isNaN(start)) ? Math.max(0.1, end - start) : 10;

      results.push({
        node: node,
        duration: duration
      });
    }

    results.sort(function (a, b) {
      if (a.duration !== b.duration) return a.duration - b.duration;
      var sa = Number(a.node.start) || 0;
      var sb = Number(b.node.start) || 0;
      return sa - sb;
    });

    return results;
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

  function renderResults(container, results, options) {
    options = options || {};
    var nodeById = options.nodeById;
    var focusId = options.focusId || 'gpt.summary.brief';
    var onSelect = typeof options.onSelect === 'function' ? options.onSelect : function () {};
    var maxResults = typeof options.maxResults === 'number' && options.maxResults > 0 ? options.maxResults : 200;
    var query = options.query != null ? String(options.query) : '';
    var useRegex = !!options.regex;

    var lowerQuery = safeLower(query);
    var userRegex = null;
    if (useRegex && query) {
      try {
        userRegex = new RegExp(query, 'gi');
      } catch (e) {
        userRegex = null;
      }
    }

    if (!container) return;
    container.innerHTML = '';

    if (!results || results.length === 0) {
      var emptyEl = document.createElement('div');
      emptyEl.className = 'search-empty';
      emptyEl.textContent = 'No matching nodes.';
      container.appendChild(emptyEl);
      return;
    }

    var count = Math.min(results.length, maxResults);
    for (var i = 0; i < count; i++) {
      var r = results[i];
      var node = r.node;

      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'search-result';

      (function (capturedNode) {
        row.addEventListener('click', function () {
          onSelect(capturedNode);
        });
      })(node);

      var titleEl = document.createElement('div');
      titleEl.className = 'search-result-title';
      var label = Action100MData && Action100MData.getNodeLabel ? Action100MData.getNodeLabel(node, focusId) : '';
      titleEl.textContent = label;
      row.appendChild(titleEl);

      var metaEl = document.createElement('div');
      metaEl.className = 'search-result-meta';

      var startSec = Number(node.start);
      var endSec = Number(node.end);
      var timeText = (!Number.isNaN(startSec) && !Number.isNaN(endSec))
        ? '[' + formatTime(startSec) + ' – ' + formatTime(endSec) + ']'
        : '[? – ?]';

      var levelText = node.level != null && !Number.isNaN(Number(node.level))
        ? 'Level ' + String(node.level)
        : 'Level ?';

      metaEl.textContent = timeText + ' · ' + levelText;
      row.appendChild(metaEl);

      var fieldsContainer = document.createElement('div');
      fieldsContainer.className = 'search-result-fields';

      if (query) {
        var anyFieldShown = false;
        if (Action100MData && Action100MData.ANNOTATION_OPTIONS) {
          var opts = Action100MData.ANNOTATION_OPTIONS;
          for (var k = 0; k < opts.length; k++) {
            var opt = opts[k];
            var value = Action100MData.getAnnotationValue
              ? Action100MData.getAnnotationValue(node, opt.id)
              : (node[opt.id] != null ? String(node[opt.id]) : '');
            if (!value) continue;

            var lowerVal = safeLower(value);
            var hasMatch = false;
            var parts = [];

            if (useRegex && userRegex) {
              var lastIndex = 0;
              var m;
              userRegex.lastIndex = 0;
              while ((m = userRegex.exec(value)) !== null) {
                hasMatch = true;
                var idx = m.index;
                var mText = m[0] != null ? String(m[0]) : '';
                if (idx > lastIndex) {
                  parts.push({ text: value.slice(lastIndex, idx), highlight: false });
                }
                parts.push({ text: mText, highlight: true });
                lastIndex = idx + mText.length;
                if (mText.length === 0) {
                  userRegex.lastIndex++;
                }
              }
              if (lastIndex < value.length) {
                parts.push({ text: value.slice(lastIndex), highlight: false });
              }
            } else {
              var q = lowerQuery;
              var from = 0;
              while (q && from < lowerVal.length) {
                var idx2 = lowerVal.indexOf(q, from);
                if (idx2 === -1) break;
                hasMatch = true;
                if (idx2 > from) {
                  parts.push({ text: value.slice(from, idx2), highlight: false });
                }
                parts.push({ text: value.slice(idx2, idx2 + q.length), highlight: true });
                from = idx2 + q.length;
              }
              if (!hasMatch) {
                parts = [{ text: value, highlight: false }];
              } else if (from < value.length) {
                parts.push({ text: value.slice(from), highlight: false });
              }
            }

            if (!hasMatch) continue;
            anyFieldShown = true;

            var fieldRow = document.createElement('div');
            fieldRow.className = 'search-result-field';

            var labelSpan = document.createElement('span');
            labelSpan.className = 'search-result-field-label';
            labelSpan.textContent = opt.label + ': ';
            fieldRow.appendChild(labelSpan);

            var valueSpan = document.createElement('span');
            valueSpan.className = 'search-result-field-value';
            for (var p = 0; p < parts.length; p++) {
              var span = document.createElement('span');
              if (parts[p].highlight) span.className = 'search-highlight';
              span.textContent = parts[p].text;
              valueSpan.appendChild(span);
            }
            fieldRow.appendChild(valueSpan);

            fieldsContainer.appendChild(fieldRow);
          }
        }

        if (!anyFieldShown) {
          var fallback = document.createElement('div');
          fallback.className = 'search-result-snippet';
          fallback.textContent = '(no matching annotation text to display)';
          fieldsContainer.appendChild(fallback);
        }
      }

      row.appendChild(fieldsContainer);
      container.appendChild(row);
    }
  }

  global.NodeSearch = {
    buildIndex: buildIndex,
    search: search,
    renderResults: renderResults
  };
})(typeof window !== 'undefined' ? window : this);

