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

  // --- training ---
  "Entraînement":         { en: "Training", es: "Entrenamiento", pt: "Treino", de: "Training", it: "Allenamento", nl: "Training" },
  "Corner":               { en: "Corner", es: "Córner", pt: "Canto", de: "Ecke", it: "Calcio d'angolo", nl: "Hoekschop" },
  "Coup franc":           { en: "Free kick", es: "Tiro libre", pt: "Livre", de: "Freistoß", it: "Punizione", nl: "Vrije trap" },
  "Penalty":              { en: "Penalty", es: "Penalti", pt: "Grande penalidade", de: "Elfmeter", it: "Rigore", nl: "Strafschop" },
  "Dribble":              { en: "Dribbling", es: "Regate", pt: "Drible", de: "Dribbling", it: "Dribbling", nl: "Dribbelen" },
  "Gardien":              { en: "Goalkeeper", es: "Portero", pt: "Guarda-redes", de: "Torwart", it: "Portiere", nl: "Keeper" },
  "Centre depuis le corner": { en: "Cross from the corner", es: "Centro desde el córner", pt: "Cruzamento do canto", de: "Flanke von der Ecke", it: "Cross dal corner", nl: "Voorzet vanaf de hoek" },
  "Passe le mur":         { en: "Beat the wall", es: "Supera la barrera", pt: "Passa a barreira", de: "Über die Mauer", it: "Supera la barriera", nl: "Over de muur" },
  "Tire au but face au gardien": { en: "Shoot past the keeper", es: "Dispara ante el portero", pt: "Remata perante o guarda-redes", de: "Schieße am Torwart vorbei", it: "Tira davanti al portiere", nl: "Schiet langs de keeper" },
  "Élimine ton adversaire": { en: "Beat your opponent", es: "Supera a tu rival", pt: "Ultrapassa o adversário", de: "Überwinde deinen Gegner", it: "Supera l'avversario", nl: "Versla je tegenstander" },
  "Le bot tire, arrête-le !": { en: "The bot shoots, stop it!", es: "El bot dispara, ¡párala!", pt: "O bot remata, defende!", de: "Der Bot schießt, halt ihn!", it: "Il bot tira, parala!", nl: "De bot schiet, stop hem!" },

  // --- line-up ---
  "Composition":          { en: "Line-up", es: "Alineación", pt: "Escalação", de: "Aufstellung", it: "Formazione", nl: "Opstelling" },
  "Remplaçants":          { en: "Substitutes", es: "Suplentes", pt: "Suplentes", de: "Ersatzbank", it: "Riserve", nl: "Wissels" },
  "Jouer le match":       { en: "Play the match", es: "Jugar el partido", pt: "Jogar o jogo", de: "Spiel starten", it: "Gioca la partita", nl: "Speel de wedstrijd" },

  // --- clubs / national / defi ---
  "Affronter ce club":       { en: "Play this club", es: "Enfrentar a este club", pt: "Enfrentar este clube", de: "Gegen diesen Verein", it: "Affronta questo club", nl: "Speel tegen deze club" },
  "Affronter cette équipe":  { en: "Play this team", es: "Enfrentar a este equipo", pt: "Enfrentar esta equipa", de: "Gegen dieses Team", it: "Affronta questa squadra", nl: "Speel tegen dit team" },
  "Jouer avec cette équipe": { en: "Play as this team", es: "Jugar con este equipo", pt: "Jogar com esta equipa", de: "Mit diesem Team spielen", it: "Gioca con questa squadra", nl: "Speel met dit team" },
  "Autres pays":          { en: "Other countries", es: "Otros países", pt: "Outros países", de: "Andere Länder", it: "Altri paesi", nl: "Andere landen" },
  "Afrique":              { en: "Africa", es: "África", pt: "África", de: "Afrika", it: "Africa", nl: "Afrika" },
  "Europe":               { en: "Europe", es: "Europa", pt: "Europa", de: "Europa", it: "Europa", nl: "Europa" },
  "Amérique du Sud":      { en: "South America", es: "Sudamérica", pt: "América do Sul", de: "Südamerika", it: "Sud America", nl: "Zuid-Amerika" },
  "Amér. du Nord":        { en: "North America", es: "Norteamérica", pt: "América do Norte", de: "Nordamerika", it: "Nord America", nl: "Noord-Amerika" },
  "Asie / Océanie":       { en: "Asia / Oceania", es: "Asia / Oceanía", pt: "Ásia / Oceânia", de: "Asien / Ozeanien", it: "Asia / Oceania", nl: "Azië / Oceanië" },
  "Bravo, objectif rempli !": { en: "Well done, objective complete!", es: "¡Bien hecho, objetivo cumplido!", pt: "Boa, objetivo cumprido!", de: "Stark, Ziel erreicht!", it: "Bravo, obiettivo raggiunto!", nl: "Goed gedaan, doel behaald!" },
  "Pas cette fois — réessaie un autre défi.": { en: "Not this time — try another challenge.", es: "Esta vez no — prueba otro reto.", pt: "Desta vez não — tenta outro desafio.", de: "Nicht diesmal — versuch eine andere Aufgabe.", it: "Non stavolta — prova un'altra sfida.", nl: "Deze keer niet — probeer een andere uitdaging." },

  // --- matches gallery ---
  "Mes matchs":           { en: "My matches", es: "Mis partidos", pt: "Os meus jogos", de: "Meine Spiele", it: "Le mie partite", nl: "Mijn wedstrijden" },

  // --- settings: tabs + sections ---
  "🖥️ Graphique":         { en: "🖥️ Graphics", es: "🖥️ Gráficos", pt: "🖥️ Gráficos", de: "🖥️ Grafik", it: "🖥️ Grafica", nl: "🖥️ Grafisch" },
  "🎮 Gameplay":          { en: "🎮 Gameplay", es: "🎮 Jugabilidad", pt: "🎮 Jogabilidade", de: "🎮 Gameplay", it: "🎮 Gameplay", nl: "🎮 Gameplay" },
  "🔊 Audio":             { en: "🔊 Audio", es: "🔊 Audio", pt: "🔊 Áudio", de: "🔊 Audio", it: "🔊 Audio", nl: "🔊 Audio" },
  "⌨️ Commandes":         { en: "⌨️ Controls", es: "⌨️ Controles", pt: "⌨️ Comandos", de: "⌨️ Steuerung", it: "⌨️ Comandi", nl: "⌨️ Besturing" },
  "RÉGLAGES":             { en: "SETTINGS", es: "AJUSTES", pt: "DEFINIÇÕES", de: "OPTIONEN", it: "OPZIONI", nl: "INSTELLINGEN" },
  "← Menu":               { en: "← Menu", es: "← Menú", pt: "← Menu", de: "← Menü", it: "← Menu", nl: "← Menu" },
  "Match":                { en: "Match", es: "Partido", pt: "Jogo", de: "Spiel", it: "Partita", nl: "Wedstrijd" },
  "Assistances":          { en: "Assists", es: "Asistencias", pt: "Assistências", de: "Hilfen", it: "Assistenze", nl: "Hulp" },
  "Déplacement":          { en: "Movement", es: "Movimiento", pt: "Movimento", de: "Bewegung", it: "Movimento", nl: "Beweging" },
  "Avec le ballon":       { en: "On the ball", es: "Con el balón", pt: "Com a bola", de: "Am Ball", it: "Con la palla", nl: "Aan de bal" },
  "Sans le ballon":       { en: "Off the ball", es: "Sin el balón", pt: "Sem a bola", de: "Ohne Ball", it: "Senza palla", nl: "Zonder bal" },
  "Général":              { en: "General", es: "General", pt: "Geral", de: "Allgemein", it: "Generale", nl: "Algemeen" },
  // --- settings: match ---
  "Difficulté du CPU (Humain vs CPU)": { en: "CPU difficulty (Human vs CPU)", es: "Dificultad de la CPU (Humano vs CPU)", pt: "Dificuldade do CPU (Humano vs CPU)", de: "CPU-Schwierigkeit (Mensch vs CPU)", it: "Difficoltà CPU (Umano vs CPU)", nl: "CPU-moeilijkheid (Mens vs CPU)" },
  "Durée du match":       { en: "Match length", es: "Duración del partido", pt: "Duração do jogo", de: "Spieldauer", it: "Durata partita", nl: "Wedstrijdduur" },
  "Force réaliste des équipes": { en: "Realistic team strength", es: "Fuerza realista de los equipos", pt: "Força realista das equipas", de: "Realistische Teamstärke", it: "Forza realistica delle squadre", nl: "Realistische teamsterkte" },
  "Chaque équipe joue à son vrai niveau (selon son OVR) : les nations faibles jouent moins bien, les grandes nations mieux. Désactivé = toutes à niveau égal.": { en: "Each team plays at its real level (by its OVR): weaker nations play worse, top nations better. Off = all equal.", es: "Cada equipo juega a su nivel real (según su OVR): las selecciones débiles juegan peor, las grandes mejor. Desactivado = todas iguales.", pt: "Cada equipa joga ao seu nível real (pelo OVR): as seleções fracas jogam pior, as grandes melhor. Desativado = todas iguais.", de: "Jedes Team spielt auf seinem echten Niveau (nach OVR): schwächere Nationen schlechter, Topnationen besser. Aus = alle gleich.", it: "Ogni squadra gioca al suo livello reale (in base all'OVR): le nazionali deboli giocano peggio, le grandi meglio. Disattivato = tutte uguali.", nl: "Elk team speelt op zijn echte niveau (op basis van OVR): zwakke landen spelen slechter, toplanden beter. Uit = allemaal gelijk." },
  "↺ Valeurs d'usine":    { en: "↺ Factory defaults", es: "↺ Valores de fábrica", pt: "↺ Valores de fábrica", de: "↺ Werkseinstellungen", it: "↺ Valori di fabbrica", nl: "↺ Fabrieksinstellingen" },
  "✔ Activé":             { en: "✔ On", es: "✔ Activado", pt: "✔ Ativado", de: "✔ An", it: "✔ Attivo", nl: "✔ Aan" },
  "Désactivé":            { en: "Off", es: "Desactivado", pt: "Desativado", de: "Aus", it: "Disattivato", nl: "Uit" },
  // --- settings: gameplay assists ---
  "Passe courte — assistance direction": { en: "Short pass — direction assist", es: "Pase corto — asistencia de dirección", pt: "Passe curto — assistência de direção", de: "Kurzpass — Richtungshilfe", it: "Passaggio corto — assist direzione", nl: "Korte pass — richtinghulp" },
  "Passe courte — assistance puissance": { en: "Short pass — power assist", es: "Pase corto — asistencia de potencia", pt: "Passe curto — assistência de força", de: "Kurzpass — Krafthilfe", it: "Passaggio corto — assist potenza", nl: "Korte pass — krachthulp" },
  "Passe en profondeur — direction": { en: "Through ball — direction", es: "Pase en profundidad — dirección", pt: "Passe em profundidade — direção", de: "Steilpass — Richtung", it: "Passaggio filtrante — direzione", nl: "Dieptepass — richting" },
  "Passe en profondeur — puissance": { en: "Through ball — power", es: "Pase en profundidad — potencia", pt: "Passe em profundidade — força", de: "Steilpass — Kraft", it: "Passaggio filtrante — potenza", nl: "Dieptepass — kracht" },
  "Centre / lob — direction": { en: "Cross / lob — direction", es: "Centro / vaselina — dirección", pt: "Cruzamento / lob — direção", de: "Flanke / Lupfer — Richtung", it: "Cross / pallonetto — direzione", nl: "Voorzet / stift — richting" },
  "Centre / lob — puissance": { en: "Cross / lob — power", es: "Centro / vaselina — potencia", pt: "Cruzamento / lob — força", de: "Flanke / Lupfer — Kraft", it: "Cross / pallonetto — potenza", nl: "Voorzet / stift — kracht" },
  "Tir — assistance direction": { en: "Shot — direction assist", es: "Tiro — asistencia de dirección", pt: "Remate — assistência de direção", de: "Schuss — Richtungshilfe", it: "Tiro — assist direzione", nl: "Schot — richtinghulp" },
  "Agilité des joueurs":  { en: "Player agility", es: "Agilidad de los jugadores", pt: "Agilidade dos jogadores", de: "Wendigkeit der Spieler", it: "Agilità dei giocatori", nl: "Behendigheid spelers" },
  "Accélération des joueurs": { en: "Player acceleration", es: "Aceleración de los jugadores", pt: "Aceleração dos jogadores", de: "Beschleunigung der Spieler", it: "Accelerazione dei giocatori", nl: "Versnelling spelers" },
  "Quantification directionnelle (plus « D-pad »)": { en: "Directional quantization (more \"D-pad\")", es: "Cuantización direccional (más «D-pad»)", pt: "Quantização direcional (mais «D-pad»)", de: "Richtungsquantisierung (mehr „D-Pad\")", it: "Quantizzazione direzionale (più \"D-pad\")", nl: "Richtingskwantisatie (meer \"D-pad\")" },
  // --- settings: audio + graphics ---
  "Volume du jeu":        { en: "Game volume", es: "Volumen del juego", pt: "Volume do jogo", de: "Spiellautstärke", it: "Volume di gioco", nl: "Spelvolume" },
  "Qualité graphique (CPU / GPU)": { en: "Graphics quality (CPU / GPU)", es: "Calidad gráfica (CPU / GPU)", pt: "Qualidade gráfica (CPU / GPU)", de: "Grafikqualität (CPU / GPU)", it: "Qualità grafica (CPU / GPU)", nl: "Grafische kwaliteit (CPU / GPU)" },
  "Plein écran":          { en: "Fullscreen", es: "Pantalla completa", pt: "Ecrã inteiro", de: "Vollbild", it: "Schermo intero", nl: "Volledig scherm" },
  "Activer le plein écran": { en: "Enable fullscreen", es: "Activar pantalla completa", pt: "Ativar ecrã inteiro", de: "Vollbild aktivieren", it: "Attiva schermo intero", nl: "Volledig scherm aan" },
  "✔ Plein écran activé": { en: "✔ Fullscreen on", es: "✔ Pantalla completa activada", pt: "✔ Ecrã inteiro ativado", de: "✔ Vollbild an", it: "✔ Schermo intero attivo", nl: "✔ Volledig scherm aan" },
  "↺ Touches par défaut": { en: "↺ Default keys", es: "↺ Teclas por defecto", pt: "↺ Teclas predefinidas", de: "↺ Standardtasten", it: "↺ Tasti predefiniti", nl: "↺ Standaardtoetsen" },
  // --- settings: movement / action key labels ---
  "Haut":                 { en: "Up", es: "Arriba", pt: "Cima", de: "Hoch", it: "Su", nl: "Omhoog" },
  "Bas":                  { en: "Down", es: "Abajo", pt: "Baixo", de: "Runter", it: "Giù", nl: "Omlaag" },
  "Gauche":               { en: "Left", es: "Izquierda", pt: "Esquerda", de: "Links", it: "Sinistra", nl: "Links" },
  "Droite":               { en: "Right", es: "Derecha", pt: "Direita", de: "Rechts", it: "Destra", nl: "Rechts" },
  "Passe en profondeur":  { en: "Through ball", es: "Pase en profundidad", pt: "Passe em profundidade", de: "Steilpass", it: "Passaggio filtrante", nl: "Dieptepass" },
  "Centre / lob":         { en: "Cross / lob", es: "Centro / vaselina", pt: "Cruzamento / lob", de: "Flanke / Lupfer", it: "Cross / pallonetto", nl: "Voorzet / stift" },
  "Passe":                { en: "Pass", es: "Pase", pt: "Passe", de: "Pass", it: "Passaggio", nl: "Pass" },
  "Tir":                  { en: "Shot", es: "Tiro", pt: "Remate", de: "Schuss", it: "Tiro", nl: "Schot" },
  "Gardien à la balle":   { en: "Keeper to ball", es: "Portero al balón", pt: "Guarda-redes à bola", de: "Torwart zum Ball", it: "Portiere alla palla", nl: "Keeper naar bal" },
  "Tacle glissé":         { en: "Sliding tackle", es: "Entrada deslizante", pt: "Desarme deslizante", de: "Grätsche", it: "Scivolata", nl: "Sliding" },
  "Pressing":             { en: "Pressure", es: "Presión", pt: "Pressão", de: "Pressing", it: "Pressing", nl: "Druk zetten" },
  "Pressing d'équipe":    { en: "Team pressure", es: "Presión de equipo", pt: "Pressão de equipa", de: "Team-Pressing", it: "Pressing di squadra", nl: "Teamdruk" },
  "Changer de joueur":    { en: "Switch player", es: "Cambiar de jugador", pt: "Trocar de jogador", de: "Spieler wechseln", it: "Cambia giocatore", nl: "Speler wisselen" },
  "Spécial / geste":      { en: "Special / skill", es: "Especial / gesto", pt: "Especial / gesto", de: "Spezial / Trick", it: "Speciale / gesto", nl: "Speciaal / trucje" },
  "Sprint":               { en: "Sprint", es: "Sprint", pt: "Sprint", de: "Sprint", it: "Scatto", nl: "Sprint" },
  "Dribble lent":         { en: "Slow dribble", es: "Regate lento", pt: "Drible lento", de: "Langsames Dribbling", it: "Dribbling lento", nl: "Langzaam dribbelen" },
  "Sélection":            { en: "Select", es: "Selección", pt: "Selecionar", de: "Auswahl", it: "Seleziona", nl: "Selecteren" },
  "Valider / démarrer":   { en: "Confirm / start", es: "Confirmar / empezar", pt: "Confirmar / iniciar", de: "Bestätigen / Start", it: "Conferma / avvia", nl: "Bevestigen / start" },
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
