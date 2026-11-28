# HeartCue Motion Prep

This directory holds standalone HeartCue motion assets. They are not wired into the office app, the 12-character layout, the collaboration manifest, or an invitation flow.

## Clips

Each clip is a transparent VP9 WebM at 12 fps, 3 seconds long, on the existing 2368×1776 (4:3) office canvas:

- `heartcue-sitting.webm` — seated idle / gentle breathing
- `heartcue-walking.webm` — alternating two-step walk cycle in place
- `heartcue-working.webm` — seated laptop typing loop
- `heartcue-daily.webm` — gentle greeting sway

The four clips share the selected empty lower-front workstation anchor **(1570, 1280)**, using top-left origin and character-center coordinates. The position is based on `previews/office-background-4x3.png`; only the transparent character layer is rendered into the clips.

## Rebuild

From the repository root, run:

```bash
python3 build-heartcue-motion.py
```

The builder creates only the four HeartCue WebM files and this directory's `manifest.json`. No existing scene asset, layout, app integration, merge, or deployment is part of this preparation.
