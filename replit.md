# SafeRoute AI

A Fatigue-Aware Smart Route Planning App for Delivery Partners built with Expo React Native.

## Architecture

- **Frontend**: Expo Router (file-based routing), React Native, TypeScript
- **Backend**: Express.js (port 5000) — minimal API server + landing page
- **State**: React Context (FatigueContext) + AsyncStorage for persistence
- **Fonts**: Rajdhani (headers/tech labels) + Inter (body text)
- **Icons**: @expo/vector-icons (Ionicons, MaterialCommunityIcons)

## App Structure

```
app/
  _layout.tsx         # Root layout with fonts, providers, Stack navigation
  (tabs)/
    _layout.tsx       # 4-tab layout with NativeTabs (liquid glass iOS 26+)
    index.tsx         # Dashboard — SVG arc gauge, live timer, quick actions
    session.tsx       # Session inputs — delivery counter, sliders, env pickers
    routes.tsx        # Smart route planner — PSO-inspired, break timer
    history.tsx       # History — safety score ring, trend chart, session log
  profile.tsx         # Driver profile modal — name, vehicle, goals
  tips.tsx            # Safety tips modal — contextual by fatigue level
context/
  FatigueContext.tsx  # Global state — session, fatigue calc, auto-timers, profile
lib/
  fatigueEngine.ts    # Fuzzy Logic engine — fatigue scoring, prediction, route gen
  query-client.ts     # React Query + API helpers
constants/
  colors.ts           # Dark navy theme with safe/caution/danger accent colors
```

## Key Features

1. **Fuzzy Logic Fatigue Engine** — calculates real-time fatigue index (0–100) from 6 inputs
2. **SVG Arc Gauge** — animated 270° arc gauge with pulsing glow on high fatigue
3. **Live Session Timer** — auto-ticking stopwatch + auto-increment for drive hours and break minutes
4. **Quick Actions** — one-tap delivery logging, break start/end from Dashboard
5. **Fatigue Prediction** — simulates forward trajectory to estimate when next level is reached
6. **PSO-inspired Route Planner** — orders deliveries by priority + fatigue risk with break markers
7. **Break Timer** — countdown timer on Routes screen when break is active
8. **Safety Score + Streak** — computed from last 10 sessions, shown in Dashboard and History
9. **Contextual Safety Tips** — 5 tips per fatigue level, accessible from Dashboard or Tips screen
10. **Driver Profile** — name, company, vehicle type, daily delivery goal with persistent storage
11. **History & Analytics** — trend bar chart, safety ring, session log with metadata

## Color Theme

- Background: `#0A1628` (deep navy)
- Cards: `#0F1F3D`, `#132240`, `#1A2D4F`
- Safe: `#00E676` (green)
- Caution: `#FFB300` (amber)
- Danger: `#FF4444` (red)
- Accent: `#00C2FF` (cyan)

## Tech Stack

- expo, expo-router, expo-blur, expo-haptics, expo-glass-effect
- react-native-svg (SVG arc gauge)
- react-native-reanimated (animations)
- @expo-google-fonts/rajdhani, @expo-google-fonts/inter
- @react-native-async-storage/async-storage (persistence)
- @tanstack/react-query (server state)
