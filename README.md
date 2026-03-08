# Kriya Visualizer

A **static, read-only** web visualizer for Action100M-style annotations: video plus a tree of temporal segments with multiple annotation fields. One screen: video, timeline (one row per level), nodes at current time, metadata, and transcript.

## Features

- **Two ways to load content**
  - **Single video + JSON**: Pick one annotation JSON file and one video file (e.g. MP4).
  - **Two folders**: Pick a folder of videos and a folder of JSON files. The app matches by **filename stem** (e.g. `1.mp4` ↔ `1.json`) and builds a browsable list. Use the **hamburger menu** (≡) to open the list and switch between videos; supports large lists via a virtual list.
- **Video view**: Video player, timeline, “Nodes at current time” panel, metadata and transcript.
- **Timeline**: One row per hierarchy level; segments at the current playback time are highlighted. Click a segment to seek; use **Details** (or “{ }”) to open the full node JSON in a modal. Optional **max level** and **seconds in view** controls; overlap warning when segments at the same level overlap.
- **Nodes at current time**: Path from root to each active node and the focused annotation; **Details** opens the node JSON modal; **Path** opens a modal showing the full path.
- **Transcript**: If the metadata transcript is valid SRT (or an array of `{ start, end, text }`), the current cue is shown under the video and the list scrolls with playback. Otherwise the transcript is shown as plain text (Transcript button opens a modal).
- **Metadata**: Title, description, and optional fields via the Metadata button.
- **Local only**: No backend, no Hugging Face API. All data comes from files you select (file inputs or folder picks).

## Tech

- **Vanilla HTML/CSS/JS**: No build step. Open `index.html` in a browser or serve the folder with any static server.
- **Browsers**: Chrome or Firefox recommended (folder selection uses `webkitdirectory`). Modern ES5+ and HTML5 `<video>`.

## How to run

1. **From disk**: Open `index.html` in a browser (e.g. double-click or `file:///path/to/kriya-viz/index.html`). Some browsers restrict local file access; if something fails, use a local server (step 2).
2. **With a static server** (recommended for folder mode and reliable video loading):
   ```bash
   python -m http.server 8080
   # or: npx serve
   ```
   Then open `http://localhost:8080`.

## How to use

1. **Select source**: On first load (or when you click **Change source**) the “Select source” modal appears.
   - **Single video + JSON**: Choose one JSON file and one video file, then click **Open video**.
   - **Two folders**: Choose a videos folder and a JSON folder. The app shows how many videos, annotations, and matched pairs; click **Open list** to build the list and open the list drawer.
2. **Video list** (when using two folders): Click the **≡** (hamburger) to open the list. Each row shows index, stem/id, and **Open**. Click a row or **Open** to load that video and its annotation.
3. **Annotation dropdowns**: Choose which field to show on the timeline and in “Nodes at current time” (e.g. “GPT summary (brief)”, “PLM caption”).
4. **Timeline**: Click a segment to seek; use **Details** (or “{ }”) on a segment to open the full node JSON in a modal. Use **Sec in view** and **Max level** to adjust the timeline.
5. **Nodes at current time**: **Details** opens the node JSON modal; **Path** opens the path-from-root modal.
6. **Transcript**: With SRT (or time-based array), the current line is shown under the video; otherwise use **Transcript** to open the plain-text modal.
7. **Metadata**: Click **Metadata** to view title and description.
8. **Keyboard**: Space = play/pause; Left/Right = seek 5 s; Escape = close modals or list drawer.

## Data format

The app expects **one JSON file per video** with this shape (see `docs/plan.md` §13):

- **Root**: `video_uid`, `metadata` (optional), `nodes` (array of segment nodes), optional `video_src`.
- **Metadata**: Optional `title`, `description`, `duration`, `transcript` (SRT string, or array of `{ start, end, text }` or `{ time, text }`), etc.
- **Nodes**: Each node has `node_id`, `parent_id`, `level`, `start`, `end`, and annotation fields (`gpt.summary.brief`, `gpt.action.brief`, `plm_caption`, etc.).

The app does **not** read Parquet. Use a data-prep script (e.g. in the Action100M repo) to export one JSON per video from your dataset if needed. If your dataset lives under a `dataset` symlink, keep it out of the repo (e.g. via `.gitignore`); the visualizer never reads it at runtime.

## Repo layout

```
kriya-viz/
├── index.html          # Single page: top bar, list drawer, video view, modals
├── css/
│   └── style.css       # Layout, timeline, list, transcript, modals
├── js/
│   ├── app.js          # Entry: state, source modal, video events, list integration
│   ├── data.js         # nodesByLevel, nodeById, getNodesAtTime, getPathToRoot, getNodeLabel
│   ├── srt.js          # SRT parse and getCurrentCue; supports array transcript
│   ├── timeline.js     # Timeline render, seek, active state
│   ├── nodes-panel.js  # Nodes at current time panel (path, Details, Path modal)
│   ├── metadata.js     # (used by app for metadata/transcript modals)
│   ├── modal.js        # Node JSON popup (Copy, close)
│   └── list.js         # Two-folder discovery, virtual list, open video from list
├── docs/
│   ├── plan.md         # Spec and implementation notes
│   └── list-browse-v2.md  # List-browse (two folders) design
├── LICENSE
└── README.md
```

## License

MIT License. See [LICENSE](LICENSE). Copyright (c) 2025 Mind and Motion Labs.
