# HUGO: Neural Overload — Stanje projekta

> Ažurirano 29.08.2026. nakon **arena pivota**. Za stanje prije pivota vidi git tag `pre-arena-pivot`.

---

## 1. Smjer projekta (pivot 29.08.2026)

**Arena je glavna igra.** Kampanja (`src/app/play/page.tsx`, 4.600+ linija) je zamrznuta
kao legacy i ne dira se. Stara 2D arena je sačuvana na ruti `/arena-legacy`.

**Tech stack:** Next.js 16 · React 19 · TypeScript · Tailwind 4 ·
**react-three-fiber + drei + rapier** (3D arena) · Three.js · Zustand · Framer Motion

```bash
npm run dev      # dev server na 127.0.0.1:3000
```

---

## 2. Nova 3D arena (`/arena`)

| Feature | Stanje |
|---|---|
| R3F + rapier fizika, top-down kamera | ✅ |
| **Beskonačna mapa** — district chunk streaming (40m chunkovi, 3 district arta, deterministički) | ✅ |
| Igrač = Vanguard GLB (Spectre/Vector se biraju u hubu) | ✅ |
| 5 tipova neprijatelja (drone, heavy, hunter, reaver, elite) | ✅ |
| **3D modeli neprijatelja iz Meshy-ja** (iz našeg 2D arta) | ✅ 4/5 (reaver u izradi) |
| Proceduralni propovi po chunkovima (reaktor, relej, pylon, cargo, city-block) | ✅ (3D modeli u izradi) |
| Auto-fire, dropovi, level-up upgradeovi, 60s survival, nagrade u profil | ✅ |
| Bloom/vignette post-processing, glow ringovi | ✅ |
| Spawn faze (breach/escalation/overload) + elite na 44s | ✅ |

**Sav balans je u JSON-u** (`src/data/`): `arena-config.json`, `arena-enemies.json`,
`arena-spawn-tables.json`, `arena-upgrades.json` — ništa hardkodirano.

Kod: `src/components/arena/` (ArenaGame, ArenaScene, DistrictFloor, Player, Enemies,
Projectiles, Drops, world.ts) + `src/store/arenaSession.ts`.

---

## 3. Meshy pipeline

- Skripta `scripts/meshy-asset-batch.mjs` — **image-to-3d** (iz referenci) i **text-to-3d**
  (preview + refine). Batchevi/limiti u `config/meshy-assets.json`; staje na 402/429.
- Ključ u `.env.local` (`MESHY_API_KEY`), nikad u repo.
- Svaki rezultat → `Assets/originals/meshy/<id>/` (master + PBR + previewi), optimizacija
  Blenderom (`scripts/optimize_glb_for_web.py`, ~10MB → ~1MB) → `public/models/`.
- Review: `config/asset-reviews.json` — **Armin odobrava** (pending → accepted/rejected).

**Potrošnja za arena zadatak:** limit 10 generacija.
Batch 1 (4 neprijatelja, image-to-3d): 60 kredita ✅. Batch 2 (reaver + 5 propova,
text-to-3d): u toku, limit 90. Balans prije batcha 2: 1.255.

---

## 4. Šta dalje / otvoreno

1. Armin: odobriti/odbiti 4 enemy modela (pending) i batch 2 rezultate
2. Modeli možda pretamni top-down — pojačati svjetlo ako se potvrdi
3. Hub "PLAY" još vodi na kampanju — odlučiti kad arena preuzima glavni ulaz
4. Kampanja levels/bossevi: legacy, bez daljeg rada
5. Ne radi se: rigging, mobile, backend (Armin pauzirao)

## 5. Poznata ograničenja

- Firebase deploy nekonfigurisan (`.firebaserc` placeholder) — sve je lokalno
- Progres u localStorage (zustand persist), nema clouda
- Zvuk je sintetički WebAudio, nema audio asseta
- Nema testova
