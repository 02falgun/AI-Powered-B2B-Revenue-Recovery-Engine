# RecoverAI Design System

> Written before any component code — per the engineering constitution's "plan first" requirement.

---

## Color Tokens

All tokens go into `globals.css` via Tailwind v4's `@theme {}` block.

| Token | Hex | Role |
|---|---|---|
| `--color-rzp-ink` | `#012652` | Deepest navy — backgrounds, logo fill, shadows |
| `--color-rzp-ocean` | `#0D5FBF` | Mid blue — interactive surfaces, borders on focus |
| `--color-rzp-electric` | `#3395FF` | Primary CTA color, links, primary badge fills |
| `--color-rzp-sky` | `#7EC8E3` | Informational blue, light accent on dark surfaces |
| `--color-rzp-chrome` | `#E8F0FE` | Near-white blue — used for glassmorphism tints |
| `--color-recover-bg` | `#060E1F` | Ultra-dark navy — richer than plain slate-950 |
| `--color-recover-surface` | `#0C1A35` | Card surfaces — deep but readable |
| `--color-recover-border` | `#1A2F55` | Subtle borders that don't scream |
| `--color-recover-mint` | `#00C48C` | Safe recovery / success state |
| `--color-recover-amber` | `#F5A623` | Human review / caution state |
| `--color-recover-red` | `#F04E37` | Hard error states |

**Source:** Razorpay Blade design system (Prussian Blue `#012652`, Dodger Blue `#0D94FB` adjusted to `#3395FF` per verified brand palette from schemecolor.com and brandpalettes.com). The `recover-*` tokens are original to RecoverAI.

### Anti-pattern check
- ❌ Cream + serif + terracotta? No. Deep navy base.
- ❌ Dark + one neon? No. Multi-tier, 11 named tokens, disciplined use.
- ❌ Numbered decorative badges? None used decoratively.
- ❌ Generic fintech template? The circuit-board guardrail signature element is unique to this product.

---

## Typography

| Usage | Font | Weight | Size |
|---|---|---|---|
| Display / h1 | Space Grotesk | 700 | 36–48px |
| Headings / h2–h3 | Space Grotesk | 600 | 20–28px |
| UI labels | Space Grotesk | 500 | 12–14px |
| Body / paragraphs | Geist Sans | 400 | 14–16px |
| Amounts / IDs | Geist Mono | 700 | varies |
| Captions / meta | Geist Sans | 400 | 11–12px |

**Rationale:** Space Grotesk has geometric confidence that reads as "fintech product" without being aggressive. It's used by several funded fintechs precisely because of this. Geist pairs cleanly as body copy. This is NOT the default Inter-everywhere look.

---

## Depth System

Three elevation tiers implemented as CSS variables + utilities:

### Tier 1 — Surface (default card state)
```css
box-shadow:
  0 1px 3px rgba(1, 38, 82, 0.5),
  0 4px 16px rgba(1, 38, 82, 0.25);
```

### Tier 2 — Raised (hover, active, focused card)
```css
box-shadow:
  0 4px 12px rgba(1, 38, 82, 0.6),
  0 16px 40px rgba(1, 38, 82, 0.35),
  inset 0 1px 0 rgba(255, 255, 255, 0.06);
```

### Tier 3 — Floating (key panels, payment link card)
```css
box-shadow:
  0 8px 32px rgba(13, 95, 191, 0.4),
  0 32px 64px rgba(1, 38, 82, 0.55),
  inset 0 1px 0 rgba(255, 255, 255, 0.08);
```

### Interactive bevel
Buttons get `inset 0 1px 0 rgba(255, 255, 255, 0.1)` — simulates a top-edge physical light catch.

### Gradient meshes
Behind hero amounts and the decision result panel:
```css
background: radial-gradient(ellipse at 50% 0%, rgba(51, 149, 255, 0.12) 0%, transparent 70%);
```

---

## Motion System

Five specific, purposeful animations. Not ambient decoration.

### 1. Page-load stagger (Dashboard invoice cards)
- `opacity: 0, y: 20 → opacity: 1, y: 0`
- Framer Motion `staggerChildren: 0.06s` on container
- Duration: `0.4s`, easing: `easeOut`
- Respects `prefers-reduced-motion`: no transform, instant opacity

### 2. Decision badge spring
- Trigger: when `result` arrives with `AUTO_RECOVER` or `HUMAN_REVIEW`
- `scale: 0.8, opacity: 0 → scale: 1, opacity: 1`
- `type: "spring", stiffness: 400, damping: 20`
- The badge only appears after all guardrail LEDs have lit up

### 3. AI processing multi-stage indicator
- Shows 3 stages while API call is in flight:
  - "Parsing buyer email..." (0–2s)
  - "Running AI intent extraction..." (2s+)
  - "Evaluating 6 policy guardrails..." (3s+)
- Animated progress bar under the stages
- Respects reduced motion: shows static label only

### 4. Guardrail circuit-board sequence (SIGNATURE ELEMENT)
- Each of the 6 guardrail rows has an LED circle on the left
- LEDs animate in sequence: `120ms` stagger delay per LED
- Passed LED: `rzp-electric` blue, with a subtle `scale: 1.2 → 1` pulse ring
- Triggered LED: `recover-amber`, with a brief flicker (`opacity: 1 → 0.6 → 1`)
- Decision badge resolves AFTER the last LED completes (creates narrative payoff)

### 5. Payment link reveal
- Card slides in: `y: 16, opacity: 0 → y: 0, opacity: 1` with spring
- Amount figure pulses: brief `textShadow` glow expands then settles
- The "Open Payment Link" button shimmers once on entry

---

## Signature Element Detail

### Guardrail Breakdown as a Circuit Board

The `PolicyGuardrailBreakdown` component is the most important screen moment. Execution:

1. Container has a subtle circuit-trace SVG background (CSS, inline SVG mask)
2. Each guardrail renders as a horizontal "trace row" — a card with a left-side LED indicator circle
3. LED states:
   - **Pending** (before animation): `#1A2F55` — dormant dark
   - **Passed**: `#3395FF` with glow ring — powered up
   - **Triggered**: `#F5A623` with amber glow — alert state
4. Animation sequence driven by Framer Motion `staggerChildren` on the list
5. Decision badge (`AUTO_RECOVER` / `HUMAN_REVIEW`) is a separate animated element that resolves last

This creates the feeling of watching a real policy engine evaluate in real time — not reading a static result.

---

## Button System

| Variant | Background | Text | Hover | Shadow |
|---|---|---|---|---|
| `primary` | `rzp-electric` | white | `rzp-ocean` + lift | Floating tier |
| `secondary` | transparent | `rzp-electric` | `rzp-electric/10` bg | Surface tier |
| `caution` | `recover-amber/15` | `recover-amber` | `recover-amber/25` bg | Surface tier |

All buttons:
- `focus-visible:outline-2 focus-visible:outline-rzp-electric focus-visible:outline-offset-2` — keyboard nav mandatory
- Hover: `translateY(-1px)` + shadow upgrade (disabled via `prefers-reduced-motion`)
- Active: `translateY(0)` + shadow downgrade

---

## Reduced Motion

All animations have fallbacks. When `prefers-reduced-motion: reduce`:
- Stagger: no transform, only opacity transitions (0.1s duration)
- Spring badge: instant appear (no scale animation)
- Guardrail LEDs: all lit simultaneously, no stagger
- Processing indicator: static label, no animated bar
- Button hover: no translateY, only color change
