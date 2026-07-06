/**
 * Continuous play-by-play driver for the WebAssembly build. The web version
 * reads its ECS every frame; here the C++ engine pushes a match-state snapshot
 * (via pushMatchState) and this loop decides, whenever the commentator is free,
 * what to describe — carrier, zone, pressure, runs, loose balls, the score.
 * The decision logic mirrors web/src/game/systems/commentary.ts.
 */
import { getRadioPack } from "./radioText";
import {
  radioFlow,
  radioHasQueued,
  radioIdle,
  radioLanguage,
  teamName,
} from "./radioEngine";

/** One snapshot of the match, pushed from C++ (window.gpfRadioTick). */
export interface MatchSnapshot {
  loose: boolean; // ball has no owner
  carrier: string; // owner player name
  teamId: number; // owner team (0/1)
  keeper: boolean; // owner is the goalkeeper
  depth: number; // normalized -1 (own goal) .. +1 (opponent goal)
  speed: number; // m/s
  oppName: string; // nearest opponent name
  oppDist: number; // metres to nearest opponent
  score: [number, number];
  clock: number; // seconds elapsed
  gen: number; // match generation (bumped each new match)
  ceremony?: boolean; // goal celebration / whistle ceremony in progress
  ended?: boolean; // full time
}

let latest: MatchSnapshot | null = null;
export function pushMatchState(s: MatchSnapshot): void {
  latest = s;
}

let gap = 0; // breathing time between lines, counts only while the mic is idle
let lastKind = "";
let sinceLine = 0;
const STALE = 3.0;

// Variety by TEMPLATE, not by finished sentence — track the phrase FUNCTIONS
// (and loose-ball strings) used recently so the commentator rotates through the
// whole pool before reusing a turn of phrase, in every language.
const RECENT = 3;
const recentFns: Array<(...a: string[]) => string> = [];
const recentStrs: string[] = [];

function remember<T>(list: T[], item: T): void {
  list.push(item);
  while (list.length > RECENT) list.shift();
}

function vary(
  main: (...args: string[]) => string,
  alts: Array<(...args: string[]) => string> | undefined,
  ...args: string[]
): string {
  const pool = [main, ...(alts ?? [])];
  const fresh = pool.filter((fn) => !recentFns.includes(fn));
  const choice = fresh.length ? fresh : pool;
  const pick = choice[Math.floor(Math.random() * choice.length)]!;
  remember(recentFns, pick);
  return pick(...args);
}

function varyStr(main: string, alts: string[] | undefined): string {
  const pool = [main, ...(alts ?? [])];
  const fresh = pool.filter((s) => !recentStrs.includes(s));
  const choice = fresh.length ? fresh : pool;
  const pick = choice[Math.floor(Math.random() * choice.length)]!;
  remember(recentStrs, pick);
  return pick;
}

function speak(text: string): void {
  radioFlow(text);
  sinceLine = 0;
}

let commentaryGen = -1;
let openingBurst = false;

/** Advance the play-by-play by dt seconds. Call from a rAF loop. */
export function commentaryTick(dt: number): void {
  const s = latest;
  if (!s) return;
  if (s.ceremony || s.ended) return;

  if (s.gen !== commentaryGen) {
    commentaryGen = s.gen;
    gap = 0.1;
    lastKind = "";
    sinceLine = 0;
    openingBurst = true;
  }

  sinceLine += dt;
  gap -= dt;
  if (gap > 0) return;
  // Keep talking almost non-stop: radioFlow bakes the next line while the
  // current one plays. But once a line is queued and ready, don't synthesize a
  // third — hold with a tiny breath until the mic frees.
  if (!radioIdle() && radioHasQueued()) {
    gap = 0.12;
    return;
  }
  gap = openingBurst ? 0.12 + Math.random() * 0.18 : 0.18 + Math.random() * 0.32;
  openingBurst = s.clock < 14;

  const language = radioLanguage();
  const copy = getRadioPack(language);

  // occasionally step back for the score
  if (Math.random() < 0.12) {
    speak(copy.scoreStatus(s.score, teamName(0, language), teamName(1, language)));
    lastKind = "score";
    return;
  }

  if (s.loose || !s.carrier) {
    if (lastKind !== "loose" || sinceLine > STALE) {
      speak(varyStr(copy.loose, copy.looseAlt));
      lastKind = "loose";
    }
    return;
  }

  const name = s.carrier;
  const team = teamName(s.teamId, language);

  if (s.keeper) {
    speak(vary(copy.keeper, copy.keeperAlt, name, team));
    lastKind = "keeper";
    return;
  }

  if ((s.oppDist < 2.5 && s.oppName && lastKind !== "duel") || sinceLine > STALE) {
    if (s.oppName) {
      speak(vary(copy.duel, copy.duelAlt, name, s.oppName));
      lastKind = "duel";
      return;
    }
  }

  if ((s.speed > 6 && lastKind !== "run") || sinceLine > STALE) {
    speak(vary(copy.run, copy.runAlt, name, team));
    lastKind = "run";
    return;
  }

  if ((s.depth > 0.5 && lastKind !== "danger") || sinceLine > STALE) {
    speak(vary(copy.danger, copy.dangerAlt, name));
    lastKind = "danger";
    return;
  }

  if ((s.depth < -0.5 && lastKind !== "build") || sinceLine > STALE) {
    speak(vary(copy.build, copy.buildAlt, name, team));
    lastKind = "build";
    return;
  }

  if (lastKind !== "carry" || sinceLine > STALE) {
    speak(vary(copy.carry, copy.carryAlt, name, team));
    lastKind = "carry";
  }
}
