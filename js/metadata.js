/**
 * Metadata and transcript: title, description, SRT or plain transcript.
 * Per docs/plan.md §10.2, §14.3.
 */

(function (global) {
  'use strict';

  var Srt = global.Srt;

  /**
   * Render metadata (title, description) and transcript.
   * If transcript parses as SRT (≥1 cue), render clickable cues and enable highlight/scroll.
   */
  function renderMetadata(metadataContainer, transcriptContainer, metadata, transcriptCues, options) {
    options = options || {};
    var currentTime = options.currentTime != null ? options.currentTime : 0;
    var onCueClick = options.onCueClick || function () {};

    // Title & description
    var emptyMeta = metadataContainer.querySelector('.metadata-empty');
    if (emptyMeta) emptyMeta.hidden = true;
    var content = metadataContainer.querySelector('.metadata-content');
    if (content) content.remove();

    var wrap = document.createElement('div');
    wrap.className = 'metadata-content';
    var title = (metadata && metadata.title) ? String(metadata.title) : '';
    var desc = (metadata && metadata.description) ? String(metadata.description) : '';
    if (!title && !desc && emptyMeta) {
      emptyMeta.textContent = 'No title or description.';
      emptyMeta.hidden = false;
    }
    if (title) {
      var h = document.createElement('p');
      h.className = 'metadata-title';
      h.textContent = title;
      wrap.appendChild(h);
    }
    if (desc) {
      var d = document.createElement('p');
      d.className = 'metadata-description';
      d.textContent = desc;
      wrap.appendChild(d);
    }
    if (title || desc) metadataContainer.appendChild(wrap);

    // Transcript
    var emptyT = transcriptContainer.querySelector('.transcript-empty');
    var transcriptContent = transcriptContainer.querySelector('.transcript-content');
    if (transcriptContent) transcriptContent.remove();

    if (!transcriptCues || transcriptCues.length === 0) {
      if (emptyT) {
        emptyT.textContent = 'No transcript.';
        emptyT.hidden = false;
      }
      return;
    }
    if (emptyT) emptyT.hidden = true;

    var tWrap = document.createElement('div');
    tWrap.className = 'transcript-content';
    for (var i = 0; i < transcriptCues.length; i++) {
      var cue = transcriptCues[i];
      var line = document.createElement('button');
      line.type = 'button';
      line.className = 'transcript-line';
      line.setAttribute('data-start', cue.startSec);
      line.setAttribute('data-end', cue.endSec);
      line.textContent = '[' + formatTime(cue.startSec) + '] ' + (cue.text || '');
      line.addEventListener('click', function (start) {
        return function () { onCueClick(start); };
      }(cue.startSec));
      tWrap.appendChild(line);
    }
    transcriptContainer.appendChild(tWrap);
  }

  /**
   * Render transcript as plain text (no cues).
   */
  function renderTranscriptPlain(transcriptContainer, plainText) {
    var emptyT = transcriptContainer.querySelector('.transcript-empty');
    var transcriptContent = transcriptContainer.querySelector('.transcript-content');
    if (transcriptContent) transcriptContent.remove();
    if (emptyT) emptyT.hidden = true;
    var wrap = document.createElement('div');
    wrap.className = 'transcript-content transcript-plain';
    wrap.textContent = plainText || 'No transcript.';
    transcriptContainer.appendChild(wrap);
  }

  /**
   * Highlight current cue and scroll it into view. Call on timeupdate.
   */
  function updateTranscriptHighlight(transcriptContainer, currentCue) {
    var lines = transcriptContainer.querySelectorAll('.transcript-line');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var start = parseFloat(line.getAttribute('data-start'));
      var end = parseFloat(line.getAttribute('data-end'));
      var isCurrent = currentCue && currentCue.startSec === start && currentCue.endSec === end;
      if (isCurrent) {
        line.classList.add('transcript-line--current');
        line.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        line.classList.remove('transcript-line--current');
      }
    }
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

  global.Metadata = {
    renderMetadata: renderMetadata,
    renderTranscriptPlain: renderTranscriptPlain,
    updateTranscriptHighlight: updateTranscriptHighlight
  };
})(typeof window !== 'undefined' ? window : this);
