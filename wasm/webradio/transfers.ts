/**
 * Transfer book: the players YOU bought, per club, kept in localStorage.
 *
 * A signing is just a name added to the club's line-up — the engine takes the
 * squad as a list of names (see squads.ts / applyMatchSquads), so a bought
 * player really does run out with the team. The keeper must stay in slot 0 or
 * the club takes the field without a goalkeeper, so signings are spliced in
 * AFTER him and push the existing outfielders down towards the bench.
 */
import { CLUB_SQUADS } from "./clubsquads";

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
 * The club's line-up as it should take the field: keeper, then your signings
 * (they start), then the rest of the real squad.
 */
export function clubSquad(code: string): string[] {
  const base = CLUB_SQUADS[code] ?? [];
  const bought = signingsFor(code);
  if (!bought.length) return base;
  const keeper = base.slice(0, 1);
  const rest = base.slice(1).filter((n) => !bought.includes(n));
  return [...keeper, ...bought, ...rest];
}
