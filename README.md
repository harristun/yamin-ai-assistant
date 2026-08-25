# Yamin AI Assistant

Build a responsive, sleek, modern, and high-tech 3D AI Assistant web app UI in React and Tailwind CSS, featuring subtle Burmese aesthetic details and full Voice/Speech interaction controls optimized across Mobile, Tablet, and Desktop screens.

Overall Visual Theme & Adaptive Layout:
- Theme: Ultra-clean light/glassmorphism theme with subtle Burmese cultural touches (soft gold, jade green, and ruby accents inspired by traditional silk patterns).
- Layout Architecture (Cross-Device Responsive):
  * Mobile (< 768px): Centered single-column mobile view with a 9:16 aspect ratio container aesthetic, collapsible chat drawer, and floating glass overlay controls.
  * Tablet (768px - 1024px): Dual-pane modal overlay layout with optimized touch targets for mid-sized screens.
  * Desktop (> 1024px): Split-screen dashboard layout (Left 60%: Full 3D interactive viewport; Right 40%: Glassmorphic chat history panel and controls sidebar).

1. Top Navigation & Responsive Status Bar:
- Left: App identity with avatar name ("Yamin AI" / "ယမင်း") and a live pulsing status pill ("Online", "Listening...", "Thinking...", "Speaking...").
- Right: Minimalist action icons (Settings, Sound Toggle, Layout Switcher, Reset Chat) using lucide-react.

2. 3D Avatar Viewport (Center / Left Panel):
- Render the 3D model placed at '/models/burmese_girl.glb' using @react-three/fiber and @react-three/drei.
- Studio lighting setup (ambient light, soft directional light, subtle gold rim light) with soft shadow mapping.
- Adaptive Camera System: Dynamically adjust Three.js OrbitControls / camera FOV and position based on viewport breakpoint (close-up portrait frame on mobile vs. waist-up framing on desktop).
- Wrap the 3D canvas in a React Suspense block with an elegant animated skeleton/loading screen.

3. Speech-to-Text (STT) & Text-to-Speech (TTS) Voice Controls:
- Active Waveform Overlay: Floating audio visualizer wave (using framer-motion) that reacts dynamically when the user speaks or when the AI speaks back.
- Main Action Hub:
  * Prominent primary Mic button (Hold or Tap to Speak) with a glowing pulse ring when active.
  * Mute / Audio Output toggle button for TTS speech playback.
  * Speech recognition language badge default set to "my-MM (Burmese)".

4. Adaptive Chat Panel & Quick Prompts:
- Mobile: Collapsible bottom drawer with drag gestures.
- Desktop/Tablet: Fixed right-side glassmorphic chat feed displaying full conversation history with distinct message bubbles (User right-aligned, "Yamin AI" left-aligned with a custom Burmese badge).
- Quick action prompt chips above the input area (e.g., "မင်္ဂလာပါ", "Translate to English", "Teach me something").
- Secondary text input fallback with a smooth send button for manual typing.

Dependencies & Responsiveness Rules:
- Tailwind CSS (utilizing responsive prefixes sm:, md:, lg:), lucide-react, three, @react-three/fiber, @react-three/drei, and framer-motion for UI transitions and micro-interactions.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ff82e5a4-a74f-4a49-aa90-54835ad2133f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
