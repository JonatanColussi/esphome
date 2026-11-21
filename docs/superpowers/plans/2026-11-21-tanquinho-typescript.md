# Tanquinho TypeScript UI + English Codebase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Tanquinho phone UI in TypeScript, translate the whole codebase (TS, firmware YAML, dev server, tests) to English while keeping on-screen copy in Portuguese, and build UI + firmware together through npm.

**Architecture:** Pure domain rules (`src/domain`) feed a pure view-model builder (`src/ui/view-model.ts`); a small `StateStore` holds entity states from the ESP's `/events` stream; DOM views are created once and receive the view model on every render. esbuild bundles `src/main.ts` into one ES2017 IIFE (`dist/ui.js`) that ESPHome serves via `web_server.js_include`. All Portuguese text lives in `src/copy.ts`.

**Tech Stack:** TypeScript 5, esbuild, Jest + ts-jest + jest-environment-jsdom, ESLint 8 (`@colussi/eslint-config`), Prettier (`@colussi/prettier-config`), `@colussi/tsconfig`, tsx, concurrently, ESPHome 2026.4.1 (pip).

**Spec:** `docs/superpowers/specs/2026-11-21-tanquinho-typescript-design.md`

## Global Constraints

- Working directory for every command: `projects/tanquinho` (repo root is `/Users/jonatancolussi/esphome`).
- Node 22 (`.nvmrc` = `22`). The machine's default `node` is v10: prefix shell commands with `export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH;`.
- All identifiers, file names, comments, CSS classes, firmware ids, entity names and test names in English. Portuguese only for text the person reads on screen, and only inside `src/copy.ts`.
- On-screen behaviour and Portuguese copy must stay identical to the current `tanquinho-ui.js` (screens, texts, confirmations, offline banner, manual-mode alert, vibration on completion, Advanced loading `https://oi.esphome.io/v2/www.js`).
- Bundle: `dist/ui.js`, IIFE, `target: es2017`, minified, ≤ 40 KB. `dist/` and `node_modules/` are git-ignored.
- Lint runs with `--max-warnings 0`; Prettier config is `@colussi/prettier-config` (single quotes, width 100, trailing commas, `arrowParens: avoid`). Run `npm run lint -- --fix` and `npm run format` before each commit.
- Firmware logic, default times, limits (fill max 10 min, `water_valve_limit` 10 min), interlocks, `reboot_timeout: 0s`, `power_save_mode: none`, `web_server.ota: false` are unchanged.
- Never print or commit secret values; `secrets.yaml` stays git-ignored. Never stage the repo-root `tanquinho.yml`.
- Never flash the ESP without the user's explicit OK in chat (Task 9 is run by the controller, not a subagent).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File Structure

```
projects/tanquinho/
├─ package.json / package-lock.json / .nvmrc
├─ tsconfig.json            extends @colussi/tsconfig
├─ .eslintrc.js             extends @colussi/eslint-config
├─ .prettierignore
├─ jest.config.js
├─ .gitignore               + /node_modules/, /dist/
├─ scripts/build-ui.mjs     esbuild → dist/ui.js (--watch for dev)
├─ src/
│  ├─ main.ts               browser entry: wires store, client, app, scheduler
│  ├─ copy.ts               Portuguese copy + translation of ESP codes
│  ├─ domain/entities.ts    entity keys, levels, stages, relays, typed readers
│  ├─ domain/time.ts        durations, H:MM:SS, clock times, progress, minutes input
│  ├─ domain/wash.ts        estimate, timeline, outcome, stage/progress parsing
│  ├─ device/protocol.ts    command URLs + /events payload parsing
│  ├─ device/store.ts       StateStore
│  ├─ device/client.ts      DeviceClient (EventSource + POST commands)
│  └─ ui/
│     ├─ actions.ts         Actions, View, CommandSender interfaces
│     ├─ dom.ts             h(), button(), setVisible(), setPressed()
│     ├─ styles.ts          CSS (English class names)
│     ├─ preferences.ts     wash type in localStorage
│     ├─ scheduler.ts       requestAnimationFrame batching
│     ├─ session.ts         WashSession (outcome + round total)
│     ├─ view-model.ts      buildViewModel()
│     ├─ app.ts             createApp(): composes views, actions, render()
│     ├─ components/{choice,confirm-sheet,toast,card}.ts
│     └─ screens/{header,manual-alert,outcome-card,ready-screen,washing-screen,settings-screen,footer,action-bar}.ts
├─ test/                    Jest tests mirroring src/
├─ dev/mock-server.ts       fake ESP (/, /0.js, /events, REST)
└─ tanquinho.yaml           firmware in English, js_include: dist/ui.js
```

Removed: `tanquinho-ui.js`, `test/ui-logic.test.js`, `dev/mock_server.py`.

---

### Task 1: Tooling and time helpers

**Files:**
- Create: `package.json`, `.nvmrc`, `tsconfig.json`, `.eslintrc.js`, `.prettierignore`, `jest.config.js`, `scripts/build-ui.mjs`, `src/domain/time.ts`, `test/domain/time.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces (`src/domain/time.ts`):
  - `formatDuration(seconds: number): string`
  - `parseHms(text: string): number`
  - `progressPercent(remainingSeconds: number, totalSeconds: number): number`
  - `clockTimeAfter(nowMs: number, seconds: number): string`
  - `normalizeMinutes(raw: string, max: number): number | null`
  - `MIN_MINUTES = 0.5`
- Produces npm scripts: `build:ui`, `typecheck`, `lint`, `format`, `format:check`, `test`, `check` (later tasks add `build`, `flash`, `dev`).

- [ ] **Step 1: Create `.nvmrc`, `package.json` and install dev dependencies**

`.nvmrc`:
```
22
```

`package.json`:
```json
{
  "name": "tanquinho",
  "version": "1.0.0",
  "private": true,
  "description": "Phone UI and firmware build for the Tanquinho washing machine (ESPHome)",
  "license": "MIT",
  "engines": {
    "node": ">=22"
  },
  "prettier": "@colussi/prettier-config",
  "scripts": {
    "build:ui": "node scripts/build-ui.mjs",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.js,.mjs --max-warnings 0",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "jest",
    "check": "npm run typecheck && npm run lint && npm run format:check && npm test"
  }
}
```

Run:
```bash
export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH
npm install --save-dev @colussi/eslint-config @colussi/prettier-config @colussi/tsconfig typescript eslint@^8.57.1 prettier jest ts-jest jest-environment-jsdom @types/jest @types/node esbuild tsx concurrently eslint-import-resolver-typescript
```
Expected: `package-lock.json` created, no `ERR!`. Peer-dependency warnings are fine.

- [ ] **Step 2: Create config files**

`tsconfig.json`:
```json
{
  "extends": "@colussi/tsconfig/tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "lib": ["ES2019", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "sourceMap": false,
    "types": ["jest", "node"]
  },
  "include": ["src", "test", "dev"]
}
```

`.eslintrc.js`:
```js
module.exports = {
  root: true,
  extends: ['@colussi/eslint-config'],
};
```

`.prettierignore`:
```
dist/
node_modules/
.esphome/
package-lock.json
*.yaml
*.md
```

`jest.config.js`:
```js
module.exports = {
  preset: 'ts-jest',
  roots: ['<rootDir>/test'],
  testEnvironment: 'node',
};
```

`scripts/build-ui.mjs`:
```js
import { build, context } from 'esbuild';

const options = {
  bundle: true,
  charset: 'utf8',
  entryPoints: ['src/main.ts'],
  format: 'iife',
  legalComments: 'none',
  logLevel: 'info',
  minify: true,
  outfile: 'dist/ui.js',
  target: 'es2017',
};

if (process.argv.includes('--watch')) {
  const buildContext = await context(options);

  await buildContext.watch();
} else {
  await build(options);
}
```

Append to `.gitignore` (keep existing lines):
```
/node_modules/
/dist/
```

- [ ] **Step 3: Write the failing tests for time helpers**

`test/domain/time.test.ts`:
```ts
import {
  clockTimeAfter,
  formatDuration,
  normalizeMinutes,
  parseHms,
  progressPercent,
} from '../../src/domain/time';

describe('formatDuration', () => {
  it('shows minutes below one hour and h + minutes above', () => {
    expect(formatDuration(28 * 60)).toBe('28 min');
    expect(formatDuration(72 * 60)).toBe('1h12');
    expect(formatDuration(60 * 60)).toBe('1h00');
    expect(formatDuration(3599)).toBe('1h00');
    expect(formatDuration(20)).toBe('1 min');
  });
});

describe('parseHms', () => {
  it('converts H:MM:SS to seconds and anything else to 0', () => {
    expect(parseHms('1:02:03')).toBe(3723);
    expect(parseHms('00:00:00')).toBe(0);
    expect(parseHms('')).toBe(0);
    expect(parseHms('abc')).toBe(0);
  });
});

describe('progressPercent', () => {
  it('returns elapsed share clamped to 0..100', () => {
    expect(progressPercent(600, 1200)).toBe(50);
    expect(progressPercent(0, 1200)).toBe(100);
    expect(progressPercent(1500, 1200)).toBe(0);
    expect(progressPercent(10, 0)).toBe(0);
  });
});

describe('clockTimeAfter', () => {
  const threePm = new Date(2026, 10, 3, 15, 0, 0).getTime();

  it('adds the duration and formats HH:MM in local time', () => {
    expect(clockTimeAfter(threePm, 40 * 60)).toBe('15:40');
    expect(clockTimeAfter(threePm, 65 * 60)).toBe('16:05');
    expect(clockTimeAfter(new Date(2026, 10, 3, 23, 50, 0).getTime(), 20 * 60)).toBe('00:10');
  });

  it('rounds to the nearest minute', () => {
    expect(clockTimeAfter(threePm, 29)).toBe('15:00');
    expect(clockTimeAfter(threePm, 30)).toBe('15:01');
  });
});

describe('normalizeMinutes', () => {
  it('accepts comma decimals, rounds to 0.5 and clamps to 0.5..max', () => {
    expect(normalizeMinutes('2,5', 10)).toBe(2.5);
    expect(normalizeMinutes('3.3', 30)).toBe(3.5);
    expect(normalizeMinutes('12', 10)).toBe(10);
    expect(normalizeMinutes('0.2', 30)).toBe(0.5);
  });

  it('rejects text that is not a number', () => {
    expect(normalizeMinutes('abc', 10)).toBeNull();
  });
});
```

- [ ] **Step 4: Run the tests to see them fail**

Run: `export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH; npx jest test/domain/time.test.ts`
Expected: FAIL, `Cannot find module '../../src/domain/time'`.

- [ ] **Step 5: Implement `src/domain/time.ts`**

```ts
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60_000;

export const MIN_MINUTES = 0.5;

const pad = (value: number) => String(value).padStart(2, '0');

/** "28 min" below one hour, "1h12" from one hour on; never less than 1 min. */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / SECONDS_PER_MINUTE));
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;

  return hours === 0 ? `${minutes} min` : `${hours}h${pad(minutes)}`;
}

/** Seconds in an "H:MM:SS" text published by the firmware; 0 when it is not one. */
export function parseHms(text: string): number {
  const parts = text.split(':');

  if (parts.length !== 3) {
    return 0;
  }

  const [hours, minutes, seconds] = parts.map(part => Number.parseInt(part, 10));
  const total = hours * 3600 + minutes * SECONDS_PER_MINUTE + seconds;

  return Number.isNaN(total) ? 0 : total;
}

export function progressPercent(remainingSeconds: number, totalSeconds: number): number {
  if (totalSeconds === 0) {
    return 0;
  }

  const percent = Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100);

  return Math.max(0, Math.min(100, percent));
}

/** Local "HH:MM" after `seconds`, rounded to the nearest minute. */
export function clockTimeAfter(nowMs: number, seconds: number): string {
  const date = new Date(nowMs + Math.round(seconds / SECONDS_PER_MINUTE) * MS_PER_MINUTE);

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Minutes typed in a settings field: comma or dot, steps of 0.5, between 0.5 and `max`. */
export function normalizeMinutes(raw: string, max: number): number | null {
  const value = Number.parseFloat(raw.replace(',', '.'));

  if (Number.isNaN(value)) {
    return null;
  }

  return Math.min(max, Math.max(MIN_MINUTES, Math.round(value * 2) / 2));
}
```

- [ ] **Step 6: Run the tests and the toolchain**

Run: `export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH; npx jest && npm run typecheck && npm run lint -- --fix && npm run format && npm run lint`
Expected: Jest PASS (all `time` tests); typecheck and lint exit 0. If ESLint cannot load `@colussi/eslint-config` (missing plugin or resolver), install the package it names as a devDependency and re-run; if that does not fix it, stop and report BLOCKED with the error.

- [ ] **Step 7: Commit**

```bash
git add .nvmrc package.json package-lock.json tsconfig.json .eslintrc.js .prettierignore jest.config.js scripts/build-ui.mjs .gitignore src/domain/time.ts test/domain/time.test.ts
git commit -m "build(tanquinho): TypeScript toolchain with @colussi configs and time helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Entities and wash rules

**Files:**
- Create: `src/domain/entities.ts`, `src/domain/wash.ts`, `test/fixtures.ts`, `test/domain/wash.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (`src/domain/entities.ts`):
  - `WATER_LEVELS = ['Low','Medium','High'] as const`, `type WaterLevel`
  - `STAGES = ['Filling','Mixing','Soaking','Washing','Draining'] as const`, `type Stage`
  - `RELAYS = ['switch/Water Valve','switch/Motor','switch/Drain Pump','switch/Auxiliary'] as const`, `type RelayKey`
  - `Entity` (object of keys, see code), `MINUTE_SETTINGS: readonly string[]`
  - `type EntityValue = boolean | number | string`, `type EntityStates = Readonly<Record<string, EntityValue | undefined>>`
  - `readNumber(states, key, fallback): number`, `readText(states, key): string`, `isOn(states, key): boolean`, `readWaterLevel(states): WaterLevel`
- Produces (`src/domain/wash.ts`):
  - `type WashType = 'normal' | 'quick'`, `type WashOutcome = 'completed' | 'interrupted'`, `interface CycleProgress { current: number; total: number }`
  - `estimateSeconds(states, washType): number`, `timelineStages(washType): Stage[]`, `parseStage(text): Stage | null`, `parseCycleProgress(text): CycleProgress | null`, `activeRelays(states): RelayKey[]`, `washOutcome(wasRunning, isRunning, stoppedByUser): WashOutcome | null`
- Produces (`test/fixtures.ts`): `buildStates(overrides?: Record<string, EntityValue>): Record<string, EntityValue>` with the firmware defaults.

- [ ] **Step 1: Create `test/fixtures.ts`**

```ts
import type { EntityValue } from '../src/domain/entities';
import { Entity } from '../src/domain/entities';

/** Entity states with the firmware's default settings (Medium level, 1 cycle). */
export function buildStates(overrides: Record<string, EntityValue> = {}): Record<string, EntityValue> {
  return {
    [Entity.waterLevel]: 'Medium',
    [Entity.cycles]: 1,
    [Entity.fillMinutes.Low]: 2.5,
    [Entity.fillMinutes.Medium]: 3.5,
    [Entity.fillMinutes.High]: 5,
    [Entity.drainMinutes.Low]: 3,
    [Entity.drainMinutes.Medium]: 4,
    [Entity.drainMinutes.High]: 5.5,
    [Entity.mixMinutes]: 0.5,
    [Entity.soakMinutes]: 5,
    [Entity.washMinutes]: 15,
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the failing tests**

`test/domain/wash.test.ts`:
```ts
import { Entity, readWaterLevel } from '../../src/domain/entities';
import {
  activeRelays,
  estimateSeconds,
  parseCycleProgress,
  parseStage,
  timelineStages,
  washOutcome,
} from '../../src/domain/wash';
import { buildStates } from '../fixtures';

describe('estimateSeconds', () => {
  it('normal wash, medium level, 1 cycle takes 28 min', () => {
    // 3.5 fill + 0.5 mix + 5 soak + 15 wash + 4 drain
    expect(estimateSeconds(buildStates(), 'normal')).toBe(28 * 60);
  });

  it('quick wash halves mix and wash, skips soak and repeats per cycle', () => {
    const states = buildStates({ [Entity.waterLevel]: 'High', [Entity.cycles]: 2 });

    // per cycle: 5 + 0.25 + 7.5 + 5.5 = 18.25 min, × 2
    expect(estimateSeconds(states, 'quick')).toBe(36.5 * 60);
  });

  it('falls back to Medium when the level is unknown', () => {
    const states = buildStates({ [Entity.waterLevel]: 'Baixo' });

    expect(readWaterLevel(states)).toBe('Medium');
    expect(estimateSeconds(states, 'normal')).toBe(28 * 60);
  });
});

describe('timelineStages', () => {
  it('has no soak in the quick wash', () => {
    expect(timelineStages('normal')).toEqual(['Filling', 'Mixing', 'Soaking', 'Washing', 'Draining']);
    expect(timelineStages('quick')).toEqual(['Filling', 'Mixing', 'Washing', 'Draining']);
  });
});

describe('parseStage', () => {
  it('accepts only the firmware stage codes', () => {
    expect(parseStage('Filling')).toBe('Filling');
    expect(parseStage('Off')).toBeNull();
    expect(parseStage('')).toBeNull();
  });
});

describe('parseCycleProgress', () => {
  it('reads "current/total" and rejects anything else', () => {
    expect(parseCycleProgress('1/2')).toEqual({ current: 1, total: 2 });
    expect(parseCycleProgress('')).toBeNull();
    expect(parseCycleProgress('Ciclo 1 de 2')).toBeNull();
  });
});

describe('activeRelays', () => {
  it('lists relays that are on, in panel order', () => {
    expect(activeRelays({})).toEqual([]);
    expect(
      activeRelays({
        'switch/Auxiliary': true,
        'switch/Motor': false,
        'switch/Water Valve': true,
      }),
    ).toEqual(['switch/Water Valve', 'switch/Auxiliary']);
  });
});

describe('washOutcome', () => {
  it('is completed or interrupted only when a running wash stops', () => {
    expect(washOutcome(true, false, false)).toBe('completed');
    expect(washOutcome(true, false, true)).toBe('interrupted');
    expect(washOutcome(true, true, false)).toBeNull();
    expect(washOutcome(false, false, false)).toBeNull();
    expect(washOutcome(false, true, false)).toBeNull();
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH; npx jest test/domain/wash.test.ts`
Expected: FAIL, `Cannot find module '../../src/domain/entities'`.

- [ ] **Step 4: Implement `src/domain/entities.ts`**

```ts
export const WATER_LEVELS = ['Low', 'Medium', 'High'] as const;
export type WaterLevel = (typeof WATER_LEVELS)[number];

export const STAGES = ['Filling', 'Mixing', 'Soaking', 'Washing', 'Draining'] as const;
export type Stage = (typeof STAGES)[number];

/** Panel order of the manual-mode relays. */
export const RELAYS = [
  'switch/Water Valve',
  'switch/Motor',
  'switch/Drain Pump',
  'switch/Auxiliary',
] as const;
export type RelayKey = (typeof RELAYS)[number];

/** Entity keys are `domain/name`, identical in the /events stream and in REST URLs. */
export const Entity = {
  cycleProgress: 'text_sensor/Cycle Progress',
  cycles: 'number/Cycles',
  drainMinutes: {
    High: 'number/Drain High (min)',
    Low: 'number/Drain Low (min)',
    Medium: 'number/Drain Medium (min)',
  },
  fillMinutes: {
    High: 'number/Fill High (min)',
    Low: 'number/Fill Low (min)',
    Medium: 'number/Fill Medium (min)',
  },
  mixMinutes: 'number/Mix Time (min)',
  running: 'binary_sensor/Running',
  soakMinutes: 'number/Soak Time (min)',
  stage: 'text_sensor/Stage',
  startFullCycle: 'button/Start Full Cycle',
  startQuickCycle: 'button/Start Quick Cycle',
  stopAll: 'button/Stop All',
  timeRemaining: 'text_sensor/Time Remaining',
  washMinutes: 'number/Wash Time (min)',
  waterLevel: 'select/Water Level',
} as const;

/** Every number entity edited in the settings screen. */
export const MINUTE_SETTINGS: readonly string[] = [
  ...WATER_LEVELS.map(level => Entity.fillMinutes[level]),
  ...WATER_LEVELS.map(level => Entity.drainMinutes[level]),
  Entity.mixMinutes,
  Entity.soakMinutes,
  Entity.washMinutes,
];

export type EntityValue = boolean | number | string;
export type EntityStates = Readonly<Record<string, EntityValue | undefined>>;

export function readNumber(states: EntityStates, key: string, fallback: number): number {
  const value = states[key];

  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
}

export function readText(states: EntityStates, key: string): string {
  const value = states[key];

  return typeof value === 'string' ? value : '';
}

export function isOn(states: EntityStates, key: string): boolean {
  return states[key] === true;
}

export function readWaterLevel(states: EntityStates): WaterLevel {
  const value = states[Entity.waterLevel];

  return WATER_LEVELS.find(level => level === value) ?? 'Medium';
}
```

- [ ] **Step 5: Implement `src/domain/wash.ts`**

```ts
import type { EntityStates, RelayKey, Stage } from './entities';
import { Entity, isOn, readNumber, readWaterLevel, RELAYS, STAGES } from './entities';

export type WashType = 'normal' | 'quick';
export type WashOutcome = 'completed' | 'interrupted';

export interface CycleProgress {
  current: number;
  total: number;
}

const QUICK_FACTOR = 0.5;
const CYCLE_PROGRESS_PATTERN = /^(\d+)\/(\d+)$/;

/** Same arithmetic as the firmware's prepare_cycle script. */
export function estimateSeconds(states: EntityStates, washType: WashType): number {
  const level = readWaterLevel(states);
  const isQuick = washType === 'quick';
  const factor = isQuick ? QUICK_FACTOR : 1;
  const minutes =
    readNumber(states, Entity.fillMinutes[level], 0) +
    readNumber(states, Entity.drainMinutes[level], 0) +
    (readNumber(states, Entity.mixMinutes, 0) + readNumber(states, Entity.washMinutes, 0)) * factor +
    (isQuick ? 0 : readNumber(states, Entity.soakMinutes, 0));
  const cycles = Math.max(1, Math.round(readNumber(states, Entity.cycles, 1)));

  return Math.round(minutes * 60) * cycles;
}

export function timelineStages(washType: WashType): Stage[] {
  return washType === 'quick' ? STAGES.filter(stage => stage !== 'Soaking') : [...STAGES];
}

export function parseStage(text: string): Stage | null {
  return STAGES.find(stage => stage === text) ?? null;
}

/** Firmware publishes "current/total" while a wash runs and "" otherwise. */
export function parseCycleProgress(text: string): CycleProgress | null {
  const match = CYCLE_PROGRESS_PATTERN.exec(text);

  if (!match) {
    return null;
  }

  return { current: Number(match[1]), total: Number(match[2]) };
}

export function activeRelays(states: EntityStates): RelayKey[] {
  return RELAYS.filter(relay => isOn(states, relay));
}

/** A wash that ends without the person pressing stop has completed. */
export function washOutcome(
  wasRunning: boolean,
  isRunning: boolean,
  stoppedByUser: boolean,
): WashOutcome | null {
  if (!wasRunning || isRunning) {
    return null;
  }

  return stoppedByUser ? 'interrupted' : 'completed';
}
```

- [ ] **Step 6: Run tests, typecheck, lint, format**

Run: `export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH; npx jest && npm run typecheck && npm run lint -- --fix && npm run format && npm run lint`
Expected: all PASS, exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/domain/entities.ts src/domain/wash.ts test/fixtures.ts test/domain/wash.test.ts
git commit -m "feat(tanquinho): typed entities and wash rules in TypeScript

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Device protocol, state store and client

**Files:**
- Create: `src/device/protocol.ts`, `src/device/store.ts`, `src/device/client.ts`, `test/device/protocol.test.ts`, `test/device/store.test.ts`, `test/device/client.test.ts`

**Interfaces:**
- Consumes: `EntityStates`, `EntityValue` from `src/domain/entities.ts`.
- Produces:
  - `protocol.ts`: `type CommandAction = 'press' | 'set' | 'toggle' | 'turn_off' | 'turn_on'`, `type CommandParams = Readonly<Record<string, number | string>>`, `interface StateUpdate { key: string; value: EntityValue }`, `commandUrl(key, action, params?): string`, `parseStateEvent(data: string): StateUpdate | null`
  - `store.ts`: `class StateStore` with `states: EntityStates` (getter), `isConnected: boolean` (getter), `apply(update: StateUpdate): void`, `setConnected(connected: boolean): void`, `subscribe(listener: () => void): () => void`
  - `client.ts`: `interface ClientEnvironment { createEventSource(url: string): EventSource; fetch(url: string, init: RequestInit): Promise<Response> }`, `class DeviceClient(store, onCommandFailed: () => void, environment?: ClientEnvironment)` with `connect(url = '/events'): void` and `send(key, action, params?): void`

- [ ] **Step 1: Write the failing tests**

`test/device/protocol.test.ts`:
```ts
import { commandUrl, parseStateEvent } from '../../src/device/protocol';

describe('commandUrl', () => {
  it('encodes the entity name and query parameters', () => {
    expect(commandUrl('button/Stop All', 'press')).toBe('/button/Stop%20All/press');
    expect(commandUrl('select/Water Level', 'set', { option: 'Medium' })).toBe(
      '/select/Water%20Level/set?option=Medium',
    );
    expect(commandUrl('number/Fill High (min)', 'set', { value: 5.5 })).toBe(
      '/number/Fill%20High%20(min)/set?value=5.5',
    );
  });
});

describe('parseStateEvent', () => {
  it('turns number values into floats', () => {
    expect(
      parseStateEvent('{"name_id":"number/Cycles","domain":"number","value":"3","state":"3"}'),
    ).toEqual({ key: 'number/Cycles', value: 3 });
  });

  it('turns switch and binary_sensor values into booleans', () => {
    expect(
      parseStateEvent('{"name_id":"switch/Motor","domain":"switch","value":true,"state":"ON"}'),
    ).toEqual({ key: 'switch/Motor', value: true });
    expect(
      parseStateEvent(
        '{"name_id":"binary_sensor/Running","domain":"binary_sensor","value":false,"state":"OFF"}',
      ),
    ).toEqual({ key: 'binary_sensor/Running', value: false });
  });

  it('uses state for selects and text sensors', () => {
    expect(
      parseStateEvent('{"name_id":"select/Water Level","domain":"select","value":"High","state":"High"}'),
    ).toEqual({ key: 'select/Water Level', value: 'High' });
    expect(
      parseStateEvent('{"name_id":"text_sensor/Cycle Progress","domain":"text_sensor","value":"","state":""}'),
    ).toEqual({ key: 'text_sensor/Cycle Progress', value: '' });
  });

  it('ignores pings and invalid JSON', () => {
    expect(parseStateEvent('{"title":"Tanquinho"}')).toBeNull();
    expect(parseStateEvent('not json')).toBeNull();
  });
});
```

`test/device/store.test.ts`:
```ts
import { StateStore } from '../../src/device/store';

describe('StateStore', () => {
  it('stores updates, marks itself connected and notifies listeners', () => {
    const store = new StateStore();
    const listener = jest.fn();

    store.subscribe(listener);
    store.apply({ key: 'switch/Motor', value: true });

    expect(store.states['switch/Motor']).toBe(true);
    expect(store.isConnected).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies only when the connection state changes', () => {
    const store = new StateStore();
    const listener = jest.fn();

    store.subscribe(listener);
    store.setConnected(false);
    store.setConnected(true);
    store.setConnected(true);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const store = new StateStore();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.apply({ key: 'switch/Motor', value: true });

    expect(listener).not.toHaveBeenCalled();
  });
});
```

`test/device/client.test.ts`:
```ts
import type { ClientEnvironment } from '../../src/device/client';
import { DeviceClient } from '../../src/device/client';
import { StateStore } from '../../src/device/store';

class FakeEventSource extends EventTarget {
  public emit(type: string, data?: string): void {
    const event = new Event(type) as Event & { data?: string };

    event.data = data;
    this.dispatchEvent(event);
  }
}

const flushPromises = () =>
  new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });

function setup(response: Promise<Response>) {
  const source = new FakeEventSource();
  const fetch = jest.fn(() => response);
  const environment: ClientEnvironment = {
    createEventSource: () => source as unknown as EventSource,
    fetch,
  };
  const store = new StateStore();
  const onCommandFailed = jest.fn();
  const client = new DeviceClient(store, onCommandFailed, environment);

  return { client, fetch, onCommandFailed, source, store };
}

describe('DeviceClient', () => {
  it('feeds state events into the store and tracks the connection', () => {
    const { client, source, store } = setup(Promise.resolve(new Response()));

    client.connect();
    source.emit('open');
    expect(store.isConnected).toBe(true);

    source.emit('state', '{"name_id":"switch/Motor","domain":"switch","value":true}');
    expect(store.states['switch/Motor']).toBe(true);

    source.emit('error');
    expect(store.isConnected).toBe(false);
  });

  it('posts commands to the REST url', async () => {
    const { client, fetch, onCommandFailed } = setup(Promise.resolve(new Response()));

    client.send('button/Stop All', 'press');
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith('/button/Stop%20All/press', { method: 'POST' });
    expect(onCommandFailed).not.toHaveBeenCalled();
  });

  it('reports failed commands without changing state', async () => {
    const { client, onCommandFailed, store } = setup(
      Promise.resolve(new Response(null, { status: 500 })),
    );

    client.send('switch/Motor', 'toggle');
    await flushPromises();

    expect(onCommandFailed).toHaveBeenCalledTimes(1);
    expect(store.states['switch/Motor']).toBeUndefined();
  });

  it('reports network errors', async () => {
    const { client, onCommandFailed } = setup(Promise.reject(new Error('offline')));

    client.send('switch/Motor', 'toggle');
    await flushPromises();

    expect(onCommandFailed).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH; npx jest test/device`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/device/protocol.ts`**

```ts
import type { EntityValue } from '../domain/entities';

export type CommandAction = 'press' | 'set' | 'toggle' | 'turn_off' | 'turn_on';
export type CommandParams = Readonly<Record<string, number | string>>;

export interface StateUpdate {
  key: string;
  value: EntityValue;
}

/** Shape of the JSON in an ESPHome web_server `state` event. */
interface StateEventPayload {
  domain?: string;
  name_id?: string;
  state?: string;
  value?: unknown;
}

const BOOLEAN_DOMAINS = new Set(['binary_sensor', 'switch']);

/** ESPHome REST route: POST /<domain>/<url-encoded name>/<action>?<params>. */
export function commandUrl(key: string, action: CommandAction, params: CommandParams = {}): string {
  const separator = key.indexOf('/');
  const domain = key.slice(0, separator);
  const name = key.slice(separator + 1);
  const path = `/${domain}/${encodeURIComponent(name)}/${action}`;
  const query = Object.entries(params)
    .map(([param, value]) => `${encodeURIComponent(param)}=${encodeURIComponent(String(value))}`)
    .join('&');

  return query ? `${path}?${query}` : path;
}

function isPayload(value: unknown): value is StateEventPayload {
  return typeof value === 'object' && value !== null;
}

export function parseStateEvent(data: string): StateUpdate | null {
  let payload: unknown;

  try {
    payload = JSON.parse(data);
  } catch {
    return null;
  }

  if (!isPayload(payload) || typeof payload.name_id !== 'string') {
    return null;
  }

  const key = payload.name_id;
  const domain = payload.domain ?? key.split('/')[0];

  if (domain === 'number') {
    return { key, value: Number.parseFloat(String(payload.value)) };
  }

  if (BOOLEAN_DOMAINS.has(domain)) {
    return { key, value: payload.value === true };
  }

  return { key, value: payload.state ?? '' };
}
```

- [ ] **Step 4: Implement `src/device/store.ts`**

```ts
import type { EntityStates, EntityValue } from '../domain/entities';
import type { StateUpdate } from './protocol';

export type Listener = () => void;

/** Latest value of every entity plus the connection flag; the single source of truth for the UI. */
export class StateStore {
  private readonly values: Record<string, EntityValue> = {};

  private readonly listeners = new Set<Listener>();

  private connected = false;

  public get states(): EntityStates {
    return this.values;
  }

  public get isConnected(): boolean {
    return this.connected;
  }

  public apply(update: StateUpdate): void {
    this.values[update.key] = update.value;
    this.connected = true;
    this.notify();
  }

  public setConnected(connected: boolean): void {
    if (this.connected === connected) {
      return;
    }

    this.connected = connected;
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }
}
```

- [ ] **Step 5: Implement `src/device/client.ts`**

```ts
import type { CommandAction, CommandParams } from './protocol';
import { commandUrl, parseStateEvent } from './protocol';
import type { StateStore } from './store';

export interface ClientEnvironment {
  createEventSource(url: string): EventSource;
  fetch(url: string, init: RequestInit): Promise<Response>;
}

const browserEnvironment: ClientEnvironment = {
  createEventSource: url => new EventSource(url),
  fetch: (url, init) => window.fetch(url, init),
};

/**
 * Talks to the ESP's web_server. State only changes through /events; a command never
 * edits the store itself, so the screen always shows what the device reports.
 */
export class DeviceClient {
  constructor(
    private readonly store: StateStore,
    private readonly onCommandFailed: () => void,
    private readonly environment: ClientEnvironment = browserEnvironment,
  ) {}

  public connect(url = '/events'): void {
    const source = this.environment.createEventSource(url);

    source.addEventListener('open', () => this.store.setConnected(true));
    source.addEventListener('error', () => this.store.setConnected(false));
    source.addEventListener('state', event => {
      const update = parseStateEvent(String((event as MessageEvent).data));

      if (update) {
        this.store.apply(update);
      }
    });
  }

  public send(key: string, action: CommandAction, params?: CommandParams): void {
    this.post(commandUrl(key, action, params)).catch(() => this.onCommandFailed());
  }

  private async post(url: string): Promise<void> {
    const response = await this.environment.fetch(url, { method: 'POST' });

    if (!response.ok) {
      throw new Error(`Command failed with HTTP ${response.status}`);
    }
  }
}
```

- [ ] **Step 6: Run tests, typecheck, lint, format**

Run: `export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH; npx jest && npm run typecheck && npm run lint -- --fix && npm run format && npm run lint`
Expected: all PASS, exit 0. (Node 22 provides `EventTarget`, `Event` and `Response` globally for the client test.)

- [ ] **Step 7: Commit**

```bash
git add src/device test/device
git commit -m "feat(tanquinho): device protocol, state store and client

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Portuguese copy, wash session and view model

**Files:**
- Create: `src/copy.ts`, `src/ui/session.ts`, `src/ui/view-model.ts`, `test/copy.test.ts`, `test/ui/session.test.ts`, `test/ui/view-model.test.ts`

**Interfaces:**
- Consumes: Task 1 time helpers, Task 2 entities/wash.
- Produces (`src/copy.ts`):
  - `interface LoadCopy { icon; subtitle; title }`, `interface StageCopy { icon; short; title }`, `interface RelayCopy { label; phrase }`, `interface OutcomeCopy { icon; message; title }` (all `string`)
  - `LOAD_COPY: Record<WaterLevel, LoadCopy>`, `STAGE_COPY: Record<Stage, StageCopy>`, `UNKNOWN_STAGE_COPY: StageCopy`, `RELAY_COPY: Record<RelayKey, RelayCopy>`, `OUTCOME_COPY: Record<WashOutcome, OutcomeCopy>`, `TEXT` (object of strings, keys listed in code)
  - `cycleProgressText(progress: CycleProgress | null): string`, `manualRelaysText(relays: readonly RelayKey[]): string`, `timesLabel(count: number): string`, `washTypeSubtitle(washType: WashType, seconds: number): string`, `startSubtitle(clockTime: string): string`, `remainingText(seconds: number): string`, `statusText(connected: boolean, running: boolean): string`
- Produces (`src/ui/session.ts`): `class WashSession` with `observe(running: boolean | undefined, remainingSeconds: number): WashOutcome | null`, `markStarted()`, `markStoppedByUser()`, `dismissOutcome()`, getters `outcome: WashOutcome | null`, `roundTotalSeconds: number`
- Produces (`src/ui/view-model.ts`): `type RequestedScreen = 'ready' | 'settings'`, `type Screen = RequestedScreen | 'washing'`, `type TimelineStepState = 'current' | 'done' | 'pending'`, `interface TimelineStep`, `interface RelayView`, `interface ViewInput`, `interface ViewModel` (fields in code), `buildViewModel(input: ViewInput): ViewModel`

- [ ] **Step 1: Write the failing tests**

`test/copy.test.ts`:
```ts
import {
  cycleProgressText,
  manualRelaysText,
  STAGE_COPY,
  startSubtitle,
  statusText,
  timesLabel,
  washTypeSubtitle,
} from '../src/copy';

describe('copy', () => {
  it('translates firmware stage codes to Portuguese', () => {
    expect(STAGE_COPY.Filling.title).toBe('Enchendo de água');
    expect(STAGE_COPY.Draining.short).toBe('Esvaziar');
  });

  it('describes the cycle progress', () => {
    expect(cycleProgressText({ current: 1, total: 2 })).toBe('Lavagem 1 de 2');
    expect(cycleProgressText(null)).toBe('');
  });

  it('lists relays left on in manual mode', () => {
    expect(manualRelaysText(['switch/Water Valve', 'switch/Auxiliary'])).toBe(
      'Ligado no modo manual: a água, o auxiliar.',
    );
  });

  it('labels counts, wash types, start button and status', () => {
    expect(timesLabel(1)).toBe('1 vez');
    expect(timesLabel(3)).toBe('3 vezes');
    expect(washTypeSubtitle('normal', 28 * 60)).toBe('com molho · 28 min');
    expect(washTypeSubtitle('quick', 15 * 60)).toBe('sem molho · 15 min');
    expect(startSubtitle('15:28')).toBe('termina às 15:28');
    expect(statusText(false, true)).toBe('Sem conexão');
    expect(statusText(true, true)).toBe('Lavando');
    expect(statusText(true, false)).toBe('Pronto');
  });
});
```

`test/ui/session.test.ts`:
```ts
import { WashSession } from '../../src/ui/session';

describe('WashSession', () => {
  it('reports nothing until the running flag has been seen once', () => {
    const session = new WashSession();

    expect(session.observe(undefined, 0)).toBeNull();
    expect(session.observe(false, 0)).toBeNull();
    expect(session.outcome).toBeNull();
  });

  it('reports a completed wash when it stops by itself', () => {
    const session = new WashSession();

    session.observe(true, 600);
    expect(session.observe(false, 0)).toBe('completed');
    expect(session.outcome).toBe('completed');
  });

  it('reports an interrupted wash after the person stops it', () => {
    const session = new WashSession();

    session.observe(true, 600);
    session.markStoppedByUser();
    expect(session.observe(false, 0)).toBe('interrupted');
  });

  it('clears the outcome when a new wash starts or the card is dismissed', () => {
    const session = new WashSession();

    session.observe(true, 600);
    session.observe(false, 0);
    session.dismissOutcome();
    expect(session.outcome).toBeNull();

    session.observe(true, 600);
    session.observe(false, 0);
    session.markStarted();
    expect(session.outcome).toBeNull();
  });

  it('keeps the largest remaining time of the running wash as the round total', () => {
    const session = new WashSession();

    session.observe(true, 600);
    session.observe(true, 500);
    expect(session.roundTotalSeconds).toBe(600);

    session.observe(false, 0);
    expect(session.roundTotalSeconds).toBe(0);
  });
});
```

`test/ui/view-model.test.ts`:
```ts
import type { EntityValue } from '../../src/domain/entities';
import { Entity } from '../../src/domain/entities';
import type { ViewInput } from '../../src/ui/view-model';
import { buildViewModel } from '../../src/ui/view-model';
import { buildStates } from '../fixtures';

const THREE_PM = new Date(2026, 10, 21, 15, 0, 0).getTime();

function input(states: Record<string, EntityValue>, overrides: Partial<ViewInput> = {}): ViewInput {
  return {
    connected: true,
    nowMs: THREE_PM,
    outcome: null,
    requestedScreen: 'ready',
    roundTotalSeconds: 0,
    runningWashType: 'normal',
    selectedWashType: 'normal',
    states,
    ...overrides,
  };
}

describe('buildViewModel', () => {
  it('shows the ready screen with estimates when idle', () => {
    const model = buildViewModel(input(buildStates({ [Entity.running]: false })));

    expect(model.screen).toBe('ready');
    expect(model.statusText).toBe('Pronto');
    expect(model.headerTitle).toBe('🧺 Tanquinho');
    expect(model.normalSubtitle).toBe('com molho · 28 min');
    expect(model.startSubtitle).toBe('termina às 15:28');
    expect(model.waterLevel).toBe('Medium');
  });

  it('uses the quick estimate for the start button when quick is selected', () => {
    const model = buildViewModel(input(buildStates(), { selectedWashType: 'quick' }));

    expect(model.startSubtitle).toBe('termina às 15:15');
  });

  it('shows the washing screen with stage, timeline and finish time', () => {
    const states = buildStates({
      [Entity.cycleProgress]: '1/2',
      [Entity.cycles]: 2,
      [Entity.running]: true,
      [Entity.stage]: 'Mixing',
      [Entity.timeRemaining]: '0:20:00',
    });
    const model = buildViewModel(input(states, { outcome: 'completed', roundTotalSeconds: 2400 }));

    expect(model.screen).toBe('washing');
    expect(model.stage.title).toBe('Misturando o sabão');
    expect(model.cycleText).toBe('Lavagem 1 de 2');
    expect(model.finishTime).toBe('15:20');
    expect(model.remainingText).toBe('faltam 20 min');
    expect(model.progressPercent).toBe(50);
    expect(model.outcome).toBeNull();
    expect(model.timeline.map(step => step.state)).toEqual([
      'done',
      'current',
      'pending',
      'pending',
      'pending',
    ]);
    expect(model.timeline[0].label).toBe('Encher');
  });

  it('hides the cycle text for a single cycle', () => {
    const states = buildStates({ [Entity.cycleProgress]: '1/1', [Entity.running]: true });

    expect(buildViewModel(input(states)).cycleText).toBe('');
  });

  it('keeps the settings screen even while washing', () => {
    const model = buildViewModel(
      input(buildStates({ [Entity.running]: true }), { requestedScreen: 'settings' }),
    );

    expect(model.screen).toBe('settings');
    expect(model.headerTitle).toBe('Ajustes');
    expect(model.manualNote).toBe('Indisponível durante a lavagem.');
  });

  it('warns about relays left on in manual mode only when idle', () => {
    const idle = buildViewModel(input(buildStates({ 'switch/Motor': true })));
    const running = buildViewModel(
      input(buildStates({ [Entity.running]: true, 'switch/Motor': true })),
    );

    expect(idle.manualAlert).toBe('Ligado no modo manual: o motor.');
    expect(running.manualAlert).toBeNull();
    expect(idle.relays.find(relay => relay.key === 'switch/Motor')?.on).toBe(true);
  });

  it('exposes the current minute settings', () => {
    const model = buildViewModel(input(buildStates()));

    expect(model.minuteSettings[Entity.fillMinutes.Low]).toBe(2.5);
    expect(model.minuteSettings[Entity.washMinutes]).toBe(15);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH; npx jest test/copy.test.ts test/ui`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/copy.ts`**

```ts
import type { RelayKey, Stage, WaterLevel } from './domain/entities';
import { formatDuration } from './domain/time';
import type { CycleProgress, WashOutcome, WashType } from './domain/wash';

/** Every text the person reads lives here, in Portuguese. Code elsewhere stays in English. */

export interface LoadCopy {
  icon: string;
  subtitle: string;
  title: string;
}

export interface StageCopy {
  icon: string;
  short: string;
  title: string;
}

export interface RelayCopy {
  label: string;
  phrase: string;
}

export interface OutcomeCopy {
  icon: string;
  message: string;
  title: string;
}

export const LOAD_COPY: Readonly<Record<WaterLevel, LoadCopy>> = {
  High: { icon: '💧💧💧', subtitle: 'água alta', title: 'Muita' },
  Low: { icon: '💧', subtitle: 'água baixa', title: 'Pouca' },
  Medium: { icon: '💧💧', subtitle: 'água média', title: 'Média' },
};

export const STAGE_COPY: Readonly<Record<Stage, StageCopy>> = {
  Draining: { icon: '⬇️', short: 'Esvaziar', title: 'Esvaziando a água' },
  Filling: { icon: '🚰', short: 'Encher', title: 'Enchendo de água' },
  Mixing: { icon: '🔄', short: 'Misturar', title: 'Misturando o sabão' },
  Soaking: { icon: '🫧', short: 'Molho', title: 'Roupa de molho' },
  Washing: { icon: '🌀', short: 'Lavar', title: 'Lavando' },
};

export const UNKNOWN_STAGE_COPY: StageCopy = { icon: '🌀', short: '', title: 'Lavando' };

export const RELAY_COPY: Readonly<Record<RelayKey, RelayCopy>> = {
  'switch/Auxiliary': { label: 'Auxiliar', phrase: 'o auxiliar' },
  'switch/Drain Pump': { label: 'Bomba', phrase: 'a bomba' },
  'switch/Motor': { label: 'Motor', phrase: 'o motor' },
  'switch/Water Valve': { label: 'Água', phrase: 'a água' },
};

export const OUTCOME_COPY: Readonly<Record<WashOutcome, OutcomeCopy>> = {
  completed: { icon: '✅', message: 'A lavagem terminou.', title: 'Pronto! Pode tirar a roupa' },
  interrupted: {
    icon: '⏹️',
    message: 'Se ficou água no tanque, use ⚙️ Ajustes → Modo manual → Bomba para esvaziar.',
    title: 'Lavagem interrompida',
  },
};

export const TEXT = {
  advanced: 'Avançado',
  appTitle: '🧺 Tanquinho',
  back: '← Voltar',
  backToSimple: '🧺 Tela simples',
  cancel: 'Cancelar',
  commandFailed: 'Não foi possível falar com o tanquinho. Tente de novo.',
  cyclesQuestion: 'Quantas vezes lavar?',
  documentTitle: 'Tanquinho',
  drainTitle: 'Tempo para esvaziar (minutos)',
  fillTitle: 'Tempo para encher (minutos)',
  finishesAt: 'Termina às',
  loadHighLabel: 'Muita roupa',
  loadLowLabel: 'Pouca roupa',
  loadMediumLabel: 'Média',
  loadQuestion: 'Quanta roupa?',
  manualHint: 'Liga e desliga cada parte na hora. A água desliga sozinha depois de 10 minutos.',
  manualTitle: 'Modo manual',
  manualUnavailable: 'Indisponível durante a lavagem.',
  mixLabel: 'Misturar o sabão',
  ok: 'OK',
  offlineBanner: 'Sem conexão com o tanquinho. Tentando de novo…',
  otherStagesTitle: 'Outras etapas (minutos)',
  powerOff: '⏻ Desligar tudo',
  powerOffConfirm: '⏻ Desligar tudo',
  powerOffMessage:
    'A água, o motor e a bomba param na hora. Se estiver lavando, a lavagem é cancelada e a água fica no tanque.',
  powerOffTitle: 'Desligar tudo agora?',
  settings: '⚙️ Ajustes',
  settingsTitle: 'Ajustes',
  soakLabel: 'Molho',
  start: '▶ Começar',
  statusOffline: 'Sem conexão',
  statusReady: 'Pronto',
  statusWashing: 'Lavando',
  stopConfirm: 'Sim, parar',
  stopMessage: 'A máquina para na hora. A água que estiver no tanque fica lá.',
  stopTitle: 'Parar a lavagem?',
  stopWash: '■ Parar lavagem',
  timelineLabel: 'Etapas',
  turnOff: 'Desligar',
  washLabel: 'Lavar',
  washTypeNormal: 'Normal',
  washTypeQuestion: 'Tipo de lavagem',
  washTypeQuick: 'Rápida',
} as const;

export function cycleProgressText(progress: CycleProgress | null): string {
  return progress ? `Lavagem ${progress.current} de ${progress.total}` : '';
}

export function manualRelaysText(relays: readonly RelayKey[]): string {
  return `Ligado no modo manual: ${relays.map(relay => RELAY_COPY[relay].phrase).join(', ')}.`;
}

export function timesLabel(count: number): string {
  return count === 1 ? '1 vez' : `${count} vezes`;
}

export function washTypeSubtitle(washType: WashType, seconds: number): string {
  const soak = washType === 'quick' ? 'sem molho' : 'com molho';

  return `${soak} · ${formatDuration(seconds)}`;
}

export function startSubtitle(clockTime: string): string {
  return `termina às ${clockTime}`;
}

export function remainingText(seconds: number): string {
  return seconds > 0 ? `faltam ${formatDuration(seconds)}` : '';
}

export function statusText(connected: boolean, running: boolean): string {
  if (!connected) {
    return TEXT.statusOffline;
  }

  return running ? TEXT.statusWashing : TEXT.statusReady;
}
```

- [ ] **Step 4: Implement `src/ui/session.ts`**

```ts
import type { WashOutcome } from '../domain/wash';
import { washOutcome } from '../domain/wash';

/**
 * What the screen remembers about the current wash between renders: whether the person
 * stopped it, how it ended, and the longest remaining time seen (the progress bar's 100 %).
 */
export class WashSession {
  private wasRunning: boolean | null = null;

  private stoppedByUser = false;

  private currentOutcome: WashOutcome | null = null;

  private roundTotal = 0;

  public get outcome(): WashOutcome | null {
    return this.currentOutcome;
  }

  public get roundTotalSeconds(): number {
    return this.roundTotal;
  }

  /** Call on every render; returns the outcome only on the render where the wash ended. */
  public observe(running: boolean | undefined, remainingSeconds: number): WashOutcome | null {
    let finished: WashOutcome | null = null;

    if (running !== undefined) {
      if (this.wasRunning !== null) {
        finished = washOutcome(this.wasRunning, running, this.stoppedByUser);
      }

      this.wasRunning = running;
    }

    if (finished) {
      this.currentOutcome = finished;
    }

    const isRunning = running === true;

    if (isRunning) {
      this.currentOutcome = null;
    }

    this.roundTotal = isRunning ? Math.max(this.roundTotal, remainingSeconds) : 0;

    return finished;
  }

  public markStarted(): void {
    this.stoppedByUser = false;
    this.currentOutcome = null;
  }

  public markStoppedByUser(): void {
    this.stoppedByUser = true;
  }

  public dismissOutcome(): void {
    this.currentOutcome = null;
  }
}
```

- [ ] **Step 5: Implement `src/ui/view-model.ts`**

```ts
import type { StageCopy } from '../copy';
import {
  cycleProgressText,
  manualRelaysText,
  RELAY_COPY,
  remainingText,
  STAGE_COPY,
  startSubtitle,
  statusText,
  TEXT,
  UNKNOWN_STAGE_COPY,
  washTypeSubtitle,
} from '../copy';
import type { EntityStates, RelayKey, Stage, WaterLevel } from '../domain/entities';
import {
  Entity,
  isOn,
  MINUTE_SETTINGS,
  readNumber,
  readText,
  readWaterLevel,
  RELAYS,
} from '../domain/entities';
import { clockTimeAfter, parseHms, progressPercent } from '../domain/time';
import type { WashOutcome, WashType } from '../domain/wash';
import {
  activeRelays,
  estimateSeconds,
  parseCycleProgress,
  parseStage,
  timelineStages,
} from '../domain/wash';

export type RequestedScreen = 'ready' | 'settings';
export type Screen = RequestedScreen | 'washing';
export type TimelineStepState = 'current' | 'done' | 'pending';

export interface TimelineStep {
  label: string;
  state: TimelineStepState;
}

export interface RelayView {
  key: RelayKey;
  label: string;
  on: boolean;
}

export interface ViewInput {
  connected: boolean;
  nowMs: number;
  outcome: WashOutcome | null;
  requestedScreen: RequestedScreen;
  roundTotalSeconds: number;
  /** Wash type saved when the current wash started; drives the timeline. */
  runningWashType: WashType;
  /** Wash type selected on the ready screen; drives the start button. */
  selectedWashType: WashType;
  states: EntityStates;
}

/** Everything the views draw, already computed and translated. */
export interface ViewModel {
  connected: boolean;
  cycleText: string;
  cycles: number;
  finishTime: string;
  headerTitle: string;
  manualAlert: string | null;
  manualNote: string;
  minuteSettings: Readonly<Record<string, number | undefined>>;
  normalSubtitle: string;
  outcome: WashOutcome | null;
  progressPercent: number;
  quickSubtitle: string;
  relays: RelayView[];
  remainingText: string;
  running: boolean;
  screen: Screen;
  stage: StageCopy;
  startSubtitle: string;
  statusText: string;
  timeline: TimelineStep[];
  washType: WashType;
  waterLevel: WaterLevel;
}

const NO_TIME = '--:--';

function resolveScreen(requested: RequestedScreen, running: boolean): Screen {
  if (requested === 'settings') {
    return 'settings';
  }

  return running ? 'washing' : 'ready';
}

function buildTimeline(washType: WashType, stage: Stage | null): TimelineStep[] {
  const stages = timelineStages(washType);
  const currentIndex = stage ? stages.indexOf(stage) : -1;

  return stages.map((step, index) => {
    let state: TimelineStepState = 'pending';

    if (index < currentIndex) {
      state = 'done';
    } else if (index === currentIndex) {
      state = 'current';
    }

    return { label: STAGE_COPY[step].short, state };
  });
}

function readMinuteSettings(states: EntityStates): Record<string, number | undefined> {
  return Object.fromEntries(
    MINUTE_SETTINGS.map(key => {
      const value = states[key];

      return [key, typeof value === 'number' ? value : undefined];
    }),
  );
}

export function buildViewModel(input: ViewInput): ViewModel {
  const { connected, nowMs, states } = input;
  const running = isOn(states, Entity.running);
  const screen = resolveScreen(input.requestedScreen, running);
  const cycles = Math.round(readNumber(states, Entity.cycles, 1));
  const remaining = parseHms(readText(states, Entity.timeRemaining));
  const stage = parseStage(readText(states, Entity.stage));
  const normalSeconds = estimateSeconds(states, 'normal');
  const quickSeconds = estimateSeconds(states, 'quick');
  const selectedSeconds = input.selectedWashType === 'quick' ? quickSeconds : normalSeconds;
  const relaysOn = activeRelays(states);

  return {
    connected,
    cycleText:
      cycles > 1 ? cycleProgressText(parseCycleProgress(readText(states, Entity.cycleProgress))) : '',
    cycles,
    finishTime: remaining > 0 ? clockTimeAfter(nowMs, remaining) : NO_TIME,
    headerTitle: screen === 'settings' ? TEXT.settingsTitle : TEXT.appTitle,
    manualAlert: !running && relaysOn.length > 0 ? manualRelaysText(relaysOn) : null,
    manualNote: running ? TEXT.manualUnavailable : TEXT.manualHint,
    minuteSettings: readMinuteSettings(states),
    normalSubtitle: washTypeSubtitle('normal', normalSeconds),
    outcome: running ? null : input.outcome,
    progressPercent: progressPercent(remaining, input.roundTotalSeconds),
    quickSubtitle: washTypeSubtitle('quick', quickSeconds),
    relays: RELAYS.map(key => ({ key, label: RELAY_COPY[key].label, on: isOn(states, key) })),
    remainingText: remainingText(remaining),
    running,
    screen,
    stage: stage ? STAGE_COPY[stage] : UNKNOWN_STAGE_COPY,
    startSubtitle: startSubtitle(clockTimeAfter(nowMs, selectedSeconds)),
    statusText: statusText(connected, running),
    timeline: buildTimeline(input.runningWashType, stage),
    washType: input.selectedWashType,
    waterLevel: readWaterLevel(states),
  };
}
```

- [ ] **Step 6: Run tests, typecheck, lint, format**

Run: `export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH; npx jest && npm run typecheck && npm run lint -- --fix && npm run format && npm run lint`
Expected: all PASS, exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/copy.ts src/ui/session.ts src/ui/view-model.ts test/copy.test.ts test/ui
git commit -m "feat(tanquinho): Portuguese copy, wash session and view model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: DOM views, app composition and bundle

**Files:**
- Create: `src/ui/actions.ts`, `src/ui/dom.ts`, `src/ui/styles.ts`, `src/ui/preferences.ts`, `src/ui/scheduler.ts`, `src/ui/components/card.ts`, `src/ui/components/choice.ts`, `src/ui/components/confirm-sheet.ts`, `src/ui/components/toast.ts`, `src/ui/screens/header.ts`, `src/ui/screens/manual-alert.ts`, `src/ui/screens/outcome-card.ts`, `src/ui/screens/ready-screen.ts`, `src/ui/screens/washing-screen.ts`, `src/ui/screens/settings-screen.ts`, `src/ui/screens/footer.ts`, `src/ui/screens/action-bar.ts`, `src/ui/app.ts`, `src/main.ts`, `test/ui/app.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 (`StateStore`, `CommandAction`, `CommandParams`, `buildViewModel`, `WashSession`, copy, entities).
- Produces:
  - `actions.ts`: `interface CommandSender { send(key: string, action: CommandAction, params?: CommandParams): void }`, `interface Actions` (13 methods, see code), `interface View { element: HTMLElement; update(model: ViewModel): void }`
  - `preferences.ts`: `interface Preferences { loadWashType(): WashType; saveWashType(washType: WashType): void }`, `createLocalPreferences(getStorage?: () => Storage): Preferences`
  - `app.ts`: `interface AppEnvironment { commands; now(); openAdvanced(); preferences; scrollToTop(); store; vibrate(pattern: number[]) }`, `interface App { element: HTMLElement; overlays: HTMLElement[]; render(): void }`, `createApp(environment: AppEnvironment): App`

- [ ] **Step 1: Write the failing app test**

`test/ui/app.test.ts`:
```ts
/**
 * @jest-environment jsdom
 */
import type { EntityValue } from '../../src/domain/entities';
import { Entity } from '../../src/domain/entities';
import type { WashType } from '../../src/domain/wash';
import { StateStore } from '../../src/device/store';
import { createApp } from '../../src/ui/app';
import { buildStates } from '../fixtures';

type SentCommand = [string, string, unknown];

function setup(overrides: Record<string, EntityValue> = {}) {
  const store = new StateStore();
  const sent: SentCommand[] = [];
  let savedWashType: WashType = 'normal';
  const vibrate = jest.fn();

  Object.entries(buildStates(overrides)).forEach(([key, value]) => store.apply({ key, value }));

  const app = createApp({
    commands: {
      send: (key, action, params) => {
        sent.push([key, action, params]);
      },
    },
    now: () => new Date(2026, 10, 21, 15, 0, 0).getTime(),
    openAdvanced: jest.fn(),
    preferences: {
      loadWashType: () => savedWashType,
      saveWashType: washType => {
        savedWashType = washType;
      },
    },
    scrollToTop: jest.fn(),
    store,
    vibrate,
  });

  document.body.replaceChildren(app.element, ...app.overlays);
  app.render();

  return { app, sent, store, vibrate };
}

function findButton(text: string): HTMLButtonElement {
  const match = [...document.querySelectorAll('button')].find(candidate =>
    candidate.textContent?.includes(text),
  );

  if (!match) {
    throw new Error(`No button with text "${text}"`);
  }

  return match;
}

function isVisible(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;

  while (current) {
    if (current.style.display === 'none') {
      return false;
    }

    current = current.parentElement;
  }

  return true;
}

describe('createApp', () => {
  it('shows the ready screen with the selected level and finish time', () => {
    setup({ [Entity.running]: false });

    expect(document.body.textContent).toContain('Quanta roupa?');
    expect(findButton('Média').getAttribute('aria-pressed')).toBe('true');
    expect(findButton('▶ Começar').textContent).toContain('termina às 15:28');
    expect(isVisible(findButton('■ Parar lavagem'))).toBe(false);
  });

  it('sends the chosen level and starts the selected wash type', () => {
    const { sent } = setup({ [Entity.running]: false });

    findButton('Pouca').click();
    findButton('Rápida').click();
    findButton('▶ Começar').click();

    expect(sent).toEqual([
      ['select/Water Level', 'set', { option: 'Low' }],
      ['button/Start Quick Cycle', 'press', undefined],
    ]);
  });

  it('shows the washing screen in Portuguese', () => {
    setup({
      [Entity.cycleProgress]: '1/2',
      [Entity.cycles]: 2,
      [Entity.running]: true,
      [Entity.stage]: 'Filling',
      [Entity.timeRemaining]: '0:20:00',
    });

    expect(document.body.textContent).toContain('Enchendo de água');
    expect(document.body.textContent).toContain('Lavagem 1 de 2');
    expect(document.body.textContent).toContain('15:20');
    expect(isVisible(findButton('■ Parar lavagem'))).toBe(true);
    expect(isVisible(findButton('▶ Começar'))).toBe(false);
  });

  it('asks for confirmation before stopping a wash', () => {
    const { sent } = setup({ [Entity.running]: true, [Entity.stage]: 'Washing' });

    findButton('■ Parar lavagem').click();
    expect(sent).toEqual([]);

    findButton('Sim, parar').click();
    expect(sent).toEqual([['button/Stop All', 'press', undefined]]);
  });

  it('celebrates a wash that finished by itself', () => {
    const { app, store, vibrate } = setup({ [Entity.running]: true, [Entity.stage]: 'Draining' });

    store.apply({ key: Entity.running, value: false });
    app.render();

    expect(document.body.textContent).toContain('Pronto! Pode tirar a roupa');
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('opens settings and saves a typed fill time', () => {
    const { sent } = setup({ [Entity.running]: false });

    findButton('⚙️ Ajustes').click();
    expect(document.querySelector('h1')?.textContent).toContain('Ajustes');

    const firstField = document.querySelector<HTMLInputElement>('input[type="number"]');

    if (!firstField) {
      throw new Error('No minutes field');
    }

    expect(firstField.value).toBe('2.5');
    firstField.value = '4';
    firstField.dispatchEvent(new Event('change'));

    expect(sent).toEqual([['number/Fill Low (min)', 'set', { value: 4 }]]);
  });

  it('disables commands while offline', () => {
    const { app, store } = setup({ [Entity.running]: false });

    store.setConnected(false);
    app.render();

    expect(findButton('⏻ Desligar tudo').disabled).toBe(true);
    expect(findButton('▶ Começar').disabled).toBe(true);
    expect(app.element.classList.contains('offline')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH; npx jest test/ui/app.test.ts`
Expected: FAIL, `Cannot find module '../../src/ui/app'`.

- [ ] **Step 3: Implement the DOM helpers, styles, preferences and scheduler**

`src/ui/actions.ts`:
```ts
import type { RelayKey, WaterLevel } from '../domain/entities';
import type { WashType } from '../domain/wash';
import type { CommandAction, CommandParams } from '../device/protocol';
import type { ViewModel } from './view-model';

export interface CommandSender {
  send(key: string, action: CommandAction, params?: CommandParams): void;
}

/** What the views can ask for; implemented once in app.ts. */
export interface Actions {
  dismissOutcome(): void;
  openAdvanced(): void;
  openSettings(): void;
  requestPowerOff(): void;
  requestStop(): void;
  selectCycles(count: number): void;
  selectWashType(washType: WashType): void;
  selectWaterLevel(level: WaterLevel): void;
  setMinutes(key: string, minutes: number): void;
  showReady(): void;
  start(): void;
  stopNow(): void;
  toggleRelay(key: RelayKey): void;
}

/** A piece of the screen built once and refreshed from the view model on every render. */
export interface View {
  element: HTMLElement;
  update(model: ViewModel): void;
}
```

`src/ui/dom.ts`:
```ts
export interface ElementOptions {
  attrs?: Readonly<Record<string, string>>;
  className?: string;
  onClick?: (event: MouseEvent) => void;
  text?: string;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: readonly Node[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined) {
    element.textContent = options.text;
  }

  Object.entries(options.attrs ?? {}).forEach(([name, value]) => element.setAttribute(name, value));

  if (options.onClick) {
    element.addEventListener('click', options.onClick);
  }

  element.append(...children);

  return element;
}

export function button(
  text: string,
  className: string | undefined,
  onClick: () => void,
): HTMLButtonElement {
  return h('button', { attrs: { type: 'button' }, className, onClick, text });
}

export function setVisible(element: HTMLElement, visible: boolean): void {
  element.style.display = visible ? '' : 'none';
}

export function setPressed(element: HTMLElement, pressed: boolean): void {
  element.setAttribute('aria-pressed', String(pressed));
}

/** Replaces the children; `replaceChildren` is missing on older phones. */
export function setChildren(element: HTMLElement, children: readonly Node[]): void {
  element.textContent = '';
  element.append(...children);
}
```

`src/ui/styles.ts` (same rules as today, English class names):
```ts
const FONT = '18px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

export const SIMPLE_MODE_CLASS = 'tq-simple-mode';

export const STYLES = `
:root{--bg:#f3f5f9;--card:#fff;--text:#17202c;--muted:#566273;--primary:#1565d8;--on-primary:#fff;
--selected:#e7f0fd;--border:#d9e0ea;--danger:#c62828;--danger-bg:#fdecec;--ok:#1e8e4f;--ok-bg:#e6f5ec;
--warning:#8a5a00;--warning-bg:#fff4d6;--radius:18px}
@media (prefers-color-scheme:dark){:root{--bg:#0e131a;--card:#18202b;--text:#eef2f7;--muted:#a3afbf;
--primary:#6aa8ff;--on-primary:#0b1220;--selected:#1d2b40;--border:#2b3646;--danger:#ff6b6b;--danger-bg:#3a1c1f;
--ok:#4cc584;--ok-bg:#16301f;--warning:#ffd27a;--warning-bg:#3a2e12}}
body.${SIMPLE_MODE_CLASS} esp-app{display:none}
body:not(.${SIMPLE_MODE_CLASS}) #tq{display:none}
body.${SIMPLE_MODE_CLASS}{margin:0;background:var(--bg)}
#tq{font:${FONT};color:var(--text);max-width:480px;margin:0 auto;padding:12px 16px 0;box-sizing:border-box;min-height:100vh;display:flex;flex-direction:column}
#tq *{box-sizing:border-box}
#tq button{font:inherit;color:inherit;cursor:pointer;border-radius:14px;border:2px solid var(--border);background:var(--card);min-height:56px;-webkit-tap-highlight-color:transparent}
#tq button:disabled{opacity:.4;cursor:default}
#tq .top-bar{display:flex;align-items:center;gap:10px;margin-bottom:12px}
#tq .top-bar h1{font-size:22px;margin:0;flex:1}
#tq .top-bar button{white-space:nowrap}
#tq .status{display:block;font-size:14px;font-weight:400;color:var(--muted)}
#tq .status:before{content:"";display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--ok);margin-right:6px;vertical-align:1px}
#tq.offline .status:before{background:var(--danger)}
#tq .power-off{min-height:48px;padding:0 14px;border-color:var(--danger);color:var(--danger);font-size:16px;font-weight:600}
#tq .offline-banner,#tq .manual-alert{border-radius:14px;padding:12px 14px;margin-bottom:12px;font-size:16px}
#tq .offline-banner{background:var(--danger);color:#fff;display:none}
#tq.offline .offline-banner{display:block}
#tq .manual-alert{background:var(--warning-bg);color:var(--warning);display:flex;align-items:center;gap:10px}
#tq .manual-alert span{flex:1}
#tq .manual-alert button{min-height:48px;padding:0 14px;border-color:currentColor;background:transparent;color:inherit;font-weight:600}
#tq .card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px}
#tq h2{font-size:18px;margin:0 0 12px}
#tq .choices{display:grid;gap:10px}
#tq .choices--3{grid-template-columns:repeat(3,1fr)}
#tq .choices--2{grid-template-columns:1fr 1fr}
#tq .choices--5{grid-template-columns:repeat(5,1fr)}
#tq .choice{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:10px 4px}
#tq .choice b{font-size:19px}
#tq .choice small{font-size:14px;color:var(--muted)}
#tq .choice[aria-pressed="true"]{border-color:var(--primary);background:var(--selected)}
#tq .choices--5 .choice b{font-size:22px}
#tq .action-bar{position:sticky;bottom:0;margin:auto -16px 0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:linear-gradient(to top,var(--bg) 75%,transparent)}
#tq .action-bar button{width:100%;min-height:68px;border:0;font-weight:700;font-size:21px;display:flex;flex-direction:column;align-items:center;justify-content:center}
#tq .action-bar small{font-size:15px;font-weight:400;opacity:.9}
#tq .start{background:var(--primary);color:var(--on-primary)}
#tq .stop{background:var(--danger);color:#fff}
#tq .now{text-align:center}
#tq .now .icon{font-size:64px;display:inline-block;animation:tq-pulse 2s ease-in-out infinite}
#tq .now .stage{font-size:28px;font-weight:700;margin:4px 0 2px}
#tq .now .cycle{font-size:16px;color:var(--muted)}
#tq .timeline{display:flex;list-style:none;padding:0;margin:18px 0;gap:4px}
#tq .timeline li{flex:1;font-size:13px;color:var(--muted);padding-top:10px;border-top:5px solid var(--border)}
#tq .timeline li.done{border-color:var(--ok)}
#tq .timeline li.current{border-color:var(--primary);color:var(--text);font-weight:700}
#tq .finish{font-size:16px;color:var(--muted);margin-top:6px}
#tq .finish b{display:block;font-size:40px;color:var(--text);font-variant-numeric:tabular-nums}
#tq .progress{height:10px;background:var(--border);border-radius:6px;overflow:hidden;margin-top:12px}
#tq .progress i{display:block;height:100%;width:0;background:var(--ok);transition:width .8s}
#tq .outcome{text-align:center}
#tq .outcome.completed{background:var(--ok-bg);border-color:var(--ok)}
#tq .outcome.interrupted{background:var(--warning-bg);border-color:var(--warning)}
#tq .outcome .icon{font-size:48px}
#tq .outcome b{display:block;font-size:22px;margin:4px 0}
#tq .outcome p{margin:0 0 12px;font-size:16px}
#tq .outcome button{min-width:140px}
#tq .back{min-height:48px;padding:0 14px;margin-right:4px}
#tq .field{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:10px 0}
#tq .field input{width:96px;min-height:52px;font:inherit;text-align:center;border-radius:12px;border:2px solid var(--border);background:var(--bg);color:var(--text)}
#tq .note{font-size:15px;color:var(--muted);margin:0 0 10px}
#tq .relays{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#tq .relays button[aria-pressed="true"]{background:var(--ok);color:#fff;border-color:var(--ok)}
#tq .footer{display:flex;justify-content:center;gap:24px;margin:8px 0 4px}
#tq .footer button{border:0;background:transparent;min-height:48px;color:var(--muted);font-size:16px;text-decoration:underline}
#tq-sheet{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center;z-index:20}
#tq-sheet.open{display:flex}
#tq-sheet .box{background:var(--card);color:var(--text);width:100%;max-width:480px;border-radius:22px 22px 0 0;padding:22px 16px calc(16px + env(safe-area-inset-bottom));font:${FONT}}
#tq-sheet h3{margin:0 0 6px;font-size:22px}
#tq-sheet p{margin:0 0 18px;color:var(--muted);font-size:16px}
#tq-sheet button{display:block;width:100%;min-height:60px;border-radius:14px;font:inherit;font-weight:700;margin-top:10px;cursor:pointer;border:2px solid var(--border);background:var(--card);color:var(--text)}
#tq-sheet .confirm{background:var(--danger);border-color:var(--danger);color:#fff}
#tq-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:#222;color:#fff;padding:12px 16px;border-radius:12px;font:16px system-ui,sans-serif;display:none;z-index:30;max-width:90vw}
#tq-simple{position:fixed;right:12px;bottom:12px;z-index:10;padding:10px 14px;border-radius:12px;border:0;background:#1565d8;color:#fff;font:16px system-ui,sans-serif;min-height:48px}
body.${SIMPLE_MODE_CLASS} #tq-simple{display:none}
@keyframes tq-pulse{50%{transform:scale(1.08)}}
@media (prefers-reduced-motion:reduce){#tq .now .icon{animation:none}}
`;
```

`src/ui/preferences.ts`:
```ts
import type { WashType } from '../domain/wash';

const WASH_TYPE_KEY = 'tq-wash-type';

export interface Preferences {
  loadWashType(): WashType;
  saveWashType(washType: WashType): void;
}

/** localStorage can be missing (private tabs); the screen keeps working without it. */
export function createLocalPreferences(
  getStorage: () => Storage = () => window.localStorage,
): Preferences {
  return {
    loadWashType: () => {
      try {
        return getStorage().getItem(WASH_TYPE_KEY) === 'quick' ? 'quick' : 'normal';
      } catch {
        return 'normal';
      }
    },
    saveWashType: washType => {
      try {
        getStorage().setItem(WASH_TYPE_KEY, washType);
      } catch {
        // Nothing to do: the choice just will not survive a reload.
      }
    },
  };
}
```

`src/ui/scheduler.ts`:
```ts
/** Batches bursts of state events into one render per animation frame. */
export function createFrameScheduler(
  task: () => void,
  requestFrame: (callback: FrameRequestCallback) => number = callback =>
    window.requestAnimationFrame(callback),
): () => void {
  let scheduled = false;

  return () => {
    if (scheduled) {
      return;
    }

    scheduled = true;
    requestFrame(() => {
      scheduled = false;
      task();
    });
  };
}
```

- [ ] **Step 4: Implement the components**

`src/ui/components/card.ts`:
```ts
import { h } from '../dom';

export function card(title: string, children: readonly Node[]): HTMLDivElement {
  return h('div', { className: 'card' }, [h('h2', { text: title }), ...children]);
}
```

`src/ui/components/choice.ts`:
```ts
import { h } from '../dom';

export interface ChoiceOptions {
  ariaLabel?: string;
  icon?: string;
  onSelect: () => void;
  subtitle?: string;
  title: string;
}

export interface Choice {
  button: HTMLButtonElement;
  setSubtitle(text: string): void;
}

/** A large selectable option; `aria-pressed` marks the current choice. */
export function createChoice(options: ChoiceOptions): Choice {
  const subtitle = options.subtitle === undefined ? null : h('small', { text: options.subtitle });
  const icon = options.icon ? h('span', { attrs: { 'aria-hidden': 'true' }, text: options.icon }) : null;
  const children = [icon, h('b', { text: options.title }), subtitle].filter(
    (node): node is HTMLElement => node !== null,
  );
  const attrs: Record<string, string> = { 'aria-pressed': 'false', type: 'button' };

  if (options.ariaLabel) {
    attrs['aria-label'] = options.ariaLabel;
  }

  const element = h('button', { attrs, className: 'choice', onClick: options.onSelect }, children);

  return {
    button: element,
    setSubtitle: text => {
      if (subtitle) {
        subtitle.textContent = text;
      }
    },
  };
}
```

`src/ui/components/confirm-sheet.ts`:
```ts
import { TEXT } from '../../copy';
import { button, h } from '../dom';

export interface ConfirmOptions {
  confirmLabel: string;
  message: string;
  onConfirm: () => void;
  title: string;
}

export interface ConfirmSheet {
  element: HTMLElement;
  open(options: ConfirmOptions): void;
}

/** Bottom sheet that asks before anything that stops the machine. */
export function createConfirmSheet(): ConfirmSheet {
  const title = h('h3');
  const message = h('p');
  let pendingAction: (() => void) | null = null;

  const close = () => {
    element.classList.remove('open');
    pendingAction = null;
  };

  const confirmButton = button('', 'confirm', () => {
    const action = pendingAction;

    close();
    action?.();
  });

  const element = h('div', { attrs: { 'aria-modal': 'true', id: 'tq-sheet', role: 'dialog' } }, [
    h('div', { className: 'box' }, [title, message, confirmButton, button(TEXT.cancel, undefined, close)]),
  ]);

  element.addEventListener('click', event => {
    if (event.target === element) {
      close();
    }
  });

  return {
    element,
    open: options => {
      title.textContent = options.title;
      message.textContent = options.message;
      confirmButton.textContent = options.confirmLabel;
      pendingAction = options.onConfirm;
      element.classList.add('open');
      confirmButton.focus();
    },
  };
}
```

`src/ui/components/toast.ts`:
```ts
import { h } from '../dom';

const TOAST_DURATION_MS = 3500;

export interface Toast {
  element: HTMLElement;
  show(message: string): void;
}

export function createToast(): Toast {
  const element = h('div', { attrs: { id: 'tq-toast', role: 'status' } });
  let hideTimer: number | undefined;

  return {
    element,
    show: message => {
      element.textContent = message;
      element.style.display = 'block';
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        element.style.display = 'none';
      }, TOAST_DURATION_MS);
    },
  };
}
```

- [ ] **Step 5: Implement the screens**

`src/ui/screens/header.ts`:
```ts
import { TEXT } from '../../copy';
import type { Actions, View } from '../actions';
import { button, h, setVisible } from '../dom';

export function createHeader(actions: Actions): View {
  const title = h('span');
  const status = h('span', { className: 'status' });
  const back = button(TEXT.back, 'back', actions.showReady);
  const powerOff = button(TEXT.powerOff, 'power-off', actions.requestPowerOff);
  const element = h('div', { className: 'header' }, [
    h('div', { className: 'top-bar' }, [back, h('h1', {}, [title, status]), powerOff]),
    h('div', { attrs: { role: 'alert' }, className: 'offline-banner', text: TEXT.offlineBanner }),
  ]);

  return {
    element,
    update: model => {
      title.textContent = model.headerTitle;
      status.textContent = model.statusText;
      setVisible(back, model.screen === 'settings');
      powerOff.disabled = !model.connected;
    },
  };
}
```

`src/ui/screens/manual-alert.ts`:
```ts
import { TEXT } from '../../copy';
import type { Actions, View } from '../actions';
import { button, h, setVisible } from '../dom';

/** Yellow warning when a relay was left on in manual mode with no wash running. */
export function createManualAlert(actions: Actions): View {
  const text = h('span');
  const element = h('div', { attrs: { role: 'status' }, className: 'manual-alert' }, [
    text,
    button(TEXT.turnOff, undefined, actions.stopNow),
  ]);

  return {
    element,
    update: model => {
      setVisible(element, model.manualAlert !== null);
      text.textContent = model.manualAlert ?? '';
    },
  };
}
```

`src/ui/screens/outcome-card.ts`:
```ts
import { OUTCOME_COPY, TEXT } from '../../copy';
import type { Actions, View } from '../actions';
import { button, h, setVisible } from '../dom';

export function createOutcomeCard(actions: Actions): View {
  const icon = h('div', { className: 'icon' });
  const title = h('b');
  const message = h('p');
  const element = h('div', { attrs: { role: 'status' }, className: 'card outcome' }, [
    icon,
    title,
    message,
    button(TEXT.ok, undefined, actions.dismissOutcome),
  ]);

  return {
    element,
    update: model => {
      setVisible(element, model.outcome !== null && model.screen === 'ready');

      if (!model.outcome) {
        return;
      }

      const copy = OUTCOME_COPY[model.outcome];

      element.className = `card outcome ${model.outcome}`;
      icon.textContent = copy.icon;
      title.textContent = copy.title;
      message.textContent = copy.message;
    },
  };
}
```

`src/ui/screens/ready-screen.ts`:
```ts
import { LOAD_COPY, TEXT, timesLabel } from '../../copy';
import { WATER_LEVELS } from '../../domain/entities';
import type { Actions, View } from '../actions';
import { card } from '../components/card';
import { createChoice } from '../components/choice';
import { h, setPressed, setVisible } from '../dom';

const CYCLE_OPTIONS = [1, 2, 3, 4, 5] as const;

/** Choose first, confirm later: load, wash type and number of washes. */
export function createReadyScreen(actions: Actions): View {
  const loadChoices = WATER_LEVELS.map(level => ({
    choice: createChoice({
      icon: LOAD_COPY[level].icon,
      onSelect: () => actions.selectWaterLevel(level),
      subtitle: LOAD_COPY[level].subtitle,
      title: LOAD_COPY[level].title,
    }),
    level,
  }));
  const normal = createChoice({
    onSelect: () => actions.selectWashType('normal'),
    subtitle: '',
    title: TEXT.washTypeNormal,
  });
  const quick = createChoice({
    onSelect: () => actions.selectWashType('quick'),
    subtitle: '',
    title: TEXT.washTypeQuick,
  });
  const cycleChoices = CYCLE_OPTIONS.map(count =>
    createChoice({
      ariaLabel: timesLabel(count),
      onSelect: () => actions.selectCycles(count),
      title: String(count),
    }),
  );

  const element = h('div', { className: 'ready' }, [
    card(TEXT.loadQuestion, [
      h(
        'div',
        { className: 'choices choices--3' },
        loadChoices.map(({ choice }) => choice.button),
      ),
    ]),
    card(TEXT.washTypeQuestion, [
      h('div', { className: 'choices choices--2' }, [normal.button, quick.button]),
    ]),
    card(TEXT.cyclesQuestion, [
      h(
        'div',
        { className: 'choices choices--5' },
        cycleChoices.map(choice => choice.button),
      ),
    ]),
  ]);

  return {
    element,
    update: model => {
      setVisible(element, model.screen === 'ready');
      loadChoices.forEach(({ choice, level }) => {
        choice.button.disabled = !model.connected;
        setPressed(choice.button, level === model.waterLevel);
      });
      setPressed(normal.button, model.washType === 'normal');
      setPressed(quick.button, model.washType === 'quick');
      normal.setSubtitle(model.normalSubtitle);
      quick.setSubtitle(model.quickSubtitle);
      cycleChoices.forEach((choice, index) => {
        choice.button.disabled = !model.connected;
        setPressed(choice.button, index + 1 === model.cycles);
      });
    },
  };
}
```

`src/ui/screens/washing-screen.ts`:
```ts
import { TEXT } from '../../copy';
import type { View } from '../actions';
import { h, setChildren, setVisible } from '../dom';

export function createWashingScreen(): View {
  const icon = h('span', { attrs: { 'aria-hidden': 'true' }, className: 'icon' });
  const stage = h('div', { className: 'stage' });
  const cycle = h('div', { className: 'cycle' });
  const timeline = h('ol', { attrs: { 'aria-label': TEXT.timelineLabel }, className: 'timeline' });
  const finishTime = h('b');
  const remaining = h('span');
  const progress = h('i');
  const element = h('div', { attrs: { 'aria-live': 'polite' }, className: 'card now' }, [
    icon,
    stage,
    cycle,
    timeline,
    h('div', { className: 'finish' }, [h('span', { text: TEXT.finishesAt }), finishTime, remaining]),
    h('div', { className: 'progress' }, [progress]),
  ]);

  return {
    element,
    update: model => {
      setVisible(element, model.screen === 'washing');
      icon.textContent = model.stage.icon;
      stage.textContent = model.stage.title;
      cycle.textContent = model.cycleText;
      setChildren(
        timeline,
        model.timeline.map(step => h('li', { className: step.state, text: step.label })),
      );
      finishTime.textContent = model.finishTime;
      remaining.textContent = model.remainingText;
      progress.style.width = `${model.progressPercent}%`;
    },
  };
}
```

`src/ui/screens/settings-screen.ts`:
```ts
import { RELAY_COPY, TEXT } from '../../copy';
import { Entity, RELAYS } from '../../domain/entities';
import { MIN_MINUTES, normalizeMinutes } from '../../domain/time';
import type { Actions, View } from '../actions';
import { card } from '../components/card';
import { button, h, setPressed, setVisible } from '../dom';
import type { ViewModel } from '../view-model';

/** The water valve shuts itself after 10 min (water_valve_limit in the firmware). */
const FILL_MAX_MINUTES = 10;
const DEFAULT_MAX_MINUTES = 30;

interface MinutesFieldSpec {
  key: string;
  label: string;
  max: number;
}

interface FieldGroup {
  fields: readonly MinutesFieldSpec[];
  title: string;
}

const FIELD_GROUPS: readonly FieldGroup[] = [
  {
    fields: [
      { key: Entity.fillMinutes.Low, label: TEXT.loadLowLabel, max: FILL_MAX_MINUTES },
      { key: Entity.fillMinutes.Medium, label: TEXT.loadMediumLabel, max: FILL_MAX_MINUTES },
      { key: Entity.fillMinutes.High, label: TEXT.loadHighLabel, max: FILL_MAX_MINUTES },
    ],
    title: TEXT.fillTitle,
  },
  {
    fields: [
      { key: Entity.drainMinutes.Low, label: TEXT.loadLowLabel, max: DEFAULT_MAX_MINUTES },
      { key: Entity.drainMinutes.Medium, label: TEXT.loadMediumLabel, max: DEFAULT_MAX_MINUTES },
      { key: Entity.drainMinutes.High, label: TEXT.loadHighLabel, max: DEFAULT_MAX_MINUTES },
    ],
    title: TEXT.drainTitle,
  },
  {
    fields: [
      { key: Entity.mixMinutes, label: TEXT.mixLabel, max: DEFAULT_MAX_MINUTES },
      { key: Entity.soakMinutes, label: TEXT.soakLabel, max: DEFAULT_MAX_MINUTES },
      { key: Entity.washMinutes, label: TEXT.washLabel, max: DEFAULT_MAX_MINUTES },
    ],
    title: TEXT.otherStagesTitle,
  },
];

function createMinutesField(spec: MinutesFieldSpec, actions: Actions): View {
  const input = h('input', {
    attrs: {
      inputmode: 'decimal',
      max: String(spec.max),
      min: String(MIN_MINUTES),
      step: '0.5',
      type: 'number',
    },
  });

  input.addEventListener('change', () => {
    const minutes = normalizeMinutes(input.value, spec.max);

    if (minutes !== null) {
      actions.setMinutes(spec.key, minutes);
    }
  });

  return {
    element: h('label', { className: 'field' }, [h('span', { text: spec.label }), input]),
    update: (model: ViewModel) => {
      const value = model.minuteSettings[spec.key];

      input.disabled = !model.connected;

      // Do not overwrite what the person is typing.
      if (document.activeElement !== input && value !== undefined) {
        input.value = String(value);
      }
    },
  };
}

export function createSettingsScreen(actions: Actions): View {
  const groups = FIELD_GROUPS.map(group => ({
    fields: group.fields.map(spec => createMinutesField(spec, actions)),
    title: group.title,
  }));
  const relayButtons = RELAYS.map(key =>
    button(RELAY_COPY[key].label, undefined, () => actions.toggleRelay(key)),
  );
  const manualNote = h('p', { className: 'note' });
  const element = h('div', { className: 'settings' }, [
    ...groups.map(group =>
      card(
        group.title,
        group.fields.map(field => field.element),
      ),
    ),
    card(TEXT.manualTitle, [manualNote, h('div', { className: 'relays' }, relayButtons)]),
  ]);

  return {
    element,
    update: model => {
      setVisible(element, model.screen === 'settings');
      groups.forEach(group => group.fields.forEach(field => field.update(model)));
      model.relays.forEach((relay, index) => {
        relayButtons[index].disabled = !model.connected || model.running;
        setPressed(relayButtons[index], relay.on);
      });
      manualNote.textContent = model.manualNote;
    },
  };
}
```

`src/ui/screens/footer.ts`:
```ts
import { TEXT } from '../../copy';
import type { Actions, View } from '../actions';
import { button, h, setVisible } from '../dom';

export function createFooter(actions: Actions): View {
  const element = h('div', { className: 'footer' }, [
    button(TEXT.settings, undefined, actions.openSettings),
    button(TEXT.advanced, undefined, actions.openAdvanced),
  ]);

  return {
    element,
    update: model => setVisible(element, model.screen === 'ready'),
  };
}
```

`src/ui/screens/action-bar.ts`:
```ts
import { TEXT } from '../../copy';
import type { Actions, View } from '../actions';
import { button, h, setVisible } from '../dom';

/** Sticky main action: start on the ready screen, stop while washing. */
export function createActionBar(actions: Actions): View {
  const startSubtitle = h('small');
  const start = h(
    'button',
    { attrs: { type: 'button' }, className: 'start', onClick: actions.start },
    [h('span', { text: TEXT.start }), startSubtitle],
  );
  const stop = button(TEXT.stopWash, 'stop', actions.requestStop);
  const element = h('div', { className: 'action-bar' }, [start, stop]);

  return {
    element,
    update: model => {
      setVisible(element, model.screen !== 'settings');
      setVisible(start, model.screen === 'ready');
      setVisible(stop, model.screen === 'washing');
      start.disabled = !model.connected;
      startSubtitle.textContent = model.startSubtitle;
    },
  };
}
```

- [ ] **Step 6: Implement `src/ui/app.ts` and `src/main.ts`**

`src/ui/app.ts`:
```ts
import { TEXT } from '../copy';
import { Entity, isOn, readText } from '../domain/entities';
import { parseHms } from '../domain/time';
import type { StateStore } from '../device/store';
import type { Actions, CommandSender, View } from './actions';
import { createConfirmSheet } from './components/confirm-sheet';
import { h } from './dom';
import type { Preferences } from './preferences';
import { createActionBar } from './screens/action-bar';
import { createFooter } from './screens/footer';
import { createHeader } from './screens/header';
import { createManualAlert } from './screens/manual-alert';
import { createOutcomeCard } from './screens/outcome-card';
import { createReadyScreen } from './screens/ready-screen';
import { createSettingsScreen } from './screens/settings-screen';
import { createWashingScreen } from './screens/washing-screen';
import { WashSession } from './session';
import type { RequestedScreen } from './view-model';
import { buildViewModel } from './view-model';

const COMPLETED_VIBRATION = [300, 150, 300];

export interface AppEnvironment {
  commands: CommandSender;
  now(): number;
  openAdvanced(): void;
  preferences: Preferences;
  scrollToTop(): void;
  store: StateStore;
  vibrate(pattern: number[]): void;
}

export interface App {
  element: HTMLElement;
  /** Fixed-position layers that must be appended to <body> next to the app. */
  overlays: HTMLElement[];
  render(): void;
}

export function createApp(environment: AppEnvironment): App {
  const { commands, preferences, store } = environment;
  const session = new WashSession();
  const sheet = createConfirmSheet();
  let requestedScreen: RequestedScreen = 'ready';
  let selectedWashType = preferences.loadWashType();

  const stopAll = () => {
    if (isOn(store.states, Entity.running)) {
      session.markStoppedByUser();
    }

    commands.send(Entity.stopAll, 'press');
  };

  const actions: Actions = {
    dismissOutcome: () => {
      session.dismissOutcome();
      render();
    },
    openAdvanced: () => environment.openAdvanced(),
    openSettings: () => navigate('settings'),
    requestPowerOff: () =>
      sheet.open({
        confirmLabel: TEXT.powerOffConfirm,
        message: TEXT.powerOffMessage,
        onConfirm: stopAll,
        title: TEXT.powerOffTitle,
      }),
    requestStop: () =>
      sheet.open({
        confirmLabel: TEXT.stopConfirm,
        message: TEXT.stopMessage,
        onConfirm: stopAll,
        title: TEXT.stopTitle,
      }),
    selectCycles: count => commands.send(Entity.cycles, 'set', { value: count }),
    selectWashType: washType => {
      selectedWashType = washType;
      render();
    },
    selectWaterLevel: level => commands.send(Entity.waterLevel, 'set', { option: level }),
    setMinutes: (key, minutes) => commands.send(key, 'set', { value: minutes }),
    showReady: () => navigate('ready'),
    start: () => {
      session.markStarted();
      preferences.saveWashType(selectedWashType);
      commands.send(
        selectedWashType === 'quick' ? Entity.startQuickCycle : Entity.startFullCycle,
        'press',
      );
    },
    stopNow: stopAll,
    toggleRelay: key => commands.send(key, 'toggle'),
  };

  const views: View[] = [
    createHeader(actions),
    createManualAlert(actions),
    createOutcomeCard(actions),
    createReadyScreen(actions),
    createWashingScreen(),
    createSettingsScreen(actions),
    createFooter(actions),
    createActionBar(actions),
  ];
  const element = h(
    'div',
    { attrs: { id: 'tq' } },
    views.map(view => view.element),
  );

  function render(): void {
    const { states } = store;
    const running = states[Entity.running];
    const finished = session.observe(
      typeof running === 'boolean' ? running : undefined,
      parseHms(readText(states, Entity.timeRemaining)),
    );

    if (finished === 'completed') {
      environment.vibrate(COMPLETED_VIBRATION);
    }

    const model = buildViewModel({
      connected: store.isConnected,
      nowMs: environment.now(),
      outcome: session.outcome,
      requestedScreen,
      roundTotalSeconds: session.roundTotalSeconds,
      runningWashType: preferences.loadWashType(),
      selectedWashType,
      states,
    });

    element.classList.toggle('offline', !model.connected);
    views.forEach(view => view.update(model));
  }

  function navigate(screen: RequestedScreen): void {
    requestedScreen = screen;
    render();
    environment.scrollToTop();
  }

  return { element, overlays: [sheet.element], render };
}
```

`src/main.ts`:
```ts
import { TEXT } from './copy';
import { DeviceClient } from './device/client';
import { StateStore } from './device/store';
import { createApp } from './ui/app';
import { createToast } from './ui/components/toast';
import { button, h } from './ui/dom';
import { createLocalPreferences } from './ui/preferences';
import { createFrameScheduler } from './ui/scheduler';
import { SIMPLE_MODE_CLASS, STYLES } from './ui/styles';

/** ESPHome's default interface, loaded only when the person taps "Avançado". */
const ADVANCED_UI_URL = 'https://oi.esphome.io/v2/www.js';
/** The finish time moves with the clock even without new events. */
const CLOCK_REFRESH_MS = 30_000;

const META_TAGS: Readonly<Record<string, string>> = {
  'apple-mobile-web-app-capable': 'yes',
  'apple-mobile-web-app-title': TEXT.documentTitle,
  'theme-color': '#1565d8',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
};

function addMetaTags(): void {
  Object.entries(META_TAGS).forEach(([name, content]) => {
    if (!document.querySelector(`meta[name="${name}"]`)) {
      document.head.append(h('meta', { attrs: { content, name } }));
    }
  });
}

function createAdvancedLoader(): () => void {
  let loaded = false;

  return () => {
    if (!loaded) {
      loaded = true;
      document.body.append(h('script', { attrs: { src: ADVANCED_UI_URL } }));
    }

    document.body.classList.remove(SIMPLE_MODE_CLASS);
  };
}

function main(): void {
  addMetaTags();
  document.title = TEXT.documentTitle;
  document.head.append(h('style', { text: STYLES }));

  const store = new StateStore();
  const toast = createToast();
  const client = new DeviceClient(store, () => toast.show(TEXT.commandFailed));
  const app = createApp({
    commands: client,
    now: () => Date.now(),
    openAdvanced: createAdvancedLoader(),
    preferences: createLocalPreferences(),
    scrollToTop: () => window.scrollTo(0, 0),
    store,
    vibrate: pattern => {
      navigator.vibrate?.(pattern);
    },
  });
  const backToSimple = button(TEXT.backToSimple, undefined, () =>
    document.body.classList.add(SIMPLE_MODE_CLASS),
  );

  backToSimple.id = 'tq-simple';
  document.body.classList.add(SIMPLE_MODE_CLASS);
  document.body.prepend(app.element);
  document.body.append(...app.overlays, toast.element, backToSimple);

  const scheduleRender = createFrameScheduler(app.render);

  store.subscribe(scheduleRender);
  client.connect();
  window.setInterval(scheduleRender, CLOCK_REFRESH_MS);
  app.render();
}

main();
```

- [ ] **Step 7: Run tests, toolchain and bundle**

Run:
```bash
export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH
npx jest && npm run typecheck && npm run lint -- --fix && npm run format && npm run lint && npm run build:ui && wc -c dist/ui.js
```
Expected: every Jest suite PASS (including the 7 app tests), typecheck and lint exit 0, `dist/ui.js` created and ≤ 40960 bytes. Fix lint findings by changing code, never by disabling rules, except a single `// eslint-disable-next-line` with a reason if a rule is impossible to satisfy.

- [ ] **Step 8: Commit**

```bash
git add src test
git commit -m "feat(tanquinho): phone UI views and app in TypeScript

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Firmware in English, wired to the TS bundle

**Files:**
- Modify: `tanquinho.yaml` (full rewrite below), `package.json` (add `build` and `flash` scripts)
- Delete: `tanquinho-ui.js`, `test/ui-logic.test.js`, `dev/mock_server.py`

**Interfaces:**
- Consumes: entity names from `src/domain/entities.ts` (Task 2) — the YAML names below must match them exactly.
- Produces: firmware entities named as in the spec table; `js_include: dist/ui.js`; npm scripts `build` and `flash`.

- [ ] **Step 1: Replace `tanquinho.yaml` with the English version**

```yaml
esphome:
  name: tanquinho
  friendly_name: Tanquinho
  on_boot:
    priority: -100
    then:
      # A reboot in the middle of a wash counts as an interrupted wash.
      - lambda: |-
          if (id(h_running)) {
            id(h_interrupted) += 1;
            id(h_interrupted_stage) = id(h_stage);
            id(h_interrupted_cycle) = id(h_cycle);
            id(h_running) = false;
          }
      - script.execute: state_off

esp32:
  board: esp32dev
  framework:
    type: arduino

logger:

api:
  # No Home Assistant here: never reboot for lack of API clients.
  reboot_timeout: 0s
  encryption:
    key: !secret api_key

ota:
  - platform: esphome
    password: !secret ota_password

wifi:
  reboot_timeout: 0s
  # Keep the radio awake between packets: much lower latency on a weak signal.
  power_save_mode: none
  ssid: !secret wifi_ssid
  password: !secret wifi_password
  ap:
    ssid: "Tanquinho Fallback"
    password: !secret ap_password

captive_portal:

# Diagnostics shown in the Advanced UI: last reset reason and Wi-Fi signal.
debug:
  update_interval: 60s

sensor:
  - platform: wifi_signal
    name: "Wi-Fi Signal"
    update_interval: 60s
    entity_category: diagnostic

web_server:
  # Phone UI built from src/ by `npm run build:ui`; served as /0.js.
  js_include: dist/ui.js
  js_url: ""
  # No firmware upload from the browser (/update has no password); only password-protected OTA.
  ota: false

preferences:
  flash_write_interval: 10s

globals:
  # Wash history: survives reboots (shown in the Advanced UI).
  - id: h_started
    type: int
    restore_value: yes
    initial_value: '0'
  - id: h_completed
    type: int
    restore_value: yes
    initial_value: '0'
  - id: h_stopped
    type: int
    restore_value: yes
    initial_value: '0'
  - id: h_interrupted
    type: int
    restore_value: yes
    initial_value: '0'
  - id: h_running
    type: bool
    restore_value: yes
    initial_value: 'false'
  # Current stage: 1 Filling, 2 Mixing, 3 Soaking, 4 Washing, 5 Draining.
  - id: h_stage
    type: int
    restore_value: yes
    initial_value: '0'
  - id: h_cycle
    type: int
    restore_value: yes
    initial_value: '0'
  - id: h_interrupted_stage
    type: int
    restore_value: yes
    initial_value: '0'
  - id: h_interrupted_cycle
    type: int
    restore_value: yes
    initial_value: '0'
  - id: cycle_active
    type: bool
    restore_value: no
    initial_value: 'false'
  - id: start_time
    type: int
    restore_value: no
    initial_value: '0'
  - id: total_time
    type: int
    restore_value: no
    initial_value: '0'
  - id: fill_ms
    type: int
    restore_value: no
    initial_value: '0'
  - id: mix_ms
    type: int
    restore_value: no
    initial_value: '0'
  - id: soak_ms
    type: int
    restore_value: no
    initial_value: '0'
  - id: wash_ms
    type: int
    restore_value: no
    initial_value: '0'
  - id: drain_ms
    type: int
    restore_value: no
    initial_value: '0'
  - id: current_cycle
    type: int
    restore_value: no
    initial_value: '0'
  - id: total_cycles
    type: int
    restore_value: no
    initial_value: '0'

select:
  - platform: template
    name: "Water Level"
    id: water_level
    icon: mdi:waves-arrow-up
    options:
      - "Low"
      - "Medium"
      - "High"
    initial_option: "Medium"
    optimistic: true
    restore_value: true

number:
  # Fill times stop at 10 min, the same limit as water_valve_limit.
  - platform: template
    optimistic: true
    name: "Fill Low (min)"
    id: fill_low
    min_value: 0.5
    max_value: 10
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:water-plus
    entity_category: config
    initial_value: 2.5
    restore_value: true

  - platform: template
    optimistic: true
    name: "Fill Medium (min)"
    id: fill_medium
    min_value: 0.5
    max_value: 10
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:water-plus
    entity_category: config
    initial_value: 3.5
    restore_value: true

  - platform: template
    optimistic: true
    name: "Fill High (min)"
    id: fill_high
    min_value: 0.5
    max_value: 10
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:water-plus
    entity_category: config
    initial_value: 5
    restore_value: true

  - platform: template
    optimistic: true
    name: "Drain Low (min)"
    id: drain_low
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:water-minus
    entity_category: config
    initial_value: 3
    restore_value: true

  - platform: template
    optimistic: true
    name: "Drain Medium (min)"
    id: drain_medium
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:water-minus
    entity_category: config
    initial_value: 4
    restore_value: true

  - platform: template
    optimistic: true
    name: "Drain High (min)"
    id: drain_high
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:water-minus
    entity_category: config
    initial_value: 5.5
    restore_value: true

  - platform: template
    optimistic: true
    name: "Mix Time (min)"
    id: mix_time
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:rotate-right
    entity_category: config
    initial_value: 0.5
    restore_value: true

  - platform: template
    optimistic: true
    name: "Soak Time (min)"
    id: soak_time
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:waves
    entity_category: config
    initial_value: 5
    restore_value: true

  - platform: template
    optimistic: true
    name: "Wash Time (min)"
    id: wash_time
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:rotate-3d
    entity_category: config
    initial_value: 15
    restore_value: true

  - platform: template
    optimistic: true
    name: "Cycles"
    id: cycle_count
    min_value: 1
    max_value: 5
    step: 1
    icon: mdi:rotate-3d-variant
    entity_category: config
    initial_value: 1
    restore_value: true

# Relay module is active-low. Interlocks: water and pump never together; motor and pump never together.
switch:
  - platform: gpio
    name: "Water Valve"
    pin:
      number: GPIO12
      inverted: true
    id: water_valve
    icon: mdi:water-plus
    restore_mode: ALWAYS_OFF
    on_turn_on:
      - switch.turn_off: drain_pump
      - script.execute: water_valve_limit
    on_turn_off:
      - script.stop: water_valve_limit

  - platform: gpio
    name: "Motor"
    pin:
      number: GPIO27
      inverted: true
    id: motor
    icon: mdi:engine
    restore_mode: ALWAYS_OFF
    on_turn_on:
      - switch.turn_off: drain_pump

  - platform: gpio
    name: "Drain Pump"
    pin:
      number: GPIO14
      inverted: true
    id: drain_pump
    icon: mdi:water-minus
    restore_mode: ALWAYS_OFF
    on_turn_on:
      - switch.turn_off: water_valve
      - switch.turn_off: motor

  - platform: gpio
    name: "Auxiliary"
    pin:
      number: GPIO26
      inverted: true
    id: auxiliary
    restore_mode: ALWAYS_OFF

button:
  - platform: template
    name: "Start Full Cycle"
    icon: mdi:play-circle
    on_press:
      - if:
          condition:
            lambda: 'return !id(cycle_active);'
          then:
            - script.execute: full_cycle

  - platform: template
    name: "Start Quick Cycle"
    icon: mdi:play-speed
    on_press:
      - if:
          condition:
            lambda: 'return !id(cycle_active);'
          then:
            - script.execute: quick_cycle

  - platform: template
    name: "Stop All"
    icon: mdi:stop-circle
    on_press:
      - lambda: |-
          if (id(cycle_active)) {
            id(h_stopped) += 1;
            id(h_running) = false;
          }
      - script.execute: state_off

binary_sensor:
  - platform: template
    name: "Running"
    id: running_sensor
    icon: mdi:washing-machine
    lambda: 'return id(cycle_active);'

text_sensor:
  - platform: template
    name: "Wash History"
    entity_category: diagnostic
    icon: mdi:history
    update_interval: 15s
    lambda: |-
      static const char *stage_names[] = {"start", "Filling", "Mixing", "Soaking", "Washing", "Draining"};
      std::string text = "Started " + std::to_string(id(h_started)) +
                         " | Completed " + std::to_string(id(h_completed)) +
                         " | Stopped " + std::to_string(id(h_stopped)) +
                         " | Interrupted " + std::to_string(id(h_interrupted));
      if (id(h_interrupted) > 0) {
        int stage = id(h_interrupted_stage);
        if (stage < 0 || stage > 5) stage = 0;
        text += " (last at " + std::string(stage_names[stage]) + ", cycle " +
                std::to_string(id(h_interrupted_cycle)) + ")";
      }
      return text;
  - platform: debug
    reset_reason:
      name: "Reset Reason"
      entity_category: diagnostic
  - platform: template
    name: "Stage"
    id: stage_sensor
    icon: mdi:information
    lambda: 'return {"Off"};'
    update_interval: never

  - platform: template
    name: "Time Remaining"
    id: time_remaining
    icon: mdi:timer
    lambda: 'return {"00:00:00"};'
    update_interval: never

  # "current/total" while a wash runs, empty otherwise.
  - platform: template
    name: "Cycle Progress"
    id: cycle_progress
    icon: mdi:counter
    lambda: 'return {""};'
    update_interval: never

script:
  # A water valve left on closes by itself after 10 min.
  - id: water_valve_limit
    mode: restart
    then:
      - delay: 10min
      - switch.turn_off: water_valve

  - id: state_off
    then:
      - script.stop: full_cycle
      - script.stop: quick_cycle
      - script.stop: run_cycles
      - switch.turn_off: water_valve
      - switch.turn_off: motor
      - switch.turn_off: drain_pump
      - switch.turn_off: auxiliary
      - globals.set:
          id: cycle_active
          value: 'false'
      - globals.set:
          id: start_time
          value: '0'
      - globals.set:
          id: total_time
          value: '0'
      - globals.set:
          id: current_cycle
          value: '0'
      - text_sensor.template.publish:
          id: stage_sensor
          state: "Off"
      - text_sensor.template.publish:
          id: time_remaining
          state: "00:00:00"
      - text_sensor.template.publish:
          id: cycle_progress
          state: ""

  - id: state_filling
    then:
      - switch.turn_off: motor
      - switch.turn_off: drain_pump
      - switch.turn_on: water_valve
      - text_sensor.template.publish:
          id: stage_sensor
          state: "Filling"
      - lambda: |-
          id(h_stage) = 1;
          id(h_cycle) = id(current_cycle);

  - id: state_mixing
    then:
      - switch.turn_off: water_valve
      - switch.turn_off: drain_pump
      - switch.turn_on: motor
      - text_sensor.template.publish:
          id: stage_sensor
          state: "Mixing"
      - lambda: |-
          id(h_stage) = 2;
          id(h_cycle) = id(current_cycle);

  - id: state_soaking
    then:
      - switch.turn_off: water_valve
      - switch.turn_off: motor
      - switch.turn_off: drain_pump
      - text_sensor.template.publish:
          id: stage_sensor
          state: "Soaking"
      - lambda: |-
          id(h_stage) = 3;
          id(h_cycle) = id(current_cycle);

  - id: state_washing
    then:
      - switch.turn_off: water_valve
      - switch.turn_off: drain_pump
      - switch.turn_on: motor
      - text_sensor.template.publish:
          id: stage_sensor
          state: "Washing"
      - lambda: |-
          id(h_stage) = 4;
          id(h_cycle) = id(current_cycle);

  - id: state_draining
    then:
      - switch.turn_off: water_valve
      - switch.turn_off: motor
      - switch.turn_on: drain_pump
      - text_sensor.template.publish:
          id: stage_sensor
          state: "Draining"
      - lambda: |-
          id(h_stage) = 5;
          id(h_cycle) = id(current_cycle);

  # Freezes the active level's times for the wash about to start.
  - id: prepare_cycle
    parameters:
      quick: bool
    then:
      - lambda: |-
          auto index = id(water_level).active_index();
          size_t level = index.has_value() ? *index : 1;
          float fill_minutes[] = {id(fill_low).state, id(fill_medium).state, id(fill_high).state};
          float drain_minutes[] = {id(drain_low).state, id(drain_medium).state, id(drain_high).state};
          float factor = quick ? 0.5f : 1.0f;

          id(fill_ms) = (int) (fill_minutes[level] * 60000);
          id(drain_ms) = (int) (drain_minutes[level] * 60000);
          id(mix_ms) = (int) (id(mix_time).state * 60000 * factor);
          id(wash_ms) = (int) (id(wash_time).state * 60000 * factor);
          id(soak_ms) = quick ? 0 : (int) (id(soak_time).state * 60000);

          id(total_cycles) = (int) id(cycle_count).state;
          id(current_cycle) = 0;
          int cycle_ms = id(fill_ms) + id(mix_ms) + id(soak_ms) + id(wash_ms) + id(drain_ms);
          id(total_time) = (cycle_ms / 1000) * id(total_cycles);
          id(start_time) = millis();
          id(cycle_active) = true;
          id(h_started) += 1;
          id(h_running) = true;
          id(h_stage) = 0;
          id(h_cycle) = 0;

  - id: run_cycles
    then:
      - repeat:
          count: !lambda 'return id(total_cycles);'
          then:
            - lambda: |-
                id(current_cycle) += 1;
                id(cycle_progress).publish_state(
                  std::to_string(id(current_cycle)) + "/" + std::to_string(id(total_cycles)));
            - script.execute: state_filling
            - delay: !lambda 'return id(fill_ms);'
            - script.execute: state_mixing
            - delay: !lambda 'return id(mix_ms);'
            - if:
                condition:
                  lambda: 'return id(soak_ms) > 0;'
                then:
                  - script.execute: state_soaking
                  - delay: !lambda 'return id(soak_ms);'
            - script.execute: state_washing
            - delay: !lambda 'return id(wash_ms);'
            - script.execute: state_draining
            - delay: !lambda 'return id(drain_ms);'
      - lambda: |-
          id(h_completed) += 1;
          id(h_running) = false;
      - script.execute: state_off

  - id: full_cycle
    then:
      - script.execute:
          id: prepare_cycle
          quick: false
      - script.execute: run_cycles

  - id: quick_cycle
    then:
      - script.execute:
          id: prepare_cycle
          quick: true
      - script.execute: run_cycles

interval:
  - interval: 1s
    then:
      - lambda: |-
          if (id(cycle_active)) {
            int elapsed = (millis() - id(start_time)) / 1000;
            int remaining = id(total_time) - elapsed;
            if (remaining < 0) remaining = 0;

            int hours = remaining / 3600;
            int minutes = (remaining % 3600) / 60;
            int seconds = remaining % 60;

            std::string text =
              std::to_string(hours) + ":" +
              (minutes < 10 ? "0" : "") + std::to_string(minutes) + ":" +
              (seconds < 10 ? "0" : "") + std::to_string(seconds);

            id(time_remaining).publish_state(text);
          }
```

- [ ] **Step 2: Add `build` and `flash` scripts to `package.json`**

Inside `"scripts"`, add:
```json
"build": "npm run typecheck && npm run build:ui && esphome compile tanquinho.yaml",
"flash": "npm run build && esphome upload tanquinho.yaml --device ${TANQUINHO_HOST:-tanquinho.local}",
```

- [ ] **Step 3: Delete the old JavaScript UI, test and Python mock**

```bash
git rm tanquinho-ui.js test/ui-logic.test.js dev/mock_server.py
```

- [ ] **Step 4: Validate and compile the firmware**

Run:
```bash
export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH
npm run build:ui && esphome config tanquinho.yaml > /dev/null && echo CONFIG_OK && npm run build 2>&1 | tail -3
```
Expected: `CONFIG_OK`, then `INFO Successfully compiled program.` (first compile can take ~5 min; run with a 600 s timeout). The local `secrets.yaml` already exists; never print it.

- [ ] **Step 5: Check that every entity key in TS exists in the YAML**

Run:
```bash
grep -oE "'(select|number|switch|button|binary_sensor|text_sensor)/[^']+'" src/domain/entities.ts | tr -d "'" | cut -d/ -f2- | while read -r name; do grep -q "name: \"$name\"" tanquinho.yaml && echo "ok   $name" || echo "MISSING $name"; done
```
Expected: only `ok` lines.

- [ ] **Step 6: Commit**

```bash
git add tanquinho.yaml package.json
git commit -m "refactor(tanquinho): firmware in English, served UI built from TypeScript

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Mock server in TypeScript and `npm run dev`

**Files:**
- Create: `dev/mock-server.ts`
- Modify: `package.json` (add `dev` script)

**Interfaces:**
- Consumes: `dist/ui.js` from `build:ui`; entity names from Task 6.
- Produces: `npm run dev` → esbuild watch + mock server at `http://localhost:8099`.

- [ ] **Step 1: Write `dev/mock-server.ts`**

```ts
/**
 * Fake Tanquinho web_server (/, /0.js, /events and REST) to try the phone UI without the ESP.
 * Usage: npm run dev   (or: npx tsx dev/mock-server.ts [port], default 8099)
 * A simulated wash advances 30 s of "time remaining" per real second.
 */
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import path from 'node:path';

type Value = boolean | number | string;

const PORT = Number(process.argv[2] ?? 8099);
const UI_BUNDLE = path.resolve(__dirname, '../dist/ui.js');
const SIMULATED_SECONDS_PER_TICK = 30;
const TICKS_PER_STAGE = 4;
const STAGES = ['Filling', 'Mixing', 'Soaking', 'Washing', 'Draining'];
const RELAYS = ['switch/Water Valve', 'switch/Motor', 'switch/Drain Pump', 'switch/Auxiliary'];
const INDEX_HTML =
  '<!DOCTYPE html><html><head><meta charset=UTF-8><link rel=icon href=data:></head>' +
  '<body><esp-app><h1>ESPHome default UI (mock)</h1></esp-app>' +
  '<script type=module src=/0.js></script></body></html>';

const states = new Map<string, Value>([
  ['select/Water Level', 'Medium'],
  ['number/Cycles', 1],
  ['number/Fill Low (min)', 2.5],
  ['number/Fill Medium (min)', 3.5],
  ['number/Fill High (min)', 5],
  ['number/Drain Low (min)', 3],
  ['number/Drain Medium (min)', 4],
  ['number/Drain High (min)', 5.5],
  ['number/Mix Time (min)', 0.5],
  ['number/Soak Time (min)', 5],
  ['number/Wash Time (min)', 15],
  ['text_sensor/Stage', 'Off'],
  ['text_sensor/Time Remaining', '00:00:00'],
  ['text_sensor/Cycle Progress', ''],
  ['binary_sensor/Running', false],
  ...RELAYS.map((relay): [string, Value] => [relay, false]),
]);
const clients = new Set<ServerResponse>();
const wash = { remainingSeconds: 0, ticks: 0 };

function eventPayload(key: string): string {
  const separator = key.indexOf('/');
  const domain = key.slice(0, separator);
  const name = key.slice(separator + 1);
  const value = states.get(key) ?? '';
  const base = { domain, id: `${domain}-${name.toLowerCase()}`, name, name_id: key };

  if (typeof value === 'number') {
    return JSON.stringify({ ...base, state: String(value), value: String(value) });
  }

  if (typeof value === 'boolean') {
    return JSON.stringify({ ...base, state: value ? 'ON' : 'OFF', value });
  }

  return JSON.stringify({ ...base, state: value, value });
}

function publish(key: string, value: Value): void {
  states.set(key, value);
  const message = `event: state\ndata: ${eventPayload(key)}\n\n`;

  clients.forEach(client => client.write(message));
}

const pad = (value: number) => String(value).padStart(2, '0');

function hms(seconds: number): string {
  return `${Math.floor(seconds / 3600)}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

function minutes(key: string): number {
  const value = states.get(key);

  return typeof value === 'number' ? value : 0;
}

function startWash(quick: boolean): void {
  if (states.get('binary_sensor/Running') === true) {
    return;
  }

  const level = String(states.get('select/Water Level'));
  const factor = quick ? 0.5 : 1;
  const cycles = minutes('number/Cycles');
  const perCycle =
    minutes(`number/Fill ${level} (min)`) +
    minutes(`number/Drain ${level} (min)`) +
    (minutes('number/Mix Time (min)') + minutes('number/Wash Time (min)')) * factor +
    (quick ? 0 : minutes('number/Soak Time (min)'));

  wash.remainingSeconds = Math.round(perCycle * 60) * cycles;
  wash.ticks = 0;
  publish('binary_sensor/Running', true);
  publish('text_sensor/Cycle Progress', `1/${cycles}`);
  publish('text_sensor/Stage', 'Filling');
}

/** Same as the firmware's state_off: every relay off. */
function stopAll(): void {
  wash.remainingSeconds = 0;
  RELAYS.forEach(relay => publish(relay, false));
  publish('binary_sensor/Running', false);
  publish('text_sensor/Stage', 'Off');
  publish('text_sensor/Time Remaining', '00:00:00');
  publish('text_sensor/Cycle Progress', '');
}

function tick(): void {
  if (states.get('binary_sensor/Running') !== true) {
    return;
  }

  wash.remainingSeconds = Math.max(0, wash.remainingSeconds - SIMULATED_SECONDS_PER_TICK);
  wash.ticks += 1;
  publish('text_sensor/Time Remaining', hms(wash.remainingSeconds));

  if (wash.ticks % TICKS_PER_STAGE === 0) {
    const current = STAGES.indexOf(String(states.get('text_sensor/Stage')));

    publish('text_sensor/Stage', STAGES[(current + 1) % STAGES.length]);
  }

  if (wash.remainingSeconds === 0) {
    stopAll();
  }
}

function send(response: ServerResponse, status: number, body = '', contentType = 'text/plain'): void {
  response.writeHead(status, { 'Content-Length': Buffer.byteLength(body), 'Content-Type': contentType });
  response.end(body);
}

function streamEvents(response: ServerResponse): void {
  response.writeHead(200, { 'Cache-Control': 'no-cache', 'Content-Type': 'text/event-stream' });
  response.write('event: ping\ndata: {"title":"Tanquinho"}\n\n');
  states.forEach((_value, key) => response.write(`event: state\ndata: ${eventPayload(key)}\n\n`));
  clients.add(response);
  response.on('close', () => clients.delete(response));
}

const BUTTONS: Readonly<Record<string, () => void>> = {
  'Start Full Cycle': () => startWash(false),
  'Start Quick Cycle': () => startWash(true),
  'Stop All': stopAll,
};

function applyCommand(domain: string, name: string, action: string, query: URLSearchParams): boolean {
  const key = `${domain}/${name}`;

  if (domain === 'button' && action === 'press') {
    BUTTONS[name]?.();

    return true;
  }

  if (!states.has(key)) {
    return false;
  }

  if (domain === 'number' && action === 'set') {
    publish(key, Number(query.get('value')));
  } else if (domain === 'select' && action === 'set') {
    publish(key, query.get('option') ?? '');
  } else if (domain === 'switch' && ['toggle', 'turn_off', 'turn_on'].includes(action)) {
    publish(key, action === 'toggle' ? states.get(key) !== true : action === 'turn_on');
  } else {
    return false;
  }

  return true;
}

function handle(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);

  if (request.method === 'GET' && url.pathname === '/') {
    send(response, 200, INDEX_HTML, 'text/html; charset=utf-8');
  } else if (request.method === 'GET' && url.pathname === '/0.js') {
    send(response, 200, readFileSync(UI_BUNDLE, 'utf8'), 'text/javascript; charset=utf-8');
  } else if (request.method === 'GET' && url.pathname === '/events') {
    streamEvents(response);
  } else if (request.method === 'POST') {
    const [domain = '', name = '', action = ''] = url.pathname.slice(1).split('/');
    const ok = applyCommand(domain, decodeURIComponent(name), action, url.searchParams);

    send(response, ok ? 200 : 404);
  } else {
    send(response, 404);
  }
}

setInterval(tick, 1000);
createServer(handle).listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`Tanquinho mock at http://localhost:${PORT}\n`);
});
```

- [ ] **Step 2: Add the `dev` script**

Inside `"scripts"` in `package.json`:
```json
"dev": "npm run build:ui && concurrently --kill-others --names ui,mock \"node scripts/build-ui.mjs --watch\" \"tsx dev/mock-server.ts\"",
```

- [ ] **Step 3: Lint, typecheck and smoke-test the mock**

Run:
```bash
export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH
npm run typecheck && npm run lint -- --fix && npm run format && npm run lint
npm run build:ui && (npx tsx dev/mock-server.ts 8098 & echo $! > /tmp/tq-mock.pid); sleep 2
curl -s -o /dev/null -w "index %{http_code}\n" http://localhost:8098/
curl -s -o /dev/null -w "ui %{http_code}\n" http://localhost:8098/0.js
curl -s -X POST -d '' -o /dev/null -w "level %{http_code}\n" "http://localhost:8098/select/Water%20Level/set?option=Low"
curl -s -m 2 -N http://localhost:8098/events | grep -m1 -o '"name_id":"select/Water Level"[^}]*'
kill "$(cat /tmp/tq-mock.pid)"
```
Expected: `index 200`, `ui 200`, `level 200`, and the Water Level event shows `"state":"Low"`.

- [ ] **Step 4: Check the screen in the browser (controller does this with the browser pane)**

Start `npm run dev`, open `http://localhost:8099` at phone width (375×812) in light and dark mode and confirm: ready screen (Quanta roupa? / Tipo de lavagem / Quantas vezes lavar? / ▶ Começar · termina às HH:MM), start a quick wash → washing screen with stage text, timeline, "Termina às", progress bar; "■ Parar lavagem" → sheet → "Sim, parar" → "Lavagem interrompida" card; ⚙️ Ajustes → fields and Modo manual; manual relay on → yellow alert; stop the mock → "Sem conexão" banner and disabled controls. No console errors.

- [ ] **Step 5: Commit**

```bash
git add dev/mock-server.ts package.json
git commit -m "feat(tanquinho): TypeScript mock server and npm run dev

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: CI and documentation

**Files:**
- Modify: `/Users/jonatancolussi/esphome/.github/workflows/tanquinho.yml` (full rewrite below), `/Users/jonatancolussi/esphome/docs/superpowers/specs/2026-11-17-tanquinho-alexa-design.md`

**Interfaces:**
- Consumes: npm scripts `check` and `build` (Tasks 1, 6).

- [ ] **Step 1: Replace `.github/workflows/tanquinho.yml`**

```yaml
name: Tanquinho

on:
  push:
    branches: [main]
    paths:
      - "projects/tanquinho/**"
      - ".github/workflows/tanquinho.yml"
  pull_request:
    paths:
      - "projects/tanquinho/**"
      - ".github/workflows/tanquinho.yml"

permissions:
  contents: read

concurrency:
  group: tanquinho-${{ github.ref }}
  cancel-in-progress: true

env:
  ESPHOME_VERSION: "2026.4.1"

defaults:
  run:
    working-directory: projects/tanquinho

jobs:
  check:
    name: Types, lint, format and tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: projects/tanquinho/.nvmrc
          cache: npm
          cache-dependency-path: projects/tanquinho/package-lock.json
      - run: npm ci
      - run: npm run check

  firmware:
    name: Firmware build (UI bundle + ESPHome compile)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: projects/tanquinho/.nvmrc
          cache: npm
          cache-dependency-path: projects/tanquinho/package-lock.json
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: .github/workflows/tanquinho.yml
      - name: Install ESPHome
        run: pip install "esphome==${ESPHOME_VERSION}"
      - run: npm ci
      # Throwaway secrets generated on every run: no real password ever reaches GitHub.
      - name: Test secrets
        run: |
          cat > secrets.yaml <<EOF
          wifi_ssid: "ci"
          wifi_password: "$(openssl rand -hex 8)"
          api_key: "$(openssl rand -base64 32)"
          ota_password: "$(openssl rand -hex 16)"
          ap_password: "$(openssl rand -hex 8)"
          EOF
      - name: PlatformIO cache
        uses: actions/cache@v4
        with:
          path: |
            ~/.platformio
            projects/tanquinho/.esphome/platformio
          key: pio-${{ runner.os }}-${{ env.ESPHOME_VERSION }}
      - name: Build UI and compile firmware
        run: npm run build
      - name: Bundle size
        run: |
          size=$(wc -c < dist/ui.js)
          echo "dist/ui.js: ${size} bytes"
          test "$size" -le 40960
```

- [ ] **Step 2: Update entity names in the Alexa spec**

In `docs/superpowers/specs/2026-11-17-tanquinho-alexa-design.md`, replace (whole words, keep surrounding Portuguese prose):

| Old | New |
|---|---|
| `PARAR TUDO` | `Stop All` |
| `Em andamento` | `Running` |
| `Iniciar Ciclo Completo` | `Start Full Cycle` |
| `Iniciar Ciclo Rapido` | `Start Quick Cycle` |
| select **Tipo** / `Tipo` (`Normal` / `Rapida`) | select **Wash Type** / `Wash Type` (`Normal` / `Quick`) |
| button **Iniciar** / `Iniciar` | button **Start** / `Start` |
| `select/Tipo` | `select/Wash Type` |
| `button/Iniciar` | `button/Start` |
| `set?option=Normal\|Rapida` | `set?option=Normal\|Quick` |
| `ciclo_completo` / `ciclo_rapido` | `full_cycle` / `quick_cycle` |
| `executar_ciclos` | `run_cycles` |
| `estado_desligado` | `state_off` |
| `ciclo_ativo` | `cycle_active` |
| `tq-tipo` | `tq-wash-type` |
| `tanquinho-ui.js` | `src/` (TypeScript) |
| `dev/mock_server.py` | `dev/mock-server.ts` |
| `node test/ui-logic.test.js` | `npm run check` |

Then run `grep -nE "PARAR TUDO|Em andamento|Iniciar|ciclo_|estado_|tq-tipo|mock_server|ui-logic" docs/superpowers/specs/2026-11-17-tanquinho-alexa-design.md` from the repo root. Expected: no output.

- [ ] **Step 3: Full local verification**

Run:
```bash
export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH
npm ci && npm run check && npm run build 2>&1 | tail -2 && wc -c dist/ui.js
```
Expected: check passes, `Successfully compiled program.`, bundle ≤ 40960 bytes.

- [ ] **Step 4: Commit**

```bash
cd /Users/jonatancolussi/esphome
git add .github/workflows/tanquinho.yml docs/superpowers/specs/2026-11-17-tanquinho-alexa-design.md
git commit -m "ci(tanquinho): npm check and build; Alexa spec with English entity names

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Flash with settings migration (controller only, needs the user's OK)

**Files:** none (device operation).

Do not start without an explicit "pode gravar" (or equivalent) from the user in chat. Check no wash is running first.

- [ ] **Step 1: Confirm idle and save current settings (old names)**

```bash
B=http://192.168.2.121
curl -s "$B/binary_sensor/Em%20andamento"
for e in "select/Nivel" "number/Ciclos" "number/Enchendo%20Baixo%20(min)" "number/Enchendo%20Medio%20(min)" "number/Enchendo%20Alto%20(min)" "number/Drenando%20Baixo%20(min)" "number/Drenando%20Medio%20(min)" "number/Drenando%20Alto%20(min)" "number/Tempo%20Misturando%20(min)" "number/Tempo%20Molho%20(min)" "number/Tempo%20Lavando%20(min)"; do curl -s "$B/$e"; echo; done | tee /private/tmp/claude-501/-Users-jonatancolussi-esphome/8c86656a-664c-4417-9ef7-06732cf46039/scratchpad/old-settings.json
```
Expected: `"state":"OFF"` for the running sensor and 11 JSON lines with values.

- [ ] **Step 2: Flash**

Run: `export PATH=~/.nvm/versions/node/v22.18.0/bin:$PATH; TANQUINHO_HOST=192.168.2.121 npm run flash 2>&1 | grep -E "OTA successful|ERROR"`
Expected: `INFO OTA successful`.

- [ ] **Step 3: Re-apply the saved settings under the new names**

Mapping: `Nivel` Baixo/Medio/Alto → `Water Level` Low/Medium/High; `Ciclos` → `Cycles`; `Enchendo X` → `Fill Low/Medium/High (min)`; `Drenando X` → `Drain Low/Medium/High (min)`; `Tempo Misturando` → `Mix Time (min)`; `Tempo Molho` → `Soak Time (min)`; `Tempo Lavando` → `Wash Time (min)`. Send each with `curl -s -X POST -d '' "$B/<domain>/<url-encoded new name>/set?value=<v>"` (select: `?option=`), using the values from `old-settings.json`.

- [ ] **Step 4: Verify on the device**

- `curl -s "$B/select/Water%20Level"` and each new number return the old values.
- `curl -s "$B/text_sensor/Stage"` returns `"Off"`; `curl -s "$B/0.js" | head -c 200` returns minified JS.
- Open `http://tanquinho.local/` (or the IP) in the browser pane at phone width: ready screen in Portuguese, level and cycles match the old values, no console errors.
- Tell the user: wash history restarted at zero; the Advanced UI now shows English names; the wash type (Normal/Rápida) resets to Normal once on each phone.
```
