/**
 * Pre-match anthem ceremony (page side). The C++ match lines both teams up at
 * the centre and pans a close camera along team 0's row, then team 1's
 * (18s each), calling window.gpfAnthem(idx, teamName) at each phase start and
 * window.gpfAnthemEnd() when the kickoff resumes. Here we resolve the team to a
 * country (national team name, or the club's country) and play a public-domain
 * instrumental anthem recording (Wikimedia Commons, via /img-proxy), with a
 * banner and a "Passer" button (Module._gpf_skip_anthem). Training drills opt
 * out via gpfCeremonyWanted.
 */
import { isDrillSession, isChallengeSession } from "./homemenu";
import { radio, setRadioSuppressed } from "./radioEngine";
import { hideLoading } from "./loading";

interface AnthemModule { _gpf_skip_anthem?: () => void }

// canonical country -> public-domain instrumental recording (upload.wikimedia.org,
// mostly US Navy Band). Every URL verified (HTTP 200 + audio content type).
const ANTHEMS: Record<string, string> = {
  "France": "https://upload.wikimedia.org/wikipedia/commons/3/30/La_Marseillaise.ogg",
  "England": "https://upload.wikimedia.org/wikipedia/commons/0/03/United_States_Navy_Band_-_God_Save_the_Queen.oga",
  "Spain": "https://upload.wikimedia.org/wikipedia/commons/c/c8/Marcha_Real-Royal_March_by_US_Navy_Band.ogg",
  "Italy": "https://upload.wikimedia.org/wikipedia/commons/b/b1/National_anthem_of_Italy_-_U.S._Navy_Band_%28short_version%29.ogg",
  "Germany": "https://upload.wikimedia.org/wikipedia/commons/a/a6/German_national_anthem_performed_by_the_US_Navy_Band.ogg",
  "Portugal": "https://upload.wikimedia.org/wikipedia/commons/5/58/A_Portuguesa.ogg",
  "Netherlands": "https://upload.wikimedia.org/wikipedia/commons/2/2e/United_States_Navy_Band_-_Het_Wilhelmus.ogg",
  "Belgium": "https://upload.wikimedia.org/wikipedia/commons/e/e8/La_Braban%C3%A7onne.oga",
  "Croatia": "https://upload.wikimedia.org/wikipedia/commons/4/42/Lijepa_nasa_domovino_instrumental_cijeli.ogg",
  "Argentina": "https://upload.wikimedia.org/wikipedia/commons/c/cd/Himno_Nacional_Argentino_instrumental.ogg",
  "Brazil": "https://upload.wikimedia.org/wikipedia/commons/9/9b/Hino_Nacional_Brasileiro_instrumental.ogg",
  "Uruguay": "https://upload.wikimedia.org/wikipedia/commons/2/2b/United_States_Navy_Band_-_National_Anthem_of_Uruguay_%28complete%29.ogg",
  "Colombia": "https://upload.wikimedia.org/wikipedia/commons/5/55/United_States_Navy_Band_-_%C2%A1Oh%2C_gloria_inmarcesible%21.ogg",
  "Chile": "https://upload.wikimedia.org/wikipedia/commons/6/6e/United_States_Navy_Band_-_National_Anthem_of_Chile.ogg",
  "Peru": "https://upload.wikimedia.org/wikipedia/commons/c/cc/United_States_Navy_Band_-_Marcha_Nacional_del_Per%C3%BA.ogg",
  "Ecuador": "https://upload.wikimedia.org/wikipedia/commons/6/6e/Anthem_of_Ecuador.ogg",
  "Mexico": "https://upload.wikimedia.org/wikipedia/commons/9/9d/Himno_Nacional_Mexicano_instrumental.ogg",
  "USA": "https://upload.wikimedia.org/wikipedia/commons/2/25/%22The_Star-Spangled_Banner%22_performed_by_the_United_States_Navy_Band.mp3",
  "Canada": "https://upload.wikimedia.org/wikipedia/commons/b/b4/United_States_Navy_Band_-_O_Canada.ogg",
  "Morocco": "https://upload.wikimedia.org/wikipedia/commons/3/3f/National_Anthem_of_Morocco.ogg",
  "Senegal": "https://upload.wikimedia.org/wikipedia/commons/8/8c/National_Anthem_of_Senegal.ogg",
  "Egypt": "https://upload.wikimedia.org/wikipedia/commons/f/f2/Bilady%2C_Bilady%2C_Bilady.ogg",
  "Nigeria": "https://upload.wikimedia.org/wikipedia/commons/8/8a/Nigeria%2C_We_Hail_Thee_-_Banda_do_Batalh%C3%A3o_da_Guarda_Presidencial%2C_2025.ogg",
  "Ghana": "https://upload.wikimedia.org/wikipedia/commons/4/43/National_Anthem_of_Ghana.ogg",
  "Algeria": "https://upload.wikimedia.org/wikipedia/commons/4/48/Kassaman_instrumental.ogg",
  "Tunisia": "https://upload.wikimedia.org/wikipedia/commons/2/23/Humat_al-Hima.ogg",
  "Ivory Coast": "https://upload.wikimedia.org/wikipedia/commons/6/67/United_States_Navy_Band_-_National_Anthem_of_C%C3%B4te_D%27Ivoire_%22L%27Abidjanaise%22.ogg",
  "Japan": "https://upload.wikimedia.org/wikipedia/commons/a/a3/Kimi_ga_Yo_instrumental.ogg",
  "South Korea": "https://upload.wikimedia.org/wikipedia/commons/0/0d/National_anthem_of_South_Korea%2C_performed_by_the_United_States_Navy_Band.wav",
  "Saudi Arabia": "https://upload.wikimedia.org/wikipedia/commons/6/6d/Saudi_Arabian_national_anthem%2C_performed_by_the_United_States_Navy_Band.oga",
  "Qatar": "https://upload.wikimedia.org/wikipedia/commons/e/ec/National_anthem_of_Qatar.ogg",
  "Australia": "https://upload.wikimedia.org/wikipedia/commons/a/a6/U.S._Navy_Band%2C_Advance_Australia_Fair_%28instrumental%29.ogg",
  "Iran": "https://upload.wikimedia.org/wikipedia/commons/f/f2/Sorud-e_Mell%C3%AD-e_Yomhur%C3%AD-e_Eslam%C3%AD-e_Ir%C3%A1n_%28instrumental%29.oga",
  "Turkey": "https://upload.wikimedia.org/wikipedia/commons/9/99/Istikl%C3%A2l_Marsi_instrumetal.ogg",
  "Poland": "https://upload.wikimedia.org/wikipedia/commons/5/52/Mazurek_D%C4%85browskiego_%28official_instrumental%29.oga",
  "Sweden": "https://upload.wikimedia.org/wikipedia/commons/0/02/United_States_Navy_Band_-_Sweden.ogg",
  "Denmark": "https://upload.wikimedia.org/wikipedia/commons/0/06/United_States_Navy_Band_-_Der_er_et_yndigt_land.ogg",
  "Norway": "https://upload.wikimedia.org/wikipedia/commons/f/f6/Norway_%28National_Anthem%29.ogg",
  "Switzerland": "https://upload.wikimedia.org/wikipedia/commons/e/ee/Swiss_Psalm_%28official_instrumental%29.ogg",
  "Austria": "https://upload.wikimedia.org/wikipedia/commons/7/7c/Land_der_Berge_Land_am_Strome_instrumental.ogg",
  "Scotland": "https://upload.wikimedia.org/wikipedia/commons/5/52/Scotland_the_Brave_-_United_States_Air_Force_Pipe_Band.oga",
  "Wales": "https://upload.wikimedia.org/wikipedia/commons/0/02/Hen_Wlad_fy_Nhadau_piano.ogg",
  "Ireland": "https://upload.wikimedia.org/wikipedia/commons/7/7c/United_States_Navy_Band_-_Amhr%C3%A1n_na_bhFiann.ogg",
  "Ukraine": "https://upload.wikimedia.org/wikipedia/commons/6/6d/National_anthem_of_Ukraine%2C_instrumental.oga",
  "Russia": "https://upload.wikimedia.org/wikipedia/commons/9/9c/Russian_anthem_instrumental.oga",
  "Serbia": "https://upload.wikimedia.org/wikipedia/commons/d/dd/National_anthem_of_Serbia%2C_performed_by_the_United_States_Navy_Band.wav",
  "Greece": "https://upload.wikimedia.org/wikipedia/commons/d/db/Hymn_to_liberty_instrumental.oga",
};

// aliases (lowercase, accent-stripped) -> canonical ANTHEMS key
const COUNTRY_ALIASES: Record<string, string> = {
  "france": "France",
  "angleterre": "England", "england": "England", "royaume-uni": "England", "united kingdom": "England",
  "espagne": "Spain", "spain": "Spain",
  "italie": "Italy", "italy": "Italy",
  "allemagne": "Germany", "germany": "Germany",
  "portugal": "Portugal",
  "pays-bas": "Netherlands", "netherlands": "Netherlands", "holland": "Netherlands",
  "belgique": "Belgium", "belgium": "Belgium",
  "croatie": "Croatia", "croatia": "Croatia",
  "argentine": "Argentina", "argentina": "Argentina",
  "bresil": "Brazil", "brazil": "Brazil", "brasil": "Brazil",
  "uruguay": "Uruguay",
  "colombie": "Colombia", "colombia": "Colombia",
  "chili": "Chile", "chile": "Chile",
  "perou": "Peru", "peru": "Peru",
  "equateur": "Ecuador", "ecuador": "Ecuador",
  "mexique": "Mexico", "mexico": "Mexico",
  "etats-unis": "USA", "usa": "USA", "united states": "USA",
  "canada": "Canada",
  "maroc": "Morocco", "morocco": "Morocco",
  "senegal": "Senegal",
  "egypte": "Egypt", "egypt": "Egypt",
  "nigeria": "Nigeria",
  "ghana": "Ghana",
  "cameroun": "Cameroon", "cameroon": "Cameroon",
  "algerie": "Algeria", "algeria": "Algeria",
  "tunisie": "Tunisia", "tunisia": "Tunisia",
  "cote d'ivoire": "Ivory Coast", "ivory coast": "Ivory Coast",
  "japon": "Japan", "japan": "Japan",
  "coree du sud": "South Korea", "south korea": "South Korea",
  "arabie saoudite": "Saudi Arabia", "saudi arabia": "Saudi Arabia",
  "qatar": "Qatar",
  "australie": "Australia", "australia": "Australia",
  "iran": "Iran",
  "turquie": "Turkey", "turkey": "Turkey",
  "pologne": "Poland", "poland": "Poland",
  "suede": "Sweden", "sweden": "Sweden",
  "danemark": "Denmark", "denmark": "Denmark",
  "norvege": "Norway", "norway": "Norway",
  "suisse": "Switzerland", "switzerland": "Switzerland",
  "autriche": "Austria", "austria": "Austria",
  "ecosse": "Scotland", "scotland": "Scotland",
  "pays de galles": "Wales", "wales": "Wales",
  "irlande": "Ireland", "ireland": "Ireland",
  "ukraine": "Ukraine",
  "russie": "Russia", "russia": "Russia",
  "serbie": "Serbia", "serbia": "Serbia",
  "grece": "Greece", "greece": "Greece",
};

// club-name fragment (lowercase, accent-stripped) -> canonical country.
// Covers the clubs in the CLUB menu; DB team names are matched by substring.
const CLUB_TO_COUNTRY: Array<[string, string]> = [
  ["paris", "France"], ["marseille", "France"], ["lyonnais", "France"], ["lyon", "France"],
  ["monaco", "France"], ["lille", "France"], ["nice", "France"], ["lens", "France"],
  ["rennais", "France"], ["rennes", "France"], ["strasbourg", "France"], ["toulouse", "France"],
  ["nantes", "France"], ["brestois", "France"], ["brest", "France"], ["saint-etienne", "France"],
  ["arsenal", "England"], ["liverpool", "England"], ["manchester", "England"],
  ["chelsea", "England"], ["tottenham", "England"], ["everton", "England"],
  ["newcastle", "England"], ["aston villa", "England"], ["west ham", "England"],
  ["real madrid", "Spain"], ["barcelon", "Spain"], ["atletico", "Spain"],
  ["sevilla", "Spain"], ["seville", "Spain"], ["valencia", "Spain"], ["bilbao", "Spain"],
  ["inter milan", "Italy"], ["ac milan", "Italy"], ["milan", "Italy"],
  ["juventus", "Italy"], ["napoli", "Italy"], ["roma", "Italy"], ["lazio", "Italy"],
  ["bayern", "Germany"], ["dortmund", "Germany"], ["leverkusen", "Germany"],
  ["schalke", "Germany"], ["leipzig", "Germany"],
  ["galatasaray", "Turkey"], ["fenerbahce", "Turkey"], ["besiktas", "Turkey"],
  ["al-nassr", "Saudi Arabia"], ["al nassr", "Saudi Arabia"], ["al-hilal", "Saudi Arabia"],
  ["miami", "USA"],
  ["ajax", "Netherlands"], ["psv", "Netherlands"], ["feyenoord", "Netherlands"],
  ["porto", "Portugal"], ["benfica", "Portugal"], ["sporting", "Portugal"],
  ["celtic", "Scotland"], ["rangers", "Scotland"],
  // the shipped default DB teams (fictional names -> the club they stand in for)
  ["masterdam", "Netherlands"],      // Ajax
  ["rood wit", "Netherlands"], ["eindhoven", "Netherlands"], // PSV
  ["gunners", "England"],            // Arsenal
  ["red devils", "England"],         // Man United
  ["cataluna", "Spain"],             // Barcelona (accent-stripped "cataluña")
  ["galacticos", "Spain"],           // Real Madrid
  ["bavaria", "Germany"],            // Bayern
  ["gelben", "Germany"],             // Dortmund ("die Gelben")
];

// last-resort fallback so the ceremony always has music: a deterministic pick
// from a handful of big anthems, keyed off the team name.
const FALLBACK_ORDER = ["England", "France", "Spain", "Italy", "Germany", "Brazil", "Argentina", "Netherlands"];
function fallbackAnthem(teamName: string): string {
  let h = 0;
  const n = normalize(teamName);
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return ANTHEMS[FALLBACK_ORDER[h % FALLBACK_ORDER.length]];
}

const normalize = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function resolveAnthemUrl(teamName: string): string | null {
  const n = normalize(teamName);
  // 1) the team IS a country (national teams)
  const direct = COUNTRY_ALIASES[n];
  if (direct && ANTHEMS[direct]) return ANTHEMS[direct];
  // 2) any country alias contained in the name ("equipe de france", "italy nt"...)
  for (const alias in COUNTRY_ALIASES) {
    if (n.includes(alias)) {
      const c = COUNTRY_ALIASES[alias];
      if (ANTHEMS[c]) return ANTHEMS[c];
    }
  }
  // 3) a known club -> its country's anthem
  for (const [frag, country] of CLUB_TO_COUNTRY) {
    if (n.includes(frag) && ANTHEMS[country]) return ANTHEMS[country];
  }
  // 4) unknown team -> a deterministic fallback so we always have an anthem
  return fallbackAnthem(teamName);
}

let audio: HTMLAudioElement | null = null;
let fadeTimer: number | null = null;
let holdTimer: number | null = null;
let banner: HTMLElement | null = null;
let bannerLabel: HTMLElement | null = null;

// The anthem plays IN FULL: the ceremony advances on the audio's "ended" event,
// or — once we know the clip's real length from its metadata — a timer set to
// that exact duration (the "ended" event is unreliable when streaming through
// /img-proxy). ANTHEM_MAX_MS is only an absolute safety cap so a totally stalled
// stream can't hang the ceremony forever; the "Passer" button skips any time.
const ANTHEM_MAX_MS = 130000; // ~2 min hard cap (longest anthems ~90s)

// When the player picks teams in the NATIONAL/CLUB menu, those choices override
// the (limited) DB team names for the ceremony, so e.g. choosing France plays
// the French anthem. Home = team 0, away = team 1. Cleared after the ceremony.
let overrideHome: string | null = null;
let overrideAway: string | null = null;
export function setAnthemOverride(home: string | null, away: string | null): void {
  overrideHome = home;
  overrideAway = away;
}
// the picked display names, so the radio can say "France" instead of the DB
// team name ("Gunners"). Read by radioMain when the engine reports its teams.
export function getTeamOverride(): [string | null, string | null] {
  return [overrideHome, overrideAway];
}

// NOTE: an earlier WebAudio gain-node "boost" made some anthems silent in a live
// match (the game runs its own AudioContext; routing the element through a second
// one is unreliable). We now play the plain element — proven to play every codec
// — and rely on ducking the game audio (menu music off, crowd hushed) instead.

function stopAudio(): void {
  if (fadeTimer !== null) { clearInterval(fadeTimer); fadeTimer = null; }
  if (holdTimer !== null) { clearTimeout(holdTimer); holdTimer = null; }
  if (audio) { try { audio.pause(); } catch { /* already */ } audio = null; }
}

function fadeOutAndStop(a: HTMLAudioElement, ms: number): void {
  if (fadeTimer !== null) clearInterval(fadeTimer);
  const step = 50;
  const dec = a.volume / Math.max(1, ms / step);
  fadeTimer = window.setInterval(() => {
    if (!audio || audio !== a) { if (fadeTimer !== null) clearInterval(fadeTimer); fadeTimer = null; return; }
    a.volume = Math.max(0, a.volume - dec);
    if (a.volume <= 0.01) { stopAudio(); }
  }, step);
}

function showBanner(teamName: string): void {
  if (!banner) return;
  if (bannerLabel) bannerLabel.textContent = `🎵 Hymne national — ${teamName}`;
  banner.style.opacity = "1";
  banner.style.pointerEvents = "auto";
}

function hideBanner(): void {
  if (!banner) return;
  banner.style.opacity = "0";
  banner.style.pointerEvents = "none";
}

export function initAnthem(): void {
  if (banner) return;

  banner = document.createElement("div");
  banner.id = "gpf-anthem";
  Object.assign(banner.style, {
    position: "fixed", left: "50%", bottom: "26px", transform: "translateX(-50%)",
    zIndex: "46", display: "flex", alignItems: "center", gap: "14px",
    padding: "10px 20px", borderRadius: "999px", background: "rgba(0,0,0,0.62)",
    border: "1px solid rgba(255,255,255,0.25)", color: "#fff",
    font: "700 16px system-ui, sans-serif", whiteSpace: "nowrap",
    opacity: "0", pointerEvents: "none", transition: "opacity .25s ease",
  } as CSSStyleDeclaration);

  bannerLabel = document.createElement("span");
  const skip = document.createElement("button");
  skip.textContent = "Passer ▶";
  Object.assign(skip.style, {
    cursor: "pointer", padding: "6px 14px", borderRadius: "999px",
    border: "2px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)",
    color: "#ffe94a", font: "800 14px system-ui, sans-serif",
  } as CSSStyleDeclaration);
  skip.addEventListener("click", () => {
    stopAudio(); // C++ will announce the next phase (or end) right away
    (window as unknown as { Module?: AnthemModule }).Module?._gpf_skip_anthem?.();
  });
  banner.append(bannerLabel, skip);
  document.body.appendChild(banner);

  const w = window as unknown as {
    gpfAnthem?: (idx: number, teamName: string) => void;
    gpfAnthemEnd?: () => void;
    gpfCeremonyWanted?: () => boolean;
  };

  w.gpfCeremonyWanted = (): boolean => !isDrillSession() && !isChallengeSession();

  // the anthem is played IN FULL; when it ends we advance the ceremony to the
  // next team (or kickoff) via the C++ skip hook — so it's not cut short.
  const advance = (a: HTMLAudioElement): void => {
    if (audio !== a) return; // superseded or already stopped
    (window as unknown as { Module?: AnthemModule }).Module?._gpf_skip_anthem?.();
  };

  w.gpfAnthem = (idx: number, teamName: string): void => {
    setRadioSuppressed(true); // the commentator stays silent during the anthems
    hideLoading();            // ceremony is on screen now -> drop the loading cover
    stopAudio();
    const name = (idx === 0 ? overrideHome : overrideAway) || teamName;
    showBanner(name);
    const url = resolveAnthemUrl(name); // always resolves (has a fallback)
    if (!url) return;
    const a = new Audio("/img-proxy?u=" + encodeURIComponent(url));
    a.volume = 1.0;
    audio = a;
    a.addEventListener("ended", () => advance(a)); // anthem played out -> next
    // Play the FULL anthem: once metadata gives us the real length, advance right
    // when it finishes; until then (and if metadata never arrives) fall back to the
    // hard safety cap so a stalled stream can't hang the ceremony.
    const setHold = (ms: number): void => {
      if (holdTimer !== null) clearTimeout(holdTimer);
      holdTimer = window.setTimeout(() => { if (audio === a) { fadeOutAndStop(a, 900); advance(a); } }, ms);
    };
    setHold(ANTHEM_MAX_MS);
    a.addEventListener("loadedmetadata", () => {
      if (audio === a && isFinite(a.duration) && a.duration > 1) setHold(a.duration * 1000 + 1500);
    });
    a.play().then(() => console.log(`[gpf-anthem] playing ${name} in full`))
      .catch((e) => {
        console.warn("[gpf-anthem] play blocked:", e?.message || e);
        setHold(2000); // couldn't play — don't hang
      });
  };

  w.gpfAnthemEnd = (): void => {
    stopAudio();
    hideBanner();
    overrideHome = null;
    overrideAway = null;
    // ceremony over, kickoff coming — let the commentator back in and greet
    setRadioSuppressed(false);
    try { radio("opening", {}); } catch { /* radio not ready */ }
  };
}
