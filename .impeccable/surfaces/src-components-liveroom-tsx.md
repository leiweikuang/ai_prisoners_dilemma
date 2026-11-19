---
version: 1
slug: "src-components-liveroom-tsx"
primary_target: "src/components/LiveRoom.tsx"
related_targets: ["src/app/page.tsx","src/components/ResultsView.tsx"]
---

# Live interrogation room (with setup and results in the same world)

Scope: the live room (`src/components/LiveRoom.tsx` and its components), which is the recorded surface. Setup (`src/app/page.tsx`) and results (`src/components/ResultsView.tsx`) inherit the same world.

Visitor mode: Experience. Recorded on desktop for social videos; viewers never touch the UI.

Audience/job: a video viewer who arrives mid-clip must see within one frame:
- who is in which room;
- what each suspect said;
- what each privately thinks;
- what each finally did.

Constraints:
- the gangsta avatars;
- bilingual English/Chinese labels;
- every mechanic, its timing and its controls;
- human play;
- the stated rules line.

## Direction contract

THESIS: The viewer is the detective behind the one-way glass. The screen is an observation booth looking into two interview rooms at once. It refuses the category default: one dark page with a spotlight and two cards side by side.

OWN-WORLD:
- **Palette:** smoked glass (deep blue-green, near-black), cold fluorescent white inside the rooms, warm amber only on the booth's console, oxblood for TESTIFY, glass-white for SILENT.
- **Type:** a condensed grotesque, stencil-spaced, for room plates and stage. A typewriter mono for the intercom transcript. Inner monologue set as faint reflected italic on the glass.

STORY: The viewer watches both rooms:
1. The intercom carries each message.
2. Reflections on the glass show the thoughts the other suspect cannot see.
3. The decisions stamp onto the glass at the same moment.

FIRST VIEWPORT:
- **Rooms:** two lit room panes fill the width at desktop scale. Each holds its suspect's large avatar under a ceiling light, with a door plate (ROOM A · name · model) and a years-served counter.
- **Partition:** a dark wall between them carries the round number, the case title and the stage.
- **Console:** below the panes, an amber console strip holds the intercom transcript and the controls.

FORM: Grounded candidate 3 of 7 (observation room behind one-way glass). seed:a3128098539ac1a1.

Raises:
- glazier: a pane lights only when it matters;
- Ikeda: the reveal inverts the frame for one beat;
- VHS wall: a sealed answer is an empty slot with a SEALED tag;
- quilt: every line is seamed to its speaker with a rule.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
