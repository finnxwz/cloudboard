# Cloudboard

Create Pinterest-style image boards with four fixed columns — local photos, vault images and online images in one place. No Canvas and no Pinterest login required.

## ⚒️ Features

- Four fixed image columns with rounded cards and an empty **+** frame in every column.
- Add photos **from your device**, **from your vault**, as a **direct HTTPS image** or as a **public Pinterest pin preview**.
- Captions can be edited with the pencil or cleared completely; source links stay hidden.
- Optional caption bar: turn it off to show only the photo, with edit and delete actions appearing on hover or tap.
- Reorder cards with drag and drop — across columns too. On touch screens, hold a card for a moment and drag. Keyboard users can focus a card and move it with the arrow keys.
- Click an image for a large preview. Removing a card **never deletes the image file** from your vault.
- Your boards live in a dedicated `.pboard` file, not in a Canvas. The original note is never changed.
- Existing Canvas boards can be converted into an image board without modifying the source Canvas.
- Interface available in **English (default), German, Spanish and French**.
- Online images stay online; they are not downloaded into your vault.

## 🤔 How to use Cloudboard

| Action                | How                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Create a board        | Right-click a Markdown note → *Convert note into an image board*. Cloudboard creates `<note name> Board.pboard` and opens it automatically. |
| Create an empty board | With no Markdown note active, click the *New image board* ribbon icon.                                                                      |
| Add images            | Click the **+** in a column → *Choose from device*, *Choose from vault* or paste an *Internet link*.                                          |
| Add a Pinterest pin   | Paste a full pin link such as `https://www.pinterest.com/pin/123456789/` and let Cloudboard use its public preview image.                     |
| Edit a caption        | Click the pencil below the image, or on the image itself when the caption bar is hidden.                                                     |
| Remove a card         | Click the trash icon. The image file remains in your vault.                                                                                 |
| Reorder cards         | Drag a card on desktop; long-press and drag on touch; focus a card and use the arrow keys on a keyboard.                                    |
| Preview an image      | Click the image.                                                                                                                            |
| Convert an old Canvas | Right-click a `.canvas` file → *Import as an image board*. The original Canvas stays unchanged.                                              |

## 💻 Installation

Requires **Obsidian 1.5.7 or newer**. Cloudboard is not yet listed in the official Community plugins directory.

- **via GitHub release:**
  - Open the [latest release](https://github.com/finnxwz/cloudboard/releases/latest).
  - Copy `main.js`, `manifest.json` and `styles.css` into `<your vault>/.obsidian/plugins/cloudboard/`.
  - Reload Obsidian and enable **Cloudboard** under *Settings → Community plugins*.
- **via BRAT:**
  - Install [BRAT](https://github.com/TfTHacker/obsidian42-brat), then run *Add Beta plugin* and enter `finnxwz/cloudboard`.
- **from source:**
  - Run `npm install`, `npm test` and `npm run build`, then copy the three files above into the plugin folder.

## ⚙️ Settings

| Setting             | What it does                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Language            | Switches the plugin interface between English, German, Spanish and French. Your own captions and notes are never translated.       |
| Show caption bar    | Shows captions and actions below the photo. When off, actions appear when hovering or tapping the image.                           |
| Sync interval       | Background sync for the older Pinterest-to-Canvas import.                                                                          |
| Save images locally | Downloads Pinterest images into the vault during the older import or sync.                                                         |
| Sync now            | Checks all linked Canvas boards immediately. These last three settings apply only to the legacy Canvas importer.                    |

## 💡 Additional info

- Cloudboard stores each board as a readable JSON file with a `.pboard` extension. The extension is independent of Canvas; existing boards remain compatible after the rename from **Import From Pinterest**.
- If you previously installed the plugin under the old ID `import-from-pinterest`, install Cloudboard into the new `cloudboard` plugin folder. Old plugin settings are not migrated automatically.
- Local images must be present in the vault or synced to your device. Online images need an internet connection and can disappear if the image host removes them.
- Pinterest may block public pin previews even when a pin is publicly visible. In that case, open the pin in your browser and copy the direct image address (`https://i.pinimg.com/...`) instead of the pin page URL.
- On narrow screens the board keeps all four columns and scrolls horizontally. To use local images on mobile, sync the `.pboard` file and its image attachments; online images work without local files.
- Supported local formats: JPG/JPEG, PNG, GIF, WebP, AVIF and BMP, up to 25 MB per image. HEIC and SVG are not supported.
- The legacy Canvas importer uses public Pinterest endpoints without a Pinterest login. Pinterest can change or restrict these endpoints at any time.
- Cloudboard is not affiliated with Pinterest. Image rights remain with their respective owners.

## 😎 You might also like some other plugins I've made:

- **[TidyTasks](obsidian://show-plugin?id=tidytasks)** — Automatically move completed tasks to the bottom of each Markdown task list while keeping subtasks attached and surrounding text intact.
- **[Notemoji](obsidian://show-plugin?id=notemoji)** — Assign emoji icons to notes and folders in the file explorer to make your vault feel a little cozier.

Cloudboard is designed for Windows, macOS, Android and iOS. Mobile testing on real devices is still ongoing.

## ⚠️ Feedback and support

Found a bug or have a suggestion? Open an issue in this repository's **GitHub Issues** tab. Include your Obsidian version, device/platform, the steps you took and what you expected to happen. Please remove private note content and personal image URLs before sharing examples.
