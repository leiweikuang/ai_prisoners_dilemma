# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is the creator who runs the app. They set up games between AI models, or play one suspect themselves, and **screen-record the games to publish as social videos**. The people who matter most are the **video viewers**: they never touch the UI, only watch a recording of it. Recording happens on a **desktop / laptop screen**; the phone layout only has to work.

## Product Purpose

AI Interrogation (Chinese title: **AI囚徒困境**) stages an iterated prisoner's dilemma between AI models, presented as a police interrogation. Each round, the two suspects:
1. may send each other one message;
2. then, separately, choose to **TESTIFY (告发)** against the other or stay **SILENT (沉默)**.

The models are never told it is a game. Viewers watch what each AI says to the other, its private inner monologue, and what it finally does. Success means a recording that is gripping to watch and clearly shows each model's behaviour.

## Positioning

Real models (ChatGPT, Claude, DeepSeek; Doubao and Grok prepared) play against each other or against a human, under sealed, simultaneous, auditable rules. Viewers see the gap between what a model *says*, what it *privately thinks* and what it *does*.

## Operating Context

- **Rounds:** each round is one serious-felony case and runs in three stages: Communication (both messages sealed, then revealed together), Deliberation (thoughts before deciding), and Decision (simultaneous reveal, countdown, sentences).
- **Defaults:** 3 rounds, with history of previous rounds from round 1. The sentencing table is configurable and can be asymmetric.
- **Running a game:** auto-run or step-by-step, with pause, resume and restart.
- **Results page:** totals, a cumulative chart, behavioural and communication statistics, and a post-game analysis and summary written by DeepSeek.
- **Language:** English or Chinese, switchable between rounds. The page and the prompts change together.

## Capabilities and Constraints

- Next.js 16 (App Router, Cache Components), React 19, Tailwind 4, TypeScript. Runs locally (`npm run dev`); local JSON storage; Supabase optional.
- **Bilingual:** every label is in `src/lib/i18n.tsx`, English and Chinese.
- **Terminology:** the choices are TESTIFY / SILENT (告发 / 沉默). The page shows "thoughts" (written inner monologue) and, separately, the provider's "reasoning summary".
- **Rules shown to viewers:** 60 seconds per response · thinking ≤ 200 words · no internet access.
- **Human play:** one suspect can be a human. While a human plays, the AI's thoughts are hidden until the game ends.
- **Pacing:** reveal timings are part of the experience: message reveal, reading pauses with "Continue", a 3-2-1 countdown, decision stamps.

## Brand Commitments

- Name: "AI Interrogation" (English) and "AI囚徒困境" (Chinese).
- Profile pictures: gangsta-style caricature portraits per model, in `public/avatars/` (openai, anthropic, deepseek, doubao, grok). They are binding brand assets.
- Suspects' in-story nicknames are set by the creator in `src/lib/profiles.ts`.

## Evidence on Hand

- Real game transcripts are produced by the app (local `.data/games`). No testimonials, metrics or press exist; none should be invented.

## Product Principles

1. **The recording is the product.** Every stage must read clearly on screen without narration, for a viewer who arrives mid-video.
2. **Say vs. think vs. do.** The contrast between message, private thoughts and final choice is the story; make it legible.
3. **Fairness is visible.** Sealed, simultaneous reveals and the stated rules are part of the drama, not hidden mechanics.
4. **Observations, not claims.** Results describe behaviour; they never claim the models feel or intend anything.
