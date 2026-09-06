/**
 * Transfer book: the players YOU bought, per club, kept in localStorage.
 *
 * A signing is just a name added to the club's line-up — the engine takes the
 * squad as a list of names (see squads.ts / applyMatchSquads), so a bought
 * player really does run out with the team. Slot 0 is the goalkeeper's, so an
 * outfield signing goes in behind him while a bought KEEPER takes the slot
 * itself (see clubSquad).
 */
import { CLUB_SQUADS } from "./clubsquads";
import { marketPos } from "./marketdata";

const KEY = "gpf-transfers";
type Book = Record<string, string[]>;

function load(): Book {
  try {
    const raw = localStorage.getItem(KEY);
    const b = raw ? (JSON.parse(raw) as Book) : {};
    return b && typeof b === "object" ? b : {};
  } catch { return {}; }
}
function save(b: Book): void {
  try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* private mode */ }
}

/** Players bought for this club, newest first. */
export function signingsFor(code: string): string[] {
  return load()[code] ?? [];
}

/** Every club you have signed someone for. */
export function allSignings(): Book { return load(); }

export function ownsPlayer(code: string, name: string): boolean {
  return signingsFor(code).includes(name);
}

export function signPlayer(code: string, name: string): void {
  const b = load();
  const list = b[code] ?? [];
  if (!list.includes(name)) b[code] = [name, ...list];
  save(b);
}

export function releasePlayer(code: string, name: string): void {
  const b = load();
  const list = b[code] ?? [];
  b[code] = list.filter((n) => n !== name);
  if (!b[code].length) delete b[code];
  save(b);
}

/**
 * The club's line-up as it should take the field.
 *
 * Slot 0 IS the goalkeeper — the engine gives the shirt in that slot to whoever
 * keeps goal — so a bought KEEPER has to go there (he was ending up at right
 * back otherwise), pushing the club's own keeper down to the bench. Outfield
 * signings are spliced in right behind the keeper so they start.
 */
export function clubSquad(code: string): string[] {
  const base = CLUB_SQUADS[code] ?? [];
  const bought = signingsFor(code);
  if (!bought.length) return base;

  const keepers = bought.filter((n) => marketPos(n) === "GK");
  const outfield = bought.filter((n) => marketPos(n) !== "GK");
  const rest = base.slice(1).filter((n) => !bought.includes(n));

  if (!keepers.length) return [...base.slice(0, 1), ...outfield, ...rest];

  // your keeper takes the gloves; the club's own one, and any spare keeper you
  // bought, sit on the bench (a second keeper must not play outfield either)
  const benchedKeepers = [...base.slice(0, 1), ...keepers.slice(1)].filter((n) => n);
  return [keepers[0]!, ...outfield, ...rest, ...benchedKeepers];
}
