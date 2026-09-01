# HUGO: Neural Overload — UI/UX handoff za novog agenta

> Datum: 01.09.2026 · Tvoja uloga: **SAMO UI/UX i vizuelna prezentacija.**
> Logiku igre, storeove, balans, assete i Meshy NE diraš — to rade drugi agenti.

---

## 0. Kontekst u 5 redova

- Projekat: `/Users/arminzimic/hugo claude` — Next.js 16.2.4, React 19, Tailwind 4, react-three-fiber igra.
- Igra: top-down sci-fi survivor "Arena" (Act I: 3 bossa → portal → Underground endgame). UI jezik: **engleski**.
- Vlasnik (Armin) komunicira na bosanskom; direktan je i tačno zna šta hoće — vjeruj njegovim referencama više nego svom ukusu.
- Prije ikakvog rada pročitaj: `AGENTS.md`, `STANJE-IGRE.md`, i ovaj fajl.
- Worktree može biti dirty od drugih agenata: **nikad `git reset --hard`, nikad brisanje tuđih izmjena.**

## 1. Pokretanje i QA

```bash
cd '/Users/arminzimic/hugo claude'
npm install
npm run dev          # 127.0.0.1:3000
```

- Glavne rute: `/` (login) · `/hub` · `/skills` · `/arena` · `/arena?test=1` (QA overlay: time scale, boss jump, god mode, purge, portal descent).
- Poslije SVAKE izmjene: `npx tsc --noEmit` i `npm run build` moraju proći.
- Headless QA trik (dev): `window.__arenaSession.getState()` i `window.__r3f.advance(t)` postoje kao debug hookovi — ne uklanjaj ih.

## 2. VIZUELNI PRAVAC — šta Armin hoće (njegove riječi i reference)

Estetika: **high-tech sci-fi**, neon (cyan #00f2ff baza), tamna pozadina, "WoW energija u sci-fi pakovanju". Ključne reference koje je sam poslao:

1. **Hades dijalozi** — veliki portret lika koji izlazi iznad okvira, name plate sa epitetom, uokvirena replika. *(Već implementirano u `ArenaGame.tsx` — `HadesStyleTransmission`; dijalozi pauziraju igru. NE kvariti, samo smiješ polirati.)*
2. **Hades "Boons of Zeus" CHOOSE ONE kartice** — vertikalne široke kartice sa rarity bojama. *(Već implementirano za level-up — `UpgradeOverlay`. Smiješ podići nivo: rarity sjaj, hover animacije, ikonografija.)*
3. **V Rising skill tree** — JEDNO veliko stablo koje se grana iz korijena, uredno, sa tooltip karticom sa strane. **Ovo je trenutno najveći prioritet — Armin NIJE zadovoljan postojećim.**
4. **"Quironax" weapon ekran** (mobilna igra referenca) — horizontalne tier kartice sa rimskim brojevima, XP prsten oko aktivnog tiera, hold-to-upgrade osjećaj.
5. Opšti zahtjev: **"uredno, jako, moćno"** — čitljiva hijerarhija, ništa raštrkano.

## 3. STANJE UI-ja PO EKRANU — i šta konkretno treba

### 3.1 `/skills` — GLAVNI ZADATAK ⚠️

Fajl: `src/app/skills/page.tsx` (tri taba: SKILL MATRIX / ARTIFACT WEAPON / GEAR CRAFTING).

Šta postoji: jedno veliko stablo (barycenter layout preko `layoutTree()` — redovi po dubini zavisnosti, čvor ispod prosjeka roditelja), dijamant nodeovi, SVG linije, side panel sa opisom/WHY/cijenom; artifact tab ima tier kartice sa SVG power prstenom + trait stablo sa oružjem kao korijenom i tier separatorima.

**Armin je vidio i rekao da NIJE to to.** Njegova ocjena: struktura ok, ali izgled mora biti dramatično jači i uredniji — "veliko stablo koje se grana, uredno JAKO". Šta to znači u praksi:

- Stablo mora izgledati kao **komad hardvera/organizma, ne kao dijagram**: deblje glavne "žile" od core-a niz grane (ne tanke 1px linije), sjaj duž otključanih puteva, čvorovi sa dubinom (bevel/glow/unutrašnja tekstura), možda blagi angled konektori (koljena) umjesto dijagonalnih linija — uredna geometrija.
- **Fokus i zoom**: stablo treba da dominira ekranom (V Rising utisak), pan/zoom dobrodošao ako ostane pregledan.
- Hover = tooltip kartica pored kursora ILI istaknuti side panel sa jasnim BUY stanjem; kupljeno/dostupno/zaključano mora se razlikovati na prvi pogled iz daljine.
- Artifact tab: tier kartice zadržati kao koncept (Quironax), ali podići: veće, sa ikonom jezgre, animiran prsten, jasniji "sljedeći cilj"; trait stablo isti tretman kao matrix.
- Layout podaci: nodeovi su u `src/data/arenaProgression.ts` (`ARENA_SKILL_NODES` — 27 čvorova, 5 grana, `requires` veze; `ARTIFACT_WEAPONS` — 3×6 traitova). **Ne mijenjaj podatke — samo prezentaciju.** `layoutTree()` možeš zamijeniti svojim layoutom ako je uredniji.

### 3.2 `/hub` — konzistentnost

Fajl: `src/app/hub/page.tsx`. Radi, ali vizuelno nije u istom sistemu kao `/skills` i arena HUD. Zadatak iz starijeg handoffa i dalje važi: **ujednačiti hijerarhiju, tipografiju i navigaciju** između `/hub`, `/skills`, `/arena`. Class ekran mora u jednoj čitljivoj kartici pokazati: fantasy, resource, signature, passive, combat loop, weakness, prototype Artifact.

### 3.3 Arena HUD i overlayi

Fajl: `src/components/arena/ArenaGame.tsx` (HUD, briefing, death recap, QA deck, minimap "SECTOR SCAN", ability slotovi, boss banneri).

- HUD v2 postoji (kružni Integrity/Sprint instrumenti, XP link, 4 ability slota) — poliranje dobrodošlo, redizajn samo uz Arminovo "da".
- **Briefing prije runa je predugačak** — treba ga učiniti skenabilnim (kartice/kolone umjesto zida teksta) bez gubitka boss counterplay/reward informacija.
- Death recap: nedavno proširen (uzrok smrti, statistika, quick skill kupovina za Skill Pointe, Enter = RE-DEPLOY) — smiješ polirati.
- Minimap: canvas komponenta `MinimapHud` — fog-of-war reveal; u test modu je prekriva QA deck (dev-only, ok).

### 3.4 Dijalozi — NE DIRATI LOGIKU

`HadesStyleTransmission` u `ArenaGame.tsx` + speaker meta u `src/data/arenaStory.ts` (HUGO/PILOT/UNKNOWN, portreti u `public/images/pilots/` i `public/images/hugo-operative-v1.png`). Dijalozi **pauziraju igru** preko `isArenaGameplayActive()` — taj mehanizam ne smiješ pokvariti. Vizuelno poliranje (ulazna animacija, typewriter tekst, portret pomak) — slobodno.

## 4. TVRDA PRAVILA

1. **Ne diraj:** `src/store/*` logiku (smiješ dodati čisto prezentacijski state), `src/data/*` vrijednosti balansa, sisteme u `src/components/arena/` osim JSX/stilova, Meshy skripte, assete.
2. **Ne generiši assete** (bez Meshy, bez API poziva). Koristi postojeće slike iz `public/images/` i postojeće fontove (`font-display`, `font-mono` — definisani u `src/app/globals.css` / layoutu).
3. UI tekst **engleski**; kod komentari kratki i samo gdje objašnjavaju ograničenje.
4. Sav novi UI mora raditi sa **postojećim podacima** — ništa hardkodirano što već postoji u `src/data/`.
5. Desktop web only — nema mobile optimizacije.
6. Ne uklanjaj debug hookove (`__arenaSession`, `__r3f`, `?test=1` overlay).
7. Poslije svake cjeline: `npx tsc --noEmit` + `npm run build` + ručna provjera u browseru + commit sa jasnom porukom (bosanski ili engleski, svejedno).

## 5. REDOSLIJED RADA (Arminov prioritet)

1. **`/skills` Skill Matrix** — veliko moćno stablo (V Rising nivo utiska)
2. **`/skills` Artifact Weapon** — tier kartice + trait stablo isti tretman
3. **Arena briefing** — skenabilan
4. **`/hub` ↔ `/skills` ↔ arena konzistentnost** (jedan vizuelni sistem)
5. HUD/overlay polish (boon kartice, death recap, dijalozi — samo polish)

Za svaku tačku: napravi, pokaži Arminu (screenshot ili neka pogleda uživo), čekaj "da/ne" prije prelaska na sljedeću. On odlučuje brzo — ne troši vrijeme na varijante koje nije tražio.

## 6. Definition of done

- Armin kaže "to je to" za Skill Matrix i Artifact (tačke 1-2 su subjektivne — njegovo oko je mjerilo).
- `/hub`, `/skills`, `/arena` dijele tipografiju, boje i navigacioni obrazac.
- `tsc` + `build` prolaze; `/arena?test=1` QA tok radi (deploy → boss jump → death recap → skills → nazad).
- Nijedan gameplay sistem se ne ponaša drugačije nego prije tvojih izmjena.
