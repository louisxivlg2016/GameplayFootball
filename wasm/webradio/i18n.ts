/**
 * Web-UI localization. The HTML menus were authored in French; L("<french>")
 * returns the string in the currently-selected language (the same language the
 * radio/menu dropdown picks), falling back to the French source when a language
 * isn't covered. Fully translated: fr, en, es, pt, de, it, nl. Screens call L()
 * at render time and re-render on the "gpf-langchange" event fired by the picker.
 */
import { radioLanguage } from "./radioEngine";

type Lang = string;
// french source -> { lang: translation }. Missing lang -> french source is used.
const T: Record<string, Record<Lang, string>> = {
  // --- home sidebar ---
  "Accueil":     { en: "Main", es: "Inicio", pt: "Início", de: "Start", it: "Home", nl: "Start" },
  "Clubs":       { en: "Clubs", es: "Clubes", pt: "Clubes", de: "Vereine", it: "Club", nl: "Clubs" },
  "Sélections":  { en: "National", es: "Selecciones", pt: "Seleções", de: "Nationen", it: "Nazionali", nl: "Landen" },
  "Défis":       { en: "Challenges", es: "Retos", pt: "Desafios", de: "Duelle", it: "Sfide", nl: "Uitdagingen" },
  "Matchs":      { en: "Matches", es: "Partidos", pt: "Jogos", de: "Spiele", it: "Partite", nl: "Wedstrijden" },
  "Réglages":    { en: "Settings", es: "Ajustes", pt: "Definições", de: "Optionen", it: "Opzioni", nl: "Instellingen" },
  // --- home main ---
  "Joueurs":     { en: "Players", es: "Jugadores", pt: "Jogadores", de: "Spieler", it: "Giocatori", nl: "Spelers" },
  "1 JOUEUR":    { en: "1 PLAYER", es: "1 JUGADOR", pt: "1 JOGADOR", de: "1 SPIELER", it: "1 GIOCATORE", nl: "1 SPELER" },
  "2 JOUEURS":   { en: "2 PLAYERS", es: "2 JUGADORES", pt: "2 JOGADORES", de: "2 SPIELER", it: "2 GIOCATORI", nl: "2 SPELERS" },
  "Clique sur une carte pour lancer le match": {
    en: "Tap a card to start the match", es: "Toca una tarjeta para empezar el partido",
    pt: "Toca num cartão para começar o jogo", de: "Tippe auf eine Karte, um das Spiel zu starten",
    it: "Tocca una carta per iniziare la partita", nl: "Tik op een kaart om de wedstrijd te starten" },
  // --- pills (menu.ts) ---
  "Son":         { en: "Sound", es: "Sonido", pt: "Som", de: "Ton", it: "Audio", nl: "Geluid" },
  "Radio stade": { en: "Stadium radio", es: "Radio estadio", pt: "Rádio estádio", de: "Stadionradio", it: "Radio stadio", nl: "Stadionradio" },
  "Langue":      { en: "Language", es: "Idioma", pt: "Idioma", de: "Sprache", it: "Lingua", nl: "Taal" },
  "Actif":       { en: "On", es: "Activo", pt: "Ativo", de: "An", it: "Attivo", nl: "Aan" },
  "Coupé":       { en: "Off", es: "Apagado", pt: "Desligado", de: "Aus", it: "Spento", nl: "Uit" },
  "⏳ chargement…": { en: "⏳ loading…", es: "⏳ cargando…", pt: "⏳ a carregar…", de: "⏳ lädt…", it: "⏳ caricamento…", nl: "⏳ laden…" },
  // --- friendly / VS screen ---
  "Match amical":         { en: "Friendly", es: "Amistoso", pt: "Amigável", de: "Freundschaftsspiel", it: "Amichevole", nl: "Oefenwedstrijd" },
  "Changer le pays":      { en: "Change country", es: "Cambiar país", pt: "Mudar país", de: "Land ändern", it: "Cambia paese", nl: "Land wijzigen" },
  "JOUER ⚽":             { en: "PLAY ⚽", es: "JUGAR ⚽", pt: "JOGAR ⚽", de: "SPIELEN ⚽", it: "GIOCA ⚽", nl: "SPELEN ⚽" },
  "⚑ Changer le capitaine": { en: "⚑ Change captain", es: "⚑ Cambiar capitán", pt: "⚑ Mudar capitão", de: "⚑ Kapitän ändern", it: "⚑ Cambia capitano", nl: "⚑ Aanvoerder wijzigen" },
  "CHOISIS LE PAYS":      { en: "CHOOSE COUNTRY", es: "ELIGE EL PAÍS", pt: "ESCOLHE O PAÍS", de: "LAND WÄHLEN", it: "SCEGLI IL PAESE", nl: "KIES EEN LAND" },
  "CAPITAINE":            { en: "CAPTAIN", es: "CAPITÁN", pt: "CAPITÃO", de: "KAPITÄN", it: "CAPITANO", nl: "AANVOERDER" },
  "← Retour":             { en: "← Back", es: "← Atrás", pt: "← Voltar", de: "← Zurück", it: "← Indietro", nl: "← Terug" },
  "Retour":               { en: "Back", es: "Atrás", pt: "Voltar", de: "Zurück", it: "Indietro", nl: "Terug" },
};

/** current UI language code (en/fr/es/…), from the radio/menu picker. */
export function uiLang(): Lang {
  try { return radioLanguage(); } catch { return "fr"; }
}

/** translate a French source string to the current language (French = identity). */
export function L(fr: string): string {
  const lang = uiLang();
  if (lang === "fr" || !lang) return fr;
  const row = T[fr];
  return (row && row[lang]) ? row[lang] : fr;
}

/** translate a "CAPITAINE — FRANCE"-style header keeping the dynamic tail. */
export function Lcaptain(nation: string): string {
  return `${L("CAPITAINE")} — ${nation.toUpperCase()}`;
}

/** re-render menus when the language changes. */
export function onLangChange(cb: () => void): void {
  window.addEventListener("gpf-langchange", cb);
}
export function fireLangChange(): void {
  window.dispatchEvent(new Event("gpf-langchange"));
}
