# File and storage access goes through a platform port

Roadbuilder runs in the browser today and will ship as a Tauri desktop application, which reads and writes real files and can install a track straight into the game folder. Saving, opening, downloading and autosave therefore go through a single `Platform` interface provided to the app at startup; the editor never touches `localStorage`, `<a download>` or file inputs directly. The web implementation is the only one for now; the Tauri one will be added alongside it without touching the editor.
