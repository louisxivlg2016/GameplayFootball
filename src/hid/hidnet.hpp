// Online multiplayer: a synthetic HID device fed by the REMOTE peer's input.
// It rides the exact same code path as a real human device (polled once per sim
// tick at GameTask::ProcessPhase, read via GetButton/GetDirection/GetPrevious...),
// so the remote player is, to the sim, indistinguishable from a local human —
// which is what deterministic lockstep needs.
//
// Header-only (all inline) so it needs no CMake source-list change. Its identifier
// type is Keyboard so the gamepad-specific casts in controllerselect/main never
// touch it. Input is STAGED via Feed() and LATCHED on Process() (mirroring
// HIDKeyboard) so edge detection (previous-vs-current) keeps working.

#ifndef _HPP_HIDNET
#define _HPP_HIDNET

#include "ihidevice.hpp"

class HIDNet : public IHIDevice {
 public:
  HIDNet() {
    deviceType = e_HIDeviceType_Keyboard; // avoid gamepad casts; read via IHIDevice
    identifier = "net";
    for (int i = 0; i < e_ButtonFunction_Size; i++) { buttons[i] = false; prev[i] = false; staged[i] = false; }
    dir = Vector3(0);
  }
  virtual ~HIDNet() {}

  virtual void LoadConfig() {}
  virtual void SaveConfig() {}

  virtual void Process() {
    for (int i = 0; i < e_ButtonFunction_Size; i++) { prev[i] = buttons[i]; buttons[i] = staged[i]; }
  }

  virtual bool GetButton(e_ButtonFunction b) { return buttons[b]; }
  virtual float GetButtonValue(e_ButtonFunction b) { return buttons[b] ? 1.0f : 0.0f; }
  virtual void SetButton(e_ButtonFunction b, bool s) { buttons[b] = s; }
  virtual bool GetPreviousButtonState(e_ButtonFunction b) { return prev[b]; }
  virtual Vector3 GetDirection() { return dir; }

  // Stage the remote peer's input for one tick (applied on the next Process()).
  // `mask` bit i = e_ButtonFunction i; dx/dy = analog direction (-1..1).
  void Feed(unsigned int mask, float dx, float dy) {
    for (int i = 0; i < e_ButtonFunction_Size; i++) staged[i] = ((mask >> i) & 1u) != 0;
    dir = Vector3(dx, dy, 0);
  }

 protected:
  bool buttons[e_ButtonFunction_Size];
  bool prev[e_ButtonFunction_Size];
  bool staged[e_ButtonFunction_Size];
  Vector3 dir;
};

#endif
