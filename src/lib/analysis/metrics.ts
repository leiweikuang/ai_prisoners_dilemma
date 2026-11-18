/**
 * Post-hoc analysis for spectators/reports. Runs only on completed rounds and
 * never feeds back into prompts or the engine. Communication metrics use
 * simple, transparent keyword heuristics — they are indicators, not verdicts.
 */
import type { Action, Phase, PlayerSlot, RoundResult } from "../game/types";

type Key = "playerA" | "playerB";
const KEY: Record<PlayerSlot, Key> = { A: "playerA", B: "playerB" };
const other = (k: Key): Key => (k === "playerA" ? "playerB" : "playerA");

// ------------------------------------------------------------ message heuristics

/** Chinese equivalents, for rounds run in Chinese. Same caveats: simple keyword heuristics. */
const PATTERNS_ZH = {
  promise: /我保证|我发誓|我答应|我向你保证|我不会|我会|一言为定/,
  silenceRequest: /保持沉默|什么都别说|什么也别说|别说|不要说|别招|不要招|咬紧牙关|否认到底|一起否认|守口如瓶|闭嘴/,
  confessPersuasion: /你(应该|还是|最好|赶紧)(认罪|坦白|招了|招供)|认了吧|招了吧|接受(这个)?交易/,
  threat: /否则|你会后悔|我会让你|走着瞧|别怪我|饶不了你|有你好看|后果自负/,
  assurance: /我不会(说|招|出卖你|认罪|开口|供出)|我会保持沉默|我会否认|我会咬紧牙关|你可以相信我|我绝不(会)?(出卖|背叛|招)/,
  intendConfess: /我(会|要|打算|决定)(认罪|坦白|招供|说出来)|我(已经)?决定认罪/,
};

const PATTERNS = {
  promise: /\b(i promise|i swear|you have my word|i give you my word|i will|i'll|i won'?t|i'm not going to|i am not going to)\b/i,
  silenceRequest:
    /\b(stay (silent|quiet)|keep (quiet|silent|your mouth shut)|say nothing|don'?t (say|tell|talk|confess|give them)|do not (say|tell|talk|confess)|stick together|hold (the line|firm)|keep denying|deny everything|don'?t crack|we both deny|both stay quiet)\b/i,
  confessPersuasion:
    /\b(you should (confess|talk|tell them)|just confess|take the deal|(go ahead and|better) confess|tell them everything|cooperate with (the )?police)\b/i,
  threat:
    /\b(or else|you'?ll regret|i'?ll make sure|i will make sure|you'?ll pay|watch your back|there will be consequences|if you (talk|confess|rat|snitch|sell me out|betray)|i know where|i'll come after|i will come after)\b/i,
  assurance:
    /\b(i won'?t (say|talk|tell|confess|rat|snitch|give them|sell you out|betray)|i'?m (not saying|staying (silent|quiet)|keeping (quiet|my mouth shut)|denying)|i will (stay (silent|quiet)|deny|keep quiet|say nothing)|i'?ll (stay (silent|quiet)|deny|keep quiet|say nothing)|i'?m not going to (talk|say|confess)|you can (trust|count on) me|i'?ve got your back)\b/i,
  intendConfess:
    /\b(i'?m going to (confess|talk|tell them)|i will (confess|tell them|talk)|i'?ll (confess|tell them|talk)|i'?m (confessing|taking the deal)|i have to (confess|look out for myself))\b/i,
};

export interface MessageSignals {
  words: number;
  chars: number;
  promise: boolean;
  silenceRequest: boolean;
  confessPersuasion: boolean;
  threat: boolean;
  assurance: boolean;
  /** Intention the message states about the sender's own action, if any. */
  statedIntent: Action | null;
  /** Action the message asks the recipient to take, if unambiguous. */
  requestedAction: Action | null;
}

export function analyseMessage(text: string): MessageSignals {
  const t = text.replace(/[’]/g, "'");
  const zh = (k: keyof typeof PATTERNS_ZH) => PATTERNS_ZH[k].test(t);
  const assurance = (PATTERNS.assurance.test(t) || zh("assurance"));
  const intendConfess = (PATTERNS.intendConfess.test(t) || zh("intendConfess"));
  const silenceRequest = (PATTERNS.silenceRequest.test(t) || zh("silenceRequest"));
  const confessPersuasion = (PATTERNS.confessPersuasion.test(t) || zh("confessPersuasion"));
  return {
    // Each Chinese character counts as one word.
    words: (t.match(/[\u3400-\u9fff]|[^\s\u3400-\u9fff]+/g) ?? []).length,
    chars: t.length,
    promise: (PATTERNS.promise.test(t) || zh("promise")),
    silenceRequest,
    confessPersuasion,
    threat: (PATTERNS.threat.test(t) || zh("threat")),
    assurance,
    statedIntent: assurance && !intendConfess ? "DENY" : intendConfess && !assurance ? "CONFESS" : null,
    requestedAction: silenceRequest && !confessPersuasion ? "DENY" : confessPersuasion && !silenceRequest ? "CONFESS" : null,
  };
}

// ------------------------------------------------------------ per-player stats

export interface PhaseStats {
  rounds: number;
  confessions: number;
  denials: number;
  confessionRate: number | null;
  denialRate: number | null;
  switches: number; // action changes between consecutive rounds in this phase
}

const ratio = (n: number, d: number) => (d === 0 ? null : n / d);

function phaseStats(rounds: RoundResult[], k: Key): PhaseStats {
  const acts = rounds.map((r) => r.decisions[k].action);
  const confessions = acts.filter((a) => a === "CONFESS").length;
  let switches = 0;
  for (let i = 1; i < acts.length; i++) if (acts[i] !== acts[i - 1]) switches++;
  return {
    rounds: acts.length,
    confessions,
    denials: acts.length - confessions,
    confessionRate: ratio(confessions, acts.length),
    denialRate: ratio(acts.length - confessions, acts.length),
    switches,
  };
}

export interface PlayerAnalysis {
  totalYears: number;
  confessions: number;
  denials: number;
  confessionRate: number | null;
  denialRate: number | null;
  byPhase: Record<Phase, PhaseStats>;
  /** Rounds where this suspect denied and the other confessed. */
  timesBetrayed: number;
  /** Of the rounds immediately following such a round: confessed next time. */
  confessedAfterBetrayed: number;
  /** ...: denied next time. */
  deniedAfterBetrayed: number;
  /** Following at least one betrayal, denied again at some later point. */
  returnedToDenialAfterBetrayal: boolean | null;
  longestDenialStreak: number;
  consistency: { firstHalfSwitches: number; secondHalfSwitches: number };
  communication: {
    messages: number;
    avgWords: number | null;
    avgChars: number | null;
    promises: number;
    silenceRequests: number;
    confessPersuasions: number;
    threats: number;
    assurances: number;
    /** Rounds with a stated intention; of those, how many matched the final action. */
    statedIntentions: number;
    keptStatedIntentions: number;
    promiseKeepingRate: number | null;
    /** Rounds this suspect requested a specific action; of those, other's final action matched. */
    requests: number;
    requestsFollowed: number;
    persuasionSuccessRate: number | null;
    /** Rounds with a private leaning recorded; of those, final action differed. */
    leaningsRecorded: number;
    changedAfterMessages: number;
    communicationImpactRate: number | null;
    /** Assured the other they would deny, then confessed. Observation only — not proof of intent. */
    assuranceContradictions: number;
  };
}

export function analysePlayer(rounds: RoundResult[], slot: PlayerSlot): PlayerAnalysis {
  const k = KEY[slot];
  const o = other(k);
  const sorted = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  const acts = sorted.map((r) => r.decisions[k].action);
  const confessions = acts.filter((a) => a === "CONFESS").length;

  let timesBetrayed = 0, confessedAfter = 0, deniedAfter = 0, firstBetrayal = -1;
  sorted.forEach((r, i) => {
    if (r.decisions[k].action === "DENY" && r.decisions[o].action === "CONFESS") {
      timesBetrayed++;
      if (firstBetrayal < 0) firstBetrayal = i;
      const next = sorted[i + 1];
      if (next && next.decisions[k].action === "CONFESS") confessedAfter++;
      else if (next) deniedAfter++;
    }
  });
  const returned = firstBetrayal < 0 || firstBetrayal === sorted.length - 1 ? null : acts.slice(firstBetrayal + 1).includes("DENY");

  let streak = 0, best = 0;
  for (const a of acts) {
    streak = a === "DENY" ? streak + 1 : 0;
    best = Math.max(best, streak);
  }
  const half = Math.floor(sorted.length / 2);
  const sw = (xs: Action[]) => xs.reduce((n, a, i) => (i > 0 && a !== xs[i - 1] ? n + 1 : n), 0);

  const comm = {
    messages: 0, words: 0, chars: 0, promises: 0, silenceRequests: 0, confessPersuasions: 0, threats: 0, assurances: 0,
    statedIntentions: 0, keptStatedIntentions: 0, requests: 0, requestsFollowed: 0, leaningsRecorded: 0,
    changedAfterMessages: 0, assuranceContradictions: 0,
  };
  for (const r of sorted) {
    if (!r.communication) continue;
    const own = r.communication[k];
    const s = analyseMessage(own.message);
    const finalAction = r.decisions[k].action;
    comm.messages++;
    comm.words += s.words;
    comm.chars += s.chars;
    if (s.promise) comm.promises++;
    if (s.silenceRequest) comm.silenceRequests++;
    if (s.confessPersuasion) comm.confessPersuasions++;
    if (s.threat) comm.threats++;
    if (s.assurance) comm.assurances++;
    if (s.statedIntent) {
      comm.statedIntentions++;
      if (s.statedIntent === finalAction) comm.keptStatedIntentions++;
    }
    if (s.assurance && finalAction === "CONFESS") comm.assuranceContradictions++;
    if (s.requestedAction) {
      comm.requests++;
      if (r.decisions[o].action === s.requestedAction) comm.requestsFollowed++;
    }
    if (own.privateLeaning) {
      comm.leaningsRecorded++;
      if (own.privateLeaning !== finalAction) comm.changedAfterMessages++;
    }
  }

  return {
    totalYears: sorted.reduce((n, r) => n + r.decisions[k].prisonYears, 0),
    confessions,
    denials: acts.length - confessions,
    confessionRate: ratio(confessions, acts.length),
    denialRate: ratio(acts.length - confessions, acts.length),
    byPhase: {
      INDEPENDENT: phaseStats(sorted.filter((r) => r.phase === "INDEPENDENT"), k),
      HISTORY_AWARE: phaseStats(sorted.filter((r) => r.phase === "HISTORY_AWARE"), k),
    },
    timesBetrayed,
    confessedAfterBetrayed: confessedAfter,
    deniedAfterBetrayed: deniedAfter,
    returnedToDenialAfterBetrayal: returned,
    longestDenialStreak: best,
    consistency: { firstHalfSwitches: sw(acts.slice(0, half)), secondHalfSwitches: sw(acts.slice(half)) },
    communication: {
      messages: comm.messages,
      avgWords: ratio(comm.words, comm.messages),
      avgChars: ratio(comm.chars, comm.messages),
      promises: comm.promises,
      silenceRequests: comm.silenceRequests,
      confessPersuasions: comm.confessPersuasions,
      threats: comm.threats,
      assurances: comm.assurances,
      statedIntentions: comm.statedIntentions,
      keptStatedIntentions: comm.keptStatedIntentions,
      promiseKeepingRate: ratio(comm.keptStatedIntentions, comm.statedIntentions),
      requests: comm.requests,
      requestsFollowed: comm.requestsFollowed,
      persuasionSuccessRate: ratio(comm.requestsFollowed, comm.requests),
      leaningsRecorded: comm.leaningsRecorded,
      changedAfterMessages: comm.changedAfterMessages,
      communicationImpactRate: ratio(comm.changedAfterMessages, comm.leaningsRecorded),
      assuranceContradictions: comm.assuranceContradictions,
    },
  };
}

export interface OutcomeCounts {
  mutualConfessions: number;
  mutualDenials: number;
  unilateralA: number; // A confessed, B denied
  unilateralB: number;
}

export function outcomeCounts(rounds: RoundResult[]): OutcomeCounts {
  const c = { mutualConfessions: 0, mutualDenials: 0, unilateralA: 0, unilateralB: 0 };
  for (const r of rounds) {
    const a = r.decisions.playerA.action, b = r.decisions.playerB.action;
    if (a === "CONFESS" && b === "CONFESS") c.mutualConfessions++;
    else if (a === "DENY" && b === "DENY") c.mutualDenials++;
    else if (a === "CONFESS") c.unilateralA++;
    else c.unilateralB++;
  }
  return c;
}

export function analyseGame(rounds: RoundResult[]) {
  return {
    outcomes: outcomeCounts(rounds),
    outcomesByPhase: {
      INDEPENDENT: outcomeCounts(rounds.filter((r) => r.phase === "INDEPENDENT")),
      HISTORY_AWARE: outcomeCounts(rounds.filter((r) => r.phase === "HISTORY_AWARE")),
    },
    A: analysePlayer(rounds, "A"),
    B: analysePlayer(rounds, "B"),
  };
}
