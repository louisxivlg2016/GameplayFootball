import { attackSign } from "./levels";

export interface PracticePoint {
  x: number;
  z: number;
}

const DRIBBLE_WAYPOINTS_BASE: PracticePoint[] = [
  { x: -38, z: 0 },
  { x: -30, z: -9 },
  { x: -22, z: 9 },
  { x: -14, z: -9 },
  { x: -6, z: 9 },
  { x: 2, z: -9 },
  { x: 10, z: 9 },
  { x: 20, z: 0 },
  { x: 30, z: 0 },
];

export function dribbleWaypoints(team: number): PracticePoint[] {
  const s = attackSign(team);
  return DRIBBLE_WAYPOINTS_BASE.map((point) => ({
    x: point.x * s,
    z: point.z * s,
  }));
}

export function dribblePoles(team: number): PracticePoint[] {
  return dribbleWaypoints(team).slice(1, -1);
}
