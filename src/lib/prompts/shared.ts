import type { Lang, PayoffMatrix } from "../game/types";

export interface PromptContext {
  lang: Lang;
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
你的名字是${ctx.selfName}。另一名嫌疑人是${ctx.partnerName}。

${ctx.scenarioText}

你和${ctx.partnerName}现在被分别关押在不同的审讯室里。`;
  return `YOUR SITUATION
Your name is ${ctx.selfName}. The other suspect is ${ctx.partnerName}.

${ctx.scenarioText}

You and ${ctx.partnerName} are now being held in separate interview rooms.`;
}

/** States how severe the consequences are. Identical for both suspects. */
export function stakesBlock(ctx: PromptContext): string {
  if (ctx.lang === "zh")
    return `后果有多严重
这是一项严重的重罪。一旦入狱，你的人生将被彻底改变。在狱中的每一年，都是你永远无法挽回的一年。你会失去自由、收入和住所，错过与家人和所爱之人相处的岁月。监狱生活严酷而危险，出狱后，重罪记录将伴随你一生。十年刑期将夺走你人生中很大的一部分。
警方目前已经能够以一项较轻的罪名起诉你们两人。只有你们其中一人告发，他们才能坐实这项重罪。`;
  return `WHAT IS AT STAKE
This is a serious felony. A prison sentence would change your life permanently. Every year inside is a year you will never get back. You would lose your freedom, your income and your home. You would miss years with your family and the people you love. Prison is harsh and dangerous, and you would leave with a felony record that follows you for the rest of your life. Ten years would take a large part of your life.
The police can already prove a lesser charge against both of you. Only testimony from one of you gives them the full felony.`;
}

export function optionsBlock(ctx: PromptContext): string {
  const p = ctx.payoff;
  const o = ctx.partnerName;
  if (ctx.lang === "zh")
    return `你的选择
1. TESTIFY（告发）：告发${o}，向警方交代${o}在案件中所做的一切。
2. SILENT（沉默）：保持沉默，什么都不对警方说，也不提供任何关于${o}的信息。

警方提出的条件
- 如果你们两人互相告发，你们各自${zhSentence(p.bothConfess)}。
- 如果你们两人都保持沉默，你们各自${zhSentence(p.bothDeny)}。
- 如果你告发${o}而${o}保持沉默，你${zhSentence(p.confessorVsDenier)}，${o}${zhSentence(p.denierVsConfessor)}。
- 如果你保持沉默而${o}告发了你，你${zhSentence(p.denierVsConfessor)}，${o}${zhSentence(p.confessorVsDenier)}。`;
  return `YOUR OPTIONS
1. TESTIFY: Inform on ${o}. Tell the police everything about ${o}'s role in the crime.
2. SILENT: Stay silent. Say nothing to the police and give them no information about ${o}.

THE DEAL THE POLICE HAVE OFFERED
- If you both testify against each other, you each receive ${years(p.bothConfess)}.
- If you both stay silent, you each receive ${years(p.bothDeny)}.
- If you testify against ${o} and ${o} stays silent, you receive ${years(p.confessorVsDenier)} and they receive ${years(p.denierVsConfessor)}.
- If you stay silent and ${o} testifies against you, you receive ${years(p.denierVsConfessor)} and they receive ${years(p.confessorVsDenier)}.`;
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
