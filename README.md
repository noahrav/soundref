# SoundRef

**SoundRef** is an interactive desktop application designed to help music producers, engineers, sound designers and artists organize audio reference. Built around an interactive visual canvas, it allows you to organize your audio references, notes, between multiple workspaces.

Built with **Tauri v2**, **React 19**, **TypeScript**, **tldraw**, and **Rust**.

## Core features

* **Audio tracks**:
  * Import and play local audio files (`.wav`, `.mp3`, `.flac`, `.ogg`, `.m4a`, `.aac`, `.aiff`, etc.).
  * Embed streaming audio players via URLs or `<iframe>` tags (SoundCloud, Bandcamp, YouTube, etc.).
  * Assign custom album artwork / cover images to each track.

* **Playback & loop control**:
  * One-shot and Loop playback modes.
  * Precise loop region configuration (start and end markers in seconds with quick adjustment buttons).

* **Interactive whiteboard canvas**:
  * Smooth visual navigation: pan, zoom, multi-selection, locking, and element grouping/ungrouping.
  * Add sticky notes with custom colors, text blocks, section groups, and audio track cards.
  * Handy keyboard shortcuts (`V` for select, `H` for hand/pan navigation, etc.).

* **Projects & workspaces**:
  * Organize work by projects saved locally on your disk.
  * Support for multiple boards / tabs within a single project.
  * Automatic state persistence and saving.

* **Global mini-player**:
  * Persistent playback control bar (Play, Pause, Stop).
  * Quick-focus button to jump directly to the playing audio track on the canvas.

* **Interface & localization (SOON TO COME)**:
  * Multi-language support (English and French via `i18next`).
  * Modern dark mode user interface built with Sass/SCSS.

> All your project data is stored within a shareable `soundref.json` file containing all of your project's information.

## Build & installation guide

### 1. Prerequisites

Ensure you have the following tools installed on your system:

* **Node.js** (v24 or higher recommended)
* **pnpm** (or npm, yarn, any package manager will work)
* **Rust & Cargo** (for building the Tauri backend)

#### System dependencies:

* **Linux (Ubuntu/Debian)**:
  ```bash
  sudo apt update
  sudo apt install -y build-essential curl wget file libxdo-dev libssl-dev libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  ```
* **macOS**:
  Ensure Xcode Command Line Tools are installed:
  ```bash
  xcode-select --install
  ```
* **Windows**:
  Install [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

### 2. Clone and install dependencies

```bash
# Clone the repository
git clone https://github.com/your-account/soundref.git
cd soundref

# Install JavaScript/TypeScript dependencies with pnpm
pnpm install
```

### 3. Run in development mode

#### Launch the desktop application
This command starts the Vite development server and the native Tauri window:
```bash
pnpm tauri dev
```

#### Launch the web server only
If you want to test the user interface in a web browser without launching the Tauri desktop window:
```bash
pnpm dev
```

### 4. Build for production

#### Build the desktop executable (Tauri)
To generate the production desktop installer/binary (`.deb`, `.appimage`, `.msi`, `.dmg`, or standalone executable depending on your OS):
```bash
pnpm tauri build
```
The compiled output will be located in:
```
src-tauri/target/release/bundle/
```

## Useful commands

* **`pnpm format`**: Format code using Biome.
* **`pnpm preview`**: Preview the production web build locally.

## License

This project is licensed under the terms specified in the **GNU GPL v3** Licence. See the [LICENSE](https://github.com/noahrav/soundref/blob/master/LICENSE) file for details.
