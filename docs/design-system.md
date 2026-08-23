# RecoverAI Design System — Physical Control Panel (B&W Edition)

## 1. Overview & Aesthetic Philosophy
RecoverAI is the **Accounts Receivable Control Center**. This design system removes all generic "AI-dashboard" tropes (navy glow, neon blue/green badges, ambient looping pulses, uppercase mono stat sub-labels) and replaces them with a **tactile, physical control-panel interface** in strict grayscale.

Reference inspirations:
- Dieter Rams / Braun precision audio and calculation hardware.
- Aircraft cockpit breaker and annunciator toggle banks.
- Mechanical banking ledger consoles and milled aluminum chassis.

---

## 2. Grayscale Color Palette (Zero-Hue Axis)

| Token | Hex Value | Role / Usage |
|---|---|---|
| `--panel-chassis` | `#0D0D0E` | Main chassis / app background canvas |
| `--panel-surface` | `#161618` | Base control panel surface |
| `--panel-raised` | `#202024` | Raised physical component / card surface |
| `--panel-recessed` | `#080809` | Debossed / carved instrument readout cavity |
| `--border-bezel` | `#2E2E33` | Physical beveled seam / component boundary |
| `--border-highlight` | `#484850` | Top-edge reflection / milled metal bevel |
| `--text-primary` | `#F4F4F5` | Paper-white primary display readout |
| `--text-secondary` | `#A1A1AA` | Etched aluminum secondary label |
| `--text-tertiary` | `#71717A` | Engraved chassis label / specification |
| `--switch-active` | `#FAFAFA` | Engaged switch contact plate |
| `--switch-inactive` | `#27272A` | Disengaged switch rocker body |

*Strict Rule*: Zero blue/navy tint, zero neon green, zero saturated amber. Complete readability is maintained even when viewed on a monochrome display.

---

## 3. Status Without Color (Shape, Weight & Iconography)

Status is never conveyed by color alone:

| State | Visual Treatment | Icon | Shape |
|---|---|---|---|
| **AUTO_RECOVER** (Approved) | Solid filled white plate with black ink text | `✓` (Bold Checkmark) | Solid pill / filled block |
| **HUMAN_REVIEW** (Review Required) | Thick double-outline with dark interior | `▲` (Alert Triangle) | Heavy notched rectangle |
| **OVERDUE** | Solid bordered badge with diagonal hatching | `⏱` (Timer Dial) | Beveled rectangular tag |
| **PAID / SETTLED** | Recessed engraved plate with lock check | `●` (Solid Disc) | Debossed square badge |
| **PENDING / PROCESSING** | Dashed hairline outline | `◌` (Dashed Ring) | Dashed rounded pill |

---

## 4. Real 3D Physical Elevation & Shadow Metaphor

Single top-left directional light source:

- **Raised Panel (Outset 3D)**:
  `box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08) inset, 0 4px 12px rgba(0, 0, 0, 0.6), 0 1px 2px rgba(0, 0, 0, 0.8);`
- **Recessed Readout (Debossed 3D)**:
  `box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.9), inset 0 0 1px rgba(255, 255, 255, 0.05), 0 1px 0 rgba(255, 255, 255, 0.05);`
- **Mechanical Tactile Button**:
  - Rest: `box-shadow: 0 1px 0 rgba(255, 255, 255, 0.15) inset, 0 3px 0 #000000, 0 5px 8px rgba(0, 0, 0, 0.7);`
  - Pressed: `transform: translateY(2px); box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08) inset, 0 1px 0 #000000, 0 2px 4px rgba(0, 0, 0, 0.8);`

---

## 5. Signature Element: Guardrail Rocker-Switch Bank

An 8-unit physical toggle bank (switches **A** through **H**) simulating milled toggle switches on an instrument panel:

1. **A — Amount Specification**: Explicit payable amount parsed.
2. **B — Dispute Filter**: Zero active dispute/counter-claim.
3. **C — 50% Threshold**: >= 50% of invoice total promised.
4. **D — Outstanding Cap**: Amount <= authoritative DB balance.
5. **E — 30-Day Window**: Promised payment within 30 days of due date.
6. **F — AI Confidence**: Extraction confidence score >= 0.70.
7. **G — Adversarial Guard**: Clean prompt injection / safety check.
8. **H — Entity Match**: Verified invoice number and customer identity match.

**Switch Visual States**:
- **Engaged / Passed**: Switch rocker flipped up, bright top edge, engraved `[● ON]` marker.
- **Tripped / Flagged**: Switch rocker angled down with red-line texture, engraved `[▲ TRIP]` warning plate.

---

## 6. Typography Scale & Application Rules
- **UI Chrome & Headings**: Crisp Grotesk Sans (`font-sans` / `font-bold`), uppercase engraved section titles with wide tracking (`tracking-wider`).
- **Data Values Only**: Monospace (`font-mono`) reserved strictly for numeric quantities (e.g. `₹15,000.00`), UUIDs, and timestamps. Monospace is forbidden on labels or status descriptions.
