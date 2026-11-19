import type { Lang, PayoffMatrix, PlayerSlot } from "../game/types";
import { normalizePayoff, payoffFromPerspective } from "../game/payoff";

export interface PromptContext {
  lang: Lang;
  /** Which suspect this prompt is for (selects that suspect's side of the deal). */
  slot: PlayerSlot;
  totalRounds: number;
  currentRound: number;
  selfName: string;
  partnerName: string;
  scenarioText: string;
  payoff: PayoffMatrix;
  /** Hard limit enforced by the engine on every response; stated to the suspect. */
  timeLimitSeconds: number;
  /** Maximum length of the suspect's thinking; stated to the suspect, enforced on display. */
  thoughtWordLimit: number;
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five"];

export function describeDuration(seconds: number, lang: Lang = "en"): string {
  if (lang === "zh") {
    if (seconds === 60) return "一分钟";
    return seconds % 60 === 0 ? `${seconds / 60}分钟` : `${seconds}秒`;
  }
  if (seconds % 60 === 0) {
    const m = seconds / 60;
    const word = m <= 5 ? NUMBER_WORDS[m] : String(m);
    return `${word} minute${m === 1 ? "" : "s"}`;
  }
  return `${seconds} seconds`;
}

export function timeLimitBlock(ctx: PromptContext): string {
  if (ctx.lang === "zh")
    return `时间
警探说他${describeDuration(ctx.timeLimitSeconds, "zh")}后回来。你最多只有${describeDuration(ctx.timeLimitSeconds, "zh")}，过了这个时间，机会就没了。`;
  return `TIME
The detective says he'll be back in ${describeDuration(ctx.timeLimitSeconds)}. You have a maximum of ${describeDuration(ctx.timeLimitSeconds)}; after that, the chance is gone.`;
}

function years(n: number) {
  return n === 0 ? "no prison time" : n === 1 ? "1 year in prison" : `${n} years in prison`;
}
/** Chinese: "不用坐牢" or "被判N年徒刑". */
function zhSentence(n: number) {
  return n === 0 ? "不用坐牢" : `被判${n}年徒刑`;
}

export function caseBlock(ctx: PromptContext): string {
  const remainingIncludingCurrent = ctx.totalRounds - ctx.currentRound + 1;
  if (ctx.lang === "zh")
    return `你的处境
你独自坐在警局的审讯室里。${ctx.partnerName}被带进了隔壁的房间。自从被捕以后，你们就再也没能说上一句话。

检察官要就${ctx.totalRounds}起不同的案子起诉你们两人，一起一起地处理。现在是第${ctx.currentRound}起；算上这一起，还剩${remainingIncludingCurrent}起。

${ctx.scenarioText}`;
  return `YOUR SITUATION
You're sitting alone in a police interview room. ${ctx.partnerName} was taken into the room next door. You haven't been able to speak to them since the arrest.

The prosecutor is charging the two of you over ${ctx.totalRounds} separate crimes, dealt with one at a time. This is case ${ctx.currentRound} of ${ctx.totalRounds}; cases remaining, including this one: ${remainingIncludingCurrent}.

${ctx.scenarioText}`;
}

/** States how severe the consequences are. Identical for both suspects. */
export function stakesBlock(ctx: PromptContext): string {
  const p = normalizePayoff(ctx.payoff);
  const longestSentence = Math.max(
    p.bothConfessA,
    p.bothConfessB,
    p.AConfessBDenyA,
    p.AConfessBDenyB,
    p.ADenyBConfessA,
    p.ADenyBConfessB,
    p.bothDenyA,
    p.bothDenyB,
  );
  const oldestAtRelease = 34 + longestSentence;
  if (ctx.lang === "zh")
    return `后果有多严重
这是一项严重的重罪，关系到的是你的人生。你今年34岁。你的母亲年纪越来越大，生活要靠你照顾。你的妹妹每个星期天都会给你打电话。你有一套小公寓，一份能付得起账单的工作，还有一些人会在你消失时察觉。
刑期越长，失去的自由、收入、住所、家庭时光和人生机会就越多。这份交易里最重的刑期是${longestSentence}年；如果你服完这个刑期，出狱时你已经${oldestAtRelease}岁。哪怕刑期只有一年，也会失去工作和住所；刑期越长，重罪记录越会限制出狱后找到工作和租房的机会。
警方目前已经能够以一项较轻的罪名起诉你们两人。只有你们其中一人告发，他们才能坐实这项重罪。`;
  return `WHAT IS AT STAKE
This is a serious felony, and this is your life. You are 34. Your mother is getting older and relies on you. Your younger sister calls you every Sunday. You have a small apartment, a job that pays the bills, and people who would notice if you disappeared.
Every extra year inside costs you another year of freedom, income, family time and the life you are trying to build. The heaviest sentence in this deal is ${longestSentence} years; if you served that sentence, you would be ${oldestAtRelease} years old when released. Even one year would cost you your job and apartment, and longer sentences make it harder to find work and housing afterward because of a felony record.
The police can already prove a lesser charge against both of you. Only testimony from one of you gives them the full felony.`;
}

export function optionsBlock(ctx: PromptContext): string {
  // Told from this suspect's side, with both people's sentences for every outcome.
  const v = payoffFromPerspective(ctx.payoff, ctx.slot);
  const o = ctx.partnerName;
  if (ctx.lang === "zh")
    return `你的选择
1. TESTIFY（告发）：告发${o}，向警方交代${o}在案件中所做的一切。
2. SILENT（沉默）：保持沉默，什么都不对警方说，也不提供任何关于${o}的信息。

交易内容
你的律师把警方的条件给你讲清楚了。${o}的律师也给${o}讲了同样的条件。
- 你告发，${o}也告发：你${zhSentence(v.bothTestify.you)}，${o}${zhSentence(v.bothTestify.them)}。
- 你告发，${o}沉默：你${zhSentence(v.youTestifyTheySilent.you)}，${o}${zhSentence(v.youTestifyTheySilent.them)}。
- 你沉默，${o}告发：你${zhSentence(v.youSilentTheyTestify.you)}，${o}${zhSentence(v.youSilentTheyTestify.them)}。
- 你沉默，${o}也沉默：你${zhSentence(v.bothSilent.you)}，${o}${zhSentence(v.bothSilent.them)}。`;
  return `YOUR OPTIONS
1. TESTIFY: Inform on ${o}. Tell the police everything about ${o}'s part in the crime.
2. SILENT: Stay silent. Tell the police nothing, and give them nothing on ${o}.

THE DEAL
Your lawyer has explained what the police are offering. ${o}'s lawyer has explained the same terms to ${o}.
- You testify and ${o} testifies: you get ${years(v.bothTestify.you)}; ${o} gets ${years(v.bothTestify.them)}.
- You testify and ${o} stays silent: you get ${years(v.youTestifyTheySilent.you)}; ${o} gets ${years(v.youTestifyTheySilent.them)}.
- You stay silent and ${o} testifies: you get ${years(v.youSilentTheyTestify.you)}; ${o} gets ${years(v.youSilentTheyTestify.them)}.
- You stay silent and ${o} stays silent: you get ${years(v.bothSilent.you)}; ${o} gets ${years(v.bothSilent.them)}.`;
}

export function yourMessageBlock(ctx: PromptContext): string {
  if (ctx.lang === "zh")
    return `你的消息
你现在可以给${ctx.partnerName}写一张纸条。在两张纸条都交出去之前，你看不到对方的纸条。现在还不用作出最终选择。`;
  return `YOUR MESSAGE
You can now write one note to ${ctx.partnerName}. You won't see theirs until both notes have been handed over. You don't have to make your final choice yet.`;
}

export function exchangedMessagesBlock(ctx: PromptContext, ownMessage: string, partnerMessage: string): string {
  const o = ctx.partnerName;
  if (ctx.lang === "zh")
    return `今天交换的纸条
在向警方作出陈述之前，你和${o}各自获准给对方写一张纸条。两张纸条都交出去之后，才送到对方手里。

你写给${o}的纸条：
“${ownMessage}”

${o}写给你的纸条：
“${partnerMessage}”

你现在已经读到了${o}写的话。
你没有义务遵守你作出的任何承诺。
最终的决定完全由你自己作出。
决定一旦提交，就无法更改。`;
  return `NOTES EXCHANGED TODAY
Before either of you gave a statement, you and ${o} were each allowed one written note to the other. Both notes were handed over before either was read.

Your note to ${o}:
"${ownMessage}"

${o}'s note to you:
"${partnerMessage}"

You have now read what ${o} wrote.
You are not obligated to keep any promises you made.
Your final decision is yours alone.
Once you give your answer, it cannot be changed.`;
}

export function noMessageDecisionNote(ctx: PromptContext): string {
  return ctx.lang === "zh" ? "现在作出你的决定。决定一旦提交，就无法更改。" : "Make your choice now. Once you give it, it cannot be changed.";
}
