// Opaque on purpose: letting TS infer literal types for the converted asset
// JSONs (tens of thousands of numbers) blows up tsc's memory.
declare module "*.json" {
  const value: unknown;
  export default value;
}
declare module "*.png" {
  const url: string;
  export default url;
}
declare module "*.jpg" {
  const url: string;
  export default url;
}
declare module "*.mp3" {
  const url: string;
  export default url;
}
