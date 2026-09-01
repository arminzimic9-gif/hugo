# HUGO: Neural Overload — handoff za sljedećeg agenta

> Checkpoint: 01.09.2026. u 14:33 CEST  
> Status: aktivni web prototip, Arena-first pivot  
> Jezik UI-ja i priče: English  
> Fokus sljedećeg agenta: gameplay logika, jasnoća sistema, UI/UX i završni boss playtest

## 0. Prvo pročitaj ovo

**Jedini aktivni source-of-truth projekat je:**

```text
/Users/arminzimic/hugo claude
```

Ne nastavljaj u staroj kopiji:

```text
/Users/arminzimic/Desktop/HUGO1 copy
```

Aktivna grana i početni commit ovog checkpointa:

```text
branch: codex/boss-performance-pass
HEAD:   8aff49b
```

Worktree je namjerno veoma dirty: sadrži veliki broj korisnikovih i prethodnih agentovih izmjena i novih asseta. **Ne koristiti `git reset --hard`, `git checkout --`, cleanup koji briše untracked fajlove niti masovno prepisivanje.** Sve postojeće promjene treba sačuvati.

Obavezno prvo pročitati:

```text
/Users/arminzimic/hugo claude/AGENTS.md
/Users/arminzimic/hugo claude/STANJE-IGRE.md
```

Ovo je Next.js 16.2.4 sa breaking promjenama. Prije mijenjanja Next.js API-ja/routinga pročitati relevantan vodič u:

```text
/Users/arminzimic/hugo claude/node_modules/next/dist/docs/
```

## 1. Sigurnosni backup

Provjereni backup prije Arena scope reza:

```text
/Users/arminzimic/Desktop/HUGO-backups/hugo-claude-before-arena-scope-2026-08-31_23-25-33.tar.gz
```

Veličina: 1.8 GB  
SHA-256:

```text
5a27c3a5eefa6055d0766c1b88d63da99c841d55bb4ba90a522ace188c020350
```

`node_modules` i `.next` nisu prenosivi source podaci; obnavljaju se iz `package-lock.json` i novim buildom. Ne treba ih kopirati u buduće backupe.

## 2. Produkt odluka korisnika

- Arena `/arena` je jedina aktivna igra i centralni gameplay.
- `/play` i `/arena-legacy` su uklonjeni kao igrivi sistemi i preusmjeravaju na `/arena`.
- Igrač uvijek ostaje ljudski pilot; klase ne pretvaraju igrača u robota.
- Roboti ostaju neprijatelji i bossovi.
- Portal ostaje važan element i nakon Act I vodi u proceduralni Underground endgame.
- Klasa odmah posjeduje prototype Artifact Weapon. Bossovi zato ne bacaju zamjensko class oružje; daju milestone jezgre koje bude i nadograđuju postojeći Artifact.
- Act I ima tri bossa, poslije njih repeatable endgame, bolji buildovi i opcija `New Operative` za novu class kampanju uz zadržan account progres.
- Nema mobile-specifičnog rada dok korisnik ponovo ne otvori taj track.
- Korisnik je odobrio lokalni razvoj i asset rad, ali Meshy limite uvijek poštovati.

## 3. Pokretanje i QA

```bash
cd '/Users/arminzimic/hugo claude'
npm install
npm run dev
```

Glavne adrese:

```text
http://127.0.0.1:3000/hub
http://127.0.0.1:3000/skills
http://127.0.0.1:3000/arena
http://127.0.0.1:3000/arena?test=1
```

`/arena?test=1` je development QA overlay. Ima ubrzanje vremena, direktan jump na Boss I/II/III, god mode, heal, purge, force relic, reset i portal descent.

Provjere urađene neposredno prije ovog handoffa:

```text
npx tsc --noEmit  PASS
npm run build     PASS
git diff --check  PASS
```

Produkcijski build je uspješno generisao sve rute. Jedini build signal je Node deprecation upozorenje za `module.register()`; nije blokirajuće.

## 4. Trenutni gameplay sistem

### Aktivni loop

1. Hub: izbor ljudskog pilota, klase i geara.
2. Arena: 10-minutni Surface run, XP, level-up upgradeovi, klase, Artifact i power dropovi.
3. Boss I na 180 s: Axiom Warden → Artifact Spark / Artifact Tier I.
4. Boss II na 360 s: Gemini Choir, dvije jedinice → Class Augment / Artifact Tier II.
5. Boss III na 540 s: Hollow Crown, tri sharda → Mythic Core / Artifact Tier III.
6. Sva tri milestonea aktiviraju portal.
7. Portal prebacuje isti build u proceduralni Underground repeatable run.
8. Završetak Act I otključava endgame i `New Operative`; account Skill Matrix/crafting ostaju, Artifact progres je odvojen po klasi.

### Klase

- `Vanguard / Warrior`: Guard, stabilan front line, cleave; Artifact `Aegis Breaker`.
- `Spectre / Rogue`: Edge, brzina, critical chain; Artifact `Night Circuit`.
- `Riftweaver / Warlock`: Flux, curse/control/sustain; Artifact `Null Testament`.
- Persisted interni id za Riftweaver je još `vector` zbog kompatibilnosti sa starim saveovima. Ne mijenjati bez migracije.

Definicije i efekti:

```text
/Users/arminzimic/hugo claude/src/data/arenaProgression.ts
/Users/arminzimic/hugo claude/src/data/arenaOperators.ts
/Users/arminzimic/hugo claude/src/data/arena-operators.json
/Users/arminzimic/hugo claude/src/data/heroes.ts
```

Permanent Skill Matrix trenutno ima 27 funkcionalnih nodeova u pet povezanih grana. Artifact sistem ima 18 rankabilnih class traitova.

### Ekonomija i dropovi

```text
/Users/arminzimic/hugo claude/src/data/arenaPowerDrops.ts
/Users/arminzimic/hugo claude/src/data/crafting.ts
/Users/arminzimic/hugo claude/src/components/arena/Drops.tsx
/Users/arminzimic/hugo claude/src/app/skills/page.tsx
```

Pet power dropova:

- Cycle Surge
- Aegis Charge
- Chrono Field
- Repair Nanites
- Artifact Residue

Crafting koristi količine, tier i level prerequisite. Weapon gear slot predstavlja `Artifact Mod`, ne drugo class oružje.

### Story

```text
/Users/arminzimic/hugo claude/src/data/arenaStory.ts
```

Postoji 11 English transmisija sa queue sistemom: Zero Day, dolazak i poraz tri bossa, Artifact milestonei, Underground unlock i endgame loop. Poruke su neblokirajuće i ne bi se smjele međusobno prepisivati.

### Portal i Underground

```text
/Users/arminzimic/hugo claude/src/components/arena/ArenaPortal.tsx
/Users/arminzimic/hugo claude/src/components/arena/UndergroundLevel.tsx
/Users/arminzimic/hugo claude/src/components/arena/ArenaScene.tsx
```

Portal je uvijek vidljiv kao dormant element. Nakon tri ključa dobija rotirajuće ringove, teal/purple membranu, floor glyph, čestice i svjetlo. Ulaz ima 1.35 s charge i mijenja environment u proceduralni Underground. Portal descent je ranije browser-testiran bez app runtime grešaka.

## 5. Tri nova Act I bossa

Gameplay identitet i UI tekst:

```text
/Users/arminzimic/hugo claude/src/data/arenaBosses.ts
```

Spawn/stat definicije:

```text
/Users/arminzimic/hugo claude/src/data/arena-enemies.json
/Users/arminzimic/hugo claude/src/data/arena-spawn-tables.json
```

Runtime logika:

```text
/Users/arminzimic/hugo claude/src/components/arena/Enemies.tsx
/Users/arminzimic/hugo claude/src/components/arena/BossBombardment.tsx
/Users/arminzimic/hugo claude/src/components/arena/ArenaGame.tsx
```

Boss sposobnosti:

- Boss I `Axiom Warden`: jedan teški model, petostruki `Siege Fan`, nagrada Artifact Spark.
- Boss II `Gemini Choir`: dva modela sa offset firing laneovima, `Prediction Cross`, nagrada Class Augment.
- Boss III `Hollow Crown`: tri sharda sa offset radial singularity wheelovima, `Crown Execution`, nagrada Mythic Core.
- Boss nagrada pada tek kada je mrtva cijela grupa datog bossa.
- Underground boss cache daje Artifact Residue umjesto ponovnog campaign corea.

### Boss 3D source i runtime

Originalni 2D koncepti — nikad ne brisati niti prepisati:

```text
/Users/arminzimic/hugo claude/assets/originals/imported/arena-bosses/cyber-sentinel-boss1.png
/Users/arminzimic/hugo claude/assets/originals/imported/arena-bosses/gemini-choir-boss2.png
/Users/arminzimic/hugo claude/assets/originals/imported/arena-bosses/hollow-crown-boss3.png
```

Meshy masteri, PBR teksture, task metadata i četiri previewa po bossu:

```text
/Users/arminzimic/hugo claude/assets/originals/meshy/cyber-sentinel-boss1/
/Users/arminzimic/hugo claude/assets/originals/meshy/gemini-choir-boss2/
/Users/arminzimic/hugo claude/assets/originals/meshy/hollow-crown-boss3/
```

Optimizovane browser GLB kopije:

```text
/Users/arminzimic/hugo claude/public/models/bosses/cyber-sentinel-boss1.glb
/Users/arminzimic/hugo claude/public/models/bosses/gemini-choir-boss2.glb
/Users/arminzimic/hugo claude/public/models/bosses/hollow-crown-boss3.glb
```

Sva tri front previewa su ručno pregledana i geometrija je dovoljno čista za trenutni runtime. Nisu rigovani: za sada se kreću/proceduralno napadaju kao robotski bossovi, a dodatni rig ne donosi dovoljno koristi. Ne rigovati automatski.

Meshy batch:

```text
batch: arena-act1-bosses-v1
Cyber Sentinel task: 01a05b55-522b-7704-8170-871e167dc167 — SUCCEEDED — 15 credits
Gemini Choir task:   01a05b57-cdfe-74d2-994f-35ab546cafce — SUCCEEDED — 15 credits
Hollow Crown task:   01a05b59-cabc-700a-ac8e-3c1140c14555 — SUCCEEDED — 15 credits
batch spent: 45 credits
balance after batch: 398 credits
```

Ne pokretati isti batch ponovo bez jasne potrebe; to bi ponovo potrošilo kredite. Konfiguracija je u:

```text
/Users/arminzimic/hugo claude/config/meshy-assets.json
```

API ključ je samo lokalno u `.env.local`. **Ne otvarati ga u outputu, ne kopirati u kod, handoff, prompt, log ili metadata.**

Runtime GLB kopije su napravljene iz mastera pomoću:

```text
/Users/arminzimic/hugo claude/scripts/optimize_glb_for_web.py
```

## 6. Glavna mapa koda

### Rute i veći UI

```text
/Users/arminzimic/hugo claude/src/app/page.tsx
/Users/arminzimic/hugo claude/src/app/hub/page.tsx
/Users/arminzimic/hugo claude/src/app/skills/page.tsx
/Users/arminzimic/hugo claude/src/app/arena/page.tsx
/Users/arminzimic/hugo claude/src/app/play/page.tsx
/Users/arminzimic/hugo claude/src/app/arena-legacy/page.tsx
```

### Arena runtime

```text
/Users/arminzimic/hugo claude/src/components/arena/ArenaGame.tsx
/Users/arminzimic/hugo claude/src/components/arena/ArenaScene.tsx
/Users/arminzimic/hugo claude/src/components/arena/Player.tsx
/Users/arminzimic/hugo claude/src/components/arena/Enemies.tsx
/Users/arminzimic/hugo claude/src/components/arena/Projectiles.tsx
/Users/arminzimic/hugo claude/src/components/arena/Drops.tsx
/Users/arminzimic/hugo claude/src/components/arena/Effects.tsx
/Users/arminzimic/hugo claude/src/components/arena/DistrictFloor.tsx
/Users/arminzimic/hugo claude/src/components/arena/world.ts
```

### State i persistencija

```text
/Users/arminzimic/hugo claude/src/store/gameStore.ts
/Users/arminzimic/hugo claude/src/store/arenaSession.ts
```

- `gameStore.ts`: persistent account progres, skill points, Artifact state po klasi, story bossovi, endgame, operative cycles i crafting količine.
- `arenaSession.ts`: trenutni run, neprijatelji, boss nagrade, power dropovi, story queue, portal/environment i Underground state.
- Progres je u Zustand/localStorage; cloud save ne postoji.

### Data-driven balans

```text
/Users/arminzimic/hugo claude/src/data/arena-config.json
/Users/arminzimic/hugo claude/src/data/arena-enemies.json
/Users/arminzimic/hugo claude/src/data/arena-spawn-tables.json
/Users/arminzimic/hugo claude/src/data/arena-upgrades.json
/Users/arminzimic/hugo claude/src/data/arenaBosses.ts
/Users/arminzimic/hugo claude/src/data/arenaProgression.ts
/Users/arminzimic/hugo claude/src/data/arenaPowerDrops.ts
/Users/arminzimic/hugo claude/src/data/arenaStory.ts
/Users/arminzimic/hugo claude/src/data/crafting.ts
```

Prije hardkodiranja nove vrijednosti provjeriti da li pripada ovdje.

### Asset korijeni

```text
/Users/arminzimic/hugo claude/assets/originals/imported/   # dostavljeni/generisani source koncepti
/Users/arminzimic/hugo claude/assets/originals/meshy/      # Meshy masteri, taskovi, previewi i PBR
/Users/arminzimic/hugo claude/public/models/               # browser-ready kopije
/Users/arminzimic/hugo claude/public/images/               # browser slike/effects/maps/pilots
/Users/arminzimic/hugo claude/config/asset-reviews.json     # accepted/pending/rejected evidencija
/Users/arminzimic/hugo claude/config/meshy-assets.json      # Meshy batch limiti i definicije
```

## 7. Šta sljedeći agent prvo treba uraditi

### Prvih 15 minuta

1. `cd '/Users/arminzimic/hugo claude'` i pročitaj `AGENTS.md` + ovaj fajl.
2. Snimi `git status --short`; ne diraj nepovezane izmjene.
3. Ponovi `npx tsc --noEmit`, `npm run build` i `git diff --check` nakon svojih promjena.
4. Pokreni `/arena?test=1`, uključi God mode i testiraj direktno Boss I, II i III.
5. Za svaki boss provjeri: GLB učitavanje, veličinu/orijentaciju, telegraph, tačan projectile pattern, health/reward, story queue i da se grupna nagrada ne daje prerano.
6. Pobij Boss III, aktiviraj portal i provjeri da isti build prelazi u Underground.

### Prioriteti za logiku

1. **Boss balans i čitljivost:** trenutne sposobnosti rade kodno, ali tri nova 3D bossa poslije zadnje integracije još trebaju kompletan browser playtest i damage/cooldown tuning.
2. **Precizni telegraphi:** postojeći arrival ring i briefing objašnjavaju mehaniku, ali opasne laneove/pattern treba vizuelno označiti prije ispaljenja.
3. **Boss HUD:** jasno ime, faza, broj preostalih Gemini/Crown jedinica i nagrada milestonea.
4. **Class resource loop:** klase su definisane i stat efekti rade; Guard/Edge/Flux treba učiniti još vidljivijim i lakšim za razumijevanje tokom borbe.
5. **Artifact logika:** provjeriti Tier I/II/III prerequisite, rank trošenje, per-class save i ponašanje `New Operative` ciklusa.
6. **Underground:** dublji biome/content pass, jasni depth ciljevi, boss cache i Artifact Residue tuning.
7. **Uklanjanje legacy mrtvog koda:** `RelicChoiceOverlay` još postoji u `ArenaGame.tsx`, ali je normalno preskočen jer se class weapon veže na startu. Ukloniti tek nakon browser regresije.

### Prioriteti za UI/UX

1. Ujednačiti vizuelnu hijerarhiju između `/hub`, `/skills` i `/arena`.
2. Na class ekranu u jednoj čitljivoj kartici prikazati: fantasy, resource, signature, passive, combat loop, weakness i prototype Artifact.
3. Na `/skills` bolje razdvojiti account Skill Matrix, class Artifact tree i crafting; korisnik mora odmah razumjeti šta je trajno, šta je per-class i šta se dobija od kojeg bossa.
4. Arena briefing skratiti i učiniti skenabilnim, bez gubitka boss counterplay/reward informacija.
5. Svi dropovi, gear i weapon modovi moraju uz ime navesti tačan efekat i svrhu.
6. Fokus je desktop web. Ne pokretati mobile optimization track.

## 8. Poznate stvari koje ne treba pogrešno protumačiti

- `STANJE-IGRE.md` ima nekoliko historijskih redova o starom Boss I relic izboru/greatsword dropu. Nova logika u `arenaProgression.ts`, `arenaBosses.ts` i storeovima je mjerodavna: oružje pripada klasi, boss ga samo nadograđuje.
- Boss code/model integracija prolazi typecheck i production build, ali završni browser playtest za sva tri nova runtime modela je još otvoren.
- React lint može prijaviti postojeće React 19 purity/immutability probleme u R3F komponentama zbog `Math.random` u renderu i mutabilnog Three.js world statea. Ne gasiti pravila globalno; popravljati ciljano i bez promjene gameplaya.
- Raniji browser QA je pokazivao Three.js upozorenja za deprecated `Three.Clock`, postprocessing init argumente i `PCFSoftShadowMap`; nije bilo app runtime grešaka. Ovo je tehnički dug.
- Firebase deploy nije konfigurisan; sve je trenutno lokalno.
- Audio je proceduralni WebAudio i završni mix traži playtest.
- Nema automatizovanog gameplay test suitea; postoje typecheck, build, diff check i QA overlay.
- Možda postoji stara hourly overnight automation `hugo-arena-overnight-build`; provjeriti prije kreiranja nove da dva agenta ne rade isti posao.

## 9. Asset i Meshy pravila — bez izuzetka

1. Nikad ne brisati niti prepisivati source/master asset.
2. Importovani source ide u `assets/originals/imported/`.
3. Meshy rezultati idu u `assets/originals/meshy/`.
4. Browser kopije idu u `public/models/`.
5. Prije Meshy taska pročitati `config/meshy-assets.json`.
6. Zaustaviti generaciju na HTTP 402, HTTP 429, nedovoljnom balansu ili prekoračenju batch limita.
7. Ne izlagati API ključeve.
8. Ne auto-rigovati sve modele. Rig samo pregledan, teksturisan standardni humanoid sa jasnim udovima kada rig stvarno treba.
9. Player kandidat za rig: +Z naprijed, bottom origin, metri, A-pose.
10. Postojeće canvas enemies ne pretvarati iznova bez odobrene renderer migracije.

## 10. Definition of done za naredni pass

- Boss I/II/III ručno prolaze kroz puni QA tok bez console/app grešaka.
- Svaki boss ima čitljiv, unaprijed najavljen i međusobno različit napad.
- Boss nagrade i Artifact tierovi se daju tačno jednom i tek poslije cijele boss grupe.
- Klase su razumljive bez dodatnog objašnjenja: resource, stil, slabost i Artifact su vidljivi.
- `/hub`, `/skills` i `/arena` imaju konzistentnu navigaciju i vizuelni sistem.
- Portal i Underground rade nakon Boss III i poslije `New Operative` ciklusa.
- `npx tsc --noEmit`, `npm run build` i `git diff --check` prolaze.
- Nijedan master asset nije izbrisan/prepisan i nije potrošen novi Meshy kredit bez potrebe.

