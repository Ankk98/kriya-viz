/**
 * SRT transcript parsing and current-cue lookup.
 * Per docs/plan.md §14.
 */

(function (global) {
  'use strict';

  var SrtCue; // { index, startSec, endSec, text }

  /**
   * Parse HH:MM:SS,mmm to seconds (float).
   */
  function parseSrtTimestamp(str) {
    if (typeof str !== 'string') return NaN;
    var m = str.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
    if (!m) return NaN;
    var h = parseInt(m[1], 10);
    var min = parseInt(m[2], 10);
    var sec = parseInt(m[3], 10);
    var ms = parseInt(m[4], 10);
    if (m[4].length === 2) ms *= 10;
    if (m[4].length === 1) ms *= 100;
    return h * 3600 + min * 60 + sec + ms / 1000;
  }

  /**
   * Parse SRT string into array of { index, startSec, endSec, text }.
   * Returns [] if no valid cues.
   */
  function parseSrt(srtString) {
    var cues = [];
    if (typeof srtString !== 'string' || !srtString.trim()) return cues;

    var blocks = srtString.split(/\n\s*\n/);
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i].trim();
      if (!block) continue;

      var lines = block.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      if (lines.length < 2) continue;

      var timeLine = lines[0];
      var arrow = timeLine.indexOf('-->');
      if (arrow === -1) {
        if (lines.length >= 3 && lines[1].indexOf('-->') !== -1) {
          timeLine = lines[1];
          arrow = timeLine.indexOf('-->');
        }
      }
      if (arrow === -1) continue;

      var startStr = timeLine.substring(0, arrow).trim();
      var endStr = timeLine.substring(arrow + 3).trim();
      var startSec = parseSrtTimestamp(startStr);
      var endSec = parseSrtTimestamp(endStr);
      if (Number.isNaN(startSec) || Number.isNaN(endSec)) continue;

      var textLines = [];
      var timeLineIdx = lines.indexOf(timeLine);
      if (timeLineIdx !== -1) {
        for (var j = timeLineIdx + 1; j < lines.length; j++) textLines.push(lines[j]);
      } else {
        textLines = lines.slice(1);
      }
      var text = textLines.join(' ').trim();

      cues.push({
        index: cues.length + 1,
        startSec: startSec,
        endSec: endSec,
        text: text
      });
    }
    return cues;
  }

  /**
   * Find cue that contains currentTime (startSec <= currentTime < endSec).
   */
  function getCurrentCue(cues, currentTime) {
    if (!Array.isArray(cues) || cues.length === 0) return null;
    var t = Number(currentTime);
    if (Number.isNaN(t)) return null;
    for (var i = 0; i < cues.length; i++) {
      var c = cues[i];
      if (c.startSec <= t && t < c.endSec) return c;
    }
    return null;
  }

  global.Srt = {
    parseSrt: parseSrt,
    getCurrentCue: getCurrentCue
  };
})(typeof window !== 'undefined' ? window : this);
