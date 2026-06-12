// Opaque on purpose: letting TS infer literal types for the converted asset
// JSONs (tens of thousands of numbers) blows up tsc's memory.
declare module "*.json" {
  const value: unknown;
  export default value;
}
declare module "mespeak" {
  interface MeSpeak {
    loadConfig(data: object): void;
    loadVoice(data: object): void;
    speak(text: string, options?: Record<string, unknown>): number;
    stop(): void;
    canPlay(): boolean;
  }
  const meSpeak: MeSpeak;
  export default meSpeak;
}
declare module "*.png" {
  const url: string;
  export default url;
}
declare module "*.jpg" {
  const url: string;
  export default url;
}
