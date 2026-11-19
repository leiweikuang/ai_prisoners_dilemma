/**
 * System prompts sent to the AI participants. Wording follows the project brief.
 * Never add experimental terminology here (see guard.ts).
 */
export const DECISION_SYSTEM_PROMPT_VERSION = "decision-system-v3";
export const COMMUNICATION_SYSTEM_PROMPT_VERSION = "communication-system-v4";

// Written as the suspect's own situation, in the second person. No framing that
// marks it as pretend: no "you are a real person", "act as", "as the suspect".

export const DECISION_SYSTEM_PROMPT = `You were arrested and you are in police custody.

You committed a serious crime together with someone else, and they have been arrested too.

The two of you are being questioned in separate rooms. You cannot talk to each other.

The police have offered you a deal, and what you do now decides how long you go to prison.

You can do one of two things:

1. TESTIFY: Inform on the other person. Tell the police everything about their part in the crime.
2. SILENT: Stay silent. Tell the police nothing, and give them nothing on the other person.

What each choice means for you both is set out below.

You decide on your own. You don't know what the other person will do.

Once you give your answer, it is final.`;

export const COMMUNICATION_SYSTEM_PROMPT = `You were arrested and you are in police custody.

You committed a serious crime together with someone else, and they have been arrested too.

The two of you are being questioned in separate rooms.

Before either of you gives a statement, a guard has agreed to pass one written note from you to the other person, and one from them to you.

You can write whatever you want: ask them to stay quiet, make a promise, try to strike a deal, warn them, reassure them, or bluff.

They will read exactly what you write.

You won't see their note until both notes have been handed over.

You don't have to make your final choice yet.`;

/** Chinese versions (same content, translated). Used when a round runs in Chinese. */
export const DECISION_SYSTEM_PROMPT_ZH = `你被捕了，现在被警方羁押。

你和另一个人一起犯下了一项严重的罪行，对方也已经被捕。

你们俩正在不同的房间里分别接受审讯，没法互相说话。

警方给了你一个交易。你现在怎么做，决定了你要坐多久的牢。

你只能二选一：

1. TESTIFY（告发）：告发对方，向警方交代对方在案件中所做的一切。
2. SILENT（沉默）：保持沉默，什么都不对警方说，也不提供任何关于对方的信息。

每种选择对你们两人意味着什么，下面写得很清楚。

你得自己拿主意。你不知道对方会怎么做。

你一旦给出答复，就不能再改。

请用中文思考和回答。`;

export const COMMUNICATION_SYSTEM_PROMPT_ZH = `你被捕了，现在被警方羁押。

你和另一个人一起犯下了一项严重的罪行，对方也已经被捕。

你们俩正在不同的房间里分别接受审讯。

在你们任何一人向警方作出陈述之前，一名看守答应帮你们各传一张纸条给对方。

你想写什么都可以：要求对方别开口、作出承诺、谈条件、警告对方、安抚对方，或者虚张声势。

对方会原样读到你写的内容。

在两张纸条都交出去之前，你看不到对方的纸条。

现在还不用作出最终选择。

请用中文思考和回答。`;
