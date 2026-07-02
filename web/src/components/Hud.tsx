import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useStore } from "../game/store";
import { TouchControls } from "./TouchControls";
import { DragShoot, KeeperArrows, humanSetPieceActive } from "./DragShoot";
import { world } from "../game/world";
import { skipCinematic } from "../game/systems/cinematic";
import { audioMuted, initAudio, primeAudioOutput, resumeAudio, setAudioMuted } from "../game/audio";
import { RADIO_STATE_EVENT, radio, radioEnabled, resumeRadio, toggleRadio, warmupRadioVoice } from "../game/radio";
import {
  getConfiguredMatchSides,
  LINEUP_SLOT_LAYOUT,
  NATIONAL_TEAM_OPTIONS,
  TEAM_FLAG,
  getDefaultLineupIds,
  getNationalTeam,
  getOpponentTeamId,
  getPreviewMatchSidesFor,
  getTeamCaptain,
  getTeamOverall,
  type NationalTeam,
  type NationalTeamId,
} from "../game/teams";
import playButtonUrl from "../assets/play-button.png";
import trainingButtonUrl from "../assets/training-button.png";
import worldCupButtonUrl from "../assets/worldcup-button.png";
import trainingCornerUrl from "../assets/training-corner.png";
import trainingFreeKickUrl from "../assets/training-free-kick.png";
import trainingPenaltyUrl from "../assets/training-penalty.png";
import trainingOffsideUrl from "../assets/training-offside.png";
import trainingTackleUrl from "../assets/training-tackle.png";
import menuThemeUrl from "../assets/audio/menu-theme.mp4";
import menuThemeFrUrl from "../assets/audio/menu-theme-fr.mp4";
import menuThemeEsUrl from "../assets/audio/menu-theme-es.mp4";
import menuThemeNbUrl from "../assets/audio/menu-theme-nb.mp4";
import menuThemeDeUrl from "../assets/audio/menu-theme-de.mp4";
import menuThemeRuUrl from "../assets/audio/menu-theme-ru.mp4";
import menuThemeArUrl from "../assets/audio/menu-theme-ar.mp4";
import menuThemeItUrl from "../assets/audio/menu-theme-it.mp4";
import menuThemePtUrl from "../assets/audio/menu-theme-pt.mp4";
import menuThemeZhUrl from "../assets/audio/menu-theme-zh.mp4";
import menuThemeJaUrl from "../assets/audio/menu-theme-ja.mp4";
import menuThemeGaUrl from "../assets/audio/menu-theme-ga.mp4";
import menuThemeNlUrl from "../assets/audio/menu-theme-nl.mp4";
import menuThemeHrUrl from "../assets/audio/menu-theme-hr.mp4";
import {
  LANGUAGE_OPTIONS,
  translateBannerMessage,
  translatePhaseLabel,
  useI18n,
  type AppLanguage,
} from "../i18n";
import { LEAGUES } from "../game/clubs";
import { applyLineupToMatch } from "../game/levels";

const act = () => useStore.getState();
const MENU_THEME_BY_LANGUAGE: Partial<Record<AppLanguage, string>> = {
  fr: menuThemeFrUrl,
  es: menuThemeEsUrl,
  nb: menuThemeNbUrl,
  de: menuThemeDeUrl,
  ru: menuThemeRuUrl,
  ar: menuThemeArUrl,
  it: menuThemeItUrl,
  pt: menuThemePtUrl,
  ga: menuThemeGaUrl,
  nl: menuThemeNlUrl,
  hr: menuThemeHrUrl,
  ja: menuThemeJaUrl,
  "zh-CN": menuThemeZhUrl,
  "zh-TW": menuThemeZhUrl,
};
const LANGUAGE_PROMPT_STORAGE_KEY = "gpf-language-prompt-v1";

type LineupDrag = {
  playerId: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetSlot: number | null;
  moved: boolean;
};

const TRAINING_OPTIONS: Array<{
  id: number;
  titleKey: "freeKick" | "corner" | "penalty" | "offside" | "tackle" | "dribble";
  noteKey:
    | "freeKickNote"
    | "cornerNote"
    | "penaltyNote"
    | "offsideNote"
    | "tackleNote"
    | "dribbleNote";
  image?: string;
}> = [
  { id: 2, titleKey: "freeKick", noteKey: "freeKickNote", image: trainingFreeKickUrl },
  { id: 3, titleKey: "corner", noteKey: "cornerNote", image: trainingCornerUrl },
  { id: 4, titleKey: "penalty", noteKey: "penaltyNote", image: trainingPenaltyUrl },
  { id: 7, titleKey: "dribble", noteKey: "dribbleNote" },
  { id: 5, titleKey: "offside", noteKey: "offsideNote", image: trainingOffsideUrl },
  {
    id: 6,
    titleKey: "tackle",
    noteKey: "tackleNote",
    image: trainingTackleUrl,
  },
];

const WORLD_CUP_FIXTURES = [
  { date: "24 juin", time: "Jour 14", group: "Groupe A", home: "Czechia", away: "Mexico", venue: "Mexico City" },
  { date: "24 juin", time: "Jour 14", group: "Groupe A", home: "South Africa", away: "Korea Republic", venue: "Monterrey" },
  { date: "24 juin", time: "Jour 14", group: "Groupe B", home: "Switzerland", away: "Canada", venue: "Vancouver" },
  { date: "24 juin", time: "Jour 14", group: "Groupe C", home: "Scotland", away: "Brazil", venue: "Miami" },
  { date: "25 juin", time: "Jour 15", group: "Groupes D/E/F", home: "Ecuador", away: "Germany", venue: "New York/New Jersey" },
  { date: "25 juin", time: "Jour 15", group: "Groupes D/E/F", home: "Turkiye", away: "USA", venue: "Los Angeles" },
  { date: "26 juin", time: "Jour 16", group: "Groupes G/H/I", home: "Norway", away: "France", venue: "Boston" },
  { date: "26 juin", time: "Jour 16", group: "Groupes G/H/I", home: "Uruguay", away: "Spain", venue: "Guadalajara" },
  { date: "27 juin", time: "Jour 17", group: "Groupes J/K/L", home: "Colombia", away: "Portugal", venue: "Miami" },
  { date: "27 juin", time: "Jour 17", group: "Groupes J/K/L", home: "Panama", away: "England", venue: "New York/New Jersey" },
  { date: "28 juin - 3 juillet", time: "Elimination", group: "32es", home: "Qualifie", away: "Qualifie", venue: "Tableau final" },
  { date: "4 - 7 juillet", time: "Elimination", group: "8es", home: "Qualifie", away: "Qualifie", venue: "Tableau final" },
  { date: "9 - 11 juillet", time: "Elimination", group: "Quarts", home: "Qualifie", away: "Qualifie", venue: "Tableau final" },
  { date: "14 - 15 juillet", time: "Elimination", group: "Demi-finales", home: "Qualifie", away: "Qualifie", venue: "Tableau final" },
  { date: "18 juillet", time: "Finale 3e place", group: "Match 103", home: "Perdant demi", away: "Perdant demi", venue: "Miami" },
  { date: "19 juillet", time: "Finale", group: "Match 104", home: "Finaliste", away: "Finaliste", venue: "New York/New Jersey" },
];

const MENU_LEGENDS = [
  {
    name: "Haaland",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Erling_Haaland_Morocco_v_Norway_7_June_2026-51.jpg/500px-Erling_Haaland_Morocco_v_Norway_7_June_2026-51.jpg",
  },
  {
    name: "Mbappé",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Kylian_Mbappe_France_v_Senegal_16_June_2026-391_%28cropped%29.jpg/500px-Kylian_Mbappe_France_v_Senegal_16_June_2026-391_%28cropped%29.jpg",
  },
  {
    name: "Ronaldo",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Cristiano_Ronaldo_2275_%28cropped%29.jpg/500px-Cristiano_Ronaldo_2275_%28cropped%29.jpg",
  },
  {
    name: "Messi",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Lionel_Messi_NE_Revolution_Inter_Miami_7.9.25-178_%28cropped_2%29.jpg/500px-Lionel_Messi_NE_Revolution_Inter_Miami_7.9.25-178_%28cropped_2%29.jpg",
  },
];

type MenuTab = "home" | "training" | "worldcup" | "lineup" | "matchup" | "club" | "national" | "challenge";

const MENU_SIDEBAR_ITEMS: Array<{ id: MenuTab; icon: string; label: string }> = [
  { id: "home", icon: "⌂", label: "MAIN" },
  { id: "club", icon: "◎", label: "CLUB" },
  { id: "national", icon: "◔", label: "NATIONAL" },
  { id: "challenge", icon: "◌", label: "DEFI" },
];

const LINEUP_STORAGE_KEY_PREFIX = "gpf-lineup-v2-";

function lineupStorageKey(teamId: NationalTeamId): string {
  return `${LINEUP_STORAGE_KEY_PREFIX}${teamId}`;
}

function loadSavedLineup(teamId: NationalTeamId): number[] {
  const team = getNationalTeam(teamId);
  const defaultLineup = getDefaultLineupIds(teamId);
  if (typeof window === "undefined") return defaultLineup;
  try {
    const raw = window.localStorage.getItem(lineupStorageKey(teamId));
    if (!raw) return defaultLineup;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved) || saved.length !== defaultLineup.length) return defaultLineup;
    const ids = saved.map((value) => Number(value));
    const unique = new Set(ids);
    const validIds = ids.every((id) => team.squad.some((player) => player.id === id));
    return validIds && unique.size === ids.length ? ids : defaultLineup;
  } catch {
    return defaultLineup;
  }
}

function shouldPromptForLanguage(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LANGUAGE_PROMPT_STORAGE_KEY) !== "1";
}

function playerInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function teamCode(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 3))
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

const NATIONAL_CARD_META: Record<
  NationalTeamId,
  { nickname: string; edition: string; motto: string; stars: number }
> = {
  france: {
    nickname: "Les Bleus",
    edition: "Edition Elite",
    motto: "vitesse + finition",
    stars: 2,
  },
  england: {
    nickname: "Three Lions",
    edition: "Edition Royal",
    motto: "impact + maitrise",
    stars: 1,
  },
  argentina: {
    nickname: "Albiceleste",
    edition: "Edition Oro",
    motto: "technique + genie",
    stars: 3,
  },
  portugal: {
    nickname: "Selecao",
    edition: "Edition Captain",
    motto: "dribble + frappe",
    stars: 1,
  },
  norway: {
    nickname: "Nordic Power",
    edition: "Edition North",
    motto: "puissance + course",
    stars: 0,
  },
};

function averageRating(players: Array<{ rating: number }>): number {
  if (!players.length) return 0;
  return Math.round(players.reduce((sum, player) => sum + player.rating, 0) / players.length);
}

function getNationalCardStats(team: NationalTeam): {
  overall: number;
  attack: number;
  midfield: number;
  defense: number;
} {
  const starters = team.defaultLineup
    .map((id) => team.squad.find((player) => player.id === id))
    .filter((player): player is NationalTeam["squad"][number] => Boolean(player));
  const attack = starters.filter((player) => ["AG", "AD", "BU"].includes(player.pos));
  const midfield = starters.filter((player) => ["MDC", "MC", "MOC"].includes(player.pos));
  const defense = starters.filter((player) => ["GB", "DD", "DG", "DC"].includes(player.pos));
  return {
    overall: averageRating(starters),
    attack: averageRating(attack),
    midfield: averageRating(midfield),
    defense: averageRating(defense),
  };
}

const wikiPhotoCache = new Map<string, string>();

function ensureInteractiveAudio(): void {
  initAudio();
  resumeAudio();
  primeAudioOutput();
  warmupRadioVoice();
  resumeRadio();
}

function PlayerHead({ name, photoUrl = "" }: { name: string; photoUrl?: string }): React.ReactNode {
  const [photo, setPhoto] = useState(photoUrl || wikiPhotoCache.get(name) || "");

  useEffect(() => {
    if (photo || photoUrl) return;
    const controller = new AbortController();
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("format", "json");
    url.searchParams.set("pithumbsize", "120");
    url.searchParams.set("origin", "*");
    url.searchParams.set("titles", `${name}|${name} footballer`);

    fetch(url.toString(), { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } }) => {
        const pages = data.query?.pages ?? {};
        const image = Object.values(pages).find((page) => page.thumbnail?.source)?.thumbnail?.source;
        if (image) {
          wikiPhotoCache.set(name, image);
          setPhoto(image);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [name, photo, photoUrl]);

  return (
    <i className="player-head">
      {photo ? <img src={photo} alt="" /> : playerInitials(name)}
    </i>
  );
}

export function Hud(): React.ReactNode {
  const { language, setLanguage, t } = useI18n();
  const mode = useStore((s) => s.mode);
  const score = useStore((s) => s.score);
  const clock = useStore((s) => s.clock);
  const phaseLabel = useStore((s) => s.phaseLabel);
  const banner = useStore((s) => s.banner);
  const pens = useStore((s) => s.pens);
  const selectedName = useStore((s) => s.selectedName);
  const selectedName2 = useStore((s) => s.selectedName2);
  const players = useStore((s) => s.players);
  const humanTeam = useStore((s) => s.humanTeam);
  const nationalTeam = useStore((s) => s.nationalTeam);
  const opponentTeam = useStore((s) => s.opponentTeam);
  const practice = useStore((s) => s.practice);
  const currentNationalTeam = useMemo(() => getNationalTeam(nationalTeam), [nationalTeam]);
  const previewMatchSides = useMemo(
    () => getPreviewMatchSidesFor(nationalTeam, opponentTeam, humanTeam),
    [humanTeam, nationalTeam, opponentTeam],
  );
  const lineupPlayerById = useMemo(
    () => new Map(currentNationalTeam.squad.map((player) => [player.id, player])),
    [currentNationalTeam],
  );
  const [menuTab, setMenuTab] = useState<MenuTab>("home");
  const [selectedLineup, setSelectedLineup] = useState<number[]>(() => loadSavedLineup(nationalTeam));
  const [lineupFocus, setLineupFocus] = useState<number>(() => loadSavedLineup(nationalTeam)[0] ?? 0);
  const [lineupDrag, setLineupDrag] = useState<LineupDrag | null>(null);
  const [matchSubOpen, setMatchSubOpen] = useState(false);
  // in-match substitution: COMPOSITION jumped here from a RUNNING match, so
  // the lineup screen must resume that match (subs applied live), not restart
  const [subFromMatch, setSubFromMatch] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => audioMuted());
  const [radioOn, setRadioOn] = useState<boolean>(() => radioEnabled());
  const [languagePromptOpen, setLanguagePromptOpen] = useState<boolean>(() => shouldPromptForLanguage());
  const suppressBenchClick = useRef(false);
  const menuMusicRef = useRef<HTMLAudioElement | null>(null);
  const mm = String(Math.floor(clock / 60)).padStart(2, "0");
  const ss = String(clock % 60).padStart(2, "0");
  const translatedPhase = translatePhaseLabel(language, phaseLabel);
  const translatedBanner = translateBannerMessage(language, banner);
  const menuThemeSrc = MENU_THEME_BY_LANGUAGE[language] ?? menuThemeUrl;
  const menuMusicActive = mode === "menu";

  useEffect(() => {
    if (mode !== "menu") setMenuTab("home");
  }, [mode]);

  useEffect(() => {
    if (mode !== "play") setMatchSubOpen(false);
  }, [mode]);

  useEffect(() => {
    setAudioMuted(muted);
  }, [muted]);

  useEffect(() => {
    const syncRadio = (): void => setRadioOn(radioEnabled());
    const onRadioState = (event: Event): void => {
      const next = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      setRadioOn(typeof next === "boolean" ? next : radioEnabled());
    };

    syncRadio();
    window.addEventListener(RADIO_STATE_EVENT, onRadioState as EventListener);
    return () => window.removeEventListener(RADIO_STATE_EVENT, onRadioState as EventListener);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(lineupStorageKey(nationalTeam), JSON.stringify(selectedLineup));
  }, [nationalTeam, selectedLineup]);

  useEffect(() => {
    const lineup = loadSavedLineup(nationalTeam);
    setSelectedLineup(lineup);
    setLineupFocus(lineup[0] ?? 0);
    setLineupDrag(null);
  }, [nationalTeam]);

  useEffect(() => {
    const audio = menuMusicRef.current;
    if (!audio) return;
    audio.volume = 0.42;
    audio.loop = true;
    audio.muted = muted;
    if (!menuMusicActive) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.load();

    const tryPlay = (): void => {
      void audio.play().catch(() => undefined);
    };

    tryPlay();
    window.addEventListener("pointerdown", tryPlay);
    window.addEventListener("keydown", tryPlay);
    return () => {
      window.removeEventListener("pointerdown", tryPlay);
      window.removeEventListener("keydown", tryPlay);
    };
  }, [menuMusicActive, menuThemeSrc, muted]);

  const lineupPlayerNames = (): string[] =>
    selectedLineup.map((id) => lineupPlayerById.get(id)?.name ?? "");

  const confirmLanguagePrompt = (): void => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_PROMPT_STORAGE_KEY, "1");
    }
    setLanguagePromptOpen(false);
  };

  const startMatch = (practiceId = 0): void => {
    ensureInteractiveAudio();
    setSubFromMatch(false); // a fresh match ends any pending in-match sub flow
    act().setLineupNames(lineupPlayerNames());
    act().setPractice(practiceId);
    act().newMatch();
    radio("opening");
  };

  const pickControlledTeam = (teamId: NationalTeamId): void => {
    if (teamId === nationalTeam) return;
    act().setMatchTeams(teamId, nationalTeam);
  };

  const displayMatchSides =
    mode === "menu" ? previewMatchSides : getConfiguredMatchSides();

  const replaceLineupSlot = (slotIndex: number, playerId: number): void => {
    if (selectedLineup.includes(playerId)) return;
    setSelectedLineup((current) => current.map((id, index) => (index === slotIndex ? playerId : id)));
    setLineupFocus(playerId);
  };

  const lineupSlotAt = (x: number, y: number): number | null => {
    const slotElement = document
      .elementsFromPoint(x, y)
      .find(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element.dataset.lineupSlot !== undefined,
      );
    if (!slotElement) return null;
    const slot = Number(slotElement.dataset.lineupSlot);
    return Number.isFinite(slot) ? slot : null;
  };

  useEffect(() => {
    if (!lineupDrag) return;

    const onPointerMove = (event: PointerEvent): void => {
      event.preventDefault();
      const distance = Math.hypot(event.clientX - lineupDrag.startX, event.clientY - lineupDrag.startY);
      setLineupDrag((current) =>
        current
          ? {
              ...current,
              x: event.clientX,
              y: event.clientY,
              targetSlot: lineupSlotAt(event.clientX, event.clientY),
              moved: current.moved || distance > 5,
            }
          : current,
      );
    };

    const finishDrag = (event: PointerEvent): void => {
      event.preventDefault();
      const targetSlot = lineupSlotAt(event.clientX, event.clientY);
      if (targetSlot !== null) replaceLineupSlot(targetSlot, lineupDrag.playerId);
      suppressBenchClick.current = lineupDrag.moved || targetSlot !== null;
      setLineupDrag(null);
      window.setTimeout(() => {
        suppressBenchClick.current = false;
      }, 0);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", finishDrag, { passive: false });
    window.addEventListener("pointercancel", finishDrag, { passive: false });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [lineupDrag]);

  return (
    <div className="hud">
      <audio ref={menuMusicRef} src={menuThemeSrc} preload="auto" hidden />
      {mode !== "menu" && (
        <>
          <div className="scoreboard">
            <span className="clock">
              {mm}:{ss} {translatedPhase}
            </span>
            <span className="team">
              <span className="swatch" style={{ background: displayMatchSides[0].color }} />
              {displayMatchSides[0].label}
            </span>
            <span className="score">
              {score[0]} - {score[1]}
            </span>
            <span className="team">
              <span className="swatch" style={{ background: displayMatchSides[1].color }} />
              {displayMatchSides[1].label}
            </span>
            {pens && (
              <span className="score">
                p {pens[0]} - {pens[1]}
              </span>
            )}
            {selectedName && (
              <span className="team" style={{ color: "#ffe94a" }}>
                ▶ {selectedName}
              </span>
            )}
            {players === 2 && selectedName2 && (
              <span className="team" style={{ color: "#4ad2ff" }}>
                ▶ {selectedName2}
              </span>
            )}
          </div>
          <ShootoutBoard />
          <Radar />
        </>
      )}
      {mode !== "menu" && <DragShoot />}
      {mode !== "menu" && <KeeperArrows />}
      {mode === "play" && players === 1 && <TouchControls />}
      {mode === "play" && players === 1 && (
        <div className={`match-sub-prompt${matchSubOpen ? " open" : ""}`}>
          <button className="match-sub-main" onClick={() => setMatchSubOpen((open) => !open)}>
            {t("changePlayer")}
          </button>
          {matchSubOpen && (
            <div className="match-sub-card">
              <span>{t("currentPlayer")}</span>
              <b>{selectedName || t("none")}</b>
              <button onClick={() => setMatchSubOpen(false)}>{t("keep")}</button>
              <button
                onClick={() => {
                  setSubFromMatch(true); // come back to THIS match, subs applied
                  setMatchSubOpen(false);
                  setMenuTab("lineup");
                  act().setMode("menu");
                }}
              >
                {t("composition")}
              </button>
            </div>
          )}
        </div>
      )}
      {mode === "play" && (
        <div className="hud-top-actions">
          <SoundToggleButton
            muted={muted}
            onToggle={() => setMuted((current) => !current)}
            variant="hud"
          />
          <RadioToggleButton enabled={radioOn} onToggle={() => toggleRadio()} variant="hud" />
          <button
            onClick={() => act().setMode("pause")}
            className="hud-top-button"
            aria-label={t("pauseAria")}
          >
            ❚❚
          </button>
        </div>
      )}
      {mode !== "menu" && mode !== "play" && (
        <div className="hud-top-actions">
          <SoundToggleButton muted={muted} onToggle={() => setMuted((current) => !current)} variant="hud" />
          <RadioToggleButton enabled={radioOn} onToggle={() => toggleRadio()} variant="hud" />
        </div>
      )}
      {(mode === "goal" ||
        mode === "replay" ||
        mode === "cardScene" ||
        mode === "offside") && (
        <button
          onClick={() => skipCinematic(world)}
          style={{
            position: "absolute",
            bottom: 24,
            right: 24,
            pointerEvents: "auto",
            cursor: "pointer",
            padding: "10px 20px",
            borderRadius: 8,
            border: "2px solid rgba(255,255,255,0.35)",
            background: "rgba(8,12,24,0.6)",
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 1,
          }}
          aria-label={t("skipReplayAria")}
        >
          {t("skipReplay")} ⏭
        </button>
      )}
      {mode === "goal" && <div className="banner">GOAL!</div>}
      {banner && mode !== "goal" && (
        <div className="banner" style={{ fontSize: 40, letterSpacing: 3 }}>
          {translatedBanner}
        </div>
      )}
      {mode === "pause" && (
        <div className="menu">
          <div className="menu-side menu-side-red" />
          <div className="menu-side menu-side-blue" />
          <div className="menu-shell pause-shell">
            <h1>{t("pause")}</h1>
            <BigButton label={t("resume")} onClick={() => act().setMode("play")} />
            <button
              className="menu-big-button"
              style={{
                background: "#d8342c",
                borderColor: "#ff8a80",
                color: "#fff",
                boxShadow: "0 8px 0 #7a130e, 0 16px 26px rgba(0,0,0,0.5)",
              }}
              onClick={() => act().setMode("menu")}
            >
              {t("quitToMenu")}
            </button>
            <div className="prompt">{t("pressEscape")}</div>
          </div>
        </div>
      )}
      {mode === "menu" && (
        <div className="menu">
          <div className="menu-side menu-side-red" />
          <div className="menu-side menu-side-blue" />
          <div className="menu-shell">
            {menuTab === "home" && (
              <div className="menu-top-tools">
                <SoundToggleButton
                  muted={muted}
                  onToggle={() => setMuted((current) => !current)}
                  variant="menu"
                />
                <RadioToggleButton
                  enabled={radioOn}
                  onToggle={() => toggleRadio()}
                  variant="menu"
                  longLabel
                />
                <LanguagePicker language={language} onChange={setLanguage} />
              </div>
            )}
            {languagePromptOpen && (
              <LanguagePrompt
                language={language}
                onChange={setLanguage}
                onConfirm={confirmLanguagePrompt}
              />
            )}
            <div className="menu-layout">
              <aside className="menu-sidebar">
                {MENU_SIDEBAR_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    className={`menu-sidebar-button${menuTab === item.id ? " active" : ""}`}
                    onClick={() => {
                      setSubFromMatch(false); // browsing the menu ends the sub flow
                      setMenuTab(item.id);
                    }}
                  >
                    <span className="menu-sidebar-icon">{item.icon}</span>
                    <b>{item.label}</b>
                  </button>
                ))}
              </aside>
              <div className="menu-content">
                {menuTab === "home" && (
                  <>
                    <div className="legend-strip menu-hero-legends" aria-hidden="true">
                      {MENU_LEGENDS.map((legend) => (
                        <div className="legend-card" key={legend.name}>
                          <img className="legend-photo" src={legend.image} alt="" />
                          <b>{legend.name}</b>
                        </div>
                      ))}
                    </div>
                    <div className="menu-title-row">
                      <h1>
                        GAMEPLAY <span>FOOTBALL</span>
                      </h1>
                    </div>
                    <div className="menu-main-actions">
                      <MenuModeButton
                        tone="yellow"
                        kicker="MATCH"
                        title={t("play")}
                        note={t("playNote")}
                        image={playButtonUrl}
                        onClick={() => setMenuTab("matchup")}
                      />
                      <MenuModeButton
                        tone="green"
                        kicker="EXERCICES"
                        title={t("training")}
                        note={t("trainingNote")}
                        image={trainingButtonUrl}
                        onClick={() => setMenuTab("training")}
                      />
                      <MenuModeButton
                        tone="blue"
                        kicker="19 JUILLET"
                        title={t("worldCup")}
                        note={t("worldCupNote")}
                        image={worldCupButtonUrl}
                        onClick={() => setMenuTab("worldcup")}
                      />
                    </div>
                    <div className="home-settings-strip home-settings-strip-solo">
                      <PlayersToggle />
                    </div>
                    {players === 1 ? (
                      <div className="controls">
                        {t("soloControls1")}
                        <br />
                        {t("soloControls2")}
                        <br />
                        {t("soloControls3")}
                        <br />
                        {t("soloControls4")}
                      </div>
                    ) : (
                      <div className="controls">
                        {t("versusControls1")}
                        <br />
                        {t("versusControls2")}
                        <br />
                        {t("versusControls3")}
                      </div>
                    )}
                  </>
                )}
                {menuTab === "club" && <ClubsMenu />}
                {menuTab === "challenge" && <EmptyMenu title="Defi" />}
                {menuTab === "matchup" && (
                  <div className="matchup">
                    <div className="matchup-head">
                      <b>{t("play")}</b>
                      <span>
                        {getNationalTeam(nationalTeam).label} vs {getNationalTeam(opponentTeam).label}
                      </span>
                    </div>
                    <div className="matchup-grid">
                      <MatchupTeamCard
                        teamId={nationalTeam}
                        side="home"
                        isControlled
                        onCycle={() => act().cycleNationalTeam()}
                        onPlay={() => pickControlledTeam(nationalTeam)}
                      />
                      <div className="matchup-vs">VS</div>
                      <MatchupTeamCard
                        teamId={opponentTeam}
                        side="away"
                        isControlled={false}
                        onCycle={() => act().cycleOpponentTeam()}
                        onPlay={() => pickControlledTeam(opponentTeam)}
                      />
                    </div>
                    <div className="matchup-actions">
                      <button
                        className="matchup-btn matchup-back"
                        onClick={() => setMenuTab("home")}
                        aria-label={t("back")}
                      >
                        ‹
                      </button>
                      <button
                        className="matchup-btn matchup-lineup"
                        onClick={() => setMenuTab("lineup")}
                      >
                        {t("lineup")}
                      </button>
                      <button
                        className="matchup-btn matchup-play"
                        onClick={() => startMatch(0)}
                        aria-label={t("play")}
                      >
                        ⚽
                      </button>
                    </div>
                  </div>
                )}
                {menuTab === "national" && (
                  <div className="menu-panel national-panel">
                    <div className="menu-panel-head">
                      <span>National</span>
                      <b>
                        {previewMatchSides[humanTeam].label} vs {previewMatchSides[1 - humanTeam].label}
                      </b>
                    </div>
                    <div className="national-grid">
                      {NATIONAL_TEAM_OPTIONS.map((option) => {
                        const team = getNationalTeam(option.id);
                        const opponent = getNationalTeam(getOpponentTeamId(option.id));
                        const active = option.id === nationalTeam;
                        const meta = NATIONAL_CARD_META[option.id];
                        const stats = getNationalCardStats(team);
                        return (
                          <button
                            key={option.id}
                            className={`national-card${active ? " active" : ""}`}
                            style={
                              {
                                "--team-color": team.color,
                                "--opp-color": opponent.color,
                              } as CSSProperties
                            }
                            onClick={() => act().setNationalTeam(option.id)}
                          >
                            <span className="national-card-foil">{meta.edition}</span>
                            <span className="national-card-top">
                              <em>{meta.nickname}</em>
                              {active && <strong>ACTIF</strong>}
                            </span>
                            <span className="national-crest-shell">
                              <span className="national-swatch-row">
                                <i style={{ background: team.color }} />
                                <i style={{ background: opponent.color }} />
                              </span>
                              <span className="national-crest-stars">
                                {Array.from({ length: Math.max(meta.stars, 1) }, (_, i) => (
                                  <i key={i}>{i < meta.stars ? "★" : "•"}</i>
                                ))}
                              </span>
                              <span className="national-crest-core">
                                <span>{teamCode(team.label)}</span>
                                <small>{stats.overall}</small>
                              </span>
                              <span className="national-crest-ribbon">2026</span>
                            </span>
                            <b className="national-card-title">{team.label}</b>
                            <span className="national-card-subtitle">{meta.motto}</span>
                            <span className="national-matchup-pill">
                              <small>VS</small>
                              <span>{opponent.label}</span>
                            </span>
                            <span className="national-card-stats">
                              <span>
                                <small>ATT</small>
                                <b>{stats.attack}</b>
                              </span>
                              <span>
                                <small>MIL</small>
                                <b>{stats.midfield}</b>
                              </span>
                              <span>
                                <small>DEF</small>
                                <b>{stats.defense}</b>
                              </span>
                            </span>
                            <span className="national-card-bottom">
                              <span className="national-color-chip">
                                <i style={{ background: team.color }} />
                                <i style={{ background: opponent.color }} />
                              </span>
                              <u>{stats.overall} GEN</u>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="national-actions">
                      <button className="lineup-start" onClick={() => setMenuTab("lineup")}>
                        {t("lineup")}
                      </button>
                    </div>
                  </div>
                )}
                {menuTab === "training" && (
                  <div className="menu-panel">
                    <div className="menu-panel-head">
                      <span>{t("trainingHeading")}</span>
                      <b>{t("chooseExercise")}</b>
                    </div>
                    <div className="training-grid">
                      {TRAINING_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          className={`training-card${option.image ? " training-image-card" : ""}`}
                          onClick={() => startMatch(option.id)}
                        >
                          {option.image ? (
                            <>
                              <img src={option.image} alt="" />
                              <span className="training-image-label">{t(option.titleKey)}</span>
                            </>
                          ) : (
                            <>
                              <span>{t(option.titleKey)}</span>
                              <b>{t(option.noteKey)}</b>
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {menuTab === "lineup" && (
                  <div className="lineup-panel">
                    <div className="lineup-top">
                      <div>
                        <span>{currentNationalTeam.label}</span>
                        <b>{t("choosePlayers")}</b>
                      </div>
                      <button
                        className="lineup-start"
                        onClick={() => {
                          if (subFromMatch) {
                            // live substitution: rename the changed slots on the
                            // pitch and resume — score, clock and play carry on
                            applyLineupToMatch(world, lineupPlayerNames());
                            setSubFromMatch(false);
                            act().setMode("play");
                          } else {
                            startMatch(0);
                          }
                        }}
                      >
                        {subFromMatch ? t("resumeMatch") : t("playMatch")}
                      </button>
                    </div>
                    <div className="lineup-layout">
                      <div className="lineup-pitch" aria-label={t("lineup")}>
                        {LINEUP_SLOT_LAYOUT.map((slot, index) => {
                          const player = lineupPlayerById.get(selectedLineup[index]!)!;
                          return (
                            <button
                              key={`${slot.x}-${slot.y}-${player.id}`}
                              data-lineup-slot={index}
                              className={`player-card ${lineupFocus === player.id ? "player-card-focused" : ""}${lineupDrag?.targetSlot === index ? " player-card-drop-target" : ""}`}
                              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                              onClick={() => setLineupFocus(player.id)}
                            >
                              <strong>{player.rating}</strong>
                              <span>{player.pos}</span>
                              <PlayerHead name={player.name} photoUrl={player.photo} />
                              <b>{player.name}</b>
                            </button>
                          );
                        })}
                      </div>
                      <div className="lineup-bench">
                        <span>{t("substitutes")}</span>
                        {currentNationalTeam.squad
                          .filter((player) => !selectedLineup.includes(player.id))
                          .map((player) => (
                            <button
                              key={player.id}
                              className={`bench-card ${selectedLineup.includes(player.id) ? "selected" : ""}`}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                setLineupDrag({
                                  playerId: player.id,
                                  x: event.clientX,
                                  y: event.clientY,
                                  startX: event.clientX,
                                  startY: event.clientY,
                                  targetSlot: null,
                                  moved: false,
                                });
                              }}
                              onClick={(event) => {
                                if (suppressBenchClick.current) {
                                  event.preventDefault();
                                  return;
                                }
                                setSelectedLineup((current) => {
                                  if (current.includes(player.id)) return current;
                                  const next = current.map((id) => (id === lineupFocus ? player.id : id));
                                  return next.includes(player.id) ? next : current;
                                });
                                setLineupFocus(player.id);
                              }}
                            >
                              <strong>{player.rating}</strong>
                              <PlayerHead name={player.name} photoUrl={player.photo} />
                              <b>{player.name}</b>
                              <em>{player.pos}</em>
                            </button>
                          ))}
                      </div>
                    </div>
                    {lineupDrag && (
                      <div
                        className="lineup-drag-ghost"
                        style={{
                          left: lineupDrag.x,
                          top: lineupDrag.y,
                        }}
                      >
                        {(() => {
                          const player = lineupPlayerById.get(lineupDrag.playerId)!;
                          return (
                            <>
                              <strong>{player.rating}</strong>
                              <PlayerHead name={player.name} photoUrl={player.photo} />
                              <b>{player.name}</b>
                              <em>{player.pos}</em>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
                {menuTab === "worldcup" && (
                  <>
                    <div className="menu-premium-strip">
                      <span>{t("quickTactics")}</span>
                      <span>{t("stadiumRadio")}</span>
                      <span>{t("replayCards")}</span>
                    </div>
                    <div className="menu-panel worldcup-panel">
                      <div className="menu-panel-head">
                        <span>{t("worldCup2026")}</span>
                        <b>{t("worldCupRange")}</b>
                      </div>
                      <div className="worldcup-list">
                        {WORLD_CUP_FIXTURES.map((fixture) => (
                          <button
                            key={`${fixture.date}-${fixture.group}-${fixture.home}-${fixture.away}`}
                            className="fixture-row"
                            onClick={() => startMatch(0)}
                          >
                            <span className="fixture-date">{fixture.date}</span>
                            <span className="fixture-main">
                              <b>{fixture.home}</b>
                              <em>vs</em>
                              <b>{fixture.away}</b>
                            </span>
                            <span className="fixture-meta">
                              {fixture.group} · {fixture.time} · {fixture.venue}
                            </span>
                            <span className="fixture-play">{t("playFixture")}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** A large tappable menu button (works with touch and mouse). */
function BigButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): React.ReactNode {
  return (
    <button
      className="menu-big-button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function MenuModeButton({
  tone,
  kicker,
  title,
  note,
  image,
  onClick,
}: {
  tone: "yellow" | "green" | "blue";
  kicker: string;
  title: string;
  note: string;
  image?: string;
  onClick: () => void;
}): React.ReactNode {
  return (
    <button className={`menu-mode-button mode-${tone}${image ? " image-mode-button" : ""}`} onClick={onClick}>
      {image ? (
        <>
          <img src={image} alt={title} />
          <span className="image-mode-caption">{title}</span>
          <em className="image-mode-note">{note}</em>
        </>
      ) : (
        <>
          <span>{kicker}</span>
          <b>{title}</b>
          <em>{note}</em>
        </>
      )}
    </button>
  );
}

function SoundToggleButton({
  muted,
  onToggle,
  variant,
  style,
}: {
  muted: boolean;
  onToggle: () => void;
  variant: "menu" | "hud";
  style?: CSSProperties;
}): React.ReactNode {
  const { t } = useI18n();
  return (
    <button
      className={`sound-toggle-button sound-toggle-${variant}`}
      onClick={onToggle}
      aria-label={`${t("sound")}: ${muted ? t("soundOff") : t("soundOn")}`}
      style={style}
    >
      <span>{t("sound")}</span>
      <b>{muted ? t("soundOff") : t("soundOn")}</b>
    </button>
  );
}

function RadioToggleButton({
  enabled,
  onToggle,
  variant,
  longLabel,
}: {
  enabled: boolean;
  onToggle: () => void;
  variant: "menu" | "hud";
  longLabel?: boolean;
}): React.ReactNode {
  const { t } = useI18n();
  return (
    <button
      className={`radio-toggle-button radio-toggle-${variant}`}
      onClick={onToggle}
      aria-label={`${longLabel ? t("stadiumRadio") : t("radio")}: ${enabled ? t("soundOn") : t("soundOff")}`}
    >
      <span>{longLabel ? t("stadiumRadio") : t("radio")}</span>
      <b>{enabled ? t("soundOn") : t("soundOff")}</b>
    </button>
  );
}

function LanguagePicker({
  language,
  onChange,
}: {
  language: AppLanguage;
  onChange: (language: AppLanguage) => void;
}): React.ReactNode {
  const { t } = useI18n();
  return (
    <label className="menu-language-picker">
      <span>{t("language")}</span>
      <select
        value={language}
        onChange={(event) => onChange(event.target.value as AppLanguage)}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function LanguagePrompt({
  language,
  onChange,
  onConfirm,
}: {
  language: AppLanguage;
  onChange: (language: AppLanguage) => void;
  onConfirm: () => void;
}): React.ReactNode {
  const { t } = useI18n();
  return (
    <div className="menu-language-modal-backdrop">
      <div className="menu-language-modal">
        <span>{t("chooseLanguage")}</span>
        <b>{t("chooseLanguageNote")}</b>
        <select
          value={language}
          onChange={(event) => onChange(event.target.value as AppLanguage)}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
        <button className="menu-big-button menu-language-confirm" onClick={onConfirm}>
          {t("continueLabel")}
        </button>
      </div>
    </div>
  );
}

/** The classic shoot-out tracker: a row of ticks/crosses per team. */
function ShootoutBoard(): React.ReactNode {
  const detail = useStore((s) => s.pensDetail);
  const humanTeam = useStore((s) => s.humanTeam);
  const nationalTeam = useStore((s) => s.nationalTeam);
  const opponentTeam = useStore((s) => s.opponentTeam);
  const mode = useStore((s) => s.mode);
  const sides =
    mode === "menu"
      ? getPreviewMatchSidesFor(nationalTeam, opponentTeam, humanTeam)
      : getConfiguredMatchSides();
  if (!detail) return null;
  const rounds = Math.max(5, detail[0].length, detail[1].length);
  return (
    <div
      style={{
        position: "absolute",
        top: 70,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(8, 12, 24, 0.85)",
        borderRadius: 8,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
      }}
    >
      {([0, 1] as const).map((t) => (
        <div key={t} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            style={{
              width: 11,
              height: 11,
              background: sides[t].color,
              borderRadius: 2,
              marginRight: 4,
            }}
          />
          {Array.from({ length: rounds }, (_, i) => {
            const o = detail[t][i];
            return (
              <span
                key={i}
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#fff",
                  background:
                    o === "g" ? "#2eb84a" : o === "m" ? "#d8342c" : "transparent",
                  border: o ? "none" : "2px solid rgba(255,255,255,0.35)",
                }}
              >
                {o === "g" ? "✓" : o === "m" ? "✕" : ""}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PlayersToggle(): React.ReactNode {
  const { t } = useI18n();
  const players = useStore((s) => s.players);
  return (
    <button
      className="menu-option tile-blue"
      onClick={() => act().togglePlayers()}
    >
      <span className="menu-key">J</span>
      <span className="menu-option-label">{t("players")}</span>
      <span className="menu-choice-line">
        <span className={players === 1 ? "active-choice yellow-choice" : "muted-choice"}>{t("onePlayer")}</span>
        <span className={players === 2 ? "active-choice blue-choice" : "muted-choice"}>{t("twoPlayers")}</span>
      </span>
      {players === 2 && (
        <span className="menu-option-note">
          {t("versusNote")}
        </span>
      )}
    </button>
  );
}

function NationalTeamSummary({
  team,
  opponent,
  onOpen,
}: {
  team: string;
  opponent: string;
  onOpen: () => void;
}): React.ReactNode {
  const { t } = useI18n();
  return (
    <button
      className="menu-option tile-red"
      onClick={onOpen}
    >
      <span className="menu-key">E</span>
      <span className="menu-option-label">{t("team")}</span>
      <span className="menu-choice-line">
        <span className="active-choice red-choice">{team}</span>
        <span className="muted-choice">vs {opponent}</span>
      </span>
      <span className="menu-option-note">
        {t("teamNote", { team })}
      </span>
    </button>
  );
}

function EmptyMenu({ title }: { title: string }): React.ReactNode {
  return (
    <div className="menu-panel">
      <div className="menu-panel-head">
        <span>{title}</span>
        <b />
      </div>
      <div className="menu-empty-body" />
    </div>
  );
}

/** CLUB tab: every club of the big five leagues + Europe's famous names,
 *  grouped by country, each with its kit-colored crest. */
function ClubsMenu(): React.ReactNode {
  const [league, setLeague] = useState<string>(LEAGUES[0]!.id);
  const current = LEAGUES.find((l) => l.id === league) ?? LEAGUES[0]!;
  return (
    <div className="menu-panel club-panel">
      <div className="menu-panel-head">
        <span>Clubs</span>
        <b>
          {current.flag} {current.name} · {current.clubs.length} clubs
        </b>
      </div>
      <div className="club-league-tabs">
        {LEAGUES.map((l) => (
          <button
            key={l.id}
            className={`club-league-tab${l.id === league ? " active" : ""}`}
            onClick={() => setLeague(l.id)}
          >
            <span>{l.flag}</span>
            <b>{l.country}</b>
          </button>
        ))}
      </div>
      <div className="club-grid">
        {current.clubs.map((club) => (
          <div
            key={club.name}
            className="club-card"
            style={{ "--club-color": club.color, "--club-color2": club.color2 } as CSSProperties}
          >
            <span className="club-crest">
              <span>{club.code}</span>
            </span>
            <b>{club.name}</b>
            <small>{club.city}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchupTeamCard({
  teamId,
  side,
  isControlled,
  onCycle,
  onPlay,
}: {
  teamId: NationalTeamId;
  side: "home" | "away";
  isControlled: boolean;
  onCycle: () => void;
  onPlay: () => void;
}): React.ReactNode {
  const { t } = useI18n();
  const team = getNationalTeam(teamId);
  const captain = getTeamCaptain(teamId);
  const ovr = getTeamOverall(teamId);
  return (
    <div className={`matchup-team matchup-team-${side}`} style={{ borderColor: team.color }}>
      <span className={`matchup-badge${isControlled ? "" : " matchup-badge-cpu"}`}>
        {isControlled ? "P1" : "CPU"}
      </span>
      <button className="matchup-change" onClick={onCycle} title="Changer d'équipe">
        <span className="matchup-flag">{TEAM_FLAG[teamId]}</span>
        <span className="matchup-change-hint">⟲</span>
      </button>
      <b className="matchup-name">{team.label}</b>
      <div className="matchup-ovr">
        <b>{ovr}</b>
        <span>OVR</span>
      </div>
      <div className="matchup-captain">
        <span className="matchup-cap-kit" style={{ background: team.color }}>
          <PlayerHead name={captain.name} photoUrl={captain.photo} />
          <span className="matchup-cap-band">C</span>
        </span>
        <div className="matchup-cap-text">
          <span>Capitaine</span>
          <b>{captain.name}</b>
          <i>
            {captain.pos} · {captain.rating}
          </i>
        </div>
      </div>
      {!isControlled && (
        <button className="matchup-pick" onClick={onPlay}>
          {t("play")}
        </button>
      )}
    </div>
  );
}

const DIFFICULTY_COLORS = ["#7ddb5a", "#ffe94a", "#ff6b4a"];

function DifficultyPicker(): React.ReactNode {
  const { t } = useI18n();
  const difficulty = useStore((s) => s.difficulty);
  const difficultyNames = [t("easy"), t("normal"), t("hard")];
  return (
    <button
      className="menu-option tile-yellow"
      onClick={() => act().cycleDifficulty()}
    >
      <span className="menu-key">D</span>
      <span className="menu-option-label">{t("difficulty")}</span>
      <span className="menu-choice-line">
        {difficultyNames.map((name, i) => (
          <span
            key={name}
            className={i === difficulty ? "active-choice" : "muted-choice"}
            style={{ color: i === difficulty ? DIFFICULTY_COLORS[i] : undefined }}
          >
            {name}
          </span>
        ))}
      </span>
    </button>
  );
}

function ImportantToggle(): React.ReactNode {
  const { t } = useI18n();
  const important = useStore((s) => s.important);
  return (
    <button
      className="menu-option tile-red"
      onClick={() => act().toggleImportant()}
    >
      <span className="menu-key">M</span>
      <span className="menu-option-label">{t("importantMatch")}</span>
      <b className={important ? "active-choice yellow-choice" : "muted-choice"}>
        {important ? t("yes") : t("no")}
      </b>
      <span className="menu-option-note">
        {t("importantNote")}
      </span>
    </button>
  );
}

const RADAR_W = 220;
const RADAR_H = 148;

function Radar(): React.ReactNode {
  const radar = useStore((s) => s.radar);
  const humanTeam = useStore((s) => s.humanTeam);
  const nationalTeam = useStore((s) => s.nationalTeam);
  const opponentTeam = useStore((s) => s.opponentTeam);
  const mode = useStore((s) => s.mode);
  const sides =
    mode === "menu"
      ? getPreviewMatchSidesFor(nationalTeam, opponentTeam, humanTeam)
      : getConfiguredMatchSides();
  const ref = useRef<HTMLCanvasElement>(null);
  // hide the radar while aiming a set piece — it sits right over the ball
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      setHidden(humanSetPieceActive());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, RADAR_W, RADAR_H);
    ctx.fillStyle = "rgba(10, 40, 14, 0.75)";
    ctx.fillRect(0, 0, RADAR_W, RADAR_H);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(4, 4, RADAR_W - 8, RADAR_H - 8);
    ctx.beginPath();
    ctx.moveTo(RADAR_W / 2, 4);
    ctx.lineTo(RADAR_W / 2, RADAR_H - 4);
    ctx.stroke();

    for (let i = 0; i + 2 < radar.length; i += 3) {
      const x = (radar[i]! * 0.92 * 0.5 + 0.5) * RADAR_W;
      const y = (radar[i + 1]! * 0.92 * 0.5 + 0.5) * RADAR_H;
      const code = radar[i + 2]!;
      ctx.beginPath();
      if (code === 4) {
        ctx.fillStyle = "#ffffff";
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = sides[(code % 2) as 0 | 1].color;
        ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      }
      ctx.fill();
      if (code === 2 || code === 3) {
        ctx.strokeStyle = "#ffe94a";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
  }, [radar]);

  if (hidden) return null;
  return (
    <canvas
      ref={ref}
      width={RADAR_W}
      height={RADAR_H}
      style={{
        position: "absolute",
        bottom: 18,
        left: "50%",
        transform: "translateX(-50%)",
        opacity: 0.9,
        borderRadius: 6,
      }}
    />
  );
}
