# Glorb

A macOS menu bar Pomodoro timer that uses your webcam to detect when you've drifted from your screen — and brings you back.

![Glorb mascot](glorb.png)

## What it does

Glorb sits in your menu bar. When you start a focus session, it watches your webcam in the background. If you look away for more than 8 seconds, it escalates through a series of interventions to pull your attention back:

- **Weak mode** — notifications and chime sounds
- **Strong mode** — notifications, then screen flash, audio fade, and a full-screen overlay

Interventions are tailored to your profile. During onboarding, Glorb walks you through the Adult ADHD Self-Report Scale (ASRS v1.1) and uses your results to pick the right escalation pattern.

## Features

- Runs as a menu bar app with no Dock icon
- Draggable ring to set session duration (1–60 min)
- Webcam focus detection using [face-api.js](https://github.com/justadudewhohacks/face-api.js) (TinyFaceDetector + 68-point landmarks)
- ADHD-aware intervention paths
- Dark/light theme (follows system, toggleable)
- All data stored locally via `electron-store` — nothing is sent anywhere

## Requirements

- macOS
- Node.js + npm
- Camera access (prompted on first run)

## Getting started

```bash
npm install
npm start
```

On first launch, Glorb will open an onboarding window to collect your name and walk you through the ASRS questionnaire. After that, click the menu bar icon to open the timer.

**Cmd+Q** quits the app.

## Intervention modes

| Mode | Trigger | Escalation |
|------|---------|------------|
| Weak – Regular | 30s after drift | Notifications + chimes, resets after last ping |
| Weak – ADHD | 10s after drift | Escalating note sequences |
| Strong – Regular | 15s after drift | Notifications → screen flash → audio fade → vignette → terminate overlay |
| Strong – ADHD | 10s after drift | Escalating notes → screen flash → audio fade → vignette → terminate overlay |

You can switch between Weak and Strong in the settings panel at any time.
