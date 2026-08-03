/**
 * In-page overlay for the WebAssembly build: a language picker (drives the TTS
 * radio) and the localized menu-theme music ("les chansons"), mirroring the web
 * version. Rendered as a small fixed panel so it works over the game canvas
 * without touching the native C++ menu.
 */
import { RADIO_LANGUAGES, type AppLanguage } from "./radioText";
import { radioEnabled, setRadioLanguage, toggleRadio, radioVoicePhase } from "./radioEngine";
import { L, fireLangChange, onLangChange } from "./i18n";

// Native display names for the language picker.
const LANG_NAMES: Record<AppLanguage, string> = {
  en: "English", fr: "Français", es: "Español", pt: "Português", de: "Deutsch",
  nb: "Norsk", it: "Italiano", ga: "Gaeilge", nl: "Nederlands", hr: "Hrvatski",
  ro: "Română", pl: "Polski", tr: "Türkçe", ru: "Русский", uk: "Українська",
  ar: "العربية", hi: "हिन्दी", id: "Bahasa Indonesia", vi: "Tiếng Việt",
  th: "ไทย", ja: "日本語", ko: "한국어", "zh-CN": "简体中文", "zh-TW": "繁體中文",
};

// Languages that have a dedicated menu-theme file (others use the default). The
// server maps /menu-music/<key> -> menu-theme-<key>.mp4 (or menu-theme.mp4).
const THEME_LANGS = new Set([
  "fr", "es", "nb", "de", "ru", "ar", "it", "pt", "ga", "nl", "hr", "ko", "hi",
  "ro", "th", "ja", "zh",
]);
function themeKey(lang: AppLanguage): string {
  if (lang === "zh-CN" || lang === "zh-TW") return "zh";
  return THEME_LANGS.has(lang) ? lang : "default";
}

let current: AppLanguage =
  (new URLSearchParams(location.search).get("lang") as AppLanguage) || "en";
if (!(RADIO_LANGUAGES as string[]).includes(current)) current = "en";

// ---- menu music ----
let music: HTMLAudioElement | null = null;
let musicOn = true; // "SON : Actif" by default like the web menu (autoplay-gated)
const MUSIC_VOL = 0.4;

function loadMusic(): void {
  if (!music) {
    music = new Audio();
    music.loop = true;
    music.volume = MUSIC_VOL;
  }
  music.src = `/menu-music/${themeKey(current)}`;
  if (musicOn) void music.play().catch(() => {});
}
function setMusic(on: boolean): void {
  musicOn = on;
  if (!music) loadMusic();
  if (on) void music!.play().catch(() => {});
  else music!.pause();
}
/** Stop the menu music entirely while a match is on air, resume it back at the
 *  menu. (The user wants no menu theme during matches.) */
function duck(on: boolean): void {
  if (!music) return;
  if (on) { music.pause(); }
  else { music.volume = MUSIC_VOL; if (musicOn) void music.play().catch(() => {}); }
}
/** Called when the home menu comes back (see homemenu.show). */
export function resumeMenuMusic(): void { duck(false); }

// ---- overlay UI (styled like the web version's top-right controls) ----
const CSS = `
#gpf-menu { position:fixed; top:14px; right:18px; z-index:2147483647;
  display:flex; align-items:flex-start; gap:14px; user-select:none;
  font-family:'Segoe UI',ui-sans-serif,system-ui,-apple-system,sans-serif; }
#gpf-menu .pill { pointer-events:auto; cursor:pointer; border:2px solid rgba(255,255,255,.3);
  background:rgba(8,12,24,.72); color:#fff; box-shadow:0 10px 20px rgba(0,0,0,.28);
  min-width:128px; min-height:52px; padding:7px 14px; display:grid; justify-items:center;
  align-content:center; gap:2px; border-radius:10px; font:inherit; transition:border-color .15s; }
#gpf-menu .pill:hover { border-color:rgba(255,255,255,.55); }
#gpf-menu .pill span { font-size:10px; font-weight:900; letter-spacing:.9px; text-transform:uppercase; opacity:.82; }
#gpf-menu .pill b { font-size:14px; font-weight:900; line-height:1; }
#gpf-menu .son b.on { color:#ffe94a; }
#gpf-menu .radio b.on { color:#6ef0ff; }
#gpf-menu .pill b.off { color:rgba(255,255,255,.45); }
#gpf-menu .lang { display:grid; gap:6px; justify-items:end; }
#gpf-menu .lang > span { color:rgba(255,255,255,.88); font-size:11px; font-weight:900; letter-spacing:.9px; text-transform:uppercase; }
#gpf-menu .lang select { min-width:180px; height:52px; padding:0 12px; color:#fff;
  background:rgba(8,12,24,.78); border:2px solid rgba(255,255,255,.24); border-radius:8px;
  font:inherit; font-size:15px; font-weight:800; outline:none; box-shadow:0 10px 22px rgba(0,0,0,.28); cursor:pointer; }
#gpf-menu .lang select option { background:#0c1119; color:#fff; }
`;

function pill(cls: string, label: string): { btn: HTMLButtonElement; status: HTMLElement } {
  const btn = document.createElement("button");
  btn.className = `pill ${cls}`;
  const span = document.createElement("span");
  span.textContent = label;
  const status = document.createElement("b");
  btn.append(span, status);
  return { btn, status };
}
function setStatus(status: HTMLElement, on: boolean): void {
  status.textContent = on ? L("Actif") : L("Coupé");
  status.className = on ? "on" : "off";
}

function buildOverlay(): void {
  const style = document.createElement("style");
  style.id = "gpf-menu-style";
  style.textContent = CSS;
  document.head.appendChild(style);

  const menu = document.createElement("div");
  menu.id = "gpf-menu";

  // SON (musique de menu)
  const son = pill("son", L("Son"));
  setStatus(son.status, musicOn);
  son.btn.addEventListener("click", () => { setMusic(!musicOn); setStatus(son.status, musicOn); });

  // RADIO STADE (commentaire)
  const radio = pill("radio", L("Radio stade"));
  setStatus(radio.status, radioEnabled());
  radio.btn.addEventListener("click", () => { setStatus(radio.status, toggleRadio()); paintRadio(); });
  // while the 63MB neural voice is still downloading (first load), show "⏳ chargement"
  // on the pill so it's clear the radio is coming, not broken. Once ready → "Actif".
  function paintRadio(): void {
    if (radioEnabled() && radioVoicePhase() === "loading") {
      radio.status.textContent = L("⏳ chargement…");
      radio.status.className = "on";
    } else {
      setStatus(radio.status, radioEnabled());
    }
  }
  paintRadio();
  window.setInterval(paintRadio, 800);

  // LANGUE
  const lang = document.createElement("label");
  lang.className = "lang";
  const lspan = document.createElement("span");
  lspan.textContent = L("Langue");
  const select = document.createElement("select");
  for (const l of RADIO_LANGUAGES) {
    const opt = document.createElement("option");
    opt.value = l;
    opt.textContent = LANG_NAMES[l];
    if (l === current) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => {
    current = select.value as AppLanguage;
    setRadioLanguage(current);
    pushUiLang(current); // translate the in-match native menus to the picked language
    loadMusic(); // swap to the new language's theme
    fireLangChange(); // re-render every HTML menu in the new language
  });
  lang.append(lspan, select);

  menu.append(son.btn, radio.btn, lang);
  document.body.appendChild(menu);
  pushUiLang(current); // initial (retries until the wasm module is up)

  // re-translate the pills when the language changes (labels + on/off status)
  const sonSpan = son.btn.querySelector("span")!;
  const radioSpan = radio.btn.querySelector("span")!;
  onLangChange(() => {
    sonSpan.textContent = L("Son");
    radioSpan.textContent = L("Radio stade");
    lspan.textContent = L("Langue");
    setStatus(son.status, musicOn);
    paintRadio();
  });
}

// push the selected language to the C++ side so the native in-match menus
// (half-time / pause / game plan / game over) render in that language.
function pushUiLang(lang: string): void {
  const m = (window as unknown as { Module?: { ccall?: (n: string, r: null, t: string[], a: unknown[]) => unknown } }).Module;
  if (!m?.ccall) { window.setTimeout(() => pushUiLang(lang), 1500); return; }
  try { m.ccall("gpf_set_ui_lang", null, ["string"], [lang]); } catch { /* not up */ }
}

export function initMenu(): void {
  loadMusic();
  if (document.body) buildOverlay();
  else window.addEventListener("DOMContentLoaded", buildOverlay);
  // duck the music once a match starts (wrap the reset hook radioMain installed)
  const g = window as unknown as { gpfRadioReset?: () => void };
  const orig = g.gpfRadioReset;
  g.gpfRadioReset = (): void => {
    duck(true);
    orig?.();
  };
}
