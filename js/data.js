/**
 * Data layer: build indices from nodes, get nodes at time, path to root, label by focus.
 * Schema and algorithms per docs/plan.md §13, §15.
 */

(function (global) {
  'use strict';

  var ANNOTATION_OPTIONS = [
    { id: 'gpt.summary.brief', label: 'GPT summary (brief)' },
    { id: 'gpt.summary.detailed', label: 'GPT summary (detailed)' },
    { id: 'gpt.action.brief', label: 'GPT action (brief)' },
    { id: 'gpt.action.detailed', label: 'GPT action (detailed)' },
    { id: 'gpt.action.actor', label: 'GPT action (actor)' },
    { id: 'plm_caption', label: 'PLM caption' },
    { id: 'plm_action', label: 'PLM action' },
    { id: 'llama3_caption', label: 'Llama3 caption' }
  ];

  function getAnnotationValue(node, focusId) {
    if (!node) return '';
    switch (focusId) {
      case 'gpt.summary.brief':
        return (node.gpt && node.gpt.summary && node.gpt.summary.brief) != null ? String(node.gpt.summary.brief) : '';
      case 'gpt.summary.detailed':
        return (node.gpt && node.gpt.summary && node.gpt.summary.detailed) != null ? String(node.gpt.summary.detailed) : '';
      case 'gpt.action.brief':
        return (node.gpt && node.gpt.action && node.gpt.action.brief) != null ? String(node.gpt.action.brief) : '';
      case 'gpt.action.detailed':
        return (node.gpt && node.gpt.action && node.gpt.action.detailed) != null ? String(node.gpt.action.detailed) : '';
      case 'gpt.action.actor':
        return (node.gpt && node.gpt.action && node.gpt.action.actor) != null ? String(node.gpt.action.actor) : '';
      case 'plm_caption':
        return node.plm_caption != null ? String(node.plm_caption) : '';
      case 'plm_action':
        return node.plm_action != null ? String(node.plm_action) : '';
      case 'llama3_caption':
        return node.llama3_caption != null ? String(node.llama3_caption) : '';
      default:
        return '';
    }
  }

  /**
   * Build nodesByLevel: Map<level, nodes[]>, sorted by start then end per level.
   */
  function buildNodesByLevel(nodes) {
    var nodesByLevel = new Map();
    if (!Array.isArray(nodes)) return nodesByLevel;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var level = typeof node.level === 'number' ? node.level : 0;
      if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
      nodesByLevel.get(level).push(node);
    }
    nodesByLevel.forEach(function (list) {
      list.sort(function (a, b) {
        var sa = Number(a.start);
        var sb = Number(b.start);
        if (sa !== sb) return sa - sb;
        return (Number(a.end) || 0) - (Number(b.end) || 0);
      });
    });
    return nodesByLevel;
  }

  /**
   * Build nodeById: Map<node_id, node>.
   */
  function buildNodeById(nodes) {
    var nodeById = new Map();
    if (!Array.isArray(nodes)) return nodeById;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node && node.node_id != null) nodeById.set(String(node.node_id), node);
    }
    return nodeById;
  }

  /**
   * Nodes at current time, sorted by duration descending (longest first).
   */
  function getNodesAtTime(nodes, currentTime) {
    if (!Array.isArray(nodes)) return [];
    var t = Number(currentTime);
    if (Number.isNaN(t)) t = 0;
    var active = nodes.filter(function (n) {
      var start = Number(n.start);
      var end = Number(n.end);
      return !Number.isNaN(start) && !Number.isNaN(end) && n.start <= t && t < n.end;
    });
    active.sort(function (a, b) {
      var levelA = Number(a.level) || 0;
      var levelB = Number(b.level) || 0;
      if (levelB !== levelA) return levelB - levelA;
      return (Number(a.start) || 0) - (Number(b.start) || 0);
    });
    return active;
  }

  /**
   * Path from node to root (root first). Stops at orphan.
   */
  function getPathToRoot(nodeById, node) {
    var path = [];
    var current = node;
    while (current) {
      path.unshift(current);
      var pid = current.parent_id;
      current = (pid != null && pid !== '') ? (nodeById.get(String(pid)) || null) : null;
    }
    return path;
  }

  /**
   * Label for a node given focusId; fallback "(no label)".
   */
  function getNodeLabel(node, focusId) {
    var text = getAnnotationValue(node, focusId);
    if (text === null || text === undefined) text = '';
    text = String(text).trim();
    return text === '' ? '(no label)' : text;
  }

  /**
   * True if node has GPT annotation (node.gpt is a non-null object).
   * Nodes without GPT are typically ignored and often under 4 seconds.
   */
  function hasGptAnnotation(node) {
    return !!(node && node.gpt && typeof node.gpt === 'object');
  }

  /**
   * Check if any two segments at the same level overlap.
   */
  function hasOverlappingSegments(nodesByLevel) {
    if (!nodesByLevel || !nodesByLevel.size) return false;
    var result = false;
    nodesByLevel.forEach(function (list) {
      for (var i = 0; i < list.length && !result; i++) {
        for (var j = i + 1; j < list.length; j++) {
          var a = list[i];
          var b = list[j];
          var aStart = Number(a.start);
          var aEnd = Number(a.end);
          var bStart = Number(b.start);
          var bEnd = Number(b.end);
          if (aStart < bEnd && bStart < aEnd) {
            result = true;
            break;
          }
        }
      }
    });
    return result;
  }

  global.Action100MData = {
    ANNOTATION_OPTIONS: ANNOTATION_OPTIONS,
    buildNodesByLevel: buildNodesByLevel,
    buildNodeById: buildNodeById,
    getNodesAtTime: getNodesAtTime,
    getPathToRoot: getPathToRoot,
    getNodeLabel: getNodeLabel,
    getAnnotationValue: getAnnotationValue,
    hasGptAnnotation: hasGptAnnotation,
    hasOverlappingSegments: hasOverlappingSegments
  };
})(typeof window !== 'undefined' ? window : this);
