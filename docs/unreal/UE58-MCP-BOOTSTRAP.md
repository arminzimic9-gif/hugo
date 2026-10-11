# HUGO — Unreal Engine 5.8 + Codex MCP bootstrap

> Prepared and connected 2026-09-04 for the first Unreal vertical slice.  
> Web source of truth: `/Users/arminzimic/hugo claude`  
> Proposed Unreal project: `/Users/arminzimic/Unreal Projects/HUGONeuralOverload`

## Decision

Use **Unreal Engine 5.8 and Epic's official experimental Unreal MCP plugin**.
Do not install a third-party Unreal MCP bridge unless the native plugin proves
insufficient for a specific tool we need.

The web Arena remains the playable design specification. We are not converting
TypeScript line-for-line. We reuse approved source assets and balance data, then
reimplement runtime gameplay in Unreal C++/Blueprints.

Official references:

- https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor
- https://dev.epicgames.com/documentation/unreal-engine/install-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/importing-assets-using-interchange-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/macos-development-requirements-for-unreal-engine

## Local preflight result

```text
Mac:                 MacBook Pro, Apple M4 Max, 14 cores
Memory:              36 GB
Free disk:           254 GB
macOS:               26.3.1
Xcode:               26.3
uv:                  /opt/homebrew/bin/uv
Unreal Engine:       5.8.2 INSTALLED
Epic Games Launcher: INSTALLED
Unreal project:      /Users/arminzimic/Unreal Projects/HUGONeuralOverload
Unreal MCP server:   CONNECTED on http://127.0.0.1:8123/mcp
```

The machine is strong enough for the planned desktop prototype. Epic's UE 5.8
documentation explicitly warns that Xcode 26.4 is incompatible; this Mac has
26.3. If compilation exposes an SDK mismatch, pin the exact Epic-recommended
Xcode version before changing project code.

## Human installation gate — completed

The Epic account/download gate was completed on 2026-09-04:

1. **Epic Games Launcher** installed.
2. User signed in to their Epic account.
3. **Unreal Engine 5.8.2** installed for macOS.
4. Initial HUGO C++ editor target compiled successfully.

Do not download a Preview build if a stable 5.8 build is available.

## Create the project

Create a separate Unreal project. Never place generated Unreal folders inside
the web repository.

```text
Project name: HUGONeuralOverload
Project path: /Users/arminzimic/Unreal Projects/HUGONeuralOverload
Template:     Games → Blank
Language:     C++
Target:       Desktop
Quality:      Maximum initially, tune after the slice works
Starter:      No Starter Content
Source ctrl:  Git after the clean project opens successfully
```

The proposed Unreal project root must contain:

```text
HUGONeuralOverload.uproject
Config/
Content/
Source/
```

Generated folders such as `Binaries/`, `DerivedDataCache/`, `Intermediate/`,
`Saved/` and local IDE state must not be treated as source assets.

## Enable the official MCP

Inside Unreal Editor 5.8:

1. Open `Edit → Plugins`.
2. Enable **Unreal MCP**.
3. Enable **All Toolsets**. Its Toolset Registry dependency is enabled by UE.
4. Also confirm **Python Editor Script Plugin**, **Editor Scripting Utilities**,
   **Interchange**, **Enhanced Input** and **Niagara** are enabled where relevant.
5. Restart the editor.
6. Open `Edit → Editor Preferences → Model Context Protocol`.
7. Enable `Auto Start Server`.
8. Use local port `8123` and path `/mcp` to avoid common local port conflicts.

Alternatively, start it from the Unreal console:

```text
ModelContextProtocol.StartServer 8123
```

Then generate Codex configuration from the Unreal console:

```text
ModelContextProtocol.GenerateClientConfig Codex
```

Expected generated file:

```text
/Users/arminzimic/Unreal Projects/HUGONeuralOverload/.codex/config.toml
```

Expected server endpoint:

```text
http://127.0.0.1:8123/mcp
```

The Unreal command writes Codex TOML only once. If a stale config already exists,
inspect and back it up before replacing it. Never blindly delete a config that
contains other MCP servers.

After generation, open a **new Codex task whose project root is the Unreal project**.
MCP discovery is tied to the workspace root. The current web-project task should
remain available as the source/specification task.

## Verify the connection before any import

In order:

1. Confirm Unreal Editor is open on `HUGONeuralOverload`.
2. Confirm port `8123` is listening locally.
3. Confirm the new Codex task exposes the Unreal MCP discovery tools.
4. Ask Unreal MCP to list toolsets.
5. Ask it to inspect the current level and return its name.
6. Create one temporary cube in a sandbox/test level.
7. Save, run PIE, stop PIE and delete the temporary cube.

The official Unreal MCP dispatches work serially on Unreal's game thread.
**Never issue overlapping Unreal MCP calls.** Parallel file analysis is fine;
parallel live-editor mutation is not.

## Unreal content layout

```text
/Game/HUGO/
├── Core/
│   ├── GameModes/
│   ├── Input/
│   ├── Interfaces/
│   └── Data/
├── Characters/
│   └── Pilots/
├── Weapons/
│   └── Artifacts/
├── Enemies/
├── Bosses/
├── Pickups/
├── Environment/
│   ├── Surface/
│   └── Underground/
├── VFX/
├── Audio/
├── UI/
├── Maps/
├── Tests/
└── Dev/
```

Naming:

```text
BP_   Blueprint Actor
WBP_  UMG Widget Blueprint
DA_   Primary Data Asset
DT_   DataTable
ST_   Struct
E_    Enum
SM_   Static Mesh
SK_   Skeletal Mesh
ABP_  Animation Blueprint
A_    Animation Sequence
M_    Material
MI_   Material Instance
T_    Texture
NS_   Niagara System
SFX_  Sound effect
MUS_  Music
L_    Level
```

## First vertical slice — not the whole game

Build `L_ArenaVerticalSlice` first. It is successful only when this full loop
works in PIE:

1. Top-down camera and Enhanced Input movement.
2. One male pilot Skeletal Mesh with idle/run/combat animation state.
3. One Vanguard Artifact weapon attached to a hand socket.
4. One Drone enemy that spawns, chases/positions and damages the player.
5. Auto-fire projectile damages and kills the Drone.
6. Drone drops a Data Core; pickup grants XP.
7. One upgrade choice modifies a live stat.
8. Axiom Warden spawns as the test boss and uses one telegraphed Siege Fan.
9. Minimal UMG shows Integrity, XP, elapsed time and boss health.
10. PIE can start/stop repeatedly without errors, missing materials or duplicate rewards.

Only after this works should the agent import the other classes, full wave table,
Gemini Choir, Hollow Crown, portal, Underground, crafting and permanent progression.

## Architecture for the slice

Prefer a small C++ gameplay core with Blueprint children for visual tuning:

```text
AHUGOArenaGameMode
AHUGOArenaDirector
AHUGOPilotCharacter
UHUGOHealthComponent
UHUGOCombatComponent
UHUGOProgressionComponent
AHUGOEnemyBase
AHUGOProjectileBase
AHUGOPickupBase
UHUGOGameInstanceSubsystem
```

Use data-driven structs/tables for values already proven in the web build:

```text
FEnemyRow       ← src/data/arena-enemies.json
FSpawnPhaseRow  ← src/data/arena-spawn-tables.json
FOperatorRow    ← src/data/arena-operators.json
FAbilityRow     ← src/data/arena-abilities.json
FUpgradeRow     ← src/data/arena-upgrades.json
FBossRow        ← src/data/arenaBosses.ts
```

Do not try to execute TypeScript in Unreal. Translate behavior and keep data
semantics stable so web and Unreal can be compared during the port.

## Coordinate and import rules

- Web units are meters; Unreal uses centimeters. Initial mapping: `1 m = 100 cm`.
- Player source convention: +Z forward, bottom origin, meter scale, A-pose.
- Import static Meshy masters through Interchange/glTF where possible.
- Import the rigged pilot and animations from FBX for the first skeletal test.
- Verify axis, root, scale, materials, collision and animation skeleton before batch import.
- Generate simple collision intentionally; do not use expensive per-poly collision by default.
- Preserve imported source files outside `.uasset` output so reimport remains possible.
- Do not overwrite anything under `assets/originals/`.
- Do not modify or delete the web runtime while porting.

The machine-readable first-wave list is:

```text
/Users/arminzimic/hugo claude/config/unreal-transfer-manifest.json
```

## Source systems that define behavior

```text
/Users/arminzimic/hugo claude/src/data/arena-config.json
/Users/arminzimic/hugo claude/src/data/arena-enemies.json
/Users/arminzimic/hugo claude/src/data/arena-spawn-tables.json
/Users/arminzimic/hugo claude/src/data/arena-operators.json
/Users/arminzimic/hugo claude/src/data/arena-abilities.json
/Users/arminzimic/hugo claude/src/data/arena-projectiles.json
/Users/arminzimic/hugo claude/src/data/arena-upgrades.json
/Users/arminzimic/hugo claude/src/data/arenaBosses.ts
/Users/arminzimic/hugo claude/src/data/arenaProgression.ts
/Users/arminzimic/hugo claude/src/data/arenaPowerDrops.ts
/Users/arminzimic/hugo claude/src/data/arenaStory.ts
/Users/arminzimic/hugo claude/src/data/crafting.ts
/Users/arminzimic/hugo claude/src/store/arenaSession.ts
/Users/arminzimic/hugo claude/src/store/gameStore.ts
```

## Source preservation

Master asset roots:

```text
/Users/arminzimic/hugo claude/assets/originals/imported/
/Users/arminzimic/hugo claude/assets/originals/meshy/
```

Browser GLBs under `public/models/` are optimized fallback copies. Unreal should
prefer approved masters unless the master import has a concrete problem.

No new Meshy generation is needed for this vertical slice.

## Definition of connected

Do not say "Codex is connected to Unreal" until all are true:

- UE 5.8 editor is installed and running the HUGO project.
- Unreal MCP and All Toolsets are enabled.
- Local MCP endpoint is listening.
- Codex task rooted at the Unreal project can list Unreal toolsets.
- Codex can inspect the open level.
- A reversible test actor can be created, saved and removed.

Connection verification completed on 2026-09-04:

```text
Editor target build: PASS
MCP initialize:      PASS (protocol 2025-06-18)
Tool discovery:      PASS (52 toolsets, 3 MCP meta-tools)
Current level read:  PASS (/Temp/Untitled_1)
Create test cube:    PASS
Remove test cube:    PASS
```
