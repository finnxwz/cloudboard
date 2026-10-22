# Cloudboard

**Create Pinterest-style image boards with four fixed columns, mixing local photos, vault images, direct online images and public Pinterest pin previews. No Canvas and no Pinterest login required.**

Every board is stored as a dedicated `.pboard` file. Your original Markdown note is never modified.

## 💡 How it works

- Convert a Markdown note to create `<note name> Board.pboard`. The new view has four fixed columns, each with a **+** frame for adding more images.
- Add photos **from your device**, **from your vault**, as a **direct HTTPS image** or as a **public Pinterest pin preview**. Device photos are copied into the vault using Obsidian's attachment settings; vault images are embedded without duplication.
- Online images stay online and are not downloaded into your vault. They need an internet connection and can disappear if the image host removes them.
- Click an image for a large preview. The pencil edits the caption; clearing the caption hides it. Source links are stored internally but never shown.
- With the caption bar enabled, captions and actions appear below the photo. Turn it off to show only the photo, with edit and delete actions appearing on hover or tap.
- Drag cards to reorder them within a column or move them to another column. On touch screens, hold a card for a moment and drag. Keyboard users can focus a card and move it with the arrow keys.
- The trash icon removes a card from the board, **never the image file** from your vault.
- The board keeps all four columns on narrow screens and scrolls horizontally instead of switching to fewer columns.
- Existing Canvases can be used as an image source: right-click a `.canvas` file and choose **Import as an image board**. Cloudboard copies recognizable image cards and embedded images into a new `.pboard`. Canvas layout, connections, text and other nodes are not transferred. The original `.canvas` file stays unchanged.
- The interface is available in **English (default), German, Spanish and French**. Switching the language updates open boards and command names; your own captions and notes are never translated.
- The older Pinterest-to-Canvas importer remains available for public boards. Pinterest may block previews even for public pins; in that case, copy the direct image address (`https://i.pinimg.com/...`) instead of the pin page URL.
- Cloudboard is not affiliated with Pinterest. Image rights remain with their respective owners.

## ⚙️ Settings and commands

- **Language**: choose English, German, Spanish or French.
- **Show caption bar**: show captions and actions below the photo, or hide the bar and reveal actions on hover/tap.
- **Cloudboard: Convert note into an image board**: right-click a Markdown note or use the Command Palette. With no Markdown note active, the **New image board** ribbon icon creates an empty board.
- **Cloudboard: Add image to board**: right-click a `.pboard` file or use the Command Palette to open the image picker.
- **Cloudboard: Convert existing Canvas into an image board**: right-click a `.canvas` file or use the Command Palette. This imports only recognizable images; layout, connections, text and other Canvas nodes are not transferred. The source Canvas is not modified.
- **Sync interval**, **Save images locally** and **Sync now** apply only to the older Canvas importer. **Legacy: Import Pinterest board as Canvas** and **Sync Pinterest Canvases** remain available for that workflow.
- Supported local formats: JPG/JPEG, PNG, GIF, WebP, AVIF and BMP, up to 25 MB per image. HEIC and SVG are not supported.

## 💻 Installation

Requires **Obsidian 1.5.7 or newer**.

**directly in Obsidian:**
- Cloudboard is not yet in the official Community plugins directory. Once listed, install it via Settings → Community plugins → Browse → search for **Cloudboard** → *Install* → **Enable**.

**via GitHub:**
- Download `manifest.json`, `main.js` and `styles.css` from the [latest release](https://github.com/finnxwz/cloudboard/releases/latest).
- Copy them into `<your vault>/.obsidian/plugins/cloudboard/`.
- Reload Obsidian and enable **Cloudboard** under *Settings → Community plugins*.

**via BRAT:**
- Install [BRAT](https://github.com/TfTHacker/obsidian42-brat), run *Add Beta plugin* and enter `finnxwz/cloudboard`.

Upgrading from **Import From Pinterest**: existing `.pboard` boards remain compatible. Install Cloudboard in the new `cloudboard` plugin folder; settings from the old installation are not migrated automatically.

## 😎 You might also like some other plugins I've made:

- **[TidyTasks](obsidian://show-plugin?id=tidytasks)** - Automatically move completed tasks to the bottom of each Markdown task list, keeping subtasks attached and surrounding text in place.
- **[Notemoji](obsidian://show-plugin?id=notemoji)** - Assign emoji icons to notes and folders in the file explorer to make your vault feel a little cozier.

Cloudboard is designed to work across Windows, macOS, Android, and iOS. Mobile testing on real devices is still ongoing.

## ⚠️ Feedback and support

Found a bug or have a suggestion? Open an issue in this repository's **GitHub Issues** tab. Include your Obsidian version, device/platform, the steps you took and what you expected to happen. Please remove private note content and personal image URLs before sharing examples.
