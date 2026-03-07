# Action100M Web Visualizer (v1)

A **static, read-only** web visualizer for Action100M-style annotations: one video plus a tree of temporal segments with multiple annotation fields. Same screen: video, timeline (one row per level), nodes at current time, and metadata/transcript.

## v1 scope

- **Single video**: open one annotation JSON file + one video file (no browse list).
- **Local files only**: use “Open JSON” and “Open video” file inputs; no backend, no Hugging Face API.
- **Vanilla HTML/CSS/JS**: no build step; open `index.html` in a browser or serve the folder with any static server.

## How to run

1. **From disk**: Open `index.html` in a browser (e.g. double-click or `file:///path/to/kriya-viz/index.html`). Note: some browsers restrict local file access; if something fails, use a local server (step 2).
2. **With a static server** (recommended for local video paths in JSON):
   ```bash
   python -m http.server 8080
   # or: npx serve
   ```
   Then open `http://localhost:8080` and load your files.

## How to use

1. **Open JSON**: Click “Open JSON” and select an annotation file that matches the [video record schema](docs/plan.md#13-video-record-json-schema-app-input) (`video_uid`, `metadata`, `nodes`).
2. **Open video**: Click “Open video” and select the corresponding video file (e.g. MP4). Alternatively, if your JSON has a `video_src` URL/path and you’re using a static server, the video can be loaded from that path.
3. **Annotation dropdown**: Choose which field to show on the timeline and in “Nodes at current time” (e.g. “GPT summary (brief)”, “PLM caption”).
4. **Timeline**: One row per level; segments that contain the current playback time are highlighted. **Click** a segment to seek the video to its start; use **“{ }”** or double-click a segment to open the full node JSON in a modal.
5. **Nodes at current time**: Shows the path from root to each active node and the focused annotation; **Details** opens the node JSON modal.
6. **Transcript**: If the metadata transcript is valid SRT, the current cue is highlighted and the list scrolls with playback; **click** a line to seek. Otherwise the transcript is shown as plain text.

## Repo layout

```
kriya-viz/
├── index.html       # Single page: video, timeline, nodes panel, metadata, transcript, modal
├── css/
│   └── style.css    # Layout, timeline, transcript, modal styles
├── js/
│   ├── app.js       # Entry: state, file inputs, video events
│   ├── data.js      # nodesByLevel, nodeById, getNodesAtTime, getPathToRoot, getNodeLabel
│   ├── srt.js       # SRT parse and getCurrentCue
│   ├── timeline.js  # Timeline render, seek bar, active state
│   ├── nodes-panel.js # Nodes at current time panel
│   ├── metadata.js  # Title, description, transcript (SRT or plain)
│   └── modal.js     # Node JSON popup (Copy, close)
├── docs/
│   └── plan.md      # Full spec and implementation checklist
└── README.md
```

## Data

- The app does **not** read Parquet. It expects **one JSON file per video** with the shape described in `docs/plan.md` (§13). Optional: use a data-prep script (e.g. in the Action100M repo) to export one JSON per video from `dataset/data/*.parquet`.
- If your dataset is under a `dataset` symlink in this repo, keep it ignored (e.g. via `.gitignore`); the visualizer never reads it at runtime.

## Browser support

Modern browsers with ES5+ and HTML5 `<video>`. File input and `URL.createObjectURL` for local video. No CORS issues when loading via file inputs.

## License

Use and adapt as needed for your project.
