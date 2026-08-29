# HUGO: Neural Overload — Stanje projekta

> Pregled napravljen 29.08.2026. na osnovu koda u `/Users/arminzimic/hugo claude`
> (kopija od `Desktop/HUGO1 copy`, git grana `codex/boss-performance-pass`).

---

## 1. Šta je ovo

Browser igra (Next.js web app) — cyberpunk/neon arcade sa kampanjom podijeljenom
u sektore, skill stablom, craftingom i 3D operativcima.

**Tech stack:**

| Šta | Verzija |
|---|---|
| Next.js | 16.2.4 (App Router) |
| React | 19.2.4 |
| TypeScript | 5 |
| Tailwind CSS | 4 |
| Three.js | 0.184 (3D modeli operativaca, boss) |
| Zustand | 5 (game state + persist u localStorage) |
| Framer Motion | 12 (UI animacije) |
| ogl, postprocessing | pozadinski efekti |

**Komande:**

```bash
npm run dev      # dev server na 127.0.0.1:3000
npm run build    # produkcijski build
npm run deploy   # build + firebase deploy (vidi "Šta nedostaje")
```

---

## 2. Rute / ekrani

| Ruta | Fajl | Šta radi | Stanje |
|---|---|---|---|
| `/` | `src/app/page.tsx` (498 linija) | Landing + login (username) | ✅ Radi |
| `/hub` | `src/app/hub/page.tsx` (746) | Glavni meni: sektori, level select, statistika, achievementi, 3D preview operativca | ✅ Radi |
| `/play` | `src/app/play/page.tsx` (4636) | **Glavna igra** — canvas game loop, svi tipovi levela, boss fightovi | ✅ Radi |
| `/skills` | `src/app/skills/page.tsx` (607) | Skill stablo, ~40 skillova u 3 grane | ✅ Radi |
| `/garage` | `src/app/garage/page.tsx` (221) | Cursor shop (11 kursora, kupovina kreditima) | ✅ Radi |
| `/arena` | `src/app/arena/page.tsx` (1296) | Top-down survival prototip (sektor 98) | 🧪 Test/prototip |

---

## 3. Šta je URAĐENO

### Level sistem (kampanja)
- **11 levela po sektoru** (10 običnih + boss na 11. mjestu).
- Tipovi levela po formuli u `gameStore.ts`:
  - `ninja` (neparni), `static` (parni), `gd` (svaki 3.), `chess` (5.),
    `snail` (7. i 10.), `chaos_bonus` (1. level sektora 2+), `boss` (11.).
- Specijalni sektori: **98 = Arena test**, **99 = bonus "LUDILO"** (gd/snail mix), **100 = Boss test**.
- Level intel ekrani (naslov, podnaslov, ciljevi) za uvodne levele — `src/data/progression.ts`.

### Boss sistem
- 7 boss profila definisano (`play/page.tsx`): Cyber Sentinel, Magma Forge, Void Archon,
  Quantum Mirror, Omega Firewall, Ludilo Core, Evil Eye Overseer — svaki sa svojim
  attack patternom (laser, meteor, ring, split, omega, chaos).
- Boss faze, laseri, rakete, mini-boss u GD levelima.
- 3D **Overseer boss** komponenta (`src/components/boss/OverseerBoss.tsx`).
- Git grana `codex/boss-performance-pass` = trenutno se radi optimizacija boss performansi
  (postoji backup grana `codex/backup-20260508-pre-boss-perf`).

### Progresija i ekonomija
- XP + leveli igrača (1000 XP po levelu), krediti, otključavanje sektora.
- Zustand store sa `persist` — **sav progres se čuva lokalno (localStorage)**.
- Replay levela, checkpoint logika, max level tracking.

### Skill stablo (~40 skillova, 3 grane)
- **Combat**: Precision, Blast Shot, Auto Fire, Critical, Ricochet, Cluster Bomb,
  Phantom, Bloodlust, Shockwave, Overdrive II…
- **Force (vrijeme)**: Reflexes, Barrier, Time Warp, Phase Shift, Pulse Wave,
  Time Siphon, Time Warp II, Phase Rush…
- **Survival**: Siphon, Extra HP, Magnet+, Overdrive, Resurrect…

### Crafting
- 10 materijala (Iron Shard → Ancient Gear Core) sa vrijednostima 1–10.
- 10+ recepata (Runner Boots, Shadow Gloves, Plasma Belt, Titanium Chestplate,
  Gravity Boots, Neon Visor, Void Cloak, Solar Ring, Ancient Stabilizer, Dragon Engine).
- Materijali padaju u igri, craftanje kroz store (`craftRecipe`).

### Achievementi
- 12 achievementa (First Jump, No Hit Run, Speed Demon, Boss Destroyed, Storm Rider…),
  prikaz u hubu, dodjela iz gameplay-a.

### Heroji / Operativci (3 komada)
| Operativac | Uloga | 2D slika | 3D model | Meshy status |
|---|---|---|---|---|
| VANGUARD | Defense/Control | ✅ | ✅ `vanguard.glb` | ✅ Prihvaćen |
| SPECTRE | Speed/Assault | ✅ | ✅ `spectre.glb` | ❌ Odbijen (loša geometrija) → koristi se STL izvor |
| VECTOR | Precision/Mobility | ✅ | ✅ `vector.glb` | ✅ Prihvaćen |

### Arena mod (prototip, sektor 98)
- Top-down survival: 60 sekundi, auto-fire oružje, data cores, elite spawn na 44s,
  beskonačni city districts (Neon Crossing, Freight Grid, Transit Ward), radar.

### Vizuelni efekti i UI
- Custom cursor sistem + shop (11 kursora), SplashCursor (fluid efekat),
  NeuralBackground, LevelBackground, EvilEye, Lightning storm efekat, GameHud,
  TelemetryRing, scanline estetika.
- Zvuk: proceduralni WebAudio (beep/square sinteza za hit, boss hit itd.).

### 3D asset pipeline (infrastruktura)
- Meshy batch skripta (`scripts/meshy-asset-batch.mjs`) sa sigurnosnim pravilima
  (credit limit, stop na HTTP 402/429, bez auto-retry).
- Python skripte za GLB optimizaciju i pripremu Spectre modela.
- Originali sačuvani u `Assets/originals/` (Meshy PBR mape, previewi, STL izvori).
- Review evidencija u `config/asset-reviews.json`.
- Dokumentacija: `docs/3d-asset-pipeline.md`, pravila u `AGENTS.md`.

### Mape / pozadine (webp)
- Cyberia: platform, chaos-intro, city-run.
- Arena: 3 cyber-district pozadine.
- Game sprites: enemy-drone, data-core, player-cube, hazard-mine, shield-module,
  interceptor-missile, time-crystal, energy-reactor.

---

## 4. Šta NEDOSTAJE / nije urađeno

### Kritično / konfiguracija
- ❌ **Firebase deploy nije konfigurisan** — `.firebaserc` još ima placeholder
  `"YOUR_PROJECT_ID_HERE"`, pa `npm run deploy` ne može proći.
- ❌ **Necommitovane izmjene** — velik dio novog koda (arena, game komponente,
  data fajlovi, modeli, skripte) je untracked/modified na grani
  `codex/boss-performance-pass`; `main` je daleko iza (samo 3 commita ukupno).
- ❌ **README je generički** create-next-app template — ne opisuje igru.

### Gameplay / sadržaj
- ⏳ **Boss performance overhaul u toku** — to je trenutni zadatak (ime grane).
- ❌ **Neprijatelji su još sprite-ovi** — migracija na 3D renderer nije odobrena
  (namjerno, po AGENTS.md pravilima).
- ❌ **Rigging/animacija operativaca nije urađen** — modeli su unrigged,
  rig ide tek nakon review-a (pipeline korak 5).
- ❌ **Modularni Cyberia environment kit** — korak 2 pipeline-a, nije generisan.
- ❌ **3D propovi, hazardi i 3D bossovi** — koraci 3 i 4 pipeline-a, nisu generisani.
- ❌ **Spectre model** — Meshy verzija odbijena, treba trajno rješenje
  (STL izvor se koristi kao zamjena).
- 🧪 **Arena mod je test** (sektor 98) — nije integrisan u glavnu kampanju.
- ❌ **Boss profili postoje za 5 sektora** — sadržaj/balans za dalje sektore ne postoji.

### Tehnički dug
- ❌ **Nema backend-a / cloud save-a** — progres je samo u localStorage
  (briše se sa cache-om, ne prenosi se između uređaja). Login je samo username, bez auth-a.
- ❌ **Nema pravog zvuka/muzike** — samo sintetizovani WebAudio tonovi, nema audio asseta.
- ❌ **Nema testova** — nijedan test framework nije postavljen.
- ⏸️ **Mobile optimizacija pauzirana** — `DeviceGuard` je trenutno prazan passthrough;
  po AGENTS.md ne radi se dok je user ne reaktivira.
- ⚠️ `play/page.tsx` ima **4636 linija** u jednom fajlu — kandidat za razbijanje
  na module (vjerovatno dio performance passa).
- ⚠️ Čudni prazni folderi u rootu: `novi projekat monri`, `novi rjekat monri ` — višak.
- ⚠️ `hugo_galactic_final-2.html` u rootu — stara standalone verzija igre, samo referenca.

---

## 5. Git stanje

| | |
|---|---|
| Aktivna grana | `codex/boss-performance-pass` |
| Backup grana | `codex/backup-20260508-pre-boss-perf` |
| `main` | 3 commita, daleko iza radne grane |
| Working tree | ~18 fajlova izmijenjeno/novo, **necommitovano** (4252 dodane linije vs main) |

---

## 6. Prijedlog prioriteta (šta dalje)

1. **Commitovati trenutno stanje** na radnu granu (backup prije daljeg rada).
2. **Završiti boss performance pass** (trenutni zadatak).
3. **Srediti Firebase projekat** (pravi project ID) da deploy radi.
4. Razbiti `play/page.tsx` na manje module.
5. Odlučiti sudbinu Arena moda (integracija ili odvojeni mod).
6. Cloud save / auth kad igra bude spremna za igrače.
