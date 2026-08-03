// UI-string localization for the in-match native menus (half-time, pause, game
// plan, game over) — the only native menus the wasm player sees. The selected
// language is pushed from JS via gpf_set_ui_lang (gpf_ui_lang lives in gametask.cpp,
// default "en"). GPF_TR("english", ...) looks the English key up in the table and
// returns the translation for the current language, or the English key itself when
// the language isn't covered. The 2nd macro arg (old inline French) is ignored —
// kept so existing call sites compile unchanged; the French now lives in the table.
#ifndef _HPP_GPF_I18N
#define _HPP_GPF_I18N

#include <string>
#include <map>

extern std::string gpf_ui_lang; // "en","fr","es","pt","de","it","nl",… (native build stays "en")

inline std::string gpf_tr(const std::string &en) {
  const std::string &L = gpf_ui_lang;
  if (L.empty() || L == "en") return en;
  typedef std::map<std::string, std::string> Row;   // lang -> translation
  typedef std::map<std::string, Row> Table;         // english -> Row
  static const Table t = {
    {"game plan", {{"fr","Plan de jeu"},{"es","Plan de juego"},{"pt","Plano de jogo"},{"de","Spielplan"},{"it","Piano di gioco"},{"nl","Speelplan"}}},
    {"begin ", {{"fr","Commencer "},{"es","Comenzar "},{"pt","Começar "},{"de","Beginne "},{"it","Inizia "},{"nl","Begin "}}},
    {"second half", {{"fr","la 2e mi-temps"},{"es","la 2ª parte"},{"pt","a 2ª parte"},{"de","die 2. Halbzeit"},{"it","il 2° tempo"},{"nl","de 2e helft"}}},
    {"1st extra time", {{"fr","la 1re prolongation"},{"es","la 1ª prórroga"},{"pt","o 1º prolongamento"},{"de","die 1. Verlängerung"},{"it","il 1° supplementare"},{"nl","de 1e verlenging"}}},
    {"2nd extra time", {{"fr","la 2e prolongation"},{"es","la 2ª prórroga"},{"pt","o 2º prolongamento"},{"de","die 2. Verlängerung"},{"it","il 2° supplementare"},{"nl","de 2e verlenging"}}},
    {"penalties", {{"fr","les tirs au but"},{"es","los penaltis"},{"pt","as grandes penalidades"},{"de","das Elfmeterschießen"},{"it","i rigori"},{"nl","de strafschoppen"}}},
    {"controller select", {{"fr","Manettes"},{"es","Mandos"},{"pt","Comandos"},{"de","Controller"},{"it","Controller"},{"nl","Controllers"}}},
    {"camera settings", {{"fr","Réglages caméra"},{"es","Ajustes de cámara"},{"pt","Definições da câmara"},{"de","Kameraeinstellungen"},{"it","Impostazioni telecamera"},{"nl","Camera-instellingen"}}},
    {"visual options", {{"fr","Options visuelles"},{"es","Opciones visuales"},{"pt","Opções visuais"},{"de","Bildoptionen"},{"it","Opzioni visive"},{"nl","Beeldopties"}}},
    {"system settings", {{"fr","Réglages système"},{"es","Ajustes del sistema"},{"pt","Definições do sistema"},{"de","Systemeinstellungen"},{"it","Impostazioni di sistema"},{"nl","Systeeminstellingen"}}},
    {"replay", {{"fr","Revoir l'action"},{"es","Repetición"},{"pt","Repetição"},{"de","Wiederholung"},{"it","Replay"},{"nl","Herhaling"}}},
    {"forfeit match", {{"fr","Abandonner le match"},{"es","Abandonar el partido"},{"pt","Desistir do jogo"},{"de","Spiel aufgeben"},{"it","Abbandona la partita"},{"nl","Wedstrijd opgeven"}}},
    {"are you sure you want to forfeit?", {{"fr","Abandonner le match ?"},{"es","¿Seguro que quieres abandonar?"},{"pt","Tens a certeza que queres desistir?"},{"de","Spiel wirklich aufgeben?"},{"it","Vuoi davvero abbandonare?"},{"nl","Weet je zeker dat je wilt opgeven?"}}},
    {"OK, forfeit", {{"fr","Oui, abandonner"},{"es","Sí, abandonar"},{"pt","Sim, desistir"},{"de","Ja, aufgeben"},{"it","Sì, abbandona"},{"nl","Ja, opgeven"}}},
    {"Continue match", {{"fr","Reprendre le match"},{"es","Continuar partido"},{"pt","Continuar jogo"},{"de","Spiel fortsetzen"},{"it","Continua la partita"},{"nl","Wedstrijd hervatten"}}},
    {"well then", {{"fr","Retour au menu"},{"es","Volver al menú"},{"pt","Voltar ao menu"},{"de","Zurück zum Menü"},{"it","Torna al menu"},{"nl","Terug naar menu"}}},
    {"possession", {{"fr","possession"},{"es","posesión"},{"pt","posse de bola"},{"de","Ballbesitz"},{"it","possesso"},{"nl","balbezit"}}},
    {"shots", {{"fr","tirs"},{"es","tiros"},{"pt","remates"},{"de","Schüsse"},{"it","tiri"},{"nl","schoten"}}},
    {"Line-up", {{"fr","Composition"},{"es","Alineación"},{"pt","Escalação"},{"de","Aufstellung"},{"it","Formazione"},{"nl","Opstelling"}}},
    {"Tactics", {{"fr","Tactique"},{"es","Táctica"},{"pt","Táticas"},{"de","Taktik"},{"it","Tattiche"},{"nl","Tactiek"}}},
    {"Formation", {{"fr","Formation"},{"es","Formación"},{"pt","Formação"},{"de","Formation"},{"it","Modulo"},{"nl","Formatie"}}},
    {"Team", {{"fr","Équipe"},{"es","Equipo"},{"pt","Equipa"},{"de","Team"},{"it","Squadra"},{"nl","Team"}}},
    {"Team 1", {{"fr","Équipe 1"},{"es","Equipo 1"},{"pt","Equipa 1"},{"de","Team 1"},{"it","Squadra 1"},{"nl","Team 1"}}},
    {"Team 2", {{"fr","Équipe 2"},{"es","Equipo 2"},{"pt","Equipa 2"},{"de","Team 2"},{"it","Squadra 2"},{"nl","Team 2"}}},
  };
  Table::const_iterator it = t.find(en);
  if (it == t.end()) return en;
  Row::const_iterator j = it->second.find(L);
  return j == it->second.end() ? en : j->second;
}

#define GPF_TR(en, ...) gpf_tr(en)

#endif
