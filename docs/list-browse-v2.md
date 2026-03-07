# List browse (v2) — local folder, 100s of videos

**Scope:** Browse a list of videos from a **local folder** or open a **single video + JSON**. All data (videos, annotations, transcripts) is local. Optimized for iterating over 100s of entries.

**Browsers:** Chrome and Firefox support folder selection (`webkitdirectory`). Use Chrome if your Firefox build doesn’t show a folder picker.

---

## 1. Select source modal

**Entry point:** The app shows a **“Select source” modal** when there is no video loaded (e.g. on first load, or via a “Change source” / “Open source” button in the top bar). The user chooses one of two options:

| Option | Description |
|--------|--------------|
| **Single video + JSON** | Pick one video file and one annotation JSON file. Same as current v1 flow: go straight to the single-video view. |
| **Two folders** | Pick **one folder for videos** and **one folder for JSON files** (any paths; folder names don’t matter). List is built by matching **filename stem** (e.g. `1.mp4` ↔ `1.json`). No fixed layout or `index.json`. |

After a valid choice, the modal closes. For single file we show the video view; for folders we show the list view, then user clicks a row to open that video.

**Example:** User selects folder `.../my_videos/` (contains `1.mp4`, `2.mp4`, …) and folder `.../my_annotations/` (contains `1.json`, `2.json`, …). App matches by stem (`1`, `2`, …) and builds the list. Folder names and paths are irrelevant; only filenames are used for matching.

---

## 2. Approach

- **Select source modal:** User chooses “Single video + JSON” (two file inputs) or “Two folders” (two folder inputs: videos, then JSON). No top-bar “Open JSON” / “Open video” / “Open folder” on the main screen; those live inside the modal (or we keep them in the top bar and also add “Change source” that opens the modal — see wireframe).
- **Single video + JSON:** Same as v1: load one JSON, one video; close modal and show video view.
- **Two folders:** Two `<input type="file" webkitdirectory>` — one for the **videos folder**, one for the **JSON folder**. Match by **filename stem** (base name without extension): e.g. `1.mp4` and `1.json` → one list entry with stem `1`. We build the list from the two FileLists; no reads until user opens a row.
- **List view:** Shows index, stem (or filename), [Open]. **Virtual list** for 100s of rows. Click row → read that entry’s JSON, create object URL for video, switch to video view.
- **Opening a new video:** Whenever we open a video (single file or from a list row), **revoke any existing video object URL first** and clear previous video state, then load the new one. Same when changing source. No leaking of object URLs.
- **Back to list:** Return to list; revoke video URL; list data stays in memory.

---

## 3. Two-folder discovery (no index.json)

**No fixed layout.** User picks two folders; folder names and paths don’t matter. Only filenames are used.

| Input | Content |
|-------|--------|
| **Videos folder** | Any video files (e.g. `.mp4`): `1.mp4`, `2.mp4`, or any name. |
| **JSON folder** | Annotation JSON files. Match by **filename stem** (base name without extension): `1.json` matches `1.mp4`. |

**List building (discovery):**

1. From the **videos folder** FileList: map each file to `stem → File` (stem = filename without extension, e.g. `1.mp4` → `1`).
2. From the **JSON folder** FileList: map each file to `stem → File` (e.g. `1.json` → `1`).
3. Intersection: list entries = stems that have both a video and a JSON file.
4. **Sort:** Use **natural sort** (human-friendly) on stems: e.g. `1`, `2`, `10`, `20` not `1`, `10`, `2`, `20`. Implement with `Intl.Collator(undefined, { numeric: true })` or equivalent (split numeric/non-numeric segments and compare).
5. Each entry: `{ stem, videoFile, jsonFile }`. No reading of JSON until user opens that row.

**Unmatched files:** Videos without a matching JSON (or vice versa) are skipped; we can show “N videos, M annotations, K matched” if useful.

**Implementation details:**
- **File types:** In the videos folder, consider only files with a video extension (e.g. `.mp4`, `.webm`, `.mov`); ignore others. In the JSON folder, consider only `.json` files. This avoids matching `1.txt` with `1.json`.
- **Duplicate stems:** If one folder has multiple files with the same stem (e.g. `1.mp4` and `1.webm`), use the first encountered (or any one); one stem → one `File` per folder.
- **Open failure:** If reading the JSON or loading the video fails when the user opens a row, show an error message (e.g. toast or inline) and stay in list view (or current view); do not leave the UI in a broken state.

---

## 4. Wireframes

### 4.1 Select source modal

Shown on first load when no source is loaded, or when user clicks **“Change source”** / **“Open source”** in the top bar.

```
+--------------------------------------------------------------------------------------------------+
|  Select source                                                                            [X]   |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|  Choose how to load your videos and annotations:                                                  |
|                                                                                                  |
|  ○  Single video + JSON                                                                           |
|      Pick one video file and one annotation JSON file.                                           |
|      [Choose JSON file]   <filename or "—">                                                       |
|      [Choose video file]  <filename or "—">                                                       |
|      [Open video]   (enabled when both chosen)                                                    |
|                                                                                                  |
|  ○  Two folders                                                                                    |
|      Pick one folder for videos and one for annotation JSON files. Match by base name (e.g. 1.mp4 ↔ 1.json). |
|      [Choose videos folder]   <name or "—">                                                        |
|      [Choose JSON folder]     <name or "—">                                                        |
|      [Open list]   (enabled when both chosen and there are matched pairs)                          |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
```

- **Single video + JSON:** Two file inputs (JSON first, then video, or both). Button “Open video” closes modal and loads that one video (current v1 behaviour).
- **Two folders:** Two folder inputs (`webkitdirectory`): videos folder, JSON folder. After both are selected, app matches by filename stem, builds list. “Open list” closes modal and shows list view. If no matched pairs, show message and keep modal open.
- **Close (X or Escape):** If no source was ever loaded, closing leaves the app on an empty state (modal can be reopened via “Change source” or a prompt). If source was already loaded, closing just dismisses the modal.

### 4.2 List view (browse)

```
+--------------------------------------------------------------------------------------------------+
|  Kriya Visualizer    [Change source]   |   Videos: 42                                               |
+--------------------------------------------------------------------------------------------------+
|  #   | stem / id     | Open                                                            |
|------|---------------|------------------------------------------------------------------|
|  0   | 1             | [Open]                                                          |
|  1   | 2             | [Open]                                                          |
|  2   | 3             | [Open]                                                          |
|  ... (virtual scroll: only visible rows in DOM)                                                |
|  41  | 42            | [Open]                                                          |
+--------------------------------------------------------------------------------------------------+
```

- **Change source:** Opens the Select source modal again (user can switch to single file or another folder).
- **Row click (or [Open]):** Load that entry’s JSON + video and switch to video view.
- **Virtual list:** Only visible rows in DOM; scrollbar for full list length.

### 4.3 Video view (current v1 + “Back to list”)

```
+--------------------------------------------------------------------------------------------------+
|  Kriya Visualizer    [Change source]   [← Back to list]   |   Video: <title>   |  Metadata ...   |
+--------------------------------------------------------------------------------------------------+
|  (Same as current: video player, timeline, nodes at current time, metadata, transcript, modals)   |
+--------------------------------------------------------------------------------------------------+
```

- **Change source:** Opens Select source modal (can load single file or folder; if folder, next time we show list).
- **Back to list:** Visible only when we came from the list (`state.cameFromList === true`). Click: revoke video URL, clear video state, show list view. When opening any new video (single or from list), revoke the previous video’s object URL first so the previous one is fully cleared.

---

## 5. Feasibility

| Concern | Assessment |
|--------|------------|
| **Select source modal** | Same pattern as existing modals; add one modal with two option blocks (single file + folder) and file/folder inputs. |
| **Folder selection** | Chrome and Firefox support `webkitdirectory`; each file has `webkitRelativePath`. Safe to rely on. |
| **100s of File references** | Keeping 100s of `File` references in memory is fine; we don’t read contents until user opens a video. |
| **Discovery (no index)** | Two FileLists (videos folder, JSON folder): map each to stem → File; intersect stems; natural sort. No file reads; just path parsing. |
| **Lazy load on open** | On row click: revoke any existing video object URL; we have `videoFile` and `jsonFile` for that entry; read JSON once, `URL.createObjectURL(videoFile)`. One parse + one object URL per open. |
| **Virtual list** | Only render ~20–30 rows; scroll position → startIndex/endIndex; total height = N * rowHeight. Standard approach; works in vanilla JS. |
| **Memory on “Back”** | Revoke object URL; release video record. List (folder files + matched entries) remains. |
| **Transcripts** | Already inside each annotation JSON (`metadata.transcript`); no change from v1. |

**Conclusion:** Feasible with vanilla JS; no backend; no index.json; no new browser APIs beyond `webkitdirectory` and existing `File`/`FileReader`/object URL usage.

---

## 6. Changes to codebase

### 6.1 Select source modal (HTML + JS)

- New modal `#source-modal`: backdrop, header "Select source", close X. Body: (1) Single video + JSON — two file inputs, "Open video" button; (2) Two folders — two folder inputs (videos, JSON), "Open list" button (runs discovery). Top bar: "Change source" opens modal.

### 6.2 State (app.js)

- **New:** `state.screen = 'list' | 'video'` (on first load with no source, use `'list'` with empty `listEntries` and show the source modal).
- **New:** `state.listEntries = []` (array of `{ stem, videoFile, jsonFile }` from two-folder discovery; no index.json)
- **New:** `state.cameFromList = false` (true when we switched to video view by opening a list row; controls visibility of “Back to list”)
- **New:** `state.currentVideoObjectURL = null` (revoke before opening a new video or on Back / Change source; keeps only one active URL)

### 6.3 Two-folder discovery (app.js or list.js)

- **Input:** Two arrays of `File`: `videoFiles` (from videos folder pick), `jsonFiles` (from JSON folder pick). **Output:** `listEntries = [ { stem, videoFile, jsonFile }, ... ]` sorted by stem.
- **Logic:** For each folder, stem = filename without extension (e.g. `1.mp4` → `1`). Build maps `stem → videoFile` and `stem → jsonFile`. Intersect: entries = stems present in both. **Sort:** natural sort on stems (`Intl.Collator(undefined, { numeric: true })` or equivalent so 1, 2, 10, 20 order correctly).

### 6.4 HTML (index.html)
- **Select source modal:** title, two option blocks (single: two file inputs + "Open video"; two folders: two folder inputs + "Open list"), close.
- **List view:** Header "Videos: N", virtual list container (empty: "Choose videos and JSON folders from Select source.").
- **Video view:** Existing main — wrap in container; show when `screen === 'video'`.
- **Top bar:** "[Change source]" always; "[← Back to list]" when `state.cameFromList`. Single-file inputs live in the modal.

### 6.5 list.js (new)

- `buildListFromTwoFolders(videoFiles, jsonFiles)` → `listEntries` (discovery logic in §6.3; natural sort).
- `renderList(container, listEntries, { onOpenVideo(index) })`; virtual list for visible rows only.

### 6.6 app.js integration

- **On load:** Show Select source modal if no source loaded (or empty view with "Select source" that opens modal).
- **Single (Open video in modal):** Revoke state.currentVideoObjectURL if set; read JSON, buildStateFromRecord, set state.currentVideoObjectURL = URL.createObjectURL(videoFile), video src from it, close modal, show video view, state.cameFromList = false.
- **Two folders (Open list in modal):** Discovery → state.listEntries, close modal, show list view.
- **Row click:** Revoke state.currentVideoObjectURL if set; entry = state.listEntries[index]; read entry.jsonFile; set state.currentVideoObjectURL = URL.createObjectURL(entry.videoFile), videoEl.src = it, record from JSON, state.cameFromList = true, show video view, renderAll().
- **Back to list:** Revoke state.currentVideoObjectURL; clear video state; show list; re-render from state.listEntries.
- **Change source:** Revoke state.currentVideoObjectURL before opening new source.
- **Escape:** Close source modal if open.


### 6.7 CSS (style.css)

- Source modal: same as other modals; style option blocks (labels, inputs, buttons).
- List view: table/list; row hover; virtual list container overflow-y.
- "Back to list" / "Change source" in top bar.

### (Optional) Index generator script

- Small Node or Python script that walks two directories (videos + JSON), matches by stem, and writes `index.json`. Not required for the app; only for convenience.

---

## 7. Implementation order (checklist)

1. **Select source modal** — Add `#source-modal` HTML; two options (single file + two folders); wire file inputs and two folder inputs and buttons.
2. **State** — Add `screen`, `listEntries`, `cameFromList`, `currentVideoObjectURL` in app.js.
3. **Two-folder discovery** — `buildListFromTwoFolders(videoFiles, jsonFiles)` → list of `{ stem, videoFile, jsonFile }` with natural sort on stems.
4. **List view HTML** — List container; header (count); virtual list area; empty state.
5. **list.js** — `buildListFromTwoFolders`, `renderList` with virtual list; `onOpenVideo(index)`.
6. **app.js** — On load show source modal; Single: revoke previous URL if any, read JSON + video, show video view; Two folders: discovery → list view; Row click: revoke previous URL, load entry, show video view; Back to list: revoke URL, show list; Change source: revoke URL before loading new source.
7. **Top bar** — "Change source" (opens modal); "Back to list" when `cameFromList`.
8. **Edge cases** — No matched pairs; missing file for entry; empty folder; very long list (virtual list).

---

## 8. Summary

| Item | Decision |
|------|----------|
| **Entry** | Select source modal: choose Single video + JSON or Two folders. |
| **Single** | Two file inputs in modal; open one video (same as v1). Revoke previous video URL when opening. |
| **Two folders** | One folder for videos, one for JSON; match by filename stem; no index.json. Natural sort on stems. |
| **List** | Built from two-folder discovery; virtual list for 100s of rows. |
| **Opening a video** | Revoke existing object URL first. From list: entry has `videoFile` and `jsonFile`; read JSON, object URL for video; reuse single-video screen. Same when changing source. |
| **Browser** | Chrome / Firefox; folder via `webkitdirectory`. |
| **Transcripts** | In each annotation JSON; no change from v1. |

This gives you a list browse that’s easy to iterate over 100s of videos with minimal code and no backend, and keeps the existing video/annotation/transcript behavior unchanged.
