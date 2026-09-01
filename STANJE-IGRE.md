# HUGO: Neural Overload — Stanje projekta

> Ažurirano 01.09.2026. prema novoj **HUGO strategiji i asset workflowu**. Za stanje prije pivota vidi git tag `pre-arena-pivot`.

---

## 1. Smjer projekta (pivot 29.08.2026)

**Arena je jedina aktivna igra.** Stara kampanja `/play` i 2D arena `/arena-legacy`
više nisu aktivni leveli; obje rute preusmjeravaju na `/arena`. Njihovo stanje prije
scope reza sačuvano je u provjerenom backupu od 31.08.2026.

Igrač uvijek ostaje ljudski pilot. Vanguard/Warrior, Spectre/Rogue i Riftweaver/Warlock su klase,
ne igrivi roboti, a kompletiran gear daje stat modifikatore bez transformacije tijela.
Robotski neprijatelji i bossovi ostaju dio art directiona. Portali se aktiviraju kao
prijelaz iz Surface Arene u Underground endgame.

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
| **Beskonačna mapa** — district chunk streaming (40m chunkovi, 6 district arta, deterministički) | ✅ |
| Igrač = muški/ženski ljudski pilot sa profesionalnim Meshy skinom; Idle/Walk/Run/Combat Stance/Combat Walk i posebni Warrior/Rogue/Warlock napadi animiraju cijelo tijelo; gear nikada ne mijenja pilota u robota | ✅ |
| 5 tipova neprijatelja (drone, heavy, hunter, reaver, elite) | ✅ |
| **3D modeli neprijatelja iz Meshy-ja** (iz našeg 2D arta) | ✅ 5/5 |
| Proceduralni propovi po chunkovima (reaktor, relej, pylon, cargo, city-block) | ✅ 5/5 GLB |
| Text-to-3D city kit (2 tornja, warehouse, wall, barrier, gate, ramp) | ❌ odbijen i uklonjen iz runtimea; masteri sačuvani |
| Novi 3D asset workflow | ✅ 2D concept → review → Meshy image-to-3D → runtime |
| V2 asset pack (4 projektila + data-core + 7 mapnih asseta) | ✅ 12/12 Meshy image-to-3D, web-optimizovano, spojeno i odobreno |
| P0 audio sloj | ✅ Originalna dinamička synthwave muzika + 11 gameplay SFX-ova spojeni |
| P0 wave director | ✅ 10 min, 7 faza, predasi i elite momenti na 3/6/9 min |
| P0 combat juice | ✅ Damage brojevi, screen shake, hit-stop i combo brojač/zvuk |
| Directional combat | ✅ Pucanje prati smjer kretanja/okretanja; podni nišan pokazuje putanju, radijalne moći ostaju 360° |
| Combat feedback | ✅ Veći izlazni/ulazni DMG brojevi, `+XP` pickup brojevi i pojačan combo HUD |
| Combo protokoli | ✅ Jednokratni pragovi 50/100/200/400/800/1600, screen purge + rastući shield/overdrive/repair bonusi |
| District prohodnost | ✅ Edge-blend prijelazi, zajednički asfalt i garantovana 8.5m križna cestovna mreža bez blokirajućih zgrada/propova |
| Biome pass | ✅ Originalni Verdant Rift, Flooded Rail Marsh i Sunken Reservoir; animirana voda, modularne šine, stabla i dvije vrste grmlja |
| Boss arrival | ✅ Seamless orbitalno bombardovanje bez loading screena, upozorenja na tlu, zapaljene impact zone i destrukcija pri dolasku bossa |
| Health ekonomija | ✅ 3D health-core na podu + kontrolisani dropovi iz heavy/elite neprijatelja |
| Support Link identitet | ✅ Svaki upgrade ima vlastitu ikonu, oznaku i pozadinski signalni uzorak |
| P0 evolucije | ✅ 6 kombinacija sa stvarnim weapon modifierima i evolution overlayem |
| P0 death recap | ✅ Uzrok smrti, run statistika, nagrade, quick skill kupovina i Enter RE-DEPLOY |
| Auto-fire, dropovi, level-up upgradeovi, 10-min survival, nagrade u profil | ✅ |
| Bloom/vignette post-processing, glow ringovi | ✅ |
| Spawn faze (breach/escalation/overload) + elite na 44s | ✅ |
| P1 operativci kao klase | ✅ Vanguard tank/dvostruki Bastion, Spectre brzi Repeater i Vector probojni Lance; statovi i startna oružja su u JSON-u |
| P1 meta-drip | ✅ Prvih 10 runova imaju trajne unlocke: upgrade pool, operativci, Q/F/E/R moći i Veteran cache |
| P1 pilot + gear loadout | ✅ Izbor muškog/ženskog pilota, novi GEAR tab i 6 fizičkih slotova (head/torso/arms/legs/core/weapon), Common–Legendary scaling i legacy migracija |
| P1 Holo-Fixer ugovori | ✅ 3 susreta po runu, 5 rotirajućih timed ciljeva, automatski prihvat prilaskom 3D hologramu i stackajući +50% damage bez kazne za neuspjeh |
| Sprint energija | ✅ Držanje Spacea daje 1.7× brzinu, troši regenerativnu energiju, ubrzava Walk animaciju i ima zaseban HUD bar |
| Crafting material dropovi | ✅ Normalni neprijatelji rijetko, heavy garantovano, elite 3×; 10 vrsta se odmah trajno spremaju pri 3D pickup-u |
| Prvi boss Relic izbor | ✅ Prvi elite/boss ispušta 3D greatsword na pod; pickup pauzira run i otvara Warrior/Rogue/Warlock izbor, a LMB napadi imaju različit damage, domet, cone, cooldown i VFX |
| Relic 3D weapon pack | ✅ Warrior greatsword, Rogue mono-blade (duplira se u par) i Warlock void glaive; originalni koncepti + Meshy masteri + web GLB kopije |
| Boss progresija i garantovani dropovi | ✅ Boss 1 daje Relic/class izbor, Boss 2 Class Augment (+35% relic damage i materijali), Boss 3 Chassis Core (repair, shield i endgame materijali); nagrada pada tek nakon smrti cijele boss grupe |
| Sci-fi HUD v2 | ✅ Animirani Integrity/Sprint kružni instrumenti, centralni XP link, 4 ikonisana ability slota sa cooldown maskama i statusi Relic/Augment/Chassis |
| QA Arena režim | ✅ `/arena?test=1` u developmentu koristi identičan level i dodaje 1×/2×/4×/8× vrijeme, direktan Boss 1/2/3 jump, god mode, full heal, purge, force Relic i reset runa |
| Pilot/root stabilnost | ✅ Skinned bounds se računaju iz deformisanih verteksa, Meshy root-motion je zaključan na Rapier tijelo i model više ne nestaje niti baca dijelove izvan kamere |
| Crowd pursuit | ✅ Melee i ranged grupe stalno zatvaraju krug prema igraču; ranged strafe zadržava inward komponentu, a neprijateljski collideri više ne blokiraju jedni druge u velikim valovima |
| Jasne class definicije | ✅ Vanguard = Warrior/Guard/Cleave, Spectre = Rogue/Edge/Critical, Riftweaver = Warlock/Flux/Curse; svaka klasa ima resource pravilo, signature, passive, combat loop i weakness u Hubu |
| Povezana permanent Skill Matrix | ✅ 27 data-driven Arena nodeova u 5 grana; troše Skill Pointove dobijene level-upom i svaki modifier se stvarno učitava u run |
| Artifact Weapon sistem | ✅ Svaka klasa starta sa prototype modelom; Boss I daje Artifact Spark, Boss II Class Augment, Boss III Mythic Core; 18 rankabilnih class traitova i Artifact Power progres prikazani su na `/skills` |
| Boss drop logika | ✅ Boss više ne daje oružje koje klasa već posjeduje; prototype se budi i nadograđuje kroz tri garantovana milestone corea |
| Power-drop ekonomija | ✅ 5 jasno obojenih vrsta: Cycle Surge, Aegis Charge, Chrono Field, Repair Nanites i trajni Artifact Residue; Arena briefing i pickup tekst navode tačan efekt i trajanje |
| Logični gear crafting | ✅ Recepti koriste stvarne količine materijala, level i tier prerequisite; svaki item navodi purpose, class synergy i broj owned/needed; weapon slot je jasno Artifact Mod, ne drugo class oružje |
| English Act I + New Operative loop | ✅ 11 neblokirajućih transmisija objašnjava Zero Day, dolazak/poraz sva tri bossa, Artifact milestonee i Underground otključavanje; poruke imaju queue pa se ne prepisuju. Mythic Core otključava sve klase, repeatable endgame i izbor novog operativca uz zadržan account Skill Matrix/crafting i zaseban class Artifact progres |
| Aktivni portal + Underground level | ✅ Proceduralni 3D gateway ostaje vidljiv kao dormant element prije tri ključa, a Mythic Core pali rotirajuće teal/purple ringove, membranu, floor glyph, čestice, svjetlo i 1.35s charge HUD. Ulazak čisti površinski pritisak, teleportuje pilota i prebacuje isti build u generisani beskonačni Underground grid sa tunelima, mašinama, energetskim kanalima, novim fogom/rasvjetom i 10-min repeatable depth runom; Underground boss cache daje Artifact Residue umjesto campaign corea. Meshy potrošnja: 0 kredita |

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

**Potrošnja za arena zadatak:** Batch 1 (4 neprijatelja, image-to-3d): 60 kredita ✅.
Batch 2 (reaver + 5 propova, text-to-3d): 180 kredita ✅. Batch 3 (`arena-city-kit`,
7 modularnih environment asseta): 210 kredita ✅. Batch 4 (12 odobrenih V2 concepta,
image-to-3D): 180 kredita ✅. Batch 5 (stabla, grmlje, šina, orbitalna raketa i health-core):
105 kredita ✅. Batch 6 (`arena-relic-weapons-v1`, tri class oružja): 45 kredita ✅.
Batch 7 (`arena-pilots-v1`, muški i ženski pilot iz originalnih 2D koncepata): 30 kredita ✅.
Batch 8 (`arena-pilot-combat-v1`, profesionalni skin/rig + Idle, Combat Stance i melee):
28 kredita ✅. Batch 9 (`arena-pilot-class-motion-v1`, Combat Walk + Warrior/Rogue/Warlock
napadi za oba pilota): 24 kredita ✅. Balans poslije batcha 9: **443**.

---

## 4. Šta dalje / otvoreno

Glavni izvor plana je `docs/source-plans/strategija-2026-08-30-v2-unreal.txt`.
Web ostaje laboratorija/demo do content-locka; finalni release se zatim portuje u UE5.

1. **Progression + economy core završen:** klase, permanent Skill Matrix, class Artifact stabla, pet power dropova i tierani gear crafting spojeni su u Arena runtime i provjereni u stvarnom UI-ju
2. **Act I priča i ciklus završeni:** English transmisije vode kroz Surface Lock i tri Artifact milestonea; treći otključava repeatable endgame i New Operative izbor
3. **Portal + osnovni Underground završeni:** dormant/active gateway, charge tranzicija i generisani repeatable depth runtime rade; sljedeće su tri različita 3D boss identiteta i njihove posebne moći
4. Arena je jedini gameplay ulaz iz Huba; `/play` i `/arena-legacy` su retired redirecti
5. Mobile traka ostaje zatvorena

## 5. Poznata ograničenja

- Firebase deploy nekonfigurisan (`.firebaserc` placeholder) — sve je lokalno
- Progres u localStorage (zustand persist), nema clouda
- Audio je proceduralni WebAudio; završni mix/balans se radi kroz playtest
- Nema testova
