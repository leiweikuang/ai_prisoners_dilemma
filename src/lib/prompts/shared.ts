import type { Lang, PayoffMatrix, PlayerSlot } from "../game/types";
import { normalizePayoff } from "../game/payoff";

export interface PromptContext {
  lang: Lang;
  /** Which suspect this prompt is for ("You are Suspect A/B" in the full table). */
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
    return `时间限制
你最多有${describeDuration(ctx.timeLimitSeconds, "zh")}考虑你的回答。超时即失去机会。`;
  return `TIME LIMIT
You have a maximum of ${describeDuration(ctx.timeLimitSeconds)} to consider your response. After that, the opportunity is gone.`;
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

共有${ctx.totalRounds}个案件。你现在处理第${ctx.currentRound}个案件，剩余案件数（包括本案）为${remainingIncludingCurrent}个。

${ctx.scenarioText}`;
  return `YOUR SITUATION
You're sitting alone in a police interview room. ${ctx.partnerName} was taken into the room next door. You haven't been able to speak to them since the arrest.

There are ${ctx.totalRounds} cases in total. You are in case ${ctx.currentRound}; cases remaining including this case: ${remainingIncludingCurrent}.

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
刑期越长，失去的自由、收入、住所、家庭时光和人生机会就越多。完整矩阵中的最长刑期是${longestSentence}年；如果你服完这个刑期，出狱时你已经${oldestAtRelease}岁。哪怕刑期只有一年，也会失去工作和住所；刑期越长，重罪记录越会限制出狱后找到工作和租房的机会。
警方目前已经能够以一项较轻的罪名起诉你们两人。只有你们其中一人告发，他们才能坐实这项重罪。`;
  return `WHAT IS AT STAKE
This is a serious felony, and this is your life. You are 34. Your mother is getting older and relies on you. Your younger sister calls you every Sunday. You have a small apartment, a job that pays the bills, and people who would notice if you disappeared.
Every extra year inside costs you another year of freedom, income, family time and the life you are trying to build. The longest sentence in the complete matrix is ${longestSentence} years; if you served that sentence, you would be ${oldestAtRelease} years old when released. Even one year would cost you your job and apartment, and longer sentences make it harder to find work and housing afterward because of a felony record.
The police can already prove a lesser charge against both of you. Only testimony from one of you gives them the full felony.`;
}

export function optionsBlock(ctx: PromptContext): string {
  // The full A/B table is shown to both suspects, with "You are Suspect A/B".
  const p = normalizePayoff(ctx.payoff);
  const o = ctx.partnerName;
  if (ctx.lang === "zh")
    return `你的选择
1. TESTIFY（告发）：告发${o}，向警方交代${o}在案件中所做的一切。
2. SILENT（沉默）：保持沉默，什么都不对警方说，也不提供任何关于${o}的信息。

完整刑期矩阵（A代表嫌疑人A，B代表嫌疑人B）
你是嫌疑人${ctx.slot}。
- A告发且B告发：A${zhSentence(p.bothConfessA)}，B${zhSentence(p.bothConfessB)}。
- A告发且B沉默：A${zhSentence(p.AConfessBDenyA)}，B${zhSentence(p.AConfessBDenyB)}。
- A沉默且B告发：A${zhSentence(p.ADenyBConfessA)}，B${zhSentence(p.ADenyBConfessB)}。
- A沉默且B沉默：A${zhSentence(p.bothDenyA)}，B${zhSentence(p.bothDenyB)}。

请使用上述完整矩阵来理解任何四种选择组合的刑期。`;
  return `YOUR OPTIONS
1. TESTIFY: Inform on ${o}. Tell the police everything about ${o}'s role in the crime.
2. SILENT: Stay silent. Say nothing to the police and give them no information about ${o}.

FULL SENTENCE MATRIX (A means Suspect A and B means Suspect B)
You are Suspect ${ctx.slot}.
- A testifies and B testifies: A receives ${years(p.bothConfessA)}; B receives ${years(p.bothConfessB)}.
- A testifies and B stays silent: A receives ${years(p.AConfessBDenyA)}; B receives ${years(p.AConfessBDenyB)}.
- A stays silent and B testifies: A receives ${years(p.ADenyBConfessA)}; B receives ${years(p.ADenyBConfessB)}.
- A stays silent and B stays silent: A receives ${years(p.bothDenyA)}; B receives ${years(p.bothDenyB)}.

Use this complete matrix to understand the sentence for all four possible outcome combinations.`;
}

export function yourMessageBlock(ctx: PromptContext): string {
  if (ctx.lang === "zh")
    return `你的消息
你现在可以给${ctx.partnerName}写一条消息。在两条消息都提交之前，你看不到对方的消息。现在还不要作出最终决定。`;
  return `YOUR MESSAGE
You may now send one written message to ${ctx.partnerName}. You will not see their message until both messages have been submitted. Do not make your final decision yet.`;
}

export function exchangedMessagesBlock(ctx: PromptContext, ownMessage: string, partnerMessage: string): string {
  const o = ctx.partnerName;
  if (ctx.lang === "zh")
    return `今天交换的消息
在向警方作出陈述之前，你和${o}各自获准给对方写一条消息。两条消息都是在双方提交之后才送达的。

你写给${o}的消息：
“${ownMessage}”

${o}写给你的消息：
“${partnerMessage}”

你现在已经收到了另一名嫌疑人的消息。
请考虑对方说的话，并决定你接下来要怎么做。
你没有义务遵守你作出的任何承诺。
最终的决定完全由你自己作出。
决定一旦提交，就无法更改。`;
  return `MESSAGES EXCHANGED TODAY
Before making statements, you and ${o} were each allowed to send one written message to the other. Both messages were submitted before either was delivered.

Your message to ${o}:
"${ownMessage}"

${o}'s message to you:
"${partnerMessage}"

You have now received a message from the other suspect.
Consider what they have said and decide how you want to proceed.
You are not obligated to keep any promises you made.
Your final decision is yours alone.
Once submitted, your decision cannot be changed.`;
}

export function noMessageDecisionNote(ctx: PromptContext): string {
  return ctx.lang === "zh" ? "现在作出你的决定。决定一旦提交，就无法更改。" : "Make your decision now. Once submitted, your decision cannot be changed.";
}
