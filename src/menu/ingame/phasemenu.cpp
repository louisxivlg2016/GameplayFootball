// written by bastiaan konings schuiling 2008 - 2015
// this work is public domain. the code is undocumented, scruffy, untested, and should generally not be used for anything important.
// i do not offer support, so don't ask. to be used for inspiration :)

#include "phasemenu.hpp"

#include "main.hpp"

#include "../gameplan.hpp"
#include "../pagefactory.hpp"
#include "../gpf_i18n.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten.h> // touch button to continue the match (native buttons aren't tappable)
#endif

using namespace blunted;

MatchPhasePage::MatchPhasePage(Gui2WindowManager *windowManager, const Gui2PageData &pageData) : Gui2Page(windowManager, pageData) {

  GetGameTask()->GetMatch()->Pause(true);

  nextPhase = (e_MatchPhase)pageData.properties->GetInt("nextphase");

  std::string phaseName;
  if (nextPhase == e_MatchPhase_2ndHalf) phaseName = GPF_TR("second half", "la 2e mi-temps");
  else if (nextPhase == e_MatchPhase_1stExtraTime) phaseName = GPF_TR("1st extra time", "la 1re prolongation");
  else if (nextPhase == e_MatchPhase_2ndExtraTime) phaseName = GPF_TR("2nd extra time", "la 2e prolongation");
  else if (nextPhase == e_MatchPhase_Penalties) phaseName = GPF_TR("penalties", "les tirs au but");

  buttonNext = new Gui2Button(windowManager, "button_next", 0, 0, 30, 3, GPF_TR("begin ", "Commencer ") + phaseName);
  Gui2Button *button1 = new Gui2Button(windowManager, "button1", 0, 0, 30, 3, GPF_TR("game plan", "Plan de jeu"));

  buttonNext->sig_OnClick.connect(boost::bind(&MatchPhasePage::ContinueGame, this));
  button1->sig_OnClick.connect(boost::bind(&MatchPhasePage::GoGamePlan, this));

  grid = new Gui2Grid(windowManager, "grid", 10, 10, 80, 80);

  grid->AddView(buttonNext, 0, 0);
  grid->AddView(button1, 1, 0);

  grid->UpdateLayout(0.5);

  this->AddView(grid);
  grid->Show();

  buttonNext->SetFocus();

  this->Show();

#ifdef __EMSCRIPTEN__
  // the native buttons can't be tapped with a finger -> show an HTML touch button
  // that fires the focused "begin ..." button (SDLK_RETURN) or opens the game plan.
  EM_ASM({ try { if (window.gpfPhaseMenu) window.gpfPhaseMenu(UTF8ToString($0)); } catch (e) {} }, phaseName.c_str());
#endif
}

MatchPhasePage::~MatchPhasePage() {
#ifdef __EMSCRIPTEN__
  EM_ASM({ try { if (window.gpfPhaseMenuDone) window.gpfPhaseMenuDone(); } catch (e) {} });
#endif
}

void MatchPhasePage::GoGamePlan() {

  Properties properties;
  //properties.SetInt("teamID", );
  CreatePage(e_PageID_GamePlan, properties);
}

void MatchPhasePage::ContinueGame() {
  GetMenuTask()->ReleaseAllButtons();
  GetGameTask()->GetMatch()->Pause(false);
  GoBack(); // back to gamepage
}

void MatchPhasePage::ProcessWindowingEvent(WindowingEvent *event) {
  if (event->IsEscape()) {
    ContinueGame();
    event->Ignore();
  } else {
    Gui2Page::ProcessWindowingEvent(event);
  }
}
