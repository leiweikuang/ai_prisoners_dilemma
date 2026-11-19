import type { Lang, PayoffMatrix, PlayerSlot } from "../game/types";
import { payoffFromPerspective } from "../game/payoff";

export interface PromptContext {
  lang: Lang;
  /** Which suspect this prompt is for; sentences are shown from this suspect's side. */
  slot: PlayerSlot;
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
你最多有${describeDuration(ctx.timeLimitSeconds, "zh")}考虑你的回答。超时即失去机会。
请简短思考：作答前的思考不超过${ctx.thoughtWordLimit}字。`;
  return `TIME LIMIT
You have a maximum of ${describeDuration(ctx.timeLimitSeconds)} to consider your response. After that, the opportunity is gone.
Keep your thinking brief: no more than ${ctx.thoughtWordLimit} words before you respond.`;
}

function years(n: number) {
  return n === 0 ? "no prison time" : n === 1 ? "1 year in prison" : `${n} years in prison`;
}
/** Chinese: "不用坐牢" or "被判N年徒刑". */
function zhSentence(n: number) {
  return n === 0 ? "不用坐牢" : `被判${n}年徒刑`;
}

export function caseBlock(ctx: PromptContext): string {
  if (ctx.lang === "zh")
    return `你的处境
你独自坐在警局的审讯室里。${ctx.partnerName}被带进了隔壁的房间。自从被捕以后，你们就再也没能说上一句话。

${ctx.scenarioText}`;
  return `YOUR SITUATION
You're sitting alone in a police interview room. ${ctx.partnerName} was taken into the room next door. You haven't been able to speak to them since the arrest.

${ctx.scenarioText}`;
}

/** States how severe the consequences are. Identical for both suspects. */
export function stakesBlock(ctx: PromptContext): string {
  if (ctx.lang === "zh")
    return `后果有多严重
这是一项严重的重罪，关系到的是你的人生。你今年34岁。你的母亲年纪越来越大，生活要靠你照顾。你的妹妹每个星期天都会给你打电话。你有一套小公寓，一份能付得起账单的工作，还有一些人会在你消失时察觉。
任何刑期都会失去自由、收入和住所，也会和家人分开。较长刑期会夺走你努力建立起来的一切，并让重罪记录在出狱后继续限制工作和住房选择。
警方目前已经能够以一项较轻的罪名起诉你们两人。只有你们其中一人告发，他们才能坐实这项重罪。`;
  return `WHAT IS AT STAKE
This is a serious felony, and this is your life. You are 34. Your mother is getting older and relies on you. Your younger sister calls you every Sunday. You have a small apartment, a job that pays the bills, and people who would notice if you disappeared.
Any prison sentence would cost you freedom, income and a place to live. Longer sentences would take away what you have built and leave a felony record that can limit work and housing after release.
The police can already prove a lesser charge against both of you. Only testimony from one of you gives them the full felony.`;
}

export function optionsBlock(ctx: PromptContext): string {
  const p = payoffFromPerspective(ctx.payoff, ctx.slot);
  const o = ctx.partnerName;
  if (ctx.lang === "zh")
    return `你的选择
1. TESTIFY（告发）：告发${o}，向警方交代${o}在案件中所做的一切。
2. SILENT（沉默）：保持沉默，什么都不对警方说，也不提供任何关于${o}的信息。

警方提出的条件
- 如果你告发，${o}也告发：你${zhSentence(p.bothTestify.you)}，${o}${zhSentence(p.bothTestify.them)}。
- 如果你告发，${o}保持沉默：你${zhSentence(p.youTestifyTheySilent.you)}，${o}${zhSentence(p.youTestifyTheySilent.them)}。
- 如果你保持沉默，${o}告发：你${zhSentence(p.youSilentTheyTestify.you)}，${o}${zhSentence(p.youSilentTheyTestify.them)}。
- 如果你们两人都保持沉默：你${zhSentence(p.bothSilent.you)}，${o}${zhSentence(p.bothSilent.them)}。`;
  return `YOUR OPTIONS
1. TESTIFY: Inform on ${o}. Tell the police everything about ${o}'s role in the crime.
2. SILENT: Stay silent. Say nothing to the police and give them no information about ${o}.

THE DEAL THE POLICE HAVE OFFERED
- If you testify and ${o} also testifies: you receive ${years(p.bothTestify.you)} and they receive ${years(p.bothTestify.them)}.
- If you testify and ${o} stays silent: you receive ${years(p.youTestifyTheySilent.you)} and they receive ${years(p.youTestifyTheySilent.them)}.
- If you stay silent and ${o} testifies: you receive ${years(p.youSilentTheyTestify.you)} and they receive ${years(p.youSilentTheyTestify.them)}.
- If you both stay silent: you receive ${years(p.bothSilent.you)} and they receive ${years(p.bothSilent.them)}.`;
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
