<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 3D asset pipeline

- Preserve every supplied or generated source asset. Never overwrite or delete a master file.
- Store imported masters in `assets/originals/imported/` and Meshy results in `assets/originals/meshy/`.
- Store browser-ready GLB copies in `public/models/`. Desktop exports will be derived later from the masters.
- Never put API keys in this repository, source files, prompts, logs, or generated metadata.
- Read `config/meshy-assets.json` before creating a Meshy task. Meshy generation must stop on insufficient balance, HTTP 402, HTTP 429, or when a batch credit limit would be exceeded.
- Do not auto-rig every model. Rig only textured, standard humanoids with clear limbs after the unrigged GLB has been reviewed.
- Player characters face +Z, use bottom origin, meter scale, and A-pose for rig candidates.
- Keep current canvas enemies as sprites until a renderer migration is approved. Do not spend Meshy credits recreating assets that already meet the current art direction.
- No mobile-specific optimization work until the user restarts that track.
