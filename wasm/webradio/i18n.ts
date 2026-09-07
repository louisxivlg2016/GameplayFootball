/**
 * Web-UI localization. The HTML menus were authored in French; L("<french>")
 * returns the string in the currently-selected language (the same language the
 * radio/menu dropdown picks), falling back to the French source when a language
 * isn't covered. Fully translated: fr, en, es, pt, de, it, nl. Screens call L()
 * at render time and re-render on the "gpf-langchange" event fired by the picker.
 */
import { menuLanguage } from "./radioEngine";

type Lang = string;
// french source -> { lang: translation }. Missing lang -> french source is used.
const T: Record<string, Record<Lang, string>> = {
  // --- home sidebar ---
  "Matchs":      { en: "Matches", es: "Partidos", pt: "Jogos", de: "Spiele", it: "Partite", nl: "Wedstrijden" },
  // --- online multiplayer panel ---
  "Multijoueur en ligne": { en: "Online multiplayer", es: "Multijugador en línea", pt: "Multijogador online",
    de: "Online-Mehrspieler", it: "Multigiocatore online", nl: "Online multiplayer" },
  "Créer une partie": { en: "Create a game", es: "Crear una partida", pt: "Criar um jogo",
    de: "Spiel erstellen", it: "Crea una partita", nl: "Spel aanmaken" },
  "Ton code (donne-le à ton ami)": { en: "Your code (give it to your friend)",
    es: "Tu código (dáselo a tu amigo)", pt: "O teu código (dá-o ao teu amigo)",
    de: "Dein Code (gib ihn deinem Freund)", it: "Il tuo codice (dallo al tuo amico)",
    nl: "Jouw code (geef hem aan je vriend)" },
  "📋 Copier le lien d'invitation": { en: "📋 Copy the invite link", es: "📋 Copiar el enlace de invitación",
    pt: "📋 Copiar o link de convite", de: "📋 Einladungslink kopieren", it: "📋 Copia il link d'invito",
    nl: "📋 Uitnodigingslink kopiëren" },
  "Ou tape le code de ton ami": { en: "Or type your friend's code", es: "O escribe el código de tu amigo",
    pt: "Ou escreve o código do teu amigo", de: "Oder tippe den Code deines Freundes",
    it: "Oppure digita il codice del tuo amico", nl: "Of typ de code van je vriend" },
  "Rejoindre":   { en: "Join", es: "Unirse", pt: "Entrar", de: "Beitreten", it: "Entra", nl: "Meedoen" },
  "Non connecté": { en: "Not connected", es: "Sin conexión", pt: "Não ligado", de: "Nicht verbunden",
    it: "Non connesso", nl: "Niet verbonden" },
  "Connexion au serveur…": { en: "Connecting to the server…", es: "Conectando al servidor…",
    pt: "A ligar ao servidor…", de: "Verbinde mit dem Server…", it: "Connessione al server…",
    nl: "Verbinden met de server…" },
  "Recherche de ": { en: "Looking for ", es: "Buscando ", pt: "À procura de ", de: "Suche nach ",
    it: "Ricerca di ", nl: "Zoeken naar " },
  "Toujours rien — nouvel essai ": { en: "Still nothing — retry ", es: "Todavía nada — intento ",
    pt: "Ainda nada — nova tentativa ", de: "Noch nichts — Versuch ", it: "Ancora nulla — tentativo ",
    nl: "Nog niets — poging " },
  "Personne n'attend avec ce code. Sur l'AUTRE appareil, clique « Créer une partie » et donne-moi le code affiché.": {
    en: "Nobody is hosting that code. On the OTHER device, press \"Create a game\" and use the code it shows.",
    es: "Nadie aloja ese código. En el OTRO dispositivo pulsa «Crear una partida» y usa el código que aparezca.",
    pt: "Ninguém está a alojar esse código. No OUTRO aparelho, carrega em «Criar um jogo» e usa o código mostrado.",
    de: "Niemand hostet diesen Code. Drücke auf dem ANDEREN Gerät „Spiel erstellen\" und nimm den angezeigten Code.",
    it: "Nessuno ospita quel codice. Sull'ALTRO dispositivo premi «Crea una partita» e usa il codice mostrato.",
    nl: "Niemand host die code. Druk op het ANDERE apparaat op \"Spel aanmaken\" en gebruik de getoonde code." },
  "Donne le code (ou le lien) à ton ami et attends…": {
    en: "Give the code (or the link) to your friend and wait…",
    es: "Dale el código (o el enlace) a tu amigo y espera…",
    pt: "Dá o código (ou o link) ao teu amigo e espera…",
    de: "Gib deinem Freund den Code (oder den Link) und warte…",
    it: "Dai il codice (o il link) al tuo amico e aspetta…",
    nl: "Geef de code (of de link) aan je vriend en wacht…" },
  "Connecté ✓ — clique « Lancer ensemble »": { en: "Connected ✓ — press \"Start together\"",
    es: "Conectado ✓ — pulsa «Lanzar juntos»", pt: "Ligado ✓ — carrega em «Começar juntos»",
    de: "Verbunden ✓ — drücke „Gemeinsam starten\"", it: "Connesso ✓ — premi «Inizia insieme»",
    nl: "Verbonden ✓ — druk op \"Samen starten\"" },
  "Déconnecté":  { en: "Disconnected", es: "Desconectado", pt: "Desligado", de: "Getrennt",
    it: "Disconnesso", nl: "Verbroken" },
  "Lancer le match ensemble": { en: "Start the match together", es: "Lanzar el partido juntos",
    pt: "Começar o jogo juntos", de: "Das Spiel gemeinsam starten", it: "Inizia la partita insieme",
    nl: "Start de wedstrijd samen" },
  "Lancement du match…": { en: "Starting the match…", es: "Lanzando el partido…", pt: "A começar o jogo…",
    de: "Spiel wird gestartet…", it: "Avvio della partita…", nl: "Wedstrijd starten…" },
  "Connecte-toi d'abord à ton ami": { en: "Connect to your friend first", es: "Conéctate primero a tu amigo",
    pt: "Liga-te primeiro ao teu amigo", de: "Verbinde dich zuerst mit deinem Freund",
    it: "Collegati prima al tuo amico", nl: "Maak eerst verbinding met je vriend" },
  "Graine":      { en: "Seed", es: "Semilla", pt: "Semente", de: "Startwert", it: "Seme", nl: "Seed" },
  // --- back buttons, card tooltips, currency ---
  "← Menu": { "en": "← Menu", "es": "← Menú", "pt": "← Menu", "de": "← Menü", "nb": "← Meny", "it": "← Menu", "ga": "← Roghchlár", "nl": "← Menu", "hr": "← Izbornik", "ro": "← Meniu", "pl": "← Menu", "tr": "← Menü", "ru": "← Меню", "uk": "← Меню", "ar": "← القائمة", "hi": "← मेन्यू", "id": "← Menu", "vi": "← Menu", "th": "← เมนู", "ja": "← メニュー", "ko": "← 메뉴", "zh-CN": "← 菜单", "zh-TW": "← 選單" },
  "← Retour": { "en": "← Back", "es": "← Volver", "pt": "← Voltar", "de": "← Zurück", "nb": "← Tilbake", "it": "← Indietro", "ga": "← Ar ais", "nl": "← Terug", "hr": "← Natrag", "ro": "← Înapoi", "pl": "← Wstecz", "tr": "← Geri", "ru": "← Назад", "uk": "← Назад", "ar": "← رجوع", "hi": "← वापस", "id": "← Kembali", "vi": "← Quay lại", "th": "← ย้อนกลับ", "ja": "← 戻る", "ko": "← 뒤로", "zh-CN": "← 返回", "zh-TW": "← 返回" },
  "Jouer avec ce club": { "en": "Play as this club", "es": "Jugar con este club", "pt": "Jogar com este clube", "de": "Mit diesem Verein spielen", "nb": "Spill med denne klubben", "it": "Gioca con questo club", "ga": "Imir leis an gclub seo", "nl": "Speel met deze club", "hr": "Igraj s ovim klubom", "ro": "Joacă cu acest club", "pl": "Zagraj tym klubem", "tr": "Bu kulüple oyna", "ru": "Играть за этот клуб", "uk": "Грати за цей клуб", "ar": "العب بهذا النادي", "hi": "इस क्लब से खेलें", "id": "Main dengan klub ini", "vi": "Chơi với câu lạc bộ này", "th": "เล่นกับสโมสรนี้", "ja": "このクラブでプレイ", "ko": "이 클럽으로 플레이", "zh-CN": "使用该俱乐部", "zh-TW": "使用該俱樂部" },
  "Affronter ce club": { "en": "Face this club", "es": "Enfrentar a este club", "pt": "Defrontar este clube", "de": "Gegen diesen Verein spielen", "nb": "Møt denne klubben", "it": "Affronta questo club", "ga": "Téigh i gcoinne an chlub seo", "nl": "Neem het op tegen deze club", "hr": "Suoči se s ovim klubom", "ro": "Înfruntă acest club", "pl": "Zmierz się z tym klubem", "tr": "Bu kulübe karşı oyna", "ru": "Сыграть против этого клуба", "uk": "Зіграти проти цього клубу", "ar": "واجه هذا النادي", "hi": "इस क्लब का सामना करें", "id": "Lawan klub ini", "vi": "Đối đầu câu lạc bộ này", "th": "เจอกับสโมสรนี้", "ja": "このクラブと対戦", "ko": "이 클럽과 대결", "zh-CN": "对阵该俱乐部", "zh-TW": "對陣該俱樂部" },
  "Jouer avec cette équipe": { "en": "Play as this team", "es": "Jugar con esta selección", "pt": "Jogar com esta seleção", "de": "Mit diesem Team spielen", "nb": "Spill med dette laget", "it": "Gioca con questa squadra", "ga": "Imir leis an bhfoireann seo", "nl": "Speel met dit team", "hr": "Igraj s ovom reprezentacijom", "ro": "Joacă cu această echipă", "pl": "Zagraj tą drużyną", "tr": "Bu takımla oyna", "ru": "Играть за эту сборную", "uk": "Грати за цю збірну", "ar": "العب بهذا المنتخب", "hi": "इस टीम से खेलें", "id": "Main dengan tim ini", "vi": "Chơi với đội này", "th": "เล่นกับทีมนี้", "ja": "このチームでプレイ", "ko": "이 팀으로 플레이", "zh-CN": "使用该球队", "zh-TW": "使用該球隊" },
  "Affronter cette équipe": { "en": "Face this team", "es": "Enfrentar a esta selección", "pt": "Defrontar esta seleção", "de": "Gegen dieses Team spielen", "nb": "Møt dette laget", "it": "Affronta questa squadra", "ga": "Téigh i gcoinne na foirne seo", "nl": "Neem het op tegen dit team", "hr": "Suoči se s ovom reprezentacijom", "ro": "Înfruntă această echipă", "pl": "Zmierz się z tą drużyną", "tr": "Bu takıma karşı oyna", "ru": "Сыграть против этой сборной", "uk": "Зіграти проти цієї збірної", "ar": "واجه هذا المنتخب", "hi": "इस टीम का सामना करें", "id": "Lawan tim ini", "vi": "Đối đầu đội này", "th": "เจอกับทีมนี้", "ja": "このチームと対戦", "ko": "이 팀과 대결", "zh-CN": "对阵该球队", "zh-TW": "對陣該球隊" },
  "Ballons d'or": { "en": "Gold balls", "es": "Balones de oro", "pt": "Bolas de ouro", "de": "Goldbälle", "nb": "Gullballer", "it": "Palloni d'oro", "ga": "Liathróidí óir", "nl": "Gouden ballen", "hr": "Zlatne lopte", "ro": "Mingi de aur", "pl": "Złote piłki", "tr": "Altın toplar", "ru": "Золотые мячи", "uk": "Золоті м'ячі", "ar": "الكرات الذهبية", "hi": "गोल्डन बॉल", "id": "Bola emas", "vi": "Quả bóng vàng", "th": "ลูกบอลทองคำ", "ja": "ゴールドボール", "ko": "골드볼", "zh-CN": "金球", "zh-TW": "金球" },
  // --- home, clubs, graphics, lineup and training, in every language ---
  "Son": { "en": "Sound", "es": "Sonido", "pt": "Som", "de": "Ton", "nb": "Lyd", "it": "Audio", "ga": "Fuaim", "nl": "Geluid", "hr": "Zvuk", "ro": "Sunet", "pl": "Dźwięk", "tr": "Ses", "ru": "Звук", "uk": "Звук", "ar": "الصوت", "hi": "ध्वनि", "id": "Suara", "vi": "Âm thanh", "th": "เสียง", "ja": "サウンド", "ko": "사운드", "zh-CN": "声音", "zh-TW": "聲音" },
  "Radio stade": { "en": "Stadium radio", "es": "Radio del estadio", "pt": "Rádio do estádio", "de": "Stadionradio", "nb": "Stadionradio", "it": "Radio stadio", "ga": "Raidió staidiam", "nl": "Stadionradio", "hr": "Radio stadiona", "ro": "Radio stadion", "pl": "Radio stadionowe", "tr": "Stat radyosu", "ru": "Радио стадиона", "uk": "Радіо стадіону", "ar": "راديو الملعب", "hi": "स्टेडियम रेडियो", "id": "Radio stadion", "vi": "Radio sân vận động", "th": "วิทยุสนาม", "ja": "スタジアムラジオ", "ko": "경기장 라디오", "zh-CN": "球场电台", "zh-TW": "球場電台" },
  "Actif": { "en": "On", "es": "Activo", "pt": "Ativo", "de": "An", "nb": "På", "it": "Attivo", "ga": "Ar siúl", "nl": "Aan", "hr": "Uključeno", "ro": "Activ", "pl": "Włączone", "tr": "Açık", "ru": "Вкл", "uk": "Увімк", "ar": "مفعّل", "hi": "चालू", "id": "Aktif", "vi": "Bật", "th": "เปิด", "ja": "オン", "ko": "켜짐", "zh-CN": "开", "zh-TW": "開" },
  "Coupé": { "en": "Off", "es": "Apagado", "pt": "Desligado", "de": "Aus", "nb": "Av", "it": "Spento", "ga": "As", "nl": "Uit", "hr": "Isključeno", "ro": "Oprit", "pl": "Wyłączone", "tr": "Kapalı", "ru": "Выкл", "uk": "Вимк", "ar": "مغلق", "hi": "बंद", "id": "Mati", "vi": "Tắt", "th": "ปิด", "ja": "オフ", "ko": "꺼짐", "zh-CN": "关", "zh-TW": "關" },
  "⏳ chargement…": { "en": "⏳ loading…", "es": "⏳ cargando…", "pt": "⏳ a carregar…", "de": "⏳ lädt…", "nb": "⏳ laster…", "it": "⏳ caricamento…", "ga": "⏳ á lódáil…", "nl": "⏳ laden…", "hr": "⏳ učitavanje…", "ro": "⏳ se încarcă…", "pl": "⏳ ładowanie…", "tr": "⏳ yükleniyor…", "ru": "⏳ загрузка…", "uk": "⏳ завантаження…", "ar": "⏳ جارٍ التحميل…", "hi": "⏳ लोड हो रहा है…", "id": "⏳ memuat…", "vi": "⏳ đang tải…", "th": "⏳ กำลังโหลด…", "ja": "⏳ 読み込み中…", "ko": "⏳ 불러오는 중…", "zh-CN": "⏳ 加载中…", "zh-TW": "⏳ 載入中…" },
  "Langue": { "en": "Language", "es": "Idioma", "pt": "Idioma", "de": "Sprache", "nb": "Språk", "it": "Lingua", "ga": "Teanga", "nl": "Taal", "hr": "Jezik", "ro": "Limbă", "pl": "Język", "tr": "Dil", "ru": "Язык", "uk": "Мова", "ar": "اللغة", "hi": "भाषा", "id": "Bahasa", "vi": "Ngôn ngữ", "th": "ภาษา", "ja": "言語", "ko": "언어", "zh-CN": "语言", "zh-TW": "語言" },
  "Tu diriges le match": { "en": "You run the match", "es": "Tú diriges el partido", "pt": "Diriges o jogo", "de": "Du leitest das Spiel", "nb": "Du leder kampen", "it": "Dirigi la partita", "ga": "Tusa a stiúrann an cluiche", "nl": "Jij leidt de wedstrijd", "hr": "Ti vodiš utakmicu", "ro": "Tu conduci meciul", "pl": "Ty prowadzisz mecz", "tr": "Maçı sen yönetirsin", "ru": "Ты ведёшь матч", "uk": "Ти ведеш матч", "ar": "أنت تدير المباراة", "hi": "आप मैच चलाते हैं", "id": "Kamu memimpin pertandingan", "vi": "Bạn điều khiển trận đấu", "th": "คุณคุมเกม", "ja": "あなたが試合を裁く", "ko": "당신이 경기를 진행합니다", "zh-CN": "由你主持比赛", "zh-TW": "由你主持比賽" },
  "Sur le même clavier": { "en": "On the same keyboard", "es": "En el mismo teclado", "pt": "No mesmo teclado", "de": "Auf derselben Tastatur", "nb": "På samme tastatur", "it": "Sulla stessa tastiera", "ga": "Ar an méarchlár céanna", "nl": "Op hetzelfde toetsenbord", "hr": "Na istoj tipkovnici", "ro": "Pe aceeași tastatură", "pl": "Na tej samej klawiaturze", "tr": "Aynı klavyede", "ru": "На одной клавиатуре", "uk": "На одній клавіатурі", "ar": "على نفس لوحة المفاتيح", "hi": "एक ही कीबोर्ड पर", "id": "Di keyboard yang sama", "vi": "Trên cùng bàn phím", "th": "บนคีย์บอร์ดเดียวกัน", "ja": "同じキーボードで", "ko": "같은 키보드로", "zh-CN": "同一键盘", "zh-TW": "同一鍵盤" },
  "Joue avec un ami": { "en": "Play with a friend", "es": "Juega con un amigo", "pt": "Joga com um amigo", "de": "Spiel mit einem Freund", "nb": "Spill med en venn", "it": "Gioca con un amico", "ga": "Imir le cara", "nl": "Speel met een vriend", "hr": "Igraj s prijateljem", "ro": "Joacă cu un prieten", "pl": "Zagraj z kolegą", "tr": "Bir arkadaşınla oyna", "ru": "Играй с другом", "uk": "Грай із другом", "ar": "العب مع صديق", "hi": "दोस्त के साथ खेलें", "id": "Main dengan teman", "vi": "Chơi cùng bạn bè", "th": "เล่นกับเพื่อน", "ja": "友達と遊ぶ", "ko": "친구와 플레이", "zh-CN": "和朋友一起玩", "zh-TW": "和朋友一起玩" },
  "Clique sur une carte pour lancer le match": { "en": "Tap a card to start the match", "es": "Toca una tarjeta para empezar", "pt": "Toca num cartão para começar", "de": "Tippe auf eine Karte, um zu starten", "nb": "Trykk på et kort for å starte", "it": "Tocca una carta per iniziare", "ga": "Tapáil cárta chun tosú", "nl": "Tik op een kaart om te starten", "hr": "Dodirni karticu za početak", "ro": "Atinge un card pentru a începe", "pl": "Kliknij kartę, aby zacząć", "tr": "Başlamak için bir karta dokun", "ru": "Нажми карточку, чтобы начать", "uk": "Натисни картку, щоб почати", "ar": "اضغط على بطاقة لبدء المباراة", "hi": "मैच शुरू करने के लिए कार्ड चुनें", "id": "Ketuk kartu untuk memulai", "vi": "Chạm vào thẻ để bắt đầu", "th": "แตะการ์ดเพื่อเริ่ม", "ja": "カードをタップして試合開始", "ko": "카드를 눌러 경기를 시작", "zh-CN": "点击卡片开始比赛", "zh-TW": "點擊卡片開始比賽" },
  "Autres pays": { "en": "Other countries", "es": "Otros países", "pt": "Outros países", "de": "Andere Länder", "nb": "Andre land", "it": "Altri paesi", "ga": "Tíortha eile", "nl": "Andere landen", "hr": "Ostale zemlje", "ro": "Alte țări", "pl": "Inne kraje", "tr": "Diğer ülkeler", "ru": "Другие страны", "uk": "Інші країни", "ar": "دول أخرى", "hi": "अन्य देश", "id": "Negara lain", "vi": "Các nước khác", "th": "ประเทศอื่น ๆ", "ja": "その他の国", "ko": "기타 국가", "zh-CN": "其他国家", "zh-TW": "其他國家" },
  "Qualité graphique (CPU / GPU)": { "en": "Graphics quality (CPU / GPU)", "es": "Calidad gráfica (CPU / GPU)", "pt": "Qualidade gráfica (CPU / GPU)", "de": "Grafikqualität (CPU / GPU)", "nb": "Grafikkvalitet (CPU / GPU)", "it": "Qualità grafica (CPU / GPU)", "ga": "Cáilíocht grafaice (CPU / GPU)", "nl": "Grafische kwaliteit (CPU / GPU)", "hr": "Kvaliteta grafike (CPU / GPU)", "ro": "Calitate grafică (CPU / GPU)", "pl": "Jakość grafiki (CPU / GPU)", "tr": "Grafik kalitesi (CPU / GPU)", "ru": "Качество графики (CPU / GPU)", "uk": "Якість графіки (CPU / GPU)", "ar": "جودة الرسومات (CPU / GPU)", "hi": "ग्राफ़िक्स गुणवत्ता (CPU / GPU)", "id": "Kualitas grafis (CPU / GPU)", "vi": "Chất lượng đồ họa (CPU / GPU)", "th": "คุณภาพกราฟิก (CPU / GPU)", "ja": "グラフィック品質（CPU / GPU）", "ko": "그래픽 품질 (CPU / GPU)", "zh-CN": "画质（CPU / GPU）", "zh-TW": "畫質（CPU / GPU）" },
  "Potato": { "en": "Potato", "es": "Patata", "pt": "Batata", "de": "Kartoffel", "nb": "Potet", "it": "Patata", "ga": "Práta", "nl": "Aardappel", "hr": "Krumpir", "ro": "Cartof", "pl": "Ziemniak", "tr": "Patates", "ru": "Картошка", "uk": "Картопля", "ar": "بطاطس", "hi": "आलू", "id": "Kentang", "vi": "Khoai", "th": "มันฝรั่ง", "ja": "ポテト", "ko": "감자", "zh-CN": "土豆", "zh-TW": "馬鈴薯" },
  "Basse": { "en": "Low", "es": "Baja", "pt": "Baixa", "de": "Niedrig", "nb": "Lav", "it": "Bassa", "ga": "Íseal", "nl": "Laag", "hr": "Niska", "ro": "Scăzută", "pl": "Niska", "tr": "Düşük", "ru": "Низкое", "uk": "Низька", "ar": "منخفض", "hi": "निम्न", "id": "Rendah", "vi": "Thấp", "th": "ต่ำ", "ja": "低", "ko": "낮음", "zh-CN": "低", "zh-TW": "低" },
  "Moyenne": { "en": "Medium", "es": "Media", "pt": "Média", "de": "Mittel", "nb": "Middels", "it": "Media", "ga": "Meánach", "nl": "Gemiddeld", "hr": "Srednja", "ro": "Medie", "pl": "Średnia", "tr": "Orta", "ru": "Среднее", "uk": "Середня", "ar": "متوسط", "hi": "मध्यम", "id": "Sedang", "vi": "Trung bình", "th": "กลาง", "ja": "中", "ko": "보통", "zh-CN": "中", "zh-TW": "中" },
  "Haute": { "en": "High", "es": "Alta", "pt": "Alta", "de": "Hoch", "nb": "Høy", "it": "Alta", "ga": "Ard", "nl": "Hoog", "hr": "Visoka", "ro": "Ridicată", "pl": "Wysoka", "tr": "Yüksek", "ru": "Высокое", "uk": "Висока", "ar": "عالٍ", "hi": "उच्च", "id": "Tinggi", "vi": "Cao", "th": "สูง", "ja": "高", "ko": "높음", "zh-CN": "高", "zh-TW": "高" },
  "Ultra": { "en": "Ultra", "es": "Ultra", "pt": "Ultra", "de": "Ultra", "nb": "Ultra", "it": "Ultra", "ga": "Ultra", "nl": "Ultra", "hr": "Ultra", "ro": "Ultra", "pl": "Ultra", "tr": "Ultra", "ru": "Ультра", "uk": "Ультра", "ar": "فائق", "hi": "अल्ट्रा", "id": "Ultra", "vi": "Ultra", "th": "อัลตร้า", "ja": "ウルトラ", "ko": "울트라", "zh-CN": "超高", "zh-TW": "超高" },
  "Plein écran": { "en": "Fullscreen", "es": "Pantalla completa", "pt": "Ecrã inteiro", "de": "Vollbild", "nb": "Fullskjerm", "it": "Schermo intero", "ga": "Lánscáileán", "nl": "Volledig scherm", "hr": "Puni zaslon", "ro": "Ecran complet", "pl": "Pełny ekran", "tr": "Tam ekran", "ru": "Полный экран", "uk": "Повний екран", "ar": "ملء الشاشة", "hi": "फ़ुलस्क्रीन", "id": "Layar penuh", "vi": "Toàn màn hình", "th": "เต็มจอ", "ja": "フルスクリーン", "ko": "전체 화면", "zh-CN": "全屏", "zh-TW": "全螢幕" },
  "Activer le plein écran": { "en": "Enable fullscreen", "es": "Activar pantalla completa", "pt": "Ativar ecrã inteiro", "de": "Vollbild aktivieren", "nb": "Slå på fullskjerm", "it": "Attiva schermo intero", "ga": "Cuir lánscáileán ar siúl", "nl": "Volledig scherm aan", "hr": "Uključi puni zaslon", "ro": "Activează ecranul complet", "pl": "Włącz pełny ekran", "tr": "Tam ekranı aç", "ru": "Включить полный экран", "uk": "Увімкнути повний екран", "ar": "تفعيل ملء الشاشة", "hi": "फ़ुलस्क्रीन चालू करें", "id": "Aktifkan layar penuh", "vi": "Bật toàn màn hình", "th": "เปิดเต็มจอ", "ja": "フルスクリーンにする", "ko": "전체 화면 켜기", "zh-CN": "开启全屏", "zh-TW": "開啟全螢幕" },
  "Changer le pays": { "en": "Change country", "es": "Cambiar país", "pt": "Mudar país", "de": "Land ändern", "nb": "Bytt land", "it": "Cambia paese", "ga": "Athraigh tír", "nl": "Land wijzigen", "hr": "Promijeni zemlju", "ro": "Schimbă țara", "pl": "Zmień kraj", "tr": "Ülkeyi değiştir", "ru": "Сменить страну", "uk": "Змінити країну", "ar": "تغيير البلد", "hi": "देश बदलें", "id": "Ganti negara", "vi": "Đổi quốc gia", "th": "เปลี่ยนประเทศ", "ja": "国を変更", "ko": "국가 변경", "zh-CN": "更换国家", "zh-TW": "更換國家" },
  "Jouer le match": { "en": "Play the match", "es": "Jugar el partido", "pt": "Jogar o jogo", "de": "Spiel starten", "nb": "Spill kampen", "it": "Gioca la partita", "ga": "Imir an cluiche", "nl": "Speel de wedstrijd", "hr": "Igraj utakmicu", "ro": "Joacă meciul", "pl": "Zagraj mecz", "tr": "Maçı oyna", "ru": "Играть матч", "uk": "Грати матч", "ar": "العب المباراة", "hi": "मैच खेलें", "id": "Mainkan pertandingan", "vi": "Chơi trận đấu", "th": "เล่นแมตช์", "ja": "試合開始", "ko": "경기 시작", "zh-CN": "开始比赛", "zh-TW": "開始比賽" },
  "Choisis tes joueurs avant le match": { "en": "Pick your players before the match", "es": "Elige tus jugadores antes del partido", "pt": "Escolhe os teus jogadores antes do jogo", "de": "Wähle vor dem Spiel deine Spieler", "nb": "Velg spillerne dine før kampen", "it": "Scegli i giocatori prima della partita", "ga": "Roghnaigh d'imreoirí roimh an gcluiche", "nl": "Kies je spelers voor de wedstrijd", "hr": "Izaberi igrače prije utakmice", "ro": "Alege-ți jucătorii înainte de meci", "pl": "Wybierz zawodników przed meczem", "tr": "Maçtan önce oyuncularını seç", "ru": "Выбери игроков перед матчем", "uk": "Обери гравців перед матчем", "ar": "اختر لاعبيك قبل المباراة", "hi": "मैच से पहले खिलाड़ी चुनें", "id": "Pilih pemainmu sebelum bertanding", "vi": "Chọn cầu thủ trước trận", "th": "เลือกผู้เล่นก่อนแข่ง", "ja": "試合前に選手を選ぼう", "ko": "경기 전에 선수를 고르세요", "zh-CN": "赛前挑选你的球员", "zh-TW": "賽前挑選你的球員" },
  "Remplaçants": { "en": "Substitutes", "es": "Suplentes", "pt": "Suplentes", "de": "Ersatzbank", "nb": "Innbyttere", "it": "Riserve", "ga": "Ionadaithe", "nl": "Wissels", "hr": "Zamjene", "ro": "Rezerve", "pl": "Rezerwowi", "tr": "Yedekler", "ru": "Запасные", "uk": "Запасні", "ar": "البدلاء", "hi": "स्थानापन्न", "id": "Cadangan", "vi": "Dự bị", "th": "ตัวสำรอง", "ja": "控え選手", "ko": "교체 선수", "zh-CN": "替补", "zh-TW": "替補" },
  "clique un titulaire puis un remplaçant pour échanger": { "en": "tap a starter then a sub to swap", "es": "toca un titular y luego un suplente para cambiar", "pt": "toca um titular e depois um suplente para trocar", "de": "tippe einen Starter und dann einen Ersatzspieler zum Tauschen", "nb": "trykk en startspiller og så en innbytter for å bytte", "it": "tocca un titolare poi una riserva per scambiare", "ga": "tapáil imreoir tosaigh ansin ionadaí chun malartú", "nl": "tik een basisspeler en dan een wissel om te ruilen", "hr": "dodirni startera pa zamjenu za izmjenu", "ro": "atinge un titular apoi o rezervă pentru schimb", "pl": "kliknij zawodnika z wyjściowej, potem rezerwowego", "tr": "değiştirmek için bir ilk 11 oyuncusuna sonra bir yedeğe dokun", "ru": "нажми игрока основы, затем запасного", "uk": "натисни гравця основи, потім запасного", "ar": "اضغط لاعباً أساسياً ثم بديلاً للتبديل", "hi": "बदलने के लिए एक शुरुआती और फिर एक स्थानापन्न चुनें", "id": "ketuk pemain inti lalu cadangan untuk menukar", "vi": "chạm cầu thủ đá chính rồi cầu thủ dự bị để đổi", "th": "แตะตัวจริงแล้วแตะตัวสำรองเพื่อสลับ", "ja": "先発を選んでから控えを選ぶと交代", "ko": "선발을 누른 뒤 교체 선수를 누르면 교체", "zh-CN": "先点首发再点替补进行交换", "zh-TW": "先點先發再點替補進行交換" },
  "Tire au but face au gardien": { "en": "Shoot past the keeper", "es": "Dispara ante el portero", "pt": "Remata frente ao guarda-redes", "de": "Schieß am Torwart vorbei", "nb": "Skyt forbi keeperen", "it": "Tira oltre il portiere", "ga": "Scaoil thar an gcúl báire", "nl": "Schiet langs de keeper", "hr": "Pucaj pored vratara", "ro": "Trage pe lângă portar", "pl": "Strzel obok bramkarza", "tr": "Kaleciyi geç", "ru": "Пробей вратаря", "uk": "Пробий воротаря", "ar": "سدّد وتجاوز الحارس", "hi": "गोलकीपर को छकाकर गोल करें", "id": "Tembak lewati kiper", "vi": "Sút qua thủ môn", "th": "ยิงผ่านผู้รักษาประตู", "ja": "キーパーを破れ", "ko": "골키퍼를 뚫으세요", "zh-CN": "射门破门", "zh-TW": "射門破門" },
  "Passe le mur": { "en": "Beat the wall", "es": "Supera la barrera", "pt": "Passa a barreira", "de": "Überwinde die Mauer", "nb": "Over muren", "it": "Supera la barriera", "ga": "Sáraigh an balla", "nl": "Over de muur", "hr": "Preko živog zida", "ro": "Treci de zid", "pl": "Przelob mur", "tr": "Barajı aş", "ru": "Обведи стенку", "uk": "Оминай стінку", "ar": "تجاوز الحائط", "hi": "दीवार के ऊपर से मारें", "id": "Lewati pagar betis", "vi": "Vượt qua hàng rào", "th": "ข้ามกำแพง", "ja": "壁を越えろ", "ko": "벽을 넘기세요", "zh-CN": "越过人墙", "zh-TW": "越過人牆" },
  "Centre depuis le corner": { "en": "Cross from the corner", "es": "Centra desde el córner", "pt": "Cruza do canto", "de": "Flanke von der Ecke", "nb": "Innlegg fra hjørnet", "it": "Cross dal corner", "ga": "Traschur ón gcúinne", "nl": "Voorzet vanaf de hoek", "hr": "Ubaci s kornera", "ro": "Centrează din corner", "pl": "Dośrodkuj z rożnego", "tr": "Kornerden orta yap", "ru": "Подай с углового", "uk": "Подай з кутового", "ar": "اعرض الكرة من الركنية", "hi": "कॉर्नर से क्रॉस करें", "id": "Umpan silang dari sudut", "vi": "Tạt bóng từ phạt góc", "th": "เปิดบอลจากมุม", "ja": "コーナーからクロス", "ko": "코너에서 크로스", "zh-CN": "角球传中", "zh-TW": "角球傳中" },
  "Élimine ton adversaire": { "en": "Beat your opponent", "es": "Supera a tu rival", "pt": "Ultrapassa o adversário", "de": "Umspiele deinen Gegner", "nb": "Utspill motstanderen", "it": "Salta l'avversario", "ga": "Sáraigh do chéile comhraic", "nl": "Speel je tegenstander uit", "hr": "Prođi protivnika", "ro": "Depășește-ți adversarul", "pl": "Ogranie rywala", "tr": "Rakibini geç", "ru": "Обыграй соперника", "uk": "Обіграй суперника", "ar": "تجاوز خصمك", "hi": "अपने प्रतिद्वंद्वी को छकाएँ", "id": "Lewati lawanmu", "vi": "Vượt qua đối thủ", "th": "เลี้ยงผ่านคู่แข่ง", "ja": "相手を抜き去れ", "ko": "상대를 제치세요", "zh-CN": "过掉对手", "zh-TW": "過掉對手" },
  "Le bot tire, arrête-le !": { "en": "The bot shoots, stop it!", "es": "¡El bot dispara, párala!", "pt": "O bot remata, defende!", "de": "Der Bot schießt, halt ihn!", "nb": "Boten skyter, redd den!", "it": "Il bot tira, parala!", "ga": "Scaoileann an bota, stop é!", "nl": "De bot schiet, houd hem!", "hr": "Bot puca, obrani!", "ro": "Botul trage, apără!", "pl": "Bot strzela, obroń!", "tr": "Bot şut çekiyor, kurtar!", "ru": "Бот бьёт — отрази!", "uk": "Бот б'є — відбий!", "ar": "الروبوت يسدد، تصدَّ له!", "hi": "बॉट शॉट लेता है, रोकिए!", "id": "Bot menembak, tepis!", "vi": "Bot sút, hãy cản phá!", "th": "บอทยิง หยุดให้ได้!", "ja": "ボットのシュートを止めろ！", "ko": "봇의 슛을 막으세요!", "zh-CN": "机器人射门，快扑救！", "zh-TW": "機器人射門，快撲救！" },
  "Potato = le plus rapide (l'image reste nette, mais se rafraîchit moins souvent). Ultra = le plus fluide visuellement.": { "en": "Potato = fastest (the picture stays sharp but refreshes less often). Ultra = smoothest.", "es": "Patata = lo más rápido (la imagen sigue nítida pero se refresca menos). Ultra = lo más fluido.", "pt": "Batata = o mais rápido (a imagem fica nítida mas atualiza menos). Ultra = o mais fluido.", "de": "Kartoffel = am schnellsten (das Bild bleibt scharf, wird aber seltener aktualisiert). Ultra = am flüssigsten.", "nb": "Potet = raskest (bildet forblir skarpt, men oppdateres sjeldnere). Ultra = jevnest.", "it": "Patata = più veloce (l'immagine resta nitida ma si aggiorna meno). Ultra = più fluido.", "ga": "Práta = is tapúla (fanann an íomhá géar ach athnuachtar níos lú é). Ultra = is míne.", "nl": "Aardappel = snelst (het beeld blijft scherp maar ververst minder). Ultra = vloeiendst.", "hr": "Krumpir = najbrže (slika ostaje oštra, ali se rjeđe osvježava). Ultra = najglađe.", "ro": "Cartof = cel mai rapid (imaginea rămâne clară, dar se reîmprospătează mai rar). Ultra = cel mai fluid.", "pl": "Ziemniak = najszybciej (obraz pozostaje ostry, ale odświeża się rzadziej). Ultra = najpłynniej.", "tr": "Patates = en hızlı (görüntü net kalır ama daha az yenilenir). Ultra = en akıcı.", "ru": "Картошка = самый быстрый (картинка чёткая, но обновляется реже). Ультра = самый плавный.", "uk": "Картопля = найшвидший (зображення чітке, але оновлюється рідше). Ультра = найплавніший.", "ar": "بطاطس = الأسرع (تبقى الصورة واضحة لكنها تتحدث أقل). فائق = الأكثر سلاسة.", "hi": "आलू = सबसे तेज़ (तस्वीर साफ़ रहती है पर कम रिफ़्रेश होती है)। अल्ट्रा = सबसे स्मूद।", "id": "Kentang = tercepat (gambar tetap tajam tapi lebih jarang disegarkan). Ultra = paling mulus.", "vi": "Khoai = nhanh nhất (hình vẫn nét nhưng ít làm mới hơn). Ultra = mượt nhất.", "th": "มันฝรั่ง = เร็วที่สุด (ภาพยังคมแต่รีเฟรชน้อยลง) อัลตร้า = ลื่นที่สุด", "ja": "ポテト＝最速（画質は保つが更新回数が減る）。ウルトラ＝最も滑らか。", "ko": "감자 = 가장 빠름 (화면은 선명하지만 갱신이 적음). 울트라 = 가장 부드러움.", "zh-CN": "土豆＝最快（画面依然清晰，但刷新更少）。超高＝最流畅。", "zh-TW": "馬鈴薯＝最快（畫面依然清晰，但更新較少）。超高＝最流暢。" },
  // --- menu, confederations and nations, in every language ---
  "Europe": { "en": "Europe", "es": "Europa", "pt": "Europa", "de": "Europa", "nb": "Europa", "it": "Europa", "ga": "An Eoraip", "nl": "Europa", "hr": "Europa", "ro": "Europa", "pl": "Europa", "tr": "Avrupa", "ru": "Европа", "uk": "Європа", "ar": "أوروبا", "hi": "यूरोप", "id": "Eropa", "vi": "Châu Âu", "th": "ยุโรป", "ja": "ヨーロッパ", "ko": "유럽", "zh-CN": "欧洲", "zh-TW": "歐洲" },
  "Amérique du Sud": { "en": "South America", "es": "Sudamérica", "pt": "América do Sul", "de": "Südamerika", "nb": "Sør-Amerika", "it": "Sud America", "ga": "Meiriceá Theas", "nl": "Zuid-Amerika", "hr": "Južna Amerika", "ro": "America de Sud", "pl": "Ameryka Płd.", "tr": "Güney Amerika", "ru": "Южная Америка", "uk": "Південна Америка", "ar": "أمريكا الجنوبية", "hi": "दक्षिण अमेरिका", "id": "Amerika Selatan", "vi": "Nam Mỹ", "th": "อเมริกาใต้", "ja": "南アメリカ", "ko": "남아메리카", "zh-CN": "南美洲", "zh-TW": "南美洲" },
  "Afrique": { "en": "Africa", "es": "África", "pt": "África", "de": "Afrika", "nb": "Afrika", "it": "Africa", "ga": "An Afraic", "nl": "Afrika", "hr": "Afrika", "ro": "Africa", "pl": "Afryka", "tr": "Afrika", "ru": "Африка", "uk": "Африка", "ar": "أفريقيا", "hi": "अफ़्रीका", "id": "Afrika", "vi": "Châu Phi", "th": "แอฟริกา", "ja": "アフリカ", "ko": "아프리카", "zh-CN": "非洲", "zh-TW": "非洲" },
  "Amér. du Nord": { "en": "North America", "es": "Norteamérica", "pt": "América do Norte", "de": "Nordamerika", "nb": "Nord-Amerika", "it": "Nord America", "ga": "Meiriceá Thuaidh", "nl": "Noord-Amerika", "hr": "Sjeverna Amerika", "ro": "America de Nord", "pl": "Ameryka Płn.", "tr": "Kuzey Amerika", "ru": "Северная Америка", "uk": "Північна Америка", "ar": "أمريكا الشمالية", "hi": "उत्तर अमेरिका", "id": "Amerika Utara", "vi": "Bắc Mỹ", "th": "อเมริกาเหนือ", "ja": "北アメリカ", "ko": "북아메리카", "zh-CN": "北美洲", "zh-TW": "北美洲" },
  "Asie / Océanie": { "en": "Asia / Oceania", "es": "Asia / Oceanía", "pt": "Ásia / Oceania", "de": "Asien / Ozeanien", "nb": "Asia / Oseania", "it": "Asia / Oceania", "ga": "An Áise / An Aigéine", "nl": "Azië / Oceanië", "hr": "Azija / Oceanija", "ro": "Asia / Oceania", "pl": "Azja / Oceania", "tr": "Asya / Okyanusya", "ru": "Азия / Океания", "uk": "Азія / Океанія", "ar": "آسيا / أوقيانوسيا", "hi": "एशिया / ओशिनिया", "id": "Asia / Oseania", "vi": "Châu Á / Châu Đại Dương", "th": "เอเชีย / โอเชียเนีย", "ja": "アジア / オセアニア", "ko": "아시아 / 오세아니아", "zh-CN": "亚洲 / 大洋洲", "zh-TW": "亞洲 / 大洋洲" },
  "JOUER": { "en": "PLAY", "es": "JUGAR", "pt": "JOGAR", "de": "SPIELEN", "nb": "SPILL", "it": "GIOCA", "ga": "IMIR", "nl": "SPELEN", "hr": "IGRAJ", "ro": "JOACĂ", "pl": "GRAJ", "tr": "OYNA", "ru": "ИГРАТЬ", "uk": "ГРАТИ", "ar": "العب", "hi": "खेलें", "id": "MAIN", "vi": "CHƠI", "th": "เล่น", "ja": "プレイ", "ko": "플레이", "zh-CN": "开始", "zh-TW": "開始" },
  "Angleterre": { "en": "England", "es": "Inglaterra", "pt": "Inglaterra", "de": "England", "nb": "England", "it": "Inghilterra", "ga": "Sasana", "nl": "Engeland", "hr": "Engleska", "ro": "Anglia", "pl": "Anglia", "tr": "İngiltere", "ru": "Англия", "uk": "Англія", "ar": "إنجلترا", "hi": "इंग्लैंड", "id": "Inggris", "vi": "Anh", "th": "อังกฤษ", "ja": "イングランド", "ko": "잉글랜드", "zh-CN": "英格兰", "zh-TW": "英格蘭" },
  "Écosse": { "en": "Scotland", "es": "Escocia", "pt": "Escócia", "de": "Schottland", "nb": "Skottland", "it": "Scozia", "ga": "Albain", "nl": "Schotland", "hr": "Škotska", "ro": "Scoția", "pl": "Szkocja", "tr": "İskoçya", "ru": "Шотландия", "uk": "Шотландія", "ar": "اسكتلندا", "hi": "स्कॉटलैंड", "id": "Skotlandia", "vi": "Scotland", "th": "สกอตแลนด์", "ja": "スコットランド", "ko": "스코틀랜드", "zh-CN": "苏格兰", "zh-TW": "蘇格蘭" },
  "Pays de Galles": { "en": "Wales", "es": "Gales", "pt": "País de Gales", "de": "Wales", "nb": "Wales", "it": "Galles", "ga": "An Bhreatain Bheag", "nl": "Wales", "hr": "Wales", "ro": "Țara Galilor", "pl": "Walia", "tr": "Galler", "ru": "Уэльс", "uk": "Уельс", "ar": "ويلز", "hi": "वेल्स", "id": "Wales", "vi": "Xứ Wales", "th": "เวลส์", "ja": "ウェールズ", "ko": "웨일스", "zh-CN": "威尔士", "zh-TW": "威爾斯" },
  "Accueil": { "en": "Main", "es": "Inicio", "pt": "Início", "de": "Start", "nb": "Hjem", "it": "Home", "ga": "Baile", "nl": "Start", "hr": "Početna", "ro": "Acasă", "pl": "Główna", "tr": "Ana sayfa", "ru": "Главная", "uk": "Головна", "ar": "الرئيسية", "hi": "होम", "id": "Beranda", "vi": "Trang chính", "th": "หน้าหลัก", "ja": "ホーム", "ko": "홈", "zh-CN": "主页", "zh-TW": "主頁" },
  "Clubs": { "en": "Clubs", "es": "Clubes", "pt": "Clubes", "de": "Vereine", "nb": "Klubber", "it": "Club", "ga": "Clubanna", "nl": "Clubs", "hr": "Klubovi", "ro": "Cluburi", "pl": "Kluby", "tr": "Kulüpler", "ru": "Клубы", "uk": "Клуби", "ar": "الأندية", "hi": "क्लब", "id": "Klub", "vi": "Câu lạc bộ", "th": "สโมสร", "ja": "クラブ", "ko": "클럽", "zh-CN": "俱乐部", "zh-TW": "俱樂部" },
  "Sélections": { "en": "National", "es": "Selecciones", "pt": "Seleções", "de": "Nationen", "nb": "Landslag", "it": "Nazionali", "ga": "Náisiúin", "nl": "Landen", "hr": "Reprezentacije", "ro": "Naționale", "pl": "Reprezentacje", "tr": "Milli takımlar", "ru": "Сборные", "uk": "Збірні", "ar": "المنتخبات", "hi": "राष्ट्रीय टीमें", "id": "Timnas", "vi": "Đội tuyển", "th": "ทีมชาติ", "ja": "代表チーム", "ko": "국가대표", "zh-CN": "国家队", "zh-TW": "國家隊" },
  "Défis": { "en": "Challenges", "es": "Retos", "pt": "Desafios", "de": "Duelle", "nb": "Utfordringer", "it": "Sfide", "ga": "Dúshláin", "nl": "Uitdagingen", "hr": "Izazovi", "ro": "Provocări", "pl": "Wyzwania", "tr": "Meydan okumalar", "ru": "Испытания", "uk": "Виклики", "ar": "التحديات", "hi": "चुनौतियाँ", "id": "Tantangan", "vi": "Thử thách", "th": "ความท้าทาย", "ja": "チャレンジ", "ko": "챌린지", "zh-CN": "挑战", "zh-TW": "挑戰" },
  "Marché": { "en": "Market", "es": "Mercado", "pt": "Mercado", "de": "Markt", "nb": "Marked", "it": "Mercato", "ga": "Margadh", "nl": "Markt", "hr": "Tržište", "ro": "Piață", "pl": "Rynek", "tr": "Piyasa", "ru": "Рынок", "uk": "Ринок", "ar": "السوق", "hi": "बाज़ार", "id": "Pasar", "vi": "Chợ chuyển nhượng", "th": "ตลาด", "ja": "マーケット", "ko": "마켓", "zh-CN": "市场", "zh-TW": "市場" },
  "Réglages": { "en": "Settings", "es": "Ajustes", "pt": "Definições", "de": "Optionen", "nb": "Innstillinger", "it": "Opzioni", "ga": "Socruithe", "nl": "Instellingen", "hr": "Postavke", "ro": "Setări", "pl": "Ustawienia", "tr": "Ayarlar", "ru": "Настройки", "uk": "Налаштування", "ar": "الإعدادات", "hi": "सेटिंग्स", "id": "Pengaturan", "vi": "Cài đặt", "th": "การตั้งค่า", "ja": "設定", "ko": "설정", "zh-CN": "设置", "zh-TW": "設定" },
  "2 Joueurs": { "en": "2 Players", "es": "2 Jugadores", "pt": "2 Jogadores", "de": "2 Spieler", "nb": "2 spillere", "it": "2 Giocatori", "ga": "2 Imreoir", "nl": "2 Spelers", "hr": "2 Igrača", "ro": "2 Jucători", "pl": "2 Graczy", "tr": "2 Oyuncu", "ru": "2 игрока", "uk": "2 гравці", "ar": "لاعبان", "hi": "2 खिलाड़ी", "id": "2 Pemain", "vi": "2 người chơi", "th": "2 ผู้เล่น", "ja": "2人プレイ", "ko": "2인 플레이", "zh-CN": "双人", "zh-TW": "雙人" },
  "En ligne": { "en": "Online", "es": "En línea", "pt": "Online", "de": "Online", "nb": "På nett", "it": "Online", "ga": "Ar líne", "nl": "Online", "hr": "Online", "ro": "Online", "pl": "Online", "tr": "Çevrimiçi", "ru": "Онлайн", "uk": "Онлайн", "ar": "عبر الإنترنت", "hi": "ऑनलाइन", "id": "Online", "vi": "Trực tuyến", "th": "ออนไลน์", "ja": "オンライン", "ko": "온라인", "zh-CN": "在线", "zh-TW": "線上" },
  "Arbitre": { "en": "Referee", "es": "Árbitro", "pt": "Árbitro", "de": "Schiedsrichter", "nb": "Dommer", "it": "Arbitro", "ga": "Réiteoir", "nl": "Scheidsrechter", "hr": "Sudac", "ro": "Arbitru", "pl": "Sędzia", "tr": "Hakem", "ru": "Судья", "uk": "Суддя", "ar": "الحكم", "hi": "रेफ़री", "id": "Wasit", "vi": "Trọng tài", "th": "ผู้ตัดสิน", "ja": "レフェリー", "ko": "심판", "zh-CN": "裁判", "zh-TW": "裁判" },
  "Match amical": { "en": "Friendly", "es": "Amistoso", "pt": "Amigável", "de": "Freundschaftsspiel", "nb": "Treningskamp", "it": "Amichevole", "ga": "Cluiche cairdiúil", "nl": "Oefenwedstrijd", "hr": "Prijateljska", "ro": "Amical", "pl": "Towarzyski", "tr": "Hazırlık maçı", "ru": "Товарищеский", "uk": "Товариський", "ar": "مباراة ودية", "hi": "मैत्री मैच", "id": "Persahabatan", "vi": "Giao hữu", "th": "อุ่นเครื่อง", "ja": "親善試合", "ko": "친선 경기", "zh-CN": "友谊赛", "zh-TW": "友誼賽" },
  "Entraînement": { "en": "Training", "es": "Entrenamiento", "pt": "Treino", "de": "Training", "nb": "Trening", "it": "Allenamento", "ga": "Traenáil", "nl": "Training", "hr": "Trening", "ro": "Antrenament", "pl": "Trening", "tr": "Antrenman", "ru": "Тренировка", "uk": "Тренування", "ar": "التدريب", "hi": "प्रशिक्षण", "id": "Latihan", "vi": "Tập luyện", "th": "การฝึกซ้อม", "ja": "トレーニング", "ko": "훈련", "zh-CN": "训练", "zh-TW": "訓練" },
  "Coupe du monde": { "en": "World Cup", "es": "Copa del Mundo", "pt": "Copa do Mundo", "de": "Weltmeisterschaft", "nb": "VM", "it": "Coppa del Mondo", "ga": "Corn an Domhain", "nl": "Wereldbeker", "hr": "Svjetsko prvenstvo", "ro": "Cupa Mondială", "pl": "Mistrzostwa świata", "tr": "Dünya Kupası", "ru": "Чемпионат мира", "uk": "Чемпіонат світу", "ar": "كأس العالم", "hi": "विश्व कप", "id": "Piala Dunia", "vi": "World Cup", "th": "ฟุตบอลโลก", "ja": "ワールドカップ", "ko": "월드컵", "zh-CN": "世界杯", "zh-TW": "世界盃" },
  // --- challenge + settings screens, in every language the game speaks ---
  "DÉFIS": { "en": "CHALLENGES", "es": "RETOS", "pt": "DESAFIOS", "de": "DUELLE", "nb": "UTFORDRINGER", "it": "SFIDE", "ga": "DÚSHLÁIN", "nl": "UITDAGINGEN", "hr": "IZAZOVI", "ro": "PROVOCĂRI", "pl": "WYZWANIA", "tr": "MEYDAN OKUMALAR", "ru": "ИСПЫТАНИЯ", "uk": "ВИКЛИКИ", "ar": "التحديات", "hi": "चुनौतियाँ", "id": "TANTANGAN", "vi": "THỬ THÁCH", "th": "ความท้าทาย", "ja": "チャレンジ", "ko": "챌린지", "zh-CN": "挑战", "zh-TW": "挑戰" },
  "Jouer": { "en": "Play", "es": "Jugar", "pt": "Jogar", "de": "Spielen", "nb": "Spill", "it": "Gioca", "ga": "Imir", "nl": "Spelen", "hr": "Igraj", "ro": "Joacă", "pl": "Graj", "tr": "Oyna", "ru": "Играть", "uk": "Грати", "ar": "العب", "hi": "खेलें", "id": "Main", "vi": "Chơi", "th": "เล่น", "ja": "プレイ", "ko": "플레이", "zh-CN": "开始", "zh-TW": "開始" },
  "Marque un but pour l'emporter !": { "en": "Score a goal to win!", "es": "¡Marca un gol para ganar!", "pt": "Marca um golo para venceres!", "de": "Schieß ein Tor zum Sieg!", "nb": "Score et mål for å vinne!", "it": "Segna un gol per vincere!", "ga": "Aimsigh cúl chun an bua!", "nl": "Scoor een goal om te winnen!", "hr": "Zabij gol za pobjedu!", "ro": "Marchează un gol pentru victorie!", "pl": "Strzel gola, by wygrać!", "tr": "Kazanmak için gol at!", "ru": "Забей гол ради победы!", "uk": "Забий гол заради перемоги!", "ar": "سجّل هدفاً للفوز!", "hi": "जीतने के लिए गोल करें!", "id": "Cetak gol untuk menang!", "vi": "Ghi bàn để chiến thắng!", "th": "ทำประตูเพื่อชนะ!", "ja": "ゴールを決めて勝利しよう！", "ko": "골을 넣어 이기세요!", "zh-CN": "进一球取胜！", "zh-TW": "進一球取勝！" },
  "Sois devant au coup de sifflet final !": { "en": "Be ahead at the final whistle!", "es": "¡Ve ganando al pitido final!", "pt": "Está à frente no apito final!", "de": "Führe beim Schlusspfiff!", "nb": "Ligg foran ved sluttsignalet!", "it": "Sii avanti al fischio finale!", "ga": "Bí chun tosaigh ag an bhfeadóg dheiridh!", "nl": "Sta voor bij het laatste fluitsignaal!", "hr": "Vodi na kraju susreta!", "ro": "Fii în avantaj la fluierul final!", "pl": "Prowadź do końcowego gwizdka!", "tr": "Son düdükte önde ol!", "ru": "Веди в счёте к финальному свистку!", "uk": "Веди в рахунку до фінального свистка!", "ar": "تقدّم عند صافرة النهاية!", "hi": "अंतिम सीटी तक आगे रहें!", "id": "Unggul sampai peluit akhir!", "vi": "Dẫn trước khi kết thúc trận!", "th": "นำอยู่จนหมดเวลา!", "ja": "終了の笛まで勝ち越そう！", "ko": "경기 종료까지 앞서세요!", "zh-CN": "终场哨响时保持领先！", "zh-TW": "終場哨響時保持領先！" },
  "Défends le résultat, ne concède rien !": { "en": "Defend the lead, concede nothing!", "es": "¡Defiende el resultado, no encajes!", "pt": "Defende o resultado, não sofras golos!", "de": "Verteidige das Ergebnis, kassiere nichts!", "nb": "Forsvar resultatet, slipp ingenting inn!", "it": "Difendi il risultato, non subire gol!", "ga": "Cosain an scór, ná lig aon chúl isteach!", "nl": "Verdedig de stand, incasseer niets!", "hr": "Obrani rezultat, ne primi gol!", "ro": "Apără rezultatul, nu primi gol!", "pl": "Broń wyniku, nie strać gola!", "tr": "Skoru koru, gol yeme!", "ru": "Удержи счёт, не пропусти!", "uk": "Утримай рахунок, не пропусти!", "ar": "دافع عن النتيجة ولا تستقبل أي هدف!", "hi": "बढ़त बचाएँ, कोई गोल न खाएँ!", "id": "Pertahankan skor, jangan kebobolan!", "vi": "Giữ vững tỉ số, đừng để thủng lưới!", "th": "รักษาผลไว้ อย่าเสียประตู!", "ja": "リードを守り、失点するな！", "ko": "리드를 지키고 실점하지 마세요!", "zh-CN": "守住比分，别丢球！", "zh-TW": "守住比分，別丟球！" },
  "RÉGLAGES": { "en": "SETTINGS", "es": "AJUSTES", "pt": "DEFINIÇÕES", "de": "EINSTELLUNGEN", "nb": "INNSTILLINGER", "it": "OPZIONI", "ga": "SOCRUITHE", "nl": "INSTELLINGEN", "hr": "POSTAVKE", "ro": "SETĂRI", "pl": "USTAWIENIA", "tr": "AYARLAR", "ru": "НАСТРОЙКИ", "uk": "НАЛАШТУВАННЯ", "ar": "الإعدادات", "hi": "सेटिंग्स", "id": "PENGATURAN", "vi": "CÀI ĐẶT", "th": "การตั้งค่า", "ja": "設定", "ko": "설정", "zh-CN": "设置", "zh-TW": "設定" },
  "Graphique": { "en": "Graphics", "es": "Gráficos", "pt": "Gráficos", "de": "Grafik", "nb": "Grafikk", "it": "Grafica", "ga": "Grafaic", "nl": "Grafisch", "hr": "Grafika", "ro": "Grafică", "pl": "Grafika", "tr": "Grafik", "ru": "Графика", "uk": "Графіка", "ar": "الرسومات", "hi": "ग्राफ़िक्स", "id": "Grafis", "vi": "Đồ họa", "th": "กราฟิก", "ja": "グラフィック", "ko": "그래픽", "zh-CN": "画面", "zh-TW": "畫面" },
  "Gameplay": { "en": "Gameplay", "es": "Juego", "pt": "Jogo", "de": "Spiel", "nb": "Spill", "it": "Gioco", "ga": "Imirt", "nl": "Spel", "hr": "Igra", "ro": "Joc", "pl": "Rozgrywka", "tr": "Oynanış", "ru": "Игра", "uk": "Гра", "ar": "اللعب", "hi": "गेमप्ले", "id": "Permainan", "vi": "Lối chơi", "th": "การเล่น", "ja": "ゲームプレイ", "ko": "게임플레이", "zh-CN": "玩法", "zh-TW": "玩法" },
  "Audio": { "en": "Audio", "es": "Audio", "pt": "Áudio", "de": "Audio", "nb": "Lyd", "it": "Audio", "ga": "Fuaim", "nl": "Audio", "hr": "Zvuk", "ro": "Audio", "pl": "Dźwięk", "tr": "Ses", "ru": "Звук", "uk": "Звук", "ar": "الصوت", "hi": "ऑडियो", "id": "Audio", "vi": "Âm thanh", "th": "เสียง", "ja": "オーディオ", "ko": "오디오", "zh-CN": "音频", "zh-TW": "音訊" },
  "Commandes": { "en": "Controls", "es": "Controles", "pt": "Controlos", "de": "Steuerung", "nb": "Kontroller", "it": "Comandi", "ga": "Rialuithe", "nl": "Besturing", "hr": "Kontrole", "ro": "Comenzi", "pl": "Sterowanie", "tr": "Kontroller", "ru": "Управление", "uk": "Керування", "ar": "التحكم", "hi": "नियंत्रण", "id": "Kontrol", "vi": "Điều khiển", "th": "การควบคุม", "ja": "操作", "ko": "조작", "zh-CN": "操作", "zh-TW": "操作" },
  "MATCH": { "en": "MATCH", "es": "PARTIDO", "pt": "JOGO", "de": "SPIEL", "nb": "KAMP", "it": "PARTITA", "ga": "CLUICHE", "nl": "WEDSTRIJD", "hr": "UTAKMICA", "ro": "MECI", "pl": "MECZ", "tr": "MAÇ", "ru": "МАТЧ", "uk": "МАТЧ", "ar": "المباراة", "hi": "मैच", "id": "PERTANDINGAN", "vi": "TRẬN ĐẤU", "th": "การแข่งขัน", "ja": "試合", "ko": "경기", "zh-CN": "比赛", "zh-TW": "比賽" },
  "Difficulté du CPU (Humain vs CPU)": { "en": "CPU difficulty (Human vs CPU)", "es": "Dificultad de la CPU (Humano vs CPU)", "pt": "Dificuldade do CPU (Humano vs CPU)", "de": "CPU-Schwierigkeit (Mensch gegen CPU)", "nb": "CPU-vanskelighet (menneske mot CPU)", "it": "Difficoltà CPU (Umano vs CPU)", "ga": "Deacracht an ríomhaire (Duine vs Ríomhaire)", "nl": "CPU-moeilijkheid (mens tegen CPU)", "hr": "Težina CPU-a (Čovjek protiv CPU-a)", "ro": "Dificultatea CPU (Om vs CPU)", "pl": "Poziom CPU (Człowiek vs CPU)", "tr": "CPU zorluğu (İnsan vs CPU)", "ru": "Сложность ИИ (человек против ИИ)", "uk": "Складність ШІ (людина проти ШІ)", "ar": "صعوبة الحاسوب (لاعب ضد الحاسوب)", "hi": "CPU कठिनाई (मानव बनाम CPU)", "id": "Kesulitan CPU (Manusia vs CPU)", "vi": "Độ khó CPU (Người vs CPU)", "th": "ความยากของ CPU (คนปะทะ CPU)", "ja": "CPUの強さ（人間 対 CPU）", "ko": "CPU 난이도 (사람 대 CPU)", "zh-CN": "电脑难度（玩家对电脑）", "zh-TW": "電腦難度（玩家對電腦）" },
  "Durée du match": { "en": "Match length", "es": "Duración del partido", "pt": "Duração do jogo", "de": "Spieldauer", "nb": "Kamplengde", "it": "Durata della partita", "ga": "Fad an chluiche", "nl": "Wedstrijdduur", "hr": "Trajanje utakmice", "ro": "Durata meciului", "pl": "Długość meczu", "tr": "Maç süresi", "ru": "Длительность матча", "uk": "Тривалість матчу", "ar": "مدة المباراة", "hi": "मैच की अवधि", "id": "Durasi pertandingan", "vi": "Thời lượng trận đấu", "th": "ความยาวการแข่งขัน", "ja": "試合の長さ", "ko": "경기 시간", "zh-CN": "比赛时长", "zh-TW": "比賽時長" },
  "Vitesse des joueurs": { "en": "Player speed", "es": "Velocidad de los jugadores", "pt": "Velocidade dos jogadores", "de": "Spielertempo", "nb": "Spillerfart", "it": "Velocità dei giocatori", "ga": "Luas na n-imreoirí", "nl": "Spelersnelheid", "hr": "Brzina igrača", "ro": "Viteza jucătorilor", "pl": "Szybkość zawodników", "tr": "Oyuncu hızı", "ru": "Скорость игроков", "uk": "Швидкість гравців", "ar": "سرعة اللاعبين", "hi": "खिलाड़ियों की गति", "id": "Kecepatan pemain", "vi": "Tốc độ cầu thủ", "th": "ความเร็วผู้เล่น", "ja": "選手のスピード", "ko": "선수 속도", "zh-CN": "球员速度", "zh-TW": "球員速度" },
  "Force réaliste des équipes": { "en": "Realistic team strength", "es": "Fuerza realista de los equipos", "pt": "Força realista das equipas", "de": "Realistische Teamstärke", "nb": "Realistisk lagstyrke", "it": "Forza realistica delle squadre", "ga": "Neart réadúil na bhfoirne", "nl": "Realistische teamsterkte", "hr": "Realna snaga momčadi", "ro": "Puterea realistă a echipelor", "pl": "Realistyczna siła drużyn", "tr": "Gerçekçi takım gücü", "ru": "Реалистичная сила команд", "uk": "Реалістична сила команд", "ar": "قوة واقعية للفرق", "hi": "यथार्थवादी टीम ताकत", "id": "Kekuatan tim realistis", "vi": "Sức mạnh đội thực tế", "th": "ความแข็งแกร่งตามจริง", "ja": "チームの実力を反映", "ko": "현실적인 팀 전력", "zh-CN": "真实球队实力", "zh-TW": "真實球隊實力" },
  "Activé": { "en": "On", "es": "Activado", "pt": "Ativado", "de": "An", "nb": "På", "it": "Attivo", "ga": "Ar siúl", "nl": "Aan", "hr": "Uključeno", "ro": "Activat", "pl": "Włączone", "tr": "Açık", "ru": "Включено", "uk": "Увімкнено", "ar": "مفعّل", "hi": "चालू", "id": "Aktif", "vi": "Bật", "th": "เปิด", "ja": "オン", "ko": "켜짐", "zh-CN": "开启", "zh-TW": "開啟" },
  "ASSISTANCES": { "en": "ASSISTS", "es": "AYUDAS", "pt": "AJUDAS", "de": "HILFEN", "nb": "HJELPEMIDLER", "it": "AIUTI", "ga": "CÚNAIMH", "nl": "HULPMIDDELEN", "hr": "POMOĆI", "ro": "ASISTENȚE", "pl": "UŁATWIENIA", "tr": "YARDIMLAR", "ru": "ПОМОЩЬ", "uk": "ДОПОМОГА", "ar": "المساعدات", "hi": "सहायता", "id": "BANTUAN", "vi": "HỖ TRỢ", "th": "ตัวช่วย", "ja": "アシスト", "ko": "보조 기능", "zh-CN": "辅助", "zh-TW": "輔助" },
  "Sur l'AUTRE appareil, ouvre cette adresse": {
    en: "On the OTHER device, open this address", es: "En el OTRO dispositivo, abre esta dirección",
    pt: "No OUTRO aparelho, abre este endereço", de: "Öffne auf dem ANDEREN Gerät diese Adresse",
    it: "Sull'ALTRO dispositivo, apri questo indirizzo", nl: "Open dit adres op het ANDERE apparaat" },
  "Choisis l'adversaire de": { en: "Choose the opponent for", es: "Elige el rival de",
    pt: "Escolhe o adversário de", de: "Wähle den Gegner für", it: "Scegli l'avversario di",
    nl: "Kies de tegenstander van" },
  // --- wallet / transfer market ---
  "But !":       { en: "Goal!", es: "¡Gol!", pt: "Golo!", de: "Tor!", it: "Gol!", nl: "Goal!" },
  "Victoire":    { en: "Win", es: "Victoria", pt: "Vitória", de: "Sieg", it: "Vittoria", nl: "Winst" },
  "Match nul":   { en: "Draw", es: "Empate", pt: "Empate", de: "Unentschieden", it: "Pareggio", nl: "Gelijkspel" },
  "Défaite":     { en: "Defeat", es: "Derrota", pt: "Derrota", de: "Niederlage", it: "Sconfitta", nl: "Nederlaag" },
  "Vente":       { en: "Sale", es: "Venta", pt: "Venda", de: "Verkauf", it: "Vendita", nl: "Verkoop" },
  "Match joué":  { en: "Match played", es: "Partido jugado", pt: "Jogo disputado", de: "Spiel gespielt",
    it: "Partita giocata", nl: "Wedstrijd gespeeld" },
  "Défi réussi": { en: "Challenge beaten", es: "Reto superado", pt: "Desafio superado",
    de: "Duell gemeistert", it: "Sfida superata", nl: "Uitdaging gehaald" },
  "MARCHÉ":      { en: "MARKET", es: "MERCADO", pt: "MERCADO", de: "MARKT", it: "MERCATO", nl: "MARKT" },
  "Club":        { en: "Club", es: "Club", pt: "Clube", de: "Verein", it: "Club", nl: "Club" },
  "Onze de départ": { en: "Starting XI", es: "Once inicial", pt: "Onze inicial", de: "Startelf", it: "Undici titolare", nl: "Basiself" },
  "Tes recrues": { en: "Your signings", es: "Tus fichajes", pt: "Os teus reforços", de: "Deine Neuzugänge", it: "I tuoi acquisti", nl: "Jouw aanwinsten" },
  "Aucune recrue pour ce club.": { en: "No signings for this club yet.", es: "Aún no hay fichajes para este club.",
    pt: "Ainda sem reforços para este clube.", de: "Noch keine Neuzugänge für diesen Verein.",
    it: "Nessun acquisto per questo club.", nl: "Nog geen aanwinsten voor deze club." },
  "ACHETER":     { en: "BUY", es: "COMPRAR", pt: "COMPRAR", de: "KAUFEN", it: "COMPRA", nl: "KOPEN" },
  "VENDRE":      { en: "SELL", es: "VENDER", pt: "VENDER", de: "VERKAUFEN", it: "VENDI", nl: "VERKOPEN" },
  "PAS ASSEZ":   { en: "NOT ENOUGH", es: "NO ALCANZA", pt: "INSUFICIENTE", de: "ZU WENIG", it: "NON BASTA", nl: "TE WEINIG" },
  "DÉJÀ DANS L'ÉQUIPE": { en: "ALREADY SIGNED", es: "YA FICHADO", pt: "JÁ CONTRATADO", de: "SCHON VERPFLICHTET",
    it: "GIÀ ACQUISTATO", nl: "AL GETEKEND" },
  "Gagne des ballons d'or en marquant et en gagnant tes matchs.": {
    en: "Earn gold balls by scoring and winning your matches.",
    es: "Gana balones de oro marcando y ganando tus partidos.",
    pt: "Ganha bolas de ouro a marcar e a vencer os teus jogos.",
    de: "Verdiene Goldbälle durch Tore und Siege.",
    it: "Guadagna palloni d'oro segnando e vincendo le partite.",
    nl: "Verdien gouden ballen door te scoren en te winnen." },
  "Légende":     { en: "Legend", es: "Leyenda", pt: "Lenda", de: "Legende", it: "Leggenda", nl: "Legende" },
  "Superstar":   { en: "Superstar", es: "Superestrella", pt: "Superestrela", de: "Superstar", it: "Superstar", nl: "Superster" },
  "Star":        { en: "Star", es: "Estrella", pt: "Estrela", de: "Star", it: "Stella", nl: "Ster" },
  "Espoir":      { en: "Prospect", es: "Promesa", pt: "Promessa", de: "Talent", it: "Promessa", nl: "Talent" },
  "Gardien":     { en: "Goalkeeper", es: "Portero", pt: "Guarda-redes", de: "Torwart", it: "Portiere", nl: "Keeper" },
  "Défenseur":   { en: "Defender", es: "Defensa", pt: "Defesa", de: "Verteidiger", it: "Difensore", nl: "Verdediger" },
  "Milieu":      { en: "Midfielder", es: "Centrocampista", pt: "Médio", de: "Mittelfeld", it: "Centrocampista", nl: "Middenvelder" },
  "Attaquant":   { en: "Forward", es: "Delantero", pt: "Avançado", de: "Stürmer", it: "Attaccante", nl: "Aanvaller" },
  "ans":         { en: "yrs", es: "años", pt: "anos", de: "J.", it: "anni", nl: "jr" },
  "TOUS":        { en: "ALL", es: "TODOS", pt: "TODOS", de: "ALLE", it: "TUTTI", nl: "ALLE" },
  "Tous les pays": { en: "All countries", es: "Todos los países", pt: "Todos os países",
    de: "Alle Länder", it: "Tutti i paesi", nl: "Alle landen" },
  "Chercher un joueur…": { en: "Search a player…", es: "Buscar un jugador…", pt: "Procurar um jogador…",
    de: "Spieler suchen…", it: "Cerca un giocatore…", nl: "Zoek een speler…" },
  "Aucun joueur ne correspond.": { en: "No player matches.", es: "Ningún jugador coincide.",
    pt: "Nenhum jogador corresponde.", de: "Kein Spieler passt.", it: "Nessun giocatore corrisponde.",
    nl: "Geen speler gevonden." },
  // --- home main ---
  "Joueurs":     { en: "Players", es: "Jugadores", pt: "Jogadores", de: "Spieler", it: "Giocatori", nl: "Spelers" },
  "1 JOUEUR":    { en: "1 PLAYER", es: "1 JUGADOR", pt: "1 JOGADOR", de: "1 SPIELER", it: "1 GIOCATORE", nl: "1 SPELER" },
  "2 JOUEURS":   { en: "2 PLAYERS", es: "2 JUGADORES", pt: "2 JOGADORES", de: "2 SPIELER", it: "2 GIOCATORI", nl: "2 SPELERS" },
  "Activé — flèches contre I J K L": { en: "On — arrows vs I J K L", es: "Activo — flechas contra I J K L",
    pt: "Ativo — setas contra I J K L", de: "An — Pfeile gegen I J K L", it: "Attivo — frecce contro I J K L",
    nl: "Aan — pijltjes tegen I J K L" },
  // --- pills (menu.ts) ---
  // --- friendly / VS screen ---
  "JOUER ⚽":             { en: "PLAY ⚽", es: "JUGAR ⚽", pt: "JOGAR ⚽", de: "SPIELEN ⚽", it: "GIOCA ⚽", nl: "SPELEN ⚽" },
  "⚑ Changer le capitaine": { en: "⚑ Change captain", es: "⚑ Cambiar capitán", pt: "⚑ Mudar capitão", de: "⚑ Kapitän ändern", it: "⚑ Cambia capitano", nl: "⚑ Aanvoerder wijzigen" },
  "CHOISIS LE PAYS":      { en: "CHOOSE COUNTRY", es: "ELIGE EL PAÍS", pt: "ESCOLHE O PAÍS", de: "LAND WÄHLEN", it: "SCEGLI IL PAESE", nl: "KIES EEN LAND" },
  "CAPITAINE":            { en: "CAPTAIN", es: "CAPITÁN", pt: "CAPITÃO", de: "KAPITÄN", it: "CAPITANO", nl: "AANVOERDER" },
  "Retour":               { en: "Back", es: "Atrás", pt: "Voltar", de: "Zurück", it: "Indietro", nl: "Terug" },

  // --- training ---
  "Corner":               { en: "Corner", es: "Córner", pt: "Canto", de: "Ecke", it: "Calcio d'angolo", nl: "Hoekschop" },
  "Coup franc":           { en: "Free kick", es: "Tiro libre", pt: "Livre", de: "Freistoß", it: "Punizione", nl: "Vrije trap" },
  "Penalty":              { en: "Penalty", es: "Penalti", pt: "Grande penalidade", de: "Elfmeter", it: "Rigore", nl: "Strafschop" },
  "Dribble":              { en: "Dribbling", es: "Regate", pt: "Drible", de: "Dribbling", it: "Dribbling", nl: "Dribbelen" },
  "Gardien":              { en: "Goalkeeper", es: "Portero", pt: "Guarda-redes", de: "Torwart", it: "Portiere", nl: "Keeper" },

  // --- line-up ---
  "Composition":          { en: "Line-up", es: "Alineación", pt: "Escalação", de: "Aufstellung", it: "Formazione", nl: "Opstelling" },

  // --- clubs / national / defi ---
  "Bravo, objectif rempli !": { en: "Well done, objective complete!", es: "¡Bien hecho, objetivo cumplido!", pt: "Boa, objetivo cumprido!", de: "Stark, Ziel erreicht!", it: "Bravo, obiettivo raggiunto!", nl: "Goed gedaan, doel behaald!" },
  "Pas cette fois — réessaie un autre défi.": { en: "Not this time — try another challenge.", es: "Esta vez no — prueba otro reto.", pt: "Desta vez não — tenta outro desafio.", de: "Nicht diesmal — versuch eine andere Aufgabe.", it: "Non stavolta — prova un'altra sfida.", nl: "Deze keer niet — probeer een andere uitdaging." },

  // --- matches gallery ---
  "Mes matchs":           { en: "My matches", es: "Mis partidos", pt: "Os meus jogos", de: "Meine Spiele", it: "Le mie partite", nl: "Mijn wedstrijden" },

  // --- settings: tabs + sections ---
  "🖥️ Graphique":         { en: "🖥️ Graphics", es: "🖥️ Gráficos", pt: "🖥️ Gráficos", de: "🖥️ Grafik", it: "🖥️ Grafica", nl: "🖥️ Grafisch" },
  "🎮 Gameplay":          { en: "🎮 Gameplay", es: "🎮 Jugabilidad", pt: "🎮 Jogabilidade", de: "🎮 Gameplay", it: "🎮 Gameplay", nl: "🎮 Gameplay" },
  "🔊 Audio":             { en: "🔊 Audio", es: "🔊 Audio", pt: "🔊 Áudio", de: "🔊 Audio", it: "🔊 Audio", nl: "🔊 Audio" },
  "⌨️ Commandes":         { en: "⌨️ Controls", es: "⌨️ Controles", pt: "⌨️ Comandos", de: "⌨️ Steuerung", it: "⌨️ Comandi", nl: "⌨️ Besturing" },
  "Match":                { en: "Match", es: "Partido", pt: "Jogo", de: "Spiel", it: "Partita", nl: "Wedstrijd" },
  "Assistances":          { en: "Assists", es: "Asistencias", pt: "Assistências", de: "Hilfen", it: "Assistenze", nl: "Hulp" },
  "Déplacement":          { en: "Movement", es: "Movimiento", pt: "Movimento", de: "Bewegung", it: "Movimento", nl: "Beweging" },
  "Avec le ballon":       { en: "On the ball", es: "Con el balón", pt: "Com a bola", de: "Am Ball", it: "Con la palla", nl: "Aan de bal" },
  "Sans le ballon":       { en: "Off the ball", es: "Sin el balón", pt: "Sem a bola", de: "Ohne Ball", it: "Senza palla", nl: "Zonder bal" },
  "Général":              { en: "General", es: "General", pt: "Geral", de: "Allgemein", it: "Generale", nl: "Algemeen" },
  // --- settings: match ---
  "Tirs au but":          { en: "Penalty shootout", es: "Tanda de penaltis", pt: "Disputa de pênaltis", de: "Elfmeterschießen", it: "Calci di rigore", nl: "Strafschoppenreeks" },
  "Victoire à domicile":  { en: "Home win", es: "Gana el local", pt: "Vitória da casa", de: "Heimsieg", it: "Vince la squadra di casa", nl: "Thuisploeg wint" },
  "Victoire à l'extérieur": { en: "Away win", es: "Gana el visitante", pt: "Vitória de fora", de: "Auswärtssieg", it: "Vince la squadra ospite", nl: "Uitploeg wint" },
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

  // --- on-screen touch buttons (uppercase) ---
  "PASSER EN PROFONDEUR": { en: "THROUGH BALL", es: "PASE PROFUNDO", pt: "PASSE EM PROFUNDIDADE", de: "STEILPASS", it: "FILTRANTE", nl: "DIEPTEPASS" },
  "TIRER":                { en: "SHOOT", es: "DISPARAR", pt: "REMATAR", de: "SCHIESSEN", it: "TIRARE", nl: "SCHIETEN" },
  "PASSER":               { en: "PASS", es: "PASAR", pt: "PASSAR", de: "PASSEN", it: "PASSARE", nl: "PASSEN" },
  "ACCÉLÉRER & GESTES":   { en: "SPRINT & SKILLS", es: "ESPRINT Y GESTOS", pt: "SPRINT E GESTOS", de: "SPRINT & TRICKS", it: "SCATTO E GESTI", nl: "SPRINT & TRUCS" },
  "PRESSER":              { en: "PRESSURE", es: "PRESIONAR", pt: "PRESSIONAR", de: "PRESSING", it: "PRESSARE", nl: "DRUK ZETTEN" },
  "TACLE":                { en: "TACKLE", es: "ENTRADA", pt: "DESARME", de: "GRÄTSCHE", it: "CONTRASTO", nl: "SLIDING" },
  "CHANGER DE JOUEUR":    { en: "SWITCH PLAYER", es: "CAMBIAR JUGADOR", pt: "TROCAR JOGADOR", de: "SPIELER WECHSELN", it: "CAMBIA GIOCATORE", nl: "SPELER WISSELEN" },
  "ACCÉLÉRER":            { en: "SPRINT", es: "ESPRINTAR", pt: "SPRINT", de: "SPRINT", it: "SCATTO", nl: "SPRINT" },

  // --- loading screen ---
  "Chargement du match":  { en: "Loading match", es: "Cargando partido", pt: "A carregar o jogo", de: "Spiel wird geladen", it: "Caricamento partita", nl: "Wedstrijd laden" },

  // --- referee mode ---
  "Sifflet":              { en: "Whistle", es: "Silbato", pt: "Apito", de: "Pfiff", it: "Fischio", nl: "Fluit" },
  "Jaune":                { en: "Yellow", es: "Amarilla", pt: "Amarelo", de: "Gelb", it: "Giallo", nl: "Geel" },
  "Rouge":                { en: "Red", es: "Roja", pt: "Vermelho", de: "Rot", it: "Rosso", nl: "Rood" },
  "Penalty":              { en: "Penalty", es: "Penalti", pt: "Penálti", de: "Elfmeter", it: "Rigore", nl: "Penalty" },
  "Coup franc":           { en: "Free kick", es: "Tiro libre", pt: "Livre", de: "Freistoß", it: "Punizione", nl: "Vrije trap" },
  "VAR":                  { en: "VAR", es: "VAR", pt: "VAR", de: "VAR", it: "VAR", nl: "VAR" },
  "Blessure":             { en: "Injury", es: "Lesión", pt: "Lesão", de: "Verletzung", it: "Infortunio", nl: "Blessure" },
  "Joueur à terre":       { en: "Player down", es: "Jugador en el suelo", pt: "Jogador no chão", de: "Spieler am Boden", it: "Giocatore a terra", nl: "Speler op de grond" },
  "Décide : le laisser jouer, ou le faire sortir (blessé).": { en: "Decide: let him play on, or take him off (injured).", es: "Decide: dejarlo jugar o sacarlo (lesionado).", pt: "Decide: deixá-lo jogar ou tirá-lo (lesionado).", de: "Entscheide: weiterspielen lassen oder auswechseln (verletzt).", it: "Decidi: farlo giocare o farlo uscire (infortunato).", nl: "Beslis: laat hem spelen of haal hem eraf (geblesseerd)." },
  "Le soigner (il reste)": { en: "Treat him (stays)", es: "Atenderlo (se queda)", pt: "Tratá-lo (fica)", de: "Behandeln (bleibt)", it: "Curarlo (resta)", nl: "Verzorgen (blijft)" },
  "Faire sortir ◀":       { en: "Send off ◀", es: "Sacar ◀", pt: "Tirar ◀", de: "Auswechseln ◀", it: "Far uscire ◀", nl: "Eraf ◀" },
  "Faire sortir ▶":       { en: "Send off ▶", es: "Sacar ▶", pt: "Tirar ▶", de: "Auswechseln ▶", it: "Far uscire ▶", nl: "Eraf ▶" },
  "Écris à ce joueur…":   { en: "Write to this player…", es: "Escribe a este jugador…", pt: "Escreve a este jogador…", de: "Schreib diesem Spieler…", it: "Scrivi a questo giocatore…", nl: "Schrijf deze speler…" },
  "Envoyer":              { en: "Send", es: "Enviar", pt: "Enviar", de: "Senden", it: "Invia", nl: "Sturen" },
  "Le joueur":            { en: "The player", es: "El jugador", pt: "O jogador", de: "Der Spieler", it: "Il giocatore", nl: "De speler" },
  "Flèches / ZQSD : te déplacer": { en: "Arrows / WASD: move", es: "Flechas / WASD: moverte", pt: "Setas / WASD: mover-te", de: "Pfeile / WASD: bewegen", it: "Frecce / WASD: muoverti", nl: "Pijlen / WASD: bewegen" },
  "Glisse : tourner la tête": { en: "Drag: turn your head", es: "Arrastra: girar la cabeza", pt: "Arrasta: virar a cabeça", de: "Ziehen: Kopf drehen", it: "Trascina: girare la testa", nl: "Sleep: hoofd draaien" },
  "Jeu arrêté":           { en: "Play stopped", es: "Juego parado", pt: "Jogo parado", de: "Spiel gestoppt", it: "Gioco fermo", nl: "Spel gestopt" },
  "tape un joueur pour lui parler": { en: "tap a player to talk to him", es: "toca a un jugador para hablarle", pt: "toca num jogador para lhe falar", de: "tippe einen Spieler an, um mit ihm zu reden", it: "tocca un giocatore per parlargli", nl: "tik een speler aan om te praten" },
  "Appuie sur le joueur à sanctionner": { en: "Tap the player to book", es: "Toca al jugador a amonestar", pt: "Toca no jogador a punir", de: "Tippe den zu verwarnenden Spieler an", it: "Tocca il giocatore da ammonire", nl: "Tik de te bestraffen speler aan" },
  "Coup franc !": { en: "Free kick!", es: "¡Tiro libre!", pt: "Livre!", de: "Freistoß!", it: "Punizione!", nl: "Vrije trap!" },
  "À toi de siffler pour lancer le jeu": { en: "Blow your whistle to start play", es: "Pita para iniciar el juego", pt: "Apita para iniciar o jogo", de: "Pfeife, um das Spiel zu starten", it: "Fischia per iniziare il gioco", nl: "Fluit om het spel te starten" },
  "va voir le joueur à terre !": { en: "go and check the player down!", es: "¡ve a ver al jugador en el suelo!", pt: "vai ver o jogador caído!", de: "geh zum verletzten Spieler!", it: "vai a vedere il giocatore a terra!", nl: "ga naar de gevallen speler!" },
  "⏳ Chargement… on attend ton ami": { en: "⏳ Loading… waiting for your friend", es: "⏳ Cargando… esperando a tu amigo", pt: "⏳ A carregar… à espera do teu amigo", de: "⏳ Lädt… warte auf deinen Freund", it: "⏳ Caricamento… aspettiamo il tuo amico", nl: "⏳ Laden… wachten op je vriend" },
  "⏳ On attend ton ami…": { en: "⏳ Waiting for your friend…", es: "⏳ Esperando a tu amigo…", pt: "⏳ À espera do teu amigo…", de: "⏳ Warte auf deinen Freund…", it: "⏳ Aspettiamo il tuo amico…", nl: "⏳ Wachten op je vriend…" },
  "Re-siffler : reprendre": { en: "Whistle again: resume", es: "Silbar otra vez: reanudar", pt: "Apitar de novo: retomar", de: "Nochmal pfeifen: fortsetzen", it: "Fischia di nuovo: riprendi", nl: "Fluit weer: hervatten" },
  "Siffle pour arrêter puis parler à un joueur": { en: "Whistle to stop, then talk to a player", es: "Silba para parar y habla con un jugador", pt: "Apita para parar e fala com um jogador", de: "Pfeife zum Stoppen, dann rede mit einem Spieler", it: "Fischia per fermare, poi parla con un giocatore", nl: "Fluit om te stoppen, praat dan met een speler" },

  // --- online multiplayer ---
  "Multijoueur en ligne": { en: "Online multiplayer", es: "Multijugador en línea", pt: "Multijogador online", de: "Online-Mehrspieler", it: "Multigiocatore online", nl: "Online multiplayer" },
  "Créer une partie":     { en: "Create a game", es: "Crear una partida", pt: "Criar um jogo", de: "Spiel erstellen", it: "Crea una partita", nl: "Spel aanmaken" },
  "Rejoindre":            { en: "Join", es: "Unirse", pt: "Entrar", de: "Beitreten", it: "Unisciti", nl: "Meedoen" },
  "Ton code (donne-le à ton ami)": { en: "Your code (give it to your friend)", es: "Tu código (dáselo a tu amigo)", pt: "O teu código (dá-o ao teu amigo)", de: "Dein Code (gib ihn deinem Freund)", it: "Il tuo codice (dallo al tuo amico)", nl: "Jouw code (geef aan je vriend)" },
  "📋 Copier le lien d'invitation": { en: "📋 Copy the invite link", es: "📋 Copiar el enlace de invitación", pt: "📋 Copiar o link de convite", de: "📋 Einladungslink kopieren", it: "📋 Copia il link d'invito", nl: "📋 Uitnodigingslink kopiëren" },
  "Ou tape le code de ton ami": { en: "Or type your friend's code", es: "O escribe el código de tu amigo", pt: "Ou escreve o código do teu amigo", de: "Oder tippe den Code deines Freundes", it: "O digita il codice del tuo amico", nl: "Of typ de code van je vriend" },
  "Non connecté":         { en: "Not connected", es: "No conectado", pt: "Não ligado", de: "Nicht verbunden", it: "Non connesso", nl: "Niet verbonden" },
  "Déconnecté":           { en: "Disconnected", es: "Desconectado", pt: "Desligado", de: "Getrennt", it: "Disconnesso", nl: "Verbinding verbroken" },
  "Connexion au serveur…": { en: "Connecting to server…", es: "Conectando al servidor…", pt: "A ligar ao servidor…", de: "Verbinde mit Server…", it: "Connessione al server…", nl: "Verbinden met server…" },
  "Connecté ✓ — clique « Lancer ensemble »": { en: "Connected ✓ — click “Start together”", es: "Conectado ✓ — pulsa «Empezar juntos»", pt: "Ligado ✓ — clica «Começar juntos»", de: "Verbunden ✓ — klicke „Zusammen starten“", it: "Connesso ✓ — clicca «Inizia insieme»", nl: "Verbonden ✓ — klik “Samen starten”" },
  "Lancer le match ensemble": { en: "Start the match together", es: "Empezar el partido juntos", pt: "Começar o jogo juntos", de: "Spiel zusammen starten", it: "Inizia la partita insieme", nl: "Start de wedstrijd samen" },
  "Lancement du match…":  { en: "Starting the match…", es: "Empezando el partido…", pt: "A começar o jogo…", de: "Spiel wird gestartet…", it: "Avvio della partita…", nl: "Wedstrijd starten…" },
  "Donne le code (ou le lien) à ton ami et attends…": { en: "Give the code (or link) to your friend and wait…", es: "Dale el código (o el enlace) a tu amigo y espera…", pt: "Dá o código (ou link) ao teu amigo e espera…", de: "Gib deinem Freund den Code (oder Link) und warte…", it: "Dai il codice (o link) al tuo amico e aspetta…", nl: "Geef de code (of link) aan je vriend en wacht…" },
  "Connecte-toi d'abord à ton ami": { en: "Connect to your friend first", es: "Conéctate primero a tu amigo", pt: "Liga-te primeiro ao teu amigo", de: "Verbinde dich zuerst mit deinem Freund", it: "Connettiti prima al tuo amico", nl: "Verbind eerst met je vriend" },
  "Tape le code de ton ami d'abord": { en: "Type your friend's code first", es: "Escribe primero el código de tu amigo", pt: "Escreve primeiro o código do teu amigo", de: "Tippe zuerst den Code deines Freundes", it: "Digita prima il codice del tuo amico", nl: "Typ eerst de code van je vriend" },
  "Recherche de ":        { en: "Searching for ", es: "Buscando ", pt: "À procura de ", de: "Suche nach ", it: "Ricerca di ", nl: "Zoeken naar " },
  "Pas encore — nouvel essai ": { en: "Not yet — retrying ", es: "Aún no — reintentando ", pt: "Ainda não — a tentar ", de: "Noch nicht — neuer Versuch ", it: "Non ancora — nuovo tentativo ", nl: "Nog niet — nieuwe poging " },
  "Connexion impossible — vérifie le code et que l'hôte attend, puis réessaie": { en: "Can't connect — check the code and that the host is waiting, then retry", es: "No se puede conectar — comprueba el código y que el anfitrión espera, y reintenta", pt: "Ligação impossível — verifica o código e se o anfitrião espera, e tenta de novo", de: "Verbindung fehlgeschlagen — prüfe den Code und ob der Host wartet, dann nochmal", it: "Connessione impossibile — controlla il codice e che l'host attenda, poi riprova", nl: "Verbinden mislukt — controleer de code en of de host wacht, probeer opnieuw" },
  "Code déjà pris — réessaie « Créer »": { en: "Code already taken — try “Create” again", es: "Código ya usado — pulsa «Crear» otra vez", pt: "Código já usado — tenta «Criar» de novo", de: "Code schon vergeben — nochmal „Erstellen“", it: "Codice già preso — riprova «Crea»", nl: "Code al bezet — probeer “Aanmaken” opnieuw" },
  "Code introuvable — vérifie que l'hôte a créé la partie": { en: "Code not found — check the host created the game", es: "Código no encontrado — comprueba que el anfitrión creó la partida", pt: "Código não encontrado — verifica se o anfitrião criou o jogo", de: "Code nicht gefunden — prüfe, ob der Host das Spiel erstellt hat", it: "Codice non trovato — controlla che l'host abbia creato la partita", nl: "Code niet gevonden — controleer of de host het spel maakte" },
  "Serveur injoignable — réessaie dans un instant": { en: "Server unreachable — retry in a moment", es: "Servidor inaccesible — reintenta en un momento", pt: "Servidor inacessível — tenta daqui a pouco", de: "Server nicht erreichbar — gleich nochmal", it: "Server irraggiungibile — riprova tra poco", nl: "Server onbereikbaar — probeer zo opnieuw" },
  "Navigateur incompatible avec le WebRTC": { en: "Browser doesn't support WebRTC", es: "El navegador no soporta WebRTC", pt: "O navegador não suporta WebRTC", de: "Browser unterstützt kein WebRTC", it: "Il browser non supporta WebRTC", nl: "Browser ondersteunt geen WebRTC" },
  "Clique d'abord « Créer une partie »": { en: "Click “Create a game” first", es: "Pulsa primero «Crear una partida»", pt: "Clica primeiro «Criar um jogo»", de: "Klicke zuerst „Spiel erstellen“", it: "Clicca prima «Crea una partita»", nl: "Klik eerst “Spel aanmaken”" },
  "Lien copié ✓ — envoie-le à ton ami": { en: "Link copied ✓ — send it to your friend", es: "Enlace copiado ✓ — envíaselo a tu amigo", pt: "Link copiado ✓ — envia-o ao teu amigo", de: "Link kopiert ✓ — schick ihn deinem Freund", it: "Link copiato ✓ — invialo al tuo amico", nl: "Link gekopieerd ✓ — stuur naar je vriend" },
  "Graine":               { en: "Seed", es: "Semilla", pt: "Semente", de: "Seed", it: "Seme", nl: "Seed" },
  "Erreur":               { en: "Error", es: "Error", pt: "Erro", de: "Fehler", it: "Errore", nl: "Fout" },
  "En attente d'un match (lance le MÊME match des deux côtés, sans toucher au clavier)": { en: "Waiting for a match (start the SAME match on both sides, without touching the keyboard)", es: "Esperando un partido (empieza el MISMO partido en ambos lados, sin tocar el teclado)", pt: "À espera de um jogo (começa o MESMO jogo dos dois lados, sem tocar no teclado)", de: "Warte auf ein Spiel (starte das GLEICHE Spiel auf beiden Seiten, ohne die Tastatur zu berühren)", it: "In attesa di una partita (avvia la STESSA partita da entrambi i lati, senza toccare la tastiera)", nl: "Wachten op een wedstrijd (start DEZELFDE wedstrijd aan beide kanten, zonder het toetsenbord aan te raken)" },
  "EN SYNC":              { en: "IN SYNC", es: "SINCRONIZADO", pt: "SINCRONIZADO", de: "SYNCHRON", it: "SINCRONIZZATO", nl: "GESYNCED" },
  "DÉSYNC":               { en: "OUT OF SYNC", es: "DESINCRONIZADO", pt: "DESSINCRONIZADO", de: "NICHT SYNCHRON", it: "NON SINCRO", nl: "NIET GESYNCED" },
  "frames identiques":    { en: "identical frames", es: "fotogramas idénticos", pt: "frames idênticos", de: "identische Frames", it: "frame identici", nl: "identieke frames" },
  "ok":                   { en: "ok", es: "ok", pt: "ok", de: "ok", it: "ok", nl: "ok" },
  "Un joueur clique « Créer » et obtient un code. Il le donne à l'autre (WhatsApp, etc.) qui le tape puis clique « Rejoindre ». Ensuite lancez le MÊME match des deux côtés (mêmes équipes) sans toucher au clavier, et regardez l'état plus bas.": { en: "One player clicks “Create” and gets a code. He gives it to the other (WhatsApp, etc.) who types it then clicks “Join”. Then start the SAME match on both sides (same teams) without touching the keyboard, and watch the status below.", es: "Un jugador pulsa «Crear» y obtiene un código. Se lo da al otro (WhatsApp, etc.) que lo escribe y pulsa «Unirse». Luego empezad el MISMO partido en ambos lados (mismos equipos) sin tocar el teclado, y mirad el estado abajo.", pt: "Um jogador clica «Criar» e recebe um código. Dá-o ao outro (WhatsApp, etc.) que o escreve e clica «Entrar». Depois comecem o MESMO jogo dos dois lados (mesmas equipas) sem tocar no teclado, e vejam o estado abaixo.", de: "Ein Spieler klickt „Erstellen“ und bekommt einen Code. Er gibt ihn dem anderen (WhatsApp usw.), der ihn eintippt und „Beitreten“ klickt. Dann startet das GLEICHE Spiel auf beiden Seiten (gleiche Teams), ohne die Tastatur zu berühren, und schaut unten auf den Status.", it: "Un giocatore clicca «Crea» e ottiene un codice. Lo dà all'altro (WhatsApp, ecc.) che lo digita e clicca «Unisciti». Poi avviate la STESSA partita da entrambi i lati (stesse squadre) senza toccare la tastiera, e guardate lo stato in basso.", nl: "Eén speler klikt “Aanmaken” en krijgt een code. Hij geeft die aan de ander (WhatsApp enz.) die hem typt en “Meedoen” klikt. Start dan DEZELFDE wedstrijd aan beide kanten (zelfde teams) zonder het toetsenbord aan te raken, en bekijk de status hieronder." },
};

/** current UI language code (en/fr/es/…), from the radio/menu picker. */
export function uiLang(): Lang {
  try { return menuLanguage(); } catch { return "fr"; }
}

/** translate a French source string to the current language (French = identity). */
// Country names in EVERY language the game speaks, without a table: the browser
// knows them all from the ISO code. Falls back to the French name for the ones
// Intl has no region for (the home nations, "gb-eng" and friends).
const regionCache = new Map<string, string>();
export function countryName(iso: string, french: string): string {
  const lang = uiLang();
  const key = lang + "|" + iso + "|" + french;   // "" iso is shared by several names
  const hit = regionCache.get(key);
  if (hit !== undefined) return hit;
  let out = L(french);   // hand-translated fallback (England, Scotland, Wales…)
  const code = iso.toUpperCase();
  if (/^[A-Z]{2}$/.test(code)) {
    try {
      const dn = new Intl.DisplayNames([lang], { type: "region" });
      out = dn.of(code) ?? out;
    } catch { /* keep the fallback */ }
  }
  regionCache.set(key, out);
  return out;
}

export function L(fr: string): string {
  const lang = uiLang();
  if (lang === "fr" || !lang) return fr;
  const row = T[fr];
  if (!row) return fr;
  // Exact language first, then the base of a regional code (zh-CN -> zh), then
  // English as the widest fallback — a Japanese player reading English beats a
  // Japanese player reading French.
  const base = lang.split("-")[0] ?? lang;
  return row[lang] ?? row[base] ?? row.en ?? fr;
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
