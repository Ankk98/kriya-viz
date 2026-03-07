# Action100M Web Visualizer: Research, Options & UX

## Your requirements (summary)

- **Web-based static visualizer** for Action100M-style annotations
- **Same screen**: video + annotations
- **Playback controls** for the video
- **Timeline** (one row per level; hierarchy visible; segments highlighted by current video time)
- **Nodes at current time**: path and annotation for the segment(s) active at playback time
- **Focus on a specific annotation type** (e.g. “GPT-OSS summary brief” only)
- **Also show**: transcripts, video title, video description

**Dataset**: This repo has a symlink `./dataset` pointing to the Action100M-style dataset (e.g. `action100m-preview`). The dataset contains a **`data/`** folder with parquet files (e.g. `dataset/data/part-00000.parquet`, `part-00001.parquet`, …). The visualizer does **not** read parquet at runtime: it loads one **annotation JSON** + one **video file** (see §18.1 for optional parquet→JSON data-prep script).

---

## 1. Existing tools (what’s out there)

### 1.1 VIA 3 (VGG Image Annotator) — already used with Action100M

- **Source**: Your `~/repos/Action100M` has `download_action100m_for_via.py` and `docs/VIA_ACTION100M_GUIDE.md`.
- **What it does**: Exports one VIA3 project per video with **flat** temporal segments; each segment has a single label (e.g. `gpt.action.brief`). You can view/edit segments on a timeline and play the video.
- **Gaps for your goals**:
  - No **tree** of nodes (only flat segments).
  - No **annotation-type focus** (e.g. “show only gpt.summary.brief”); only one attribute.
  - No **“nodes at current time”** view; it’s segment list/timeline.
  - Transcript/title/description are in raw JSON or sidecar files, not integrated in the same UI.
  - Aimed at **editing**, not a read-only “static” visualizer.

**Verdict**: Good for editing flat segments; not a match for tree + multi-field focus + “current time” + integrated metadata.

### 1.2 Other video annotation / timeline tools

| Tool | Type | Tree / hierarchy | “Focus on one annotation type” | “Nodes at current time” | Transcript / title / desc | Static web? |
|------|------|-------------------|--------------------------------|---------------------------|----------------------------|-------------|
| **Python Video Annotator** | Desktop (Python) | Project tree (files), not segment tree | No | Timeline only | No | No |
| **TimeLineAnnotator (Tilia)** | Desktop GUI | No | No | Timeline | No | No |
| **VideoTagger** | Desktop | No | No | Timeline | No | No |
| **vatic.js** | Web (JS) | Object list, not temporal tree | No | Bounding boxes | No | Yes |
| **InfantLab/video-annotation-viewer** | Web (React/TS) | No | No | Timeline + tracks | Different format (COCO, WebVTT, RTTM) | Yes (needs adapter) |
| **Amalia.js** | Web (HTML5) | No | No | Segment timeline (ranges) | No | Yes (plugin base) |
| **interactive-timeline-video-player** | Web (vanilla JS) | No | No | Timeline | No | Yes |
| **timelens.js** | Web (plugin) | No | No | Thumbnails on timeline | No | Yes |

None of these implement:

- Action100M’s **Tree-of-Captions** (parent_id, level, node_id),
- **Multiple annotation fields per segment** (summary.brief, summary.detailed, action.brief, action.detailed, actor, plm_*, llama3_caption) with a “focus on one” view,
- **“All nodes active at current time”** as a first-class view,
- **Transcript + title + description** in the same UI.

So there is **no ready-made annotation tool** that fits Action100M in the way you described. A **custom** tool is the practical path.

---

## 2. Custom tool: options and pros/cons

### Option A: Static HTML + vanilla JS (no build step)

- **What**: Single (or few) HTML files; JS loads one “video record” (e.g. from a pre-generated JSON per video). Video can be local file or a URL; annotations from JSON.
- **Pros**: No npm/build; easy to open from `file://` or any static server; easy to host on GitHub Pages or similar; works offline.
- **Cons**: More manual DOM/state code; scaling to many components can get messy.

### Option B: Static site with a bundler (e.g. Vite + React or Vue)

- **What**: SPA that loads the same kind of JSON (one video + nodes + metadata); still no backend — static export or dev server.
- **Pros**: Component structure, state management, and timeline UI are easier; good for complex “focus” and filtering logic.
- **Cons**: Requires Node/npm and a build step for production.

### Option C: Static site + small “data prep” script (recommended)

- **What**: Optional **data-prep script** (e.g. in Action100M repo) that:
  - Reads parquet from the dataset’s **`data/`** folder (e.g. `./dataset/data/*.parquet` when the repo has a `dataset` symlink),
  - For each video row: outputs **one JSON file** with `video_uid`, `metadata`, `nodes` (and optionally `video_src`). Same shape as §13.
  - Reference: Action100M’s `scripts/download_action100m_for_via.py` already reads parquet columns `video_uid`, `metadata`, `nodes` and writes `raw_annotations/.../action100m_raw.json` per video; a dedicated “one JSON per video for the visualizer” script can follow that pattern (or reuse that output: the visualizer can load those raw JSONs + a video file).
- **Visualizer**: **No Python dependency.** The app is HTML/JS only. User loads **two things**: (1) annotation JSON file, (2) video file. So the tool loads 2 files (video + annotation file); parquet is only used by the optional data-prep step.
- **Pros**: Clear separation (dataset → JSON; app → view only); no Python in the browser or in the visualizer repo.
- **Cons**: Extra step to run the script when you add new videos (or use existing VIA download output as-is).

### Option D: Backend that serves parquet/DB + frontend

- **What**: Small server (e.g. FastAPI/Flask) that serves video list, metadata, and nodes; frontend fetches per-video or per-page.
- **Pros**: Can browse large dataset without pre-generating all JSONs; search/filter on server.
- **Cons**: Not “static”; requires running a server; more moving parts.

**Recommendation**: **Option C** with a **Vite + React** (or Vue) frontend (Option B) gives the best balance: static deploy, rich UI, and a single “video record” JSON schema that can be produced from parquet or from maml-api responses. If you want zero build tooling, use Option A (vanilla JS) with the same JSON schema and script.

---

## 3. Suggested UX for the tool

### 3.1 Layout (single video view)

- **Top**: Video player (HTML5 `<video>`) with standard playback controls (play/pause, seek, volume, fullscreen). Optional: current time and duration.
- **Annotation focus** (dropdown in top bar): e.g. “GPT summary (brief)”, “GPT summary (detailed)”, “GPT action (brief)”, etc. The chosen field is used for labels on the timeline and in “Nodes at current time”.
- **Timeline**: Below the video, segments as horizontal bars, **one row per level** (hierarchy visible). **Segments that contain the current playback time are highlighted** (e.g. different color or border). Clicking a segment seeks the video to that segment’s start. Each bar shows the focused annotation (label or tooltip).
- **Nodes at current time**: A dedicated block showing the path from root to the node(s) for which `start <= currentTime < end`, with the selected annotation type shown. This is the “all nodes active at this moment” view.
- **Metadata section**: Video **title**, **description**, and **transcript** (SRT or plain). Clicking a transcript line seeks the video.

### 3.2 Data flow

- **Input**: One JSON file per video, e.g. `{ "video_uid": "...", "metadata": { "title", "description", "duration", "transcript", ... }, "nodes": [ ... ] }`.
- **Video source**: Either a `video_src` URL/path in that JSON (local path relative to the HTML or absolute URL) or a convention like `videos/<video_uid>.mp4`. For true static use with local files, you’d open the app from a static server and ensure `video_src` points to a path the browser can load (or use a file input to pick the video).

### 3.3 Optional enhancements

- **URL state**: Encode `video_uid` (or JSON path) and optional `t` (time in seconds) in the URL so you can share “this video at this moment.”
- **Keyboard**: Space = play/pause; arrow keys = seek; optional shortcut to focus “nodes at current time.”

---

## 4. Clarifying questions

1. **Video source**: Will you always use **locally downloaded** videos (e.g. from `download_action100m_for_via.py` or yt-dlp), or do you also want to support **YouTube embed** (or link) when you don’t have the file? (YouTube embed has limitations with precise seeking and CORS.)
2. **Scope**: Do you need to **browse a list** of many videos (e.g. from the full preview set) and then open one, or is it enough to **open a single video** by path/URL (e.g. “open this JSON + this MP4”)?
3. **Transcript format**: In your parquet `metadata`, is `transcript` a string, or a list of `{ "time", "text" }` (or similar)? Do you want clickable timestamp → seek?
4. **Where should it live**: Should the visualizer live in **maml-api** (e.g. `maml-api/visualizer/` or `maml-api/tools/action100m-viewer/`) or in **Action100M** repo, or a separate repo?
5. **Static vs editable**: Confirm you only need **read-only** viewing (no editing of segments or labels). If you later want editing, we can still start read-only and add export/save later.
6. **Build preference**: Do you prefer **no build** (vanilla JS + HTML) so anyone can open it without Node, or is **Vite + React** (or similar) acceptable for better maintainability?

Once you answer these, the next step is to define the exact **JSON schema** for “one video record” (and optionally a small Python script to produce it from parquet + optional local video list) and then implement the layout and behavior above in your chosen stack.

---

## 5. Locked decisions (from your answers)

| Topic | Decision |
|-------|----------|
| **Video source** | Both local and YouTube; **v1** = local focus, **v2** = add YouTube |
| **Scope** | **v1** = single video (open one JSON + video); **v2** = browse list of videos |
| **Transcript** | Support **both** timestamped and plain; plain as fallback; clickable seek when timestamps exist |
| **Repo** | **Separate repo** for the visualizer |
| **Editing** | **Read-only** only |
| **Build** | Prefer **vanilla JS**; use a UI framework only if the format/complexity really requires it. Prefer **simplicity**. |
| **VIA** | Not sufficient; we are building a **better tool** with timeline + focus + current-time view. |

---

## 6. Hugging Face compatibility and deployment

Goal: deploy the visualizer on **Hugging Face** so users can browse Action100M (or any dataset with the same schema) **entirely in the browser** — no local setup. Data from HF, video from YouTube.

### 6.1 How it can work

- **Data**: Hugging Face provides the [Dataset Viewer API](https://huggingface.co/docs/datasets-server/rows). For datasets that have Parquet exports (e.g. `facebook/action100m-preview`), you can fetch rows in the browser:
  - **Endpoint**: `GET https://datasets-server.huggingface.co/rows?dataset=facebook/action100m-preview&config=<config>&split=<split>&offset=<n>&length=<m>` (max `length=100` per request).
  - **Response**: JSON with `rows` (each row has `row_idx`, `row` with `video_uid`, `metadata`, `nodes`), `features`, `num_rows_total`, `num_rows_per_page`, `partial`.
  - So the app can **paginate** (e.g. load first 100 rows for the “browse” list, then on “open video” fetch that row’s data or use cached row). No backend needed; pure client-side fetch.
- **Video**: For each row we have `video_uid` (YouTube ID). In the browser we can:
  - Use **YouTube embed** (`https://www.youtube.com/embed/<video_uid>?start=...`) so the video plays from HF + YouTube with no local files. Seeking is possible via embed URL params (with some limitations vs native `<video>`).
  - So **HF + YouTube** = zero local setup: user opens the Space, browses rows from HF, clicks a video, and watches via YouTube embed with annotations and timeline alongside.
- **Static Space**: Hugging Face Spaces support [static HTML/JS](https://huggingface.co/docs/hub/en/spaces-sdks-static) (`sdk: static`, serve `index.html` + assets). So the visualizer can be a static site that:
  - Reads `dataset` (and optionally `config`, `split`) from URL params or a simple config (e.g. default `facebook/action100m-preview`).
  - Fetches rows from `datasets-server.huggingface.co` when user browses or opens a video.
  - Embeds YouTube for playback when `video_src` is not a local file.

### 6.2 Same format, other datasets

If other datasets on HF use the **same schema** (e.g. `video_uid`, `metadata`, `nodes` with Action100M node shape), the same app can point at them by just changing the `dataset` (and `config`/`split` if needed). So “compatible with Hugging Face” here means:

- **Deployable as a static Space** that talks to HF Dataset Viewer API.
- **Dataset-agnostic**: config or URL to choose which HF dataset to use (default Action100M preview).
- **Video from YouTube** when only `video_uid` is available (HF deploy path); **local file** when user provides a file or a `video_src` (v1 / local use).

### 6.3 Constraints for HF + YouTube

- **CORS**: `datasets-server.huggingface.co` is public; fetch from the browser is fine.
- **YouTube embed**: May have regional/availability and ads; seeking is via URL (e.g. `?start=123` for 123s). No frame-accurate control like `<video>`.
- **Row size**: Each row can be large (many nodes). Pagination and “load one row when opening video” keep memory and network reasonable.

---

## 7. Node hierarchy: data structure (for timeline and “nodes at current time”)

Action100M nodes form a **tree** (forest if multiple roots): each node has `node_id`, `parent_id` (null for root), `level` (0 = root), and temporal bounds `start`, `end`. There is **no tree UI** — only the **timeline** (one row per level) and **nodes at current time** (path + detail). The hierarchy is still needed in memory for:

- **Timeline**: Group nodes by `level`; each row = all nodes at that level, ordered by `start`.
- **Nodes at current time**: Find all nodes where `start ≤ currentTime < end`; sort by duration descending (longest first); show all, each with path from root so none are missed even if from different roots.
- **Timeline highlight**: The same “nodes at current time” set — draw those segments in a distinct style (e.g. highlighted) on the timeline.

### 7.1 In-memory representation

- **Flat list** (as in the API/parquet): `nodes` is a list of node objects.
- **Index by `node_id`** for O(1) lookup (needed to build path from a node to root).
- **Group by `level`** for timeline rows: `nodesByLevel[level]` = list of nodes at that level, sorted by `start`.
- **“Nodes at current time”**: filter flat list where `start ≤ t < end`. Path = from each such node, follow `parent_id` to root.

### 7.2 Edge cases

- **Multiple roots**: If `parent_id === null` for more than one node, treat as forest; timeline shows each root’s row; “nodes at current time” may show nodes from different roots.
- **Orphan nodes**: If `parent_id` points to missing `node_id`, path walk stops at the orphan; still show the node in timeline and in “nodes at current time.” When displaying the breadcrumb, show the path from the first known ancestor to the node (if the path does not reach a level-0 root, optionally prefix with “(no root)” or “?”).
- **Many levels**: Timeline uses fixed height + vertical scroll and optional “max level” cap (see §9).

---

## 8. Vanilla JS vs framework (simplicity)

You prefer **vanilla JS** and **simplicity**; use a framework only if the format really requires it.

- **Timeline** (one row per level, highlight by time), **nodes at current time**, and “focus on one annotation type” are all doable with vanilla JS: flat list + index by level, playback `timeupdate` to update highlight and “nodes at current time”, click on segment to seek, DOM updates. No framework is **required**.
- **Recommendation for v1**: **Vanilla JS** is fine. Keep the surface small: one video, one JSON, timeline, “nodes at current time” block, annotation focus dropdown, metadata/transcript. If v2 adds browse + URL state, consider a minimal framework then.

---

## 9. Final UX decisions (locked)

| # | Topic | Decision |
|---|-------|----------|
| 1 | **Timeline** | **One row per level**. Segments that contain the **current video time** are **highlighted**. Handle “too many levels” with scroll and optional level cap (see below). |
| 2 | **Click on timeline segment** | Seek the video to that segment’s start. |
| 3 | **HF dataset id** | **Configurable** (e.g. URL param), with **Action100M as default** (e.g. `facebook/action100m-preview`). |
| 4 | **Config/split** | **Local download**: no split — just `data/part-*.parquet`. **HF API**: dataset has `config=default`, `split=train` (from `datasets-server.huggingface.co/splits`). So split matters only when using HF rows API; app can default to `config=default` and `split=train` for this dataset. |
| 5 | **v1 scope** | **Yes**: v1 = file-based only (pick one JSON + one video file); browse + HF in v2. |
| 6 | **Transcript format** | **SRT**: try parsing transcript as SRT; if parse yields ≥1 valid cue, support timestamps and auto-scrolling; otherwise show **plain text** only. |

### Handling “too many levels” on the timeline

- **One row per level** means level 0 = row 1, level 1 = row 2, … level K = row K+1. If K is large (e.g. 10+), the timeline gets tall and hard to scan.
- **Options**:
  - **Cap visible levels**: Show only levels 0..N (e.g. N=5) by default; add a “Show more levels” / “Show fewer levels” or a level selector (e.g. “Levels 0–4 ▼”).
  - **Collapsible timeline rows**: Group rows by level; allow collapsing “Level 2”, “Level 3”, etc. so only levels of interest are expanded.
  - **Scrollable timeline body**: Keep a fixed height for the timeline area; vertical scroll for levels. Label each row with “Level 0”, “Level 1”, … so context is clear.
- **Recommendation**: Fixed height + vertical scroll for the timeline panel, with row labels “Level 0”, “Level 1”, …; optionally a “Max level” dropdown (e.g. “Up to level 5”) to hide deeper rows and reduce clutter.

---

## 10. Timeline, nodes at current time, transcript, and text per section

### 10.1 Timeline: hierarchy and highlight by video time

The **timeline** is the only place the hierarchy is drawn. **One row per level**: level 0 = root, level 1 = its children, etc. Each segment is a horizontal bar; children sit in the row below the parent, aligned in time. So the timeline shows **when** things happen and **how they nest**.

**Highlight by current video time:** Segments that contain the current playback time (`start ≤ currentTime < end`) are drawn in a **highlighted** style (e.g. different background or border). As the video plays, the highlight moves so the user always sees which segments are “active” at the current moment.

**Interaction:** Click a segment → seek the video to that segment’s start.

### 10.2 Transcript and video

**Yes — the transcript moves with the video.**

- As the video plays, the **current SRT cue** is **highlighted** and the transcript area **scrolls** so that line stays in view.
- Clicking a transcript line seeks the video (and the timeline highlight and “Nodes at current time” update).

### 10.3 What text is shown (Timeline and Nodes at current time)

One **annotation focus** is chosen globally (e.g. “GPT summary (brief)” from the dropdown). That same field is used for node labels. If empty for a node, show a fallback (e.g. “(no label)”).

| Section | What is shown for each node |
|--------|-----------------------------|
| **TIMELINE** | Each segment is a **horizontal bar**. **Text**: the **focused annotation** — short label on the bar (truncated) or **tooltip on hover**. Row label is “Level 0”, “Level 1”, … |
| **NODES AT CURRENT TIME** | **Breadcrumb**: path from root to the active node(s) (e.g. Root → B → B2). **Detail**: for the active node(s), `[start – end]` and the **full focused annotation** text. |

### 10.4 Node detail: view complete node JSON (popup)

**Requirement:** The user can open the **full node JSON** in a read-only **popup/modal** (all fields: `node_id`, `parent_id`, `level`, `start`, `end`, `plm_*`, `llama3_caption`, `gpt.*`, etc.).

**Trigger:** From the **Timeline** (e.g. “{ }” / “Details” on segment hover, or double-click segment, or right-click → “View node JSON”) or from **Nodes at current time** (e.g. “Details” link next to the active node). Single click on a timeline segment still only seeks the video.

**Popup:** Pretty-printed JSON (read-only), optional Copy button and syntax highlighting. Close with X or Escape.

---

## 11. ASCII wireframes

Below are ASCII sketches of the main screens and components so the intended UI/UX is clear.

### 11.1 v1 single-video screen (main view)

```
+--------------------------------------------------------------------------------------------------+
|  [Open JSON]  [Open video]   |   Annotation: [GPT summary (brief) ▼]   |   Video: <title or uid>  |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|   +-------------------------------------------------------------------------------------------+  |
|   |                         VIDEO PLAYER  (play / pause / seek / volume)                      |  |
|   +-------------------------------------------------------------------------------------------+  |
|   |  Current time: 1:45 / 5:32                                                              |  |
|   +-------------------------------------------------------------------------------------------+  |
|   TIMELINE (one row per level; segments at current time HIGHLIGHTED)                          |  |
|   Level 0  |======================== root ==================================================  |  |
|   Level 1  |== A ==|%%%% B %%%%|= C =|     ← B highlighted (current time 1:45 inside B)       |  |
|   Level 2  | a1 |a2||%b1%| b2 | b3 |c1|c2|  ← b1 highlighted                                  |  |
|   ...      (scroll if many levels)                                                             |  |
|   +-------------------------------------------------------------------------------------------+  |
|   +------------------------------------------+  +---------------------------------------------+ |
|   |  NODES AT CURRENT TIME  (1:45)            |  |  METADATA                                     | |
|   |  Root  →  B  →  B2                       |  |  Title: How to make a journal spread         | |
|   |  B2  [1:30 – 2:00]                        |  |  Description: In this video we...              | |
|   |  "Apply glue to the paper and attach."    |  |  ----------------------------------------------  | |
|   |  [Details]                                |  |  Transcript: (SRT; current line highlighted;  | |
|   +------------------------------------------+  |    click → seek)                               | |
|                                               |  |  1  00:00:00,000 --> ...  Hello and welcome  | |
|                                               |  |  2  00:00:02,500 --> ...  Today we'll be...  | |
|                                               |  +---------------------------------------------+ |
+--------------------------------------------------------------------------------------------------+
```

- **Top bar**: Load data (JSON + video file), annotation dropdown, video label.
- **Video** then **timeline** (one row per level). Segments that contain the **current video time** are **highlighted** (e.g. `%` in sketch).
- **Nodes at current time** (path + detail + optional “Details” for JSON popup) beside **metadata & transcript** (title, description, SRT; transcript moves with video, click to seek).

### 11.2 Timeline only (one row per level, many levels)

```
+--------------------------------------------------------------------------------------------------+
|  TIMELINE                                                    [Levels 0–5 ▼]  [Scroll: more below] |
+--------------------------------------------------------------------------------------------------+
|  Level 0  |======================== root ========================================================|
|  Level 1  |==== A =====|= B =|= C =|= D =|= E =|   ← segments at current time HIGHLIGHTED
|  Level 2  | a1 | a2 | a3 | b1 | b2 | c1 | c2 | d1 | e1 |
|  Level 3  |    |    |    |    | b2a| b2b|    |    | d1a| ...
|  ...      (scroll down for more levels)
+--------------------------------------------------------------------------------------------------+
|  ◀ seek bar (video position)  ● 1:45                                                              |
+--------------------------------------------------------------------------------------------------+
```

- Each **row** = one level. Segments = horizontal bars (width = duration). **Segments that contain the current video time are highlighted** (different color/border).
- **Too many levels**: Vertical scroll; optional “Levels 0–N” cap.
- **Click segment** → seek video.

### 11.3 “Nodes at current time” block

```
+---------------------------------------------+
|  NODES AT CURRENT TIME  (1:45)              |
+---------------------------------------------+
|  Root  →  B  →  B2                          |
|  ----------------------------------------- |
|  B2  [1:30 – 2:00]                          |
|  "Apply glue to the paper and attach."      |
+---------------------------------------------+
```

- **Display**: All nodes at current time, **sorted by duration (longest first)**. For each: breadcrumb path from root to that node, then `[start – end]` and the **focused annotation** text. Optional “Details” / “{ }” to open full node JSON popup. This way nodes from different roots are not missed. (The sketch shows one node; when multiple are active, repeat the block for each.)

### 11.4 v2 browse (future) — list then open

```
+--------------------------------------------------------------------------------------------------+
|  Action100M-style viewer    Dataset: [facebook/action100m-preview ▼]   [Load from HF]          |
+--------------------------------------------------------------------------------------------------+
|  Video list (paginated)                                                                          |
|  ----------------------------------------                                                        |
|  row   video_uid    title (from metadata)                                                         |
|  0     dQw4w9WgXcQ  Example title one                                                           |
|  1     abc123...    Example title two                                                           |
|  ...   [Prev] [Next]                                                                              |
|  [Click row → open single-video screen with that row’s data; video from YouTube embed if no file] |
+--------------------------------------------------------------------------------------------------+
```

- v2 only: browse rows from HF (or local index), then click to open the same single-video layout as in 11.1, with video from YouTube when no local file.

### 11.5 Node detail popup (full JSON)

```
+------------------------------------------------------------------+
|  Node details                                            [X]     |
+------------------------------------------------------------------+
|  {                                                               |
|    "node_id": "abc-123-...",                                      |
|    "parent_id": "root-456-...",                                   |
|    "level": 2,                                                    |
|    "start": 12.5,                                                 |
|    "end": 18.0,                                                   |
|    "plm_caption": "Hands apply glue to paper.",                    |
|    "plm_action": "Applying glue",                                 |
|    "llama3_caption": "Overhead view of a blue glue stick...",     |
|    "gpt": {                                                       |
|      "summary": { "brief": "...", "detailed": "..." },            |
|      "action": { "brief": "...", "detailed": "...", "actor": "..." }|
|    }                                                             |
|  }                                                               |
|                                                                  |
|  [Copy JSON]                                                     |
+------------------------------------------------------------------+
```

- **Trigger**: e.g. “{ }” / “Details” on timeline segment (hover) or in “Nodes at current time”; or double-click segment; or right-click → “View node JSON”.
- **Content**: Pretty-printed full node object (read-only). Optional: Copy button, syntax highlight.
- **Close**: X or Escape.

---

## 12. Reference: split and config for HF

- **Local dataset** (e.g. `./dataset` symlink to `action100m-preview`): Dataset has a **`data/`** folder with `part-*.parquet` files; **no split**. All rows are “one set”. v1 does not read parquet; it uses pre-generated JSON (see §18.1).
- *(v2 only)* HF Dataset Viewer API: For `facebook/action100m-preview`, use `config=default` and `split=train`. v2 is out of scope for the current plan.

---

# Part B: Implementation plan (for code generation)

**Scope: v1 only.** Ignore v2 (browse, HF API, YouTube embed) for now. Focus on: load one annotation JSON + one video file; timeline; nodes at current time; transcript (SRT or plain text).

Use this part to **generate or implement** the v1 visualizer (e.g. in this repo). It defines the exact JSON schema, data structures, algorithms, event flow, suggested repo layout, and an ordered checklist. Stack: **vanilla HTML/CSS/JS**, no build.

**How to use this doc:** Start from §13 (schema) and §19 (checklist). Implement in the order of the checklist; refer to §14–18 for SRT parsing, data algorithms, timeline math, event flow, and file layout.

**Part B contents:**

| § | Section |
|---|--------|
| 13 | Video record JSON schema (root, metadata, node, annotation focus fields) |
| 14 | SRT transcript format and parsing |
| 15 | Data structures and algorithms (level index, nodeById, nodes at time, path to root, label) |
| 16 | Timeline rendering (coordinates, segment size, highlight, click) |
| 17 | Event flow and UI updates (timeupdate, file load, click handlers, throttle) |
| 18 | Repo structure (files and folders) |
| 19 | v1 implementation checklist (ordered steps) |
| 20 | Browser and deployment notes |

---

## 13. Video record JSON schema (app input)

The app loads **one** “video record” per view. In v1 the user selects **one annotation JSON file** and **one video file** (two files). No required fields: if anything is missing (e.g. no metadata, empty nodes), handle gracefully.

### 13.1 Root object

```ts
interface VideoRecord {
  video_uid: string;           // e.g. YouTube id or any unique id
  metadata: VideoMetadata;     // may be {} if not available
  nodes: Action100MNode[];    // flat list of segment nodes
  video_src?: string;          // optional: URL or path to video (v1: can be set after user picks file)
}
```

### 13.2 Metadata

```ts
interface VideoMetadata {
  title?: string;
  description?: string;
  duration?: number;           // integer seconds (optional; can use max node end if missing)
  upload_date?: string;
  view_count?: number;
  like_count?: number;
  transcript?: string;         // SRT content as string, OR plain text (fallback)
}
```

- **Transcript**: **Try parsing** `metadata.transcript` as SRT first. If parsing yields at least one cue with valid timestamps, treat as SRT and enable **timestamps + auto-scrolling** (current cue highlighted, scroll into view; click cue → seek). Otherwise show as **plain text** only (no seek, no time-based highlight).

### 13.3 Node (Action100M segment)

```ts
interface Action100MNode {
  node_id: string;
  parent_id: string | null;     // null for root
  level: number;                // 0 = root, 1 = direct child, ...
  start: number;                // seconds (float)
  end: number;                  // seconds (float)
  plm_caption: string | null;
  plm_action: string | null;
  llama3_caption: string | null;
  gpt: {
    summary: { brief: string; detailed: string };
    action:   { brief: string; detailed: string; actor: string };
  } | null;
}
```

- **Null handling**: Nothing is required. If any field is missing, handle gracefully (e.g. treat as null/empty). `gpt` can be `null`; `plm_caption`, `plm_action`, `llama3_caption` can be `null`. When reading an annotation field, use empty string if null/undefined.

### 13.4 Annotation focus: field list

The dropdown “Annotation” must offer exactly these options. Each option has an **id** (used in code) and a **label** (shown in UI). The value is read from the node by the path below.

| id | label (display) | path in node |
|----|-----------------|--------------|
| `gpt.summary.brief` | GPT summary (brief) | `node.gpt?.summary?.brief ?? ''` |
| `gpt.summary.detailed` | GPT summary (detailed) | `node.gpt?.summary?.detailed ?? ''` |
| `gpt.action.brief` | GPT action (brief) | `node.gpt?.action?.brief ?? ''` |
| `gpt.action.detailed` | GPT action (detailed) | `node.gpt?.action?.detailed ?? ''` |
| `gpt.action.actor` | GPT action (actor) | `node.gpt?.action?.actor ?? ''` |
| `plm_caption` | PLM caption | `node.plm_caption ?? ''` |
| `plm_action` | PLM action | `node.plm_action ?? ''` |
| `llama3_caption` | Llama3 caption | `node.llama3_caption ?? ''` |

**Fallback**: If the chosen field is empty for a node, show `"(no label)"` in timeline and in “Nodes at current time”.

---

## 14. SRT transcript format and parsing

### 14.1 SRT format (spec)

- Cues are separated by a blank line.
- Each cue: optional sequence number (integer), then two lines of timestamps and text:
  - Line 1: `HH:MM:SS,mmm --> HH:MM:SS,mmm` (comma for milliseconds).
  - Line 2 (or more): subtitle text (one or multiple lines until next blank line).
- Example:
  ```
  1
  00:00:00,000 --> 00:00:02,500
  Hello and welcome.

  2
  00:00:02,500 --> 00:00:05,000
  Today we'll be making a journal spread.
  ```

### 14.2 Parse to in-memory structure

Parse into an array of cues:

```ts
interface SrtCue {
  index: number;      // 1-based from file
  startSec: number;   // seconds (float), e.g. 0, 2.5
  endSec: number;     // seconds (float), e.g. 2.5, 5.0
  text: string;       // single line or joined with space/newline
}
```

- **Timestamp parse**: `HH:MM:SS,mmm` → `hours*3600 + minutes*60 + seconds + msec/1000`.
- **Current cue**: find cue where `startSec <= currentTime < endSec`. Highlight that cue and scroll it into view.
- **Click to seek**: when user clicks a cue, set `video.currentTime = cue.startSec`.

### 14.3 Plain-text fallback

**Try parsing first**: run the SRT parser on `metadata.transcript`. If parsing yields at least one cue with valid timestamps, use SRT behaviour (timestamps, seek, highlight, auto-scroll). Otherwise show as a **plain text** block only—no per-line seek, no time-based highlight, no auto-scrolling.

---

## 15. Data structures and algorithms (in-memory)

### 15.1 Build level index (for timeline)

```text
INPUT: nodes (flat list)
OUTPUT: nodesByLevel = Map<level, nodes[]>

1. nodesByLevel = new Map()
2. For each node in nodes:
   - level = node.level
   - If nodesByLevel has no key level, set nodesByLevel[level] = []
   - Append node to nodesByLevel[level]
3. For each level in nodesByLevel:
   - Sort nodesByLevel[level] by node.start (then node.end)
4. maxLevel = max(nodesByLevel.keys())
```

- Timeline rows: for level in 0..maxLevel (or 0..capLevel if “max level” is set), render one row per level.

### 15.2 Build node index by node_id (for path)

```text
INPUT: nodes
OUTPUT: nodeById = Map<node_id, node>

For each node in nodes:
  nodeById.set(node.node_id, node)
```

### 15.3 Nodes at current time

```text
INPUT: nodes, currentTime (seconds)
OUTPUT: activeNodes = nodes where start <= currentTime < end, ordered for display

1. activeNodes = nodes.filter(n => n.start <= currentTime && currentTime < n.end)
2. Sort activeNodes by (end - start) descending (longest duration first).
```

- **Display order**: Show all active nodes **reverse-sorted by duration** (longest first). So even if there are nodes from another root at the same time, none are missed; the longest segment is shown first (typically the “main” one), then shorter ones. Ideally most of the time only one root has active nodes; when multiple roots have active nodes, all are shown, sorted by duration.

### 15.4 Path from node to root

```text
INPUT: nodeById, node (or node_id)
OUTPUT: path = [root, child, ..., node] (top-down)

path = []
current = node
While current is not null:
  path.unshift(current)   // add at beginning
  current = current.parent_id ? nodeById.get(current.parent_id) ?? null : null
Return path
```

- For “Nodes at current time”: show **each** active node (after the duration sort above). For each, optionally show the path from root to that node (breadcrumb). Display breadcrumb as path.map(n => label(n)).join(' → ').

### 15.5 Get label for a node (annotation focus)

```text
INPUT: node, focusId (e.g. 'gpt.summary.brief')
OUTPUT: string

Use the path from §13.4 for focusId. If result is null/undefined/'', return "(no label)".
```

---

## 16. Timeline rendering (coordinates and interaction)

### 16.1 Layout constants

- **Timeline total width** in px (e.g. 800 or 100% of container): `timelineWidthPx`.
- **Video duration** in seconds (timeline length): Use **`metadata.duration`** if present and valid (finite number &gt; 0), otherwise **video length** (e.g. from `<video>` element when `loadedmetadata` or from `video.duration`). Fallback: `max(node.end)` over all nodes, then 0. So **prefer metadata.duration or actual video length** for the timeline scale.
- **Scale**: `pxPerSec = timelineWidthPx / Math.max(durationSec, 1)`.

### 16.2 Segment position and size (per node)

- `leftPx = node.start * pxPerSec`
- `widthPx = (node.end - node.start) * pxPerSec` (ensure minimum 1–2 px so very short segments are clickable).

### 16.3 Per row (per level)

- Each row has a label “Level 0”, “Level 1”, … (or “Level N”).
- For each node in `nodesByLevel[level]`, draw a segment (e.g. `<div>` or `<button>`) at `leftPx`, `widthPx`.
- **Overlapping segments**: If two segments at the same level overlap in time, **draw them overlapping** (no merging). When building or rendering the timeline, detect overlaps per level (two segments overlap if `a.start < b.end && b.start < a.end`); if any exist, show a **warning** (e.g. banner or small notice) so the user is aware.
- **Highlight**: if node is in `activeNodes` (nodes at current time), apply a CSS class (e.g. `.timeline-segment--active`) for different background/border.
- **Tooltip/label**: show focused annotation (truncated) on hover or as inline text; empty → “(no label)”.
- **Click**: `video.currentTime = node.start` (and optionally `video.play()`).

### 16.4 Seek bar (optional)

- A thin bar below the timeline showing current position: `left = (currentTime / durationSec) * timelineWidthPx`. Update on `timeupdate`.

### 16.5 Scroll and level cap

- Timeline container: fixed height (e.g. 200px), overflow-y auto. Optional “Max level” dropdown: only render levels 0..N so rows for level > N are hidden.

---

## 17. Event flow and UI updates

### 17.1 Video events

- **`timeupdate`**: Read `video.currentTime`. Then:
  1. Compute `activeNodes` = nodes at current time (§15.3).
  2. Update timeline: set/remove “active” class on segments that are in `activeNodes`.
  3. Update “Nodes at current time” block: for **each** active node, show path from root to that node and full focused annotation text; update “Details” target(s) if needed.
  4. If transcript is SRT: find current cue; highlight that cue and scroll transcript so the cue is in view.
- **`loadedmetadata`** (or when JSON is loaded): Set `durationSec` from **metadata.duration** or **video duration** (when available), else max(node.end). Build `nodesByLevel` and `nodeById`. Initial render of timeline and metadata/transcript.

### 17.2 User actions

- **Open JSON**: File input → read as text → `JSON.parse` → store as current `VideoRecord` (no strict validation; handle missing/empty fields gracefully) → build indices → render timeline and metadata; show “Open video” or use `video_src` if present.
- **Open video**: File input → create object URL with `URL.createObjectURL(file)` → set `video.src = url`. Or if `video_src` is a string (relative/absolute URL), set `video.src = video_src` (may require static server for local path).
- **Annotation dropdown change**: Store selected focus id; re-render timeline labels/tooltips and “Nodes at current time” text.
- **Click timeline segment**: `video.currentTime = node.start`; no need to “select” a node for tree (tree removed).
- **Click transcript line** (SRT): `video.currentTime = cue.startSec`.
- **Details / “{ }” / double-click on segment or “Details” in Nodes at current time**: Open modal with `JSON.stringify(node, null, 2)`. Copy button: `navigator.clipboard.writeText(...)`. Close on X or Escape.

### 17.3 Throttle or debounce

- **`timeupdate`** can fire often (e.g. 4–10 times per second). Throttle updates to timeline highlight and “Nodes at current time” (e.g. 100–250 ms) to avoid layout thrash, or use requestAnimationFrame and a dirty flag.

---

## 18. Repo structure (suggested for v1)

New repo (e.g. `action100m-visualizer` or `action100m-viewer`). Vanilla JS, no build step.

```text
action100m-visualizer/
├── index.html          # Single page: video, controls, timeline, nodes-at-current-time, metadata, transcript, modal
├── css/
│   └── style.css       # Layout, timeline rows, segment bars, active state, transcript, modal
├── js/
│   ├── app.js          # Entry: init, file inputs, global state (videoRecord, focusId, currentTime)
│   ├── data.js         # Build nodesByLevel, nodeById; getNodesAtTime; getPathToRoot; getNodeLabel
│   ├── srt.js          # Parse SRT string → SrtCue[]; find current cue
│   ├── timeline.js     # Render timeline (rows, segments, highlight, click), seek bar
│   ├── nodes-panel.js  # Render “Nodes at current time” (breadcrumb, detail, Details button)
│   ├── metadata.js     # Render title, description, transcript (SRT or plain), highlight and scroll
│   └── modal.js        # Node JSON popup: open, close, copy, Escape
├── README.md           # How to run (open index.html via file:// or static server; load JSON + video)
└── docs/               # Optional: copy or link to this spec
```

- **No build**: open `index.html` in browser. For **local video file**, use “Open video” file input and set `video.src = URL.createObjectURL(file)` so no static server is required for the video. For **local JSON**, same (file input). If you later use a static server (e.g. `python -m http.server`), you can set `video_src` in JSON to a path under that server and load video by URL.

### 18.1 Optional: data prep script (parquet → JSON)

The **visualizer has no Python dependency**. It only loads two files: **annotation JSON** + **video file**.

If the source data is parquet (e.g. in `./dataset/data/*.parquet`), an **optional** Python script can produce one JSON per video:

- **Input**: Parquet files from the dataset’s **`data/`** folder (e.g. `dataset/data/part-*.parquet` when `dataset` is a symlink to something like `action100m-preview`). Optionally restrict by `video_uid` or a directory of local MP4s.
- **Output**: One `.json` file per video with shape = `VideoRecord` (§13). The visualizer expects exactly this schema; any parquet/API field or naming differences should be resolved in the data-prep script so the app receives the §13 shape. Optional: set `video_src` to relative path to MP4 (e.g. `videos/<video_uid>.mp4`).
- **Parquet structure**: Rows have columns `video_uid`, `metadata`, `nodes`. Arrow may return nested/list values; normalize to a flat list of node dicts (see Action100M `scripts/download_action100m_for_via.py`: it reads these columns and writes `raw_annotations/000N_<video_uid>/action100m_raw.json` with `{ "video_uid", "metadata", "nodes" }`). So either:
  - Run that script and use its **raw_annotations** JSONs as the visualizer input (user opens `raw_annotations/0001_<uid>/action100m_raw.json` + the corresponding video from `videos/`), or
  - Add a small script that reads `dataset/data/*.parquet` and writes one JSON per video into a folder the visualizer can point at.
- **Example layout**: The download script output (e.g. `action100m_via2/` or `~/repos/Action100M` docs) has `videos/`, `annotations/` (VIA3), and `raw_annotations/` (Action100M JSON per video). The visualizer can load from `raw_annotations/.../action100m_raw.json` + a video file—no new Python in this repo.

---

## 19. v1 implementation checklist

Use this order when generating or implementing the app.

1. **HTML shell**
   - [ ] `index.html`: top bar (Open JSON, Open video, Annotation dropdown, video title/uid); video element; current time display; timeline container (empty); “Nodes at current time” container; metadata container (title, description, transcript); modal (hidden) for node JSON.
   - [ ] Script tags: load `js/data.js`, `js/srt.js`, `js/timeline.js`, `js/nodes-panel.js`, `js/metadata.js`, `js/modal.js`, `js/app.js` (last so all dependencies are available; only `app.js` runs at load, others export functions).

2. **Data layer (`data.js`)**
   - [ ] Parse/generate `nodesByLevel` and `nodeById` from `nodes`.
   - [ ] `getNodesAtTime(nodes, currentTime)` → array of nodes.
   - [ ] `getPathToRoot(nodeById, node)` → array of nodes (root first).
   - [ ] `getNodeLabel(node, focusId)` → string (use §13.4 table; fallback "(no label)").
   - [ ] Annotation focus options: array of `{ id, label }` per §13.4.

3. **SRT (`srt.js`)**
   - [ ] `parseSrt(srtString)` → `SrtCue[]` (with startSec, endSec, text).
   - [ ] `getCurrentCue(cues, currentTime)` → cue or null.

4. **Timeline (`timeline.js`)**
   - [ ] `renderTimeline(container, nodesByLevel, durationSec, focusId, activeNodeIds, nodeById, options)` where options = { timelineWidthPx, onSegmentClick, getNodeLabel }.
   - [ ] Segments: correct left/width from start/end and durationSec; active class if node in activeNodeIds; tooltip/label from getNodeLabel; click → onSegmentClick(node).
   - [ ] Optional: seek bar showing current time position.
   - [ ] Level cap: optional maxLevel; only render levels 0..maxLevel; scrollable container.

5. **Nodes-at-current-time panel (`nodes-panel.js`)**
   - [ ] `renderNodesPanel(container, activeNodes, focusId, nodeById, getNodeLabel, onDetailsClick)` (for each active node, compute path via getPathToRoot and render breadcrumb + detail).
   - [ ] Breadcrumb: for each active node, path labels joined by “ → ”.
   - [ ] Detail: for each active node, [start–end] and full focused annotation; “Details” / “{ }” button → onDetailsClick(node).

6. **Metadata and transcript (`metadata.js`)**
   - [ ] Render title, description.
   - [ ] If transcript is SRT: parse; render list of cues; on timeupdate highlight current cue and scroll into view; on cue click set video.currentTime = cue.startSec.
   - [ ] If transcript is plain text: render single block, no seek.

7. **Modal (`modal.js`)**
   - [ ] `openNodeModal(node)` → show modal with pretty-printed JSON; Copy button; close on X or Escape.

8. **App entry (`app.js`)**
   - [ ] State: videoRecord (null until loaded), focusId (default e.g. 'gpt.summary.brief'), currentTime (0).
   - [ ] File input “Open JSON”: read file, parse, set videoRecord; build nodesByLevel, nodeById; set durationSec; render timeline, nodes panel, metadata; if video_src set and is URL, set video.src.
   - [ ] File input “Open video”: create object URL, set video.src.
   - [ ] Annotation dropdown: on change set focusId; re-render timeline and nodes panel.
   - [ ] Video element: on `timeupdate` (throttled) set currentTime; compute activeNodes (and for each, path via getPathToRoot); re-render timeline (active state), nodes panel, transcript highlight/scroll.
   - [ ] Timeline segment click: set video.currentTime = node.start.
   - [ ] Transcript cue click: set video.currentTime = cue.startSec.
   - [ ] Wire “Details” to openNodeModal(node).

9. **CSS (`css/style.css`)**
   - [ ] Layout: top bar, video, timeline (fixed height, scroll), two-column or stacked for nodes panel + metadata.
   - [ ] Timeline: row labels “Level N”; segment bars (e.g. rounded corners); distinct style for `.timeline-segment--active` (highlight).
   - [ ] Transcript: current cue highlighted; scrollable.
   - [ ] Modal: overlay, scrollable content, Copy button, close button.

10. **Edge cases and robustness**
    - [ ] **Nothing required**: If video_uid, metadata, or nodes are missing or empty, handle gracefully (e.g. show empty state, use defaults).
    - [ ] Empty nodes array: show “Load a JSON file” or empty state.
    - [ ] durationSec 0 or missing: use metadata.duration or video duration, else derive from max(node.end).
    - [ ] Multiple roots: timeline shows all level-0 segments; nodes at current time show all active nodes sorted by duration (longest first).
    - [ ] Orphan node: path stops at node; still show in timeline and active list.
    - [ ] Overlapping segments at same level: draw overlapping; show a warning when detected.

---

## 20. Browser and deployment notes

- **v1 file loading**: Use `<input type="file" accept=".json">` and `<input type="file" accept="video/*">` so user picks files from disk. No need to open from a specific path; object URL for video works. JSON is read as text and parsed.
- **CORS**: If later you load JSON or video from a URL (e.g. static server), same-origin or CORS headers may apply. For file input there is no CORS issue.
- **Static server** (optional): `python -m http.server 8080` or `npx serve` in repo root so `index.html` is served; then you can set `video_src` in JSON to e.g. `./videos/abc.mp4` and load video by path (if you add “Load from URL” in v2).
- **Hugging Face Space (v2)**: Set `sdk: static` in README; put built or vanilla files so `index.html` is at root. For v2, add logic to fetch rows from `datasets-server.huggingface.co` and optionally embed YouTube for `video_uid`.
