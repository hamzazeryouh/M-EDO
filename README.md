# M-EDO

A local browser editor for turning still images and narration into a finished video. You arrange shots on a timeline, add speech, preview the cut, and export an MP4. An optional AI agent can run the full pipeline from a topic or an imported project.

The app runs on your machine with [Vite](https://vite.dev/) and React. API keys stay in the browser and are sent only to the providers you choose.

## Run it

You need Node.js installed.

```bash
npm install
npm run dev
```

Open the local address Vite prints (usually `http://localhost:5174`).

```bash
npm run build
npm run preview
```

`npm run build` writes a production bundle to `dist`. `npm run preview` serves that bundle.

## What you see

The window is a small editing desk:

- **Top bar** — project name, play, previous and next shot, undo and redo, import, and MP4 export.
- **Preview** — the current frame, with Ken Burns moves and transitions between shots.
- **Timeline** — shot order, duration, and audio. Drag shots to reorder them. Split, duplicate, and change length from the clip menu.
- **Left sidebar** — the tools below. Click the active tab again to hide the panel.
- **Right inspector** — the selected shot: image prompt, narration text, animation, and transition.

Projects are saved in the browser (`localStorage`), not on a server.

## Sidebar

| Tab | What it does |
| --- | --- |
| **Projects** | Create, rename, duplicate, and switch projects. |
| **Media** | Import images into the timeline. |
| **Studio** | Run the full workflow: script, images, speech, sync, export. |
| **Chat** | Give the agent a subject. It runs the enabled steps through export. |
| **Agent** | Set providers, cost mode, max images, and which workflow steps run. |
| **Formats** | Platform size and style: YouTube, Shorts, Reels, TikTok, and others. |
| **Audio** | Import tracks and splice per-shot speech into one master track. |
| **Speech** | Text-to-speech for the selected shot or the whole timeline. |

## How a video is built

A typical pass looks like this:

1. Start an empty project, or import images and a `manifest.json` (shot number, image file, narration, image prompt).
2. Pick a format, such as YouTube 1920×1080 or a vertical short.
3. Write or generate narration and image prompts.
4. Generate images, or use pictures you already imported.
5. Generate speech, splice it into one track, and match shot length to the narration.
6. Preview, then export an MP4.

Speech can use free Microsoft Edge voices with no API key. Image generation and paid voices need a key in **Agent** or **Speech**.

You can also do this by hand: import images, set each shot's duration and motion, add audio, and export.

## Manifest format

Import a folder or file selection containing `manifest.json` plus optional image files:

```json
{
  "title": "My Documentary",
  "visualStyle": "Optional global style notes for AI image prompts",
  "images": [
    {
      "shot": 1,
      "file": "01-intro.jpg",
      "voice": "Opening narration line.",
      "imagePrompt": "Wide shot of a city skyline at dawn."
    }
  ]
}
```

Shots without a matching image file are imported as prompt-only placeholders — use **Agent → Generate images** to fill them in.

## Providers

Keys are entered in the app. They are not stored in this repository.

**Writing (script and narration)**

- OpenAI
- Claude (Anthropic)
- Google Gemini
- Azure OpenAI

**Images**

- OpenAI GPT Image
- Google Gemini Image

**Speech**

- Edge TTS (free, no key)
- OpenAI TTS
- ElevenLabs
- Azure Speech
- Google Cloud TTS

## License

This software is provided under the [Non-Commercial Development License](LICENSE.md).

Copyright (c) 2026 Hamza Zeryouh.

Commercial use requires prior written authorization from Hamza Zeryouh: [zeryouhbusiness@gmail.com](mailto:zeryouhbusiness@gmail.com).
