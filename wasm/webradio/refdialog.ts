// Localized canned replies for the referee-mode "talk to a player" bubble.
// The player answers in the CURRENT UI language (fr base + en/es/pt/de/it/nl,
// same scope as i18n.ts). Intent is detected from keywords (fr + en + universal
// football terms) in refmode.ts; here we just hold the phrasings per intent.
import { uiLang } from "./i18n";

export type Intent =
  | "greet" | "disputeOpen" | "resume" | "why" | "who" | "calm" | "order"
  | "silence" | "red" | "yellow" | "hand" | "penalty" | "foul" | "insult"
  | "praise" | "default";

// Simple intents → one list. Escalating intents → { c: calm, a: angry }.
type Slot = string[] | { c: string[]; a: string[] };
type Pack = Record<Intent, Slot>;

const FR: Pack = {
  greet: ["Oui monsieur l'arbitre ?", "Vous vouliez me parler ?", "Qu'est-ce qu'il y a ?"],
  disputeOpen: ["C'est pas moi qui ai commencé, monsieur !", "Monsieur, c'est LUI qui m'a cherché !", "J'ai rien fait, c'est lui le premier !"],
  resume: ["Merci monsieur l'arbitre !", "D'accord, on reprend !", "Merci, on va jouer.", "Enfin ! Merci monsieur."],
  why: ["Il m'a taclé par derrière puis il m'a insulté, monsieur !", "C'est lui qui a commencé, il m'a poussé !", "Il m'a marché dessus exprès et il rigole en plus !", "Il arrête pas de me provoquer depuis le début !"],
  who: ["C'est LUI, monsieur, pas moi !", "Moi j'ai rien fait, c'est lui le premier !", "Demandez-lui, c'est lui qui a poussé !"],
  calm: ["D'accord monsieur, je me calme.", "Oui monsieur, pardon.", "C'est bon, j'arrête.", "Ok ok, j'arrête… mais c'est lui !"],
  order: { c: ["D'accord monsieur, je recule.", "Ok, je m'écarte.", "Comme vous voulez, arbitre."], a: ["Pourquoi je reculerais ?!", "Poussez-moi encore pour voir…", "Vous n'avez pas à me commander !"] },
  silence: { c: ["…bien monsieur.", "D'accord, je me tais."], a: ["Vous me faites taire ?!", "Non mais oh, quel culot !"] },
  red: { c: ["Non, pas rouge, pitié monsieur !", "Je vais rater la finale à cause de ça…", "S'il vous plaît, laissez-moi une chance !"], a: ["C'est un SCANDALE ! Jamais rouge !", "Vous me détestez ou quoi ?!", "Je vais faire un rapport sur vous !"] },
  yellow: { c: ["Mais j'ai touché le ballon !", "C'est sévère monsieur…", "Bon d'accord, je fais attention."], a: ["Encore un carton ?! N'importe quoi !", "Vous êtes contre nous depuis le début !", "Sortez-en un pour lui aussi alors !"] },
  hand: { c: ["C'était l'épaule, pas la main !", "Ma main était collée au corps, monsieur.", "Regardez bien, y'a pas main."], a: ["Y'a JAMAIS eu main, arbitre !", "Vous inventez des fautes maintenant ?!", "La VAR va vous contredire !"] },
  penalty: { c: ["Il a plongé, y'a pas penalty !", "Regardez la VAR, c'est du cinéma.", "Jamais penalty ça, monsieur."], a: ["PENALTY ?! Il s'est jeté par terre !", "Vous nous volez le match, c'est clair !", "Honteux ! Tout le monde a vu qu'il simule !"] },
  foul: { c: ["J'ai joué le ballon, monsieur.", "C'est lui qui m'a foncé dessus !", "Y'a rien du tout sur cette action."], a: ["Vous sifflez QUE contre nous !", "Arbitrez le vrai jeu, pas l'imaginaire !", "C'est du vol pur et simple !"] },
  insult: ["Hé ! Un peu de respect, monsieur !", "Vous allez me le payer ce carton…", "Répétez ça pour voir !", "…je vais me plaindre à la fédération."],
  praise: ["Merci monsieur l'arbitre !", "Ça fait plaisir, merci.", "Enfin quelqu'un de juste !"],
  default: { c: ["Oui monsieur l'arbitre ?", "Qu'est-ce qu'il y a ?", "On peut reprendre le jeu ?", "J'ai rien fait, moi.", "Vous vouliez me parler ?"], a: ["Quoi ENCORE ?!", "Vous voulez quoi à la fin ?!", "Lâchez-moi un peu, arbitre !", "C'est du grand n'importe quoi votre arbitrage !"] },
};

const EN: Pack = {
  greet: ["Yes ref?", "You wanted to talk to me?", "What is it?"],
  disputeOpen: ["It wasn't me who started, ref!", "Ref, HE came at me first!", "I did nothing, he started it!"],
  resume: ["Thank you ref!", "Alright, let's play on!", "Thanks, we'll play.", "Finally! Thank you ref."],
  why: ["He tackled me from behind then insulted me, ref!", "He started it, he pushed me!", "He stepped on me on purpose and he's laughing about it!", "He's been provoking me the whole game!"],
  who: ["It was HIM, ref, not me!", "I did nothing, he started it!", "Ask him, he's the one who pushed!"],
  calm: ["Alright ref, I'll calm down.", "Yes ref, sorry.", "Okay, I'll stop.", "Ok ok, I'll stop… but it's him!"],
  order: { c: ["Alright ref, I'll step back.", "Ok, I'll move away.", "As you wish, ref."], a: ["Why would I step back?!", "Push me again, I dare you…", "You don't get to order me around!"] },
  silence: { c: ["…fine, ref.", "Alright, I'll be quiet."], a: ["You're telling me to shut up?!", "The nerve of you!"] },
  red: { c: ["No, not red, please ref!", "I'll miss the final because of this…", "Please, give me one chance!"], a: ["This is a SCANDAL! Never a red!", "Do you hate me or what?!", "I'll file a report on you!"] },
  yellow: { c: ["But I got the ball!", "That's harsh, ref…", "Fine, I'll be careful."], a: ["Another card?! Ridiculous!", "You've been against us all game!", "Book him too then!"] },
  hand: { c: ["That was the shoulder, not the hand!", "My arm was against my body, ref.", "Look closely, no handball."], a: ["There was NEVER a handball, ref!", "Are you inventing fouls now?!", "VAR will prove you wrong!"] },
  penalty: { c: ["He dived, that's no penalty!", "Check VAR, it's playacting.", "Never a penalty, ref."], a: ["PENALTY?! He threw himself down!", "You're robbing us, clear as day!", "Shameful! Everyone saw him dive!"] },
  foul: { c: ["I played the ball, ref.", "He ran into ME!", "There's nothing on that."], a: ["You only whistle against us!", "Referee the real game, not the imaginary one!", "This is daylight robbery!"] },
  insult: ["Hey! Show some respect, ref!", "You'll pay for that card…", "Say that again, I dare you!", "…I'll complain to the federation."],
  praise: ["Thank you ref!", "That's kind, thanks.", "Finally, someone fair!"],
  default: { c: ["Yes ref?", "What is it?", "Can we play on?", "I did nothing.", "You wanted to talk to me?"], a: ["What NOW?!", "What do you even want?!", "Leave me alone, ref!", "Your refereeing is a joke!"] },
};

const ES: Pack = {
  greet: ["¿Sí, árbitro?", "¿Quería hablar conmigo?", "¿Qué pasa?"],
  disputeOpen: ["¡No he empezado yo, árbitro!", "¡Árbitro, ÉL me buscó primero!", "¡No hice nada, empezó él!"],
  resume: ["¡Gracias árbitro!", "¡Vale, seguimos!", "Gracias, vamos a jugar.", "¡Por fin! Gracias árbitro."],
  why: ["¡Me hizo una entrada por detrás y luego me insultó, árbitro!", "¡Empezó él, me empujó!", "¡Me pisó a propósito y encima se ríe!", "¡Lleva provocándome todo el partido!"],
  who: ["¡Fue ÉL, árbitro, no yo!", "¡Yo no hice nada, empezó él!", "¡Pregúntele, él fue quien empujó!"],
  calm: ["Vale árbitro, me calmo.", "Sí árbitro, perdón.", "Está bien, paro.", "Vale vale, paro… ¡pero es él!"],
  order: { c: ["Vale árbitro, me retiro.", "Ok, me aparto.", "Como usted diga, árbitro."], a: ["¿Por qué iba a retirarme?!", "Empújeme otra vez, a ver…", "¡No tiene por qué darme órdenes!"] },
  silence: { c: ["…bien, árbitro.", "Vale, me callo."], a: ["¿Me manda callar?!", "¡Qué cara tiene!"] },
  red: { c: ["¡No, roja no, por favor árbitro!", "Me voy a perder la final por esto…", "¡Por favor, deme una oportunidad!"], a: ["¡Es un ESCÁNDALO! ¡Roja jamás!", "¿Me odia o qué?!", "¡Voy a poner un informe sobre usted!"] },
  yellow: { c: ["¡Pero toqué el balón!", "Es severo, árbitro…", "Vale, tendré cuidado."], a: ["¿Otra tarjeta?! ¡Ridículo!", "¡Lleva todo el partido contra nosotros!", "¡Sáquele una a él también!"] },
  hand: { c: ["¡Fue el hombro, no la mano!", "Tenía el brazo pegado al cuerpo, árbitro.", "Mire bien, no hay mano."], a: ["¡NUNCA hubo mano, árbitro!", "¿Ahora se inventa faltas?!", "¡El VAR le va a desmentir!"] },
  penalty: { c: ["¡Se tiró, no hay penalti!", "Mire el VAR, es teatro.", "Eso no es penalti, árbitro."], a: ["¿PENALTI?! ¡Se tiró al suelo!", "¡Nos está robando el partido, está claro!", "¡Vergonzoso! ¡Todos vieron que se tira!"] },
  foul: { c: ["Jugué el balón, árbitro.", "¡Él chocó CONMIGO!", "No hay nada en esa jugada."], a: ["¡Solo pita contra nosotros!", "¡Arbitre el juego real, no el imaginario!", "¡Esto es un robo!"] },
  insult: ["¡Eh! ¡Un poco de respeto, árbitro!", "Me la va a pagar esa tarjeta…", "¡Repítalo si se atreve!", "…me voy a quejar a la federación."],
  praise: ["¡Gracias árbitro!", "Se agradece, gracias.", "¡Por fin alguien justo!"],
  default: { c: ["¿Sí, árbitro?", "¿Qué pasa?", "¿Podemos seguir?", "Yo no hice nada.", "¿Quería hablar conmigo?"], a: ["¿Y ahora QUÉ?!", "¿Qué quiere, a ver?!", "¡Déjeme en paz, árbitro!", "¡Su arbitraje es una vergüenza!"] },
};

const PT: Pack = {
  greet: ["Sim, árbitro?", "Queria falar comigo?", "O que foi?"],
  disputeOpen: ["Não fui eu que comecei, árbitro!", "Árbitro, foi ELE que me provocou primeiro!", "Não fiz nada, foi ele que começou!"],
  resume: ["Obrigado árbitro!", "Está bem, vamos jogar!", "Obrigado, vamos jogar.", "Até que enfim! Obrigado árbitro."],
  why: ["Ele deu-me uma entrada por trás e depois insultou-me, árbitro!", "Foi ele que começou, empurrou-me!", "Pisou-me de propósito e ainda se ri!", "Anda a provocar-me o jogo todo!"],
  who: ["Foi ELE, árbitro, não eu!", "Eu não fiz nada, foi ele!", "Pergunte-lhe, foi ele que empurrou!"],
  calm: ["Está bem árbitro, vou-me acalmar.", "Sim árbitro, desculpe.", "Pronto, eu paro.", "Ok ok, eu paro… mas é ele!"],
  order: { c: ["Está bem árbitro, eu afasto-me.", "Ok, saio daqui.", "Como quiser, árbitro."], a: ["Porque é que eu me afastaria?!", "Empurre-me outra vez, a ver…", "Não me pode dar ordens!"] },
  silence: { c: ["…está bem, árbitro.", "Ok, eu calo-me."], a: ["Manda-me calar?!", "Que descaramento!"] },
  red: { c: ["Não, vermelho não, por favor árbitro!", "Vou falhar a final por causa disto…", "Por favor, dê-me uma hipótese!"], a: ["Isto é um ESCÂNDALO! Vermelho nunca!", "Odeia-me ou quê?!", "Vou fazer queixa de si!"] },
  yellow: { c: ["Mas eu toquei na bola!", "É severo, árbitro…", "Está bem, vou ter cuidado."], a: ["Outro cartão?! Ridículo!", "Está contra nós o jogo todo!", "Então mostre um a ele também!"] },
  hand: { c: ["Foi o ombro, não a mão!", "O braço estava colado ao corpo, árbitro.", "Veja bem, não há mão."], a: ["NUNCA houve mão, árbitro!", "Agora inventa faltas?!", "O VAR vai contrariá-lo!"] },
  penalty: { c: ["Ele atirou-se, não há penálti!", "Veja o VAR, é teatro.", "Isso não é penálti, árbitro."], a: ["PENÁLTI?! Atirou-se ao chão!", "Está a roubar-nos o jogo, é claro!", "Vergonhoso! Toda a gente viu que ele simula!"] },
  foul: { c: ["Joguei a bola, árbitro.", "Foi ele que embateu EM MIM!", "Não há nada nesse lance."], a: ["Só apita contra nós!", "Arbitre o jogo real, não o imaginário!", "Isto é um roubo!"] },
  insult: ["Eh! Um pouco de respeito, árbitro!", "Vai pagar-me esse cartão…", "Repita lá isso!", "…vou queixar-me à federação."],
  praise: ["Obrigado árbitro!", "Agradeço, obrigado.", "Até que enfim alguém justo!"],
  default: { c: ["Sim, árbitro?", "O que foi?", "Podemos continuar?", "Eu não fiz nada.", "Queria falar comigo?"], a: ["O que é AGORA?!", "Afinal o que quer?!", "Deixe-me em paz, árbitro!", "A sua arbitragem é uma vergonha!"] },
};

const DE: Pack = {
  greet: ["Ja, Schiri?", "Sie wollten mit mir reden?", "Was ist los?"],
  disputeOpen: ["Ich habe nicht angefangen, Schiri!", "Schiri, ER hat mich zuerst provoziert!", "Ich habe nichts gemacht, er hat angefangen!"],
  resume: ["Danke Schiri!", "Gut, weiter geht's!", "Danke, wir spielen.", "Endlich! Danke Schiri."],
  why: ["Er hat mich von hinten gefoult und dann beleidigt, Schiri!", "Er hat angefangen, er hat mich geschubst!", "Er ist mir absichtlich draufgetreten und lacht auch noch!", "Er provoziert mich das ganze Spiel!"],
  who: ["ER war's, Schiri, nicht ich!", "Ich hab nichts gemacht, er war's!", "Fragen Sie ihn, er hat geschubst!"],
  calm: ["Gut Schiri, ich beruhige mich.", "Ja Schiri, Entschuldigung.", "Okay, ich hör auf.", "Ok ok, ich hör auf… aber er ist schuld!"],
  order: { c: ["Gut Schiri, ich geh zurück.", "Ok, ich mach Platz.", "Wie Sie wollen, Schiri."], a: ["Warum sollte ich zurückgehen?!", "Schubsen Sie mich nochmal…", "Sie haben mir nichts zu befehlen!"] },
  silence: { c: ["…gut, Schiri.", "Okay, ich bin still."], a: ["Sie befehlen mir zu schweigen?!", "So eine Frechheit!"] },
  red: { c: ["Nein, nicht Rot, bitte Schiri!", "Ich verpasse das Finale deswegen…", "Bitte, geben Sie mir eine Chance!"], a: ["Das ist ein SKANDAL! Niemals Rot!", "Hassen Sie mich oder was?!", "Ich melde Sie!"] },
  yellow: { c: ["Aber ich hab den Ball gespielt!", "Das ist hart, Schiri…", "Gut, ich pass auf."], a: ["Noch eine Karte?! Lächerlich!", "Sie sind das ganze Spiel gegen uns!", "Dann zeigen Sie ihm auch eine!"] },
  hand: { c: ["Das war die Schulter, nicht die Hand!", "Mein Arm war am Körper, Schiri.", "Schauen Sie genau, kein Handspiel."], a: ["Das war NIE Hand, Schiri!", "Erfinden Sie jetzt Fouls?!", "Der VAR wird Sie widerlegen!"] },
  penalty: { c: ["Er ist geflogen, kein Elfmeter!", "Schauen Sie den VAR, das ist Theater.", "Das ist kein Elfmeter, Schiri."], a: ["ELFMETER?! Er hat sich fallen lassen!", "Sie berauben uns, ganz klar!", "Schande! Alle haben die Schwalbe gesehen!"] },
  foul: { c: ["Ich hab den Ball gespielt, Schiri.", "Er ist in MICH reingelaufen!", "Da ist gar nichts."], a: ["Sie pfeifen nur gegen uns!", "Pfeifen Sie das echte Spiel!", "Das ist glatter Raub!"] },
  insult: ["He! Etwas Respekt, Schiri!", "Diese Karte zahlen Sie mir heim…", "Sagen Sie das nochmal!", "…ich beschwer mich beim Verband."],
  praise: ["Danke Schiri!", "Das freut mich, danke.", "Endlich mal jemand Fairer!"],
  default: { c: ["Ja, Schiri?", "Was ist los?", "Können wir weiterspielen?", "Ich hab nichts gemacht.", "Sie wollten mit mir reden?"], a: ["Was JETZT?!", "Was wollen Sie überhaupt?!", "Lassen Sie mich in Ruhe, Schiri!", "Ihre Leitung ist ein Witz!"] },
};

const IT: Pack = {
  greet: ["Sì, arbitro?", "Voleva parlarmi?", "Cosa c'è?"],
  disputeOpen: ["Non ho cominciato io, arbitro!", "Arbitro, è stato LUI a provocarmi!", "Non ho fatto niente, ha cominciato lui!"],
  resume: ["Grazie arbitro!", "Va bene, si gioca!", "Grazie, giochiamo.", "Finalmente! Grazie arbitro."],
  why: ["Mi ha fatto fallo da dietro e poi mi ha insultato, arbitro!", "Ha cominciato lui, mi ha spinto!", "Mi ha pestato apposta e per giunta ride!", "Mi provoca da tutta la partita!"],
  who: ["È stato LUI, arbitro, non io!", "Io non ho fatto niente, è stato lui!", "Chieda a lui, è lui che ha spinto!"],
  calm: ["Va bene arbitro, mi calmo.", "Sì arbitro, scusi.", "Va bene, smetto.", "Ok ok, smetto… ma è lui!"],
  order: { c: ["Va bene arbitro, mi allontano.", "Ok, mi sposto.", "Come vuole, arbitro."], a: ["Perché dovrei allontanarmi?!", "Mi spinga ancora, forza…", "Non deve darmi ordini!"] },
  silence: { c: ["…va bene, arbitro.", "Ok, sto zitto."], a: ["Mi dice di stare zitto?!", "Che faccia tosta!"] },
  red: { c: ["No, non rosso, la prego arbitro!", "Mi perderò la finale per questo…", "La prego, mi dia una possibilità!"], a: ["È uno SCANDALO! Rosso mai!", "Ce l'ha con me o cosa?!", "Farò rapporto su di lei!"] },
  yellow: { c: ["Ma ho preso la palla!", "È severo, arbitro…", "Va bene, starò attento."], a: ["Un altro cartellino?! Assurdo!", "È contro di noi da tutta la partita!", "Allora lo dia anche a lui!"] },
  hand: { c: ["Era la spalla, non la mano!", "Il braccio era attaccato al corpo, arbitro.", "Guardi bene, non c'è mano."], a: ["Non c'è MAI stato fallo di mano, arbitro!", "Adesso si inventa i falli?!", "Il VAR la smentirà!"] },
  penalty: { c: ["Si è tuffato, non è rigore!", "Guardi il VAR, è teatro.", "Non è rigore, arbitro."], a: ["RIGORE?! Si è buttato per terra!", "Ci sta rubando la partita, è chiaro!", "Vergogna! Hanno visto tutti che si tuffa!"] },
  foul: { c: ["Ho giocato la palla, arbitro.", "È lui che ha addosso a ME!", "Non c'è niente su quell'azione."], a: ["Fischia solo contro di noi!", "Arbitri il gioco vero, non quello immaginario!", "Questo è un furto!"] },
  insult: ["Ehi! Un po' di rispetto, arbitro!", "Me la pagherà questa ammonizione…", "Lo ripeta se ha coraggio!", "…mi lamenterò con la federazione."],
  praise: ["Grazie arbitro!", "Fa piacere, grazie.", "Finalmente uno giusto!"],
  default: { c: ["Sì, arbitro?", "Cosa c'è?", "Possiamo giocare?", "Non ho fatto niente.", "Voleva parlarmi?"], a: ["E ADESSO cosa?!", "Ma cosa vuole?!", "Mi lasci in pace, arbitro!", "Il suo arbitraggio è uno scherzo!"] },
};

const NL: Pack = {
  greet: ["Ja, scheids?", "Wilde u me spreken?", "Wat is er?"],
  disputeOpen: ["Ik ben niet begonnen, scheids!", "Scheids, HIJ begon eerst!", "Ik deed niks, hij begon!"],
  resume: ["Bedankt scheids!", "Oké, we spelen door!", "Dank je, we spelen.", "Eindelijk! Bedankt scheids."],
  why: ["Hij tackelde me van achteren en beledigde me toen, scheids!", "Hij begon, hij duwde me!", "Hij trapte me expres en lacht er nog om ook!", "Hij zit me de hele wedstrijd op te jutten!"],
  who: ["Het was HIJ, scheids, niet ik!", "Ik deed niks, hij begon!", "Vraag het hem, hij duwde!"],
  calm: ["Oké scheids, ik kalmeer.", "Ja scheids, sorry.", "Goed, ik stop.", "Oké oké, ik stop… maar het is hem!"],
  order: { c: ["Oké scheids, ik ga terug.", "Ok, ik ga opzij.", "Zoals u wilt, scheids."], a: ["Waarom zou ik teruggaan?!", "Duw me nog eens…", "U hebt mij niks te bevelen!"] },
  silence: { c: ["…goed, scheids.", "Oké, ik ben stil."], a: ["Zegt u dat ik moet zwijgen?!", "Wat een lef!"] },
  red: { c: ["Nee, geen rood, alstublieft scheids!", "Ik mis de finale hierdoor…", "Alstublieft, geef me een kans!"], a: ["Dit is een SCHANDAAL! Nooit rood!", "Haat u me of zo?!", "Ik dien een klacht tegen u in!"] },
  yellow: { c: ["Maar ik raakte de bal!", "Dat is streng, scheids…", "Goed, ik let op."], a: ["Alweer een kaart?! Belachelijk!", "U bent de hele wedstrijd tegen ons!", "Geef hem er dan ook een!"] },
  hand: { c: ["Dat was de schouder, niet de hand!", "Mijn arm zat tegen mijn lichaam, scheids.", "Kijk goed, geen hands."], a: ["Het was NOOIT hands, scheids!", "Verzint u nu overtredingen?!", "De VAR geeft u ongelijk!"] },
  penalty: { c: ["Hij dook, dat is geen penalty!", "Bekijk de VAR, het is toneel.", "Nooit een penalty, scheids."], a: ["PENALTY?! Hij liet zich vallen!", "U berooft ons, overduidelijk!", "Schandelijk! Iedereen zag de schwalbe!"] },
  foul: { c: ["Ik speelde de bal, scheids.", "Hij liep tegen MIJ aan!", "Er is niks op die actie."], a: ["U fluit alleen tegen ons!", "Fluit het echte spel, niet het denkbeeldige!", "Dit is pure diefstal!"] },
  insult: ["Hé! Een beetje respect, scheids!", "Die kaart zet ik u betaald…", "Zeg dat nog eens!", "…ik klaag bij de bond."],
  praise: ["Bedankt scheids!", "Fijn, dank je.", "Eindelijk iemand eerlijk!"],
  default: { c: ["Ja, scheids?", "Wat is er?", "Kunnen we door?", "Ik deed niks.", "Wilde u me spreken?"], a: ["Wat NU weer?!", "Wat wilt u nou?!", "Laat me met rust, scheids!", "Uw leiding is een lachertje!"] },
};

const PACKS: Record<string, Pack> = { fr: FR, en: EN, es: ES, pt: PT, de: DE, it: IT, nl: NL };

const pick = (a: string[]): string => a[Math.floor(Math.random() * a.length)];

/** A canned reply for the given intent in the current UI language (falls back to
 *  English, then French). `hot` picks the angry variant for escalating intents. */
export function dialogLine(intent: Intent, hot: boolean): string {
  const lang = uiLang();
  const pack = PACKS[lang] || PACKS.en || FR;
  const slot: Slot = pack[intent] ?? (PACKS.en[intent] ?? FR[intent]);
  if (Array.isArray(slot)) return pick(slot);
  return pick(hot ? slot.a : slot.c);
}
