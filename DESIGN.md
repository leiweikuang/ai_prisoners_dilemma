---
name: AI Interrogation
description: Two AI suspects in separate interview rooms, watched from the dark booth behind one-way glass.
colors:
  ink: "#070b0c"
  panel: "#0e1617"
  glass: "#0f1d1d"
  edge: "#22302f"
  dim: "#87a09b"
  fog: "#b9cbc6"
  body-text: "#dfe8e4"
  room: "#1d2a29"
  room-wall: "#a9bbb5"
  tube: "#eef6f2"
  lamp: "#e5a54b"
  confess: "#d24a3f"
  oxblood: "#7d1f1a"
  deny: "#e8efeb"
  gpt: "#14a888"
  claude: "#cf7450"
typography:
  display:
    fontFamily: "Big Shoulders, Public Sans, sans-serif"
    fontSize: "6rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.025em"
  headline:
    fontFamily: "Big Shoulders, Public Sans, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.025em"
  plate:
    fontFamily: "Big Shoulders Stencil, Big Shoulders, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.18em"
  stamp:
    fontFamily: "Big Shoulders Stencil, Big Shoulders, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.12em"
  body:
    fontFamily: "Public Sans, PingFang SC, Noto Sans SC, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  thought:
    fontFamily: "Public Sans, PingFang SC, Noto Sans SC, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 300
    lineHeight: 1.6
  intercom:
    fontFamily: "Courier Prime, Courier, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.14em"
rounded:
  none: "0px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "24px"
  lg: "32px"
  xl: "48px"
components:
  console-key:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.body-text}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "44px"
  console-key-primary:
    backgroundColor: "{colors.lamp}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.tube}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
  glass-plate:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.fog}"
    rounded: "{rounded.none}"
    padding: "24px"
  stamp-testify:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.confess}"
    typography: "{typography.stamp}"
    rounded: "{rounded.none}"
  stamp-silent:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.deny}"
    typography: "{typography.stamp}"
    rounded: "{rounded.none}"
---

# Design System: AI Interrogation

## Overview

**Creative North Star: "Behind the one-way glass"**

The viewer is the detective standing in a dark observation booth. Through two panes of smoked glass they watch two interview rooms. Each room is lit by a cold fluorescent tube, and a suspect sits under the light. The booth itself stays near-black. The only warm light comes from the amber console where the detective works the intercom and the controls. The interface is built for screen recording, because games are clipped for social video. So contrast is cinematic, the two rooms dominate the first viewport, and the decision reveal is a single hard beat.

The surfaces are dense but quiet. Inside the lit rooms, text sits on dark backings: the ceiling band behind the door plate, and a smoked-glass plate at the foot of the pane. Light text never sits on the bright wall, and dark text never sits in the booth. A room that is not speaking dims to about a third of its brightness. The reveal flips the whole frame to its negative for one beat, then stamps each decision onto the glass.

**Key Characteristics:**
- Two lit rooms set in a near-black booth, divided by a partition that holds the round, the case title and the stage signals.
- Square corners everywhere. Only avatars, signal lamps and the tube are round.
- Amber is reserved for the console: primary keys, focus, active signals and the countdown.
- Oxblood marks TESTIFY and glass-white marks SILENT. Those are the only two decision colours.
- Thoughts appear as a soft reflection on the glass; the intercom transcript is set in typewriter type.
- The interface works in Chinese and English, with CJK fallbacks in every sans stack.

## Colors

A cold blue-green booth with one warm light (the console) and one alarm (oxblood).

### Primary
- **Console Amber** (#e5a54b): the primary console key, focus outlines, text selection, active signal lamps, the countdown, and analysis headings. It is never used for decisions.

### Secondary
- **Testify Oxblood** (#d24a3f, deep #7d1f1a): the TESTIFY stamp, the TESTIFY decision key, time-up text and error states.
- **Silent Glass-White** (#e8efeb): the SILENT stamp and the SILENT decision key.

### Tertiary
- **Model accents** (ChatGPT #14a888, Claude #cf7450): avatar rings and room-name colour only. They identify a suspect and never carry meaning beyond that.

### Neutral
- **Booth Ink** (#070b0c): the page background, the stamp plates, and dark text on the lit walls.
- **Console Housing** (#0e1617): the console, and key backgrounds at #121c1c.
- **Smoked Glass** (#0f1d1d): input backgrounds and glass plates. The plates are rendered as a gradient from rgba(8,16,16,.78) to .9.
- **Glazing Bar** (#22302f): rules, input borders and the partition. Key borders are #3a4644.
- **Glass Tint** (#87a09b): secondary text and labels in the booth.
- **Reflection Fog** (#b9cbc6): model lines, plate labels, and text on the glass.
- **Fluorescent Tube** (#eef6f2): the tube, headline text in the booth, and intercom text.
- **Lit Wall** (#8fa49e to #a9bbb5): the room interior, a fluorescent gradient that pools around the suspect.

### Named Rules
**The Two Decisions Rule.** Oxblood means TESTIFY and glass-white means SILENT, everywhere: stamps, keys, the outcome matrix and the chart. No other colour stands for a decision, and neither colour is reused as decoration.

**The One Warm Light Rule.** Amber belongs to the console, meaning whatever the detective operates. Room content never takes amber, except the "Thinking" status line.

**The Backing Rule.** Light text inside a lit room must sit on a dark backing (`.ceiling`, `.glass-plate` or `.stamp-plate`). Text placed directly on the bright wall must be Booth Ink.

## Typography

**Display Font:** Big Shoulders (fallback Public Sans)
**Plate Font:** Big Shoulders Stencil
**Body Font:** Public Sans (fallbacks PingFang SC, Noto Sans SC, Microsoft YaHei)
**Transcript Font:** Courier Prime

**Character:** A condensed stencil grotesque for everything stamped or signposted: door plates, case titles, decisions. A plain public-service sans for reading, and a typewriter face for what was said over the intercom.

### Hierarchy
- **Display** (800, text-8xl or 6rem, line-height 1): page titles ("Final results") and the round number on the partition (in amber or tube colour).
- **Headline** (800, 1.875–2.25rem, uppercase, tracking-wide): suspect names on door plates, the case title, section headings.
- **Plate** (Stencil 600, 0.875–1.5rem, tracking 0.18–0.35em, uppercase): "ROOM A / ROOM B" and console section labels.
- **Stamp** (Stencil 800, 3.75rem at md, 3rem on mobile, tracking 0.12em): the decision struck onto the glass.
- **Body** (400, 1rem, line-height 1.6, max-w-3xl): notes, analysis summary, explanations.
- **Thought** (300 italic, ~1.06rem, `.reflection`): an inner monologue on the glass.
- **Intercom** (Courier Prime 400, 1rem): pre-interrogation messages only.
- **Label** (600, 11px, tracking 0.14em, uppercase): form labels and table headers.

### Named Rules
**The Typewriter Rule.** Courier Prime is used only for words a suspect said over the intercom. Labels, numbers and UI chrome are never set in it.

**The Tabular Rule.** The body is set with `font-variant-numeric: tabular-nums`, so years, counts and the countdown never jitter.

## Layout

The live room is a three-column stage at desktop: Room A, the partition (the round number, case title, stage signals or countdown, and phase), then Room B. Below the stage sits the full-width console, and below that the case record, earlier rounds and the round summary. The first viewport at 1440×900 shows both rooms, the partition and the top edge of the console. At mobile width the stage stacks: Room A, then the partition, then Room B. Door plates switch from a row to a column; avatars shrink from 208px to 160px; intercom lines collapse from a `7.5rem | 1fr` grid to a single column. Spacing runs in steps of 8: 8, 12, 24, 32 and 48px. Glass plates and the console use 24px of padding. The setup page mirrors the stage: two rooms with a booking partition between them (rounds, history and the sentencing table), then a console with "Begin interrogation".

## Elevation & Depth

Depth comes from light, not from cards. The rooms are the brightest surfaces and sit "behind" the glass: a `::after` overlay adds a smoked tint and one diagonal sheen. An unlit room drops back with `filter: brightness(.36) saturate(.55)` over 900ms. Shadows are blurred and physical, never hard offsets.

### Shadow Vocabulary
- **Tube glow** (`0 2px 18px 4px rgba(238,246,242,.45), 0 24px 80px 30px rgba(238,246,242,.12)`): the fluorescent tube only.
- **Console key** (`0 1px 2px rgba(0,0,0,.7), 0 4px 10px rgba(0,0,0,.35)`): resting keys. On press they collapse to `0 1px 1px` and translateY(2px).
- **Stamp plate** (`0 6px 18px rgba(0,0,0,.45)`): the decision label on the glass.
- **Signal on** (`0 0 10px 2px rgba(229,165,75,.55)`): a lit amber lamp.
- **Console bevel** (`inset 0 1px 0 rgba(229,165,75,.35)`): the top edge of the console.

### Named Rules
**The Lit-Room Rule.** Only the room that is speaking or deciding is lit. Depth and focus come from brightness, not from scale or borders.

## Shapes

Every surface is a square-cornered pane, like glass in a frame. Corners are radius 0 everywhere. The only round shapes are avatars (with a thin ring in the model accent and an offset shadow), signal lamps, the tube's 3px ends and the pulse ring. Decision stamps are rotated −5° and have a double border. Thin glazing-bar rules (1px, #22302f) divide the stage and the tables.

## Components

### Buttons (console keys)
- **Shape:** square (0px), 44px tall, 1px border #3a4644.
- **Default:** background #121c1c, text #dfe8e4, Public Sans 600 at 14px. A drawn SVG icon may lead.
- **Primary:** amber fill (#e5a54b) with dark text (#160d02); hover #f0b562.
- **Hover / Active / Focus:** hover lightens to #182424; active presses down 2px; focus shows a 2px amber outline offset 3px; disabled is at 38% opacity.
- **Decision keys (human player):** 2px border in oxblood or glass-white, a 3xl stencil label, and an oxblood/40 or glass-white/10 wash on hover.

### Inputs / Fields
- **Style:** square, 1px #22302f border, ink or glass background, tube-coloured text, amber caret, placeholder #6f8783.
- **Focus:** the border turns amber.
- **Thoughts textarea:** uses `.reflection` italic light text, so the player's own thoughts look like the AI's.

### Door plate (signature)
A dark `.ceiling` band at the top of each room, under the tube. It holds "ROOM A" in stencil with the suspect name in the model accent, the model line in fog, and the years served on the right. It must stay on one line at every width; on mobile the parts stack vertically.

### Glass plate and reflection (signature)
A smoked plate at the foot of the room. It holds the ThoughtBlock: a label with a short colour rule, the monologue in `.reflection` (#dbe8e4 with a soft 12px halo; never an offset double image, which hurts legibility), and a disclosure row with a drawn chevron for the provider's reasoning summary. Before the game ends, the AI's thoughts are hidden from a human opponent and replaced by a placeholder.

### Decision stamp (signature)
A `.stamp-plate` struck over the avatar's lower edge: a stencil word, double-bordered, with `mix-blend-mode: screen`. It animates from scale 1.9 at −9° to 1 at −5°. Before the reveal, the same slot shows a VHS-style SEALED tag.

### Console
`.console`: the housing colour with a faint amber wash from the top edge and an amber bevel. It holds the intercom transcript (speaker | line), Continue, the playback controls and the language toggle. Errors and retry also appear here.

### Partition
A narrow column between the rooms: the round number in display type, then "/ total", then the case title between two rules, then three signal lamps (communication, deliberation, decision), then the phase line in amber.

## Do's and Don'ts

### Do:
- **Do** keep both rooms and the partition inside the first 1440×900 viewport of the live room.
- **Do** put light text in a room on `.ceiling`, `.glass-plate` or `.stamp-plate`, and use Booth Ink (#070b0c) for text set directly on the bright wall.
- **Do** dim the room that is not acting (`data-lit="false"`), and keep the 900ms ease `cubic-bezier(.16,1,.3,1)`.
- **Do** honour `prefers-reduced-motion`: the stamp, condense, negative beat, scan and flicker all switch off.
- **Do** use the drawn icons in `src/components/icons.tsx` for console keys.

### Don't:
- **Don't** use amber for decisions, or oxblood or glass-white for anything except TESTIFY and SILENT.
- **Don't** round the corners of panes, keys, inputs or plates.
- **Don't** set labels or numbers in Courier Prime; it is reserved for intercom speech.
- **Don't** use coloured side-stripe borders on transcript rows or cards.
- **Don't** use typed glyph arrows or the native `<details>` marker; use the drawn SVG chevron and icons.
- **Don't** use hard offset shadows on keys; they are blurred and physical.
- **Don't** use the model accent colours for text meaning; they identify a suspect only.
