# HUGO 3D Asset Pipeline

## Runtime targets

- Browser prototype: GLB in `public/models/`, lazy loaded and visibility paused.
- Future desktop builds: masters from `assets/originals/`, then platform-specific compression for macOS and Windows.
- Current top-down enemies remain the existing optimized sprite sheet. They are not Meshy candidates yet.

## Source preservation

- Imported files: `assets/originals/imported/`
- Meshy task output, PBR maps, previews, and metadata: `assets/originals/meshy/`
- Browser copies: `public/models/`

Originals are local and Git-ignored because they can be very large. Introduce Git LFS before committing them to a remote repository.

## Generation order

1. Operators: VANGUARD, SPECTRE, VECTOR from the approved in-game references.
2. Modular Cyberia environment kit, not one monolithic map.
3. Gameplay props and hazards.
4. Bosses, one approved concept at a time.
5. Rigging only after a textured humanoid GLB passes front/side/back review.

## Meshy safety

- API configuration lives outside the repository.
- Every paid batch has a credit limit in `config/meshy-assets.json`.
- Balance is checked before each task.
- HTTP 402 and 429 stop the batch immediately.
- Failed tasks are not retried automatically.

Run a preview:

```bash
node scripts/meshy-asset-batch.mjs --batch operators
```

Execute the paid batch only with the API key in the shell environment:

```bash
node scripts/meshy-asset-batch.mjs --batch operators --execute
```
