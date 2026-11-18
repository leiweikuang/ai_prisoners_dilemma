import type { Lang } from "../game/types";
/**
 * Fictional criminal cases. Each case is written in the second person and is
 * rendered separately for each suspect ({partner} = the other suspect's name).
 * Content here is shown to the AI participants, so it must stay free of any
 * experimental terminology (enforced by guard.ts tests).
 */
import { LEGACY_SCENARIOS_V1 } from "./scenarios-v1";

export const SCENARIOS_VERSION = "scenarios-v3";

export interface Scenario {
  id: string;
  title: string;
  /** Second-person description. Placeholders: {self}, {partner}. Every case is a serious felony. */
  description: string;
  /** Chinese translation (same facts). */
  zh?: { title: string; description: string };
}

export const SCENARIOS: Scenario[] = [
  {
    id: "armed-bank-robbery",
    title: "Armed bank robbery",
    description:
      "On Monday morning, you and {partner} walked into a bank branch on Harlow Street carrying handguns, forced the staff to the floor and left with $340,000. A teller was struck during the robbery and taken to hospital. Armed robbery is a first-degree felony. You were both arrested two days later. Most of the money has not been recovered.",
    zh: {
      title: "持枪抢劫银行",
      description: "周一上午，你和{partner}携带手枪闯入哈洛街的一家银行支行，逼迫员工趴在地上，抢走了34万美元。抢劫过程中一名柜员被打伤，被送往医院。持械抢劫属于一级重罪。两天后你们两人被捕。大部分赃款至今没有追回。",
    },
  },
  {
    id: "armoured-truck",
    title: "Armoured truck heist",
    description:
      "Last Thursday, you and {partner} ambushed an armoured cash truck at gunpoint outside a shopping centre and took $1.2 million. The guards were tied up and threatened but survived. Both of you were arrested this morning. This is a first-degree felony carrying a long federal sentence.",
    zh: {
      title: "劫持运钞车",
      description: "上周四，你和{partner}在一家购物中心外持枪伏击了一辆运钞车，抢走了120万美元。押运员被捆绑并遭到威胁，但幸存了下来。今天早上你们两人被捕。这是一项一级重罪，将面临漫长的联邦刑期。",
    },
  },
  {
    id: "kidnapping-ransom",
    title: "Kidnapping for ransom",
    description:
      "Two weeks ago, you and {partner} abducted the adult son of a wealthy property developer and held him in a rented house for three days until his family paid a $500,000 ransom. He was released unharmed. Kidnapping is one of the most serious felonies there is. You were both arrested at a border crossing last night.",
    zh: {
      title: "绑架勒索",
      description: "两周前，你和{partner}绑架了一位富有地产开发商的成年儿子，把他关在一栋租来的房子里三天，直到他的家人支付了50万美元赎金。他被释放时毫发无伤。绑架是最严重的重罪之一。昨晚你们两人在一个边境口岸被捕。",
    },
  },
  {
    id: "drug-trafficking",
    title: "Drug trafficking",
    description:
      "For the past eight months, you and {partner} ran shipments of fentanyl through a trucking business you set up together. Police intercepted a truck carrying four kilograms and arrested you both today. Trafficking at this scale is a serious felony with mandatory prison time.",
    zh: {
      title: "贩运毒品",
      description: "过去八个月里，你和{partner}利用你们一起开设的货运公司运送芬太尼。警方截获了一辆装有四公斤毒品的货车，今天逮捕了你们两人。如此规模的贩毒属于严重重罪，必须服刑。",
    },
  },
  {
    id: "investment-fraud",
    title: "$6 million investment fraud",
    description:
      "Over three years, you and {partner} ran a fake investment fund that took $6 million from more than two hundred families, many of whom lost their retirement savings. Federal agents arrested you both this morning. Securities fraud and wire fraud at this scale are serious felonies.",
    zh: {
      title: "600万美元投资诈骗",
      description: "三年来，你和{partner}经营一只虚假的投资基金，从两百多个家庭骗走了600万美元，其中许多人失去了养老积蓄。今天早上联邦探员逮捕了你们两人。如此规模的证券欺诈和电信诈骗属于严重重罪。",
    },
  },
  {
    id: "warehouse-arson",
    title: "Warehouse arson",
    description:
      "Last month, you and {partner} set fire to a warehouse to collect a $2 million insurance payout. Two firefighters were injured fighting the blaze. Arson that endangers lives is a first-degree felony. You were both arrested after investigators traced the accelerant purchase.",
    zh: {
      title: "仓库纵火",
      description: "上个月，你和{partner}放火烧毁了一座仓库，企图骗取200万美元的保险金。两名消防员在灭火时受伤。危及生命的纵火属于一级重罪。调查人员追查到助燃剂的购买记录后，你们两人被捕。",
    },
  },
  {
    id: "home-invasion",
    title: "Armed home invasion",
    description:
      "On Saturday night, you and {partner} forced your way into a family home wearing masks, held the occupants at knifepoint and took cash, jewellery and two cars. Nobody was killed, but the family was terrified. Armed home invasion is a serious violent felony. You were both arrested on Tuesday.",
    zh: {
      title: "持械入室抢劫",
      description: "周六晚上，你和{partner}戴着面罩强行闯入一户人家，持刀挟持屋里的人，抢走了现金、珠宝和两辆汽车。没有人丧命，但这家人受到了极大的惊吓。持械入室抢劫是严重的暴力重罪。周二你们两人被捕。",
    },
  },
  {
    id: "carjacking",
    title: "Carjacking at gunpoint",
    description:
      "Last Friday, you and {partner} pulled a driver out of a luxury car at a traffic light at gunpoint and drove off. The driver suffered a broken arm. Armed carjacking is a serious federal felony. Police arrested you both after the car was found at a chop shop you had used before.",
    zh: {
      title: "持枪劫车",
      description: "上周五，你和{partner}在红绿灯前持枪把一名司机从豪华轿车里拽了出来，然后把车开走。司机的手臂骨折。持枪劫车是严重的联邦重罪。警方在一家你们以前用过的非法拆车厂找到了那辆车，随后逮捕了你们两人。",
    },
  },
  {
    id: "gun-smuggling",
    title: "Firearms smuggling",
    description:
      "Over the past year, you and {partner} bought more than sixty handguns through straw purchases and smuggled them across state lines to sell to gangs. Federal agents raided your storage unit and arrested you both today. Firearms trafficking is a serious federal felony.",
    zh: {
      title: "走私枪支",
      description: "过去一年里，你和{partner}通过代购购买了六十多支手枪，并把它们跨州走私卖给帮派。联邦探员今天搜查了你们的储物仓，逮捕了你们两人。贩卖枪支是严重的联邦重罪。",
    },
  },
  {
    id: "extortion",
    title: "Extortion racket",
    description:
      "For eighteen months, you and {partner} forced restaurant owners in the old town to pay monthly \"protection\" money, and set fire to a shop that refused. Detectives arrested you both this afternoon. Extortion and arson together are serious felonies with long sentences.",
    zh: {
      title: "敲诈勒索团伙",
      description: "十八个月来，你和{partner}强迫老城区的餐馆老板每月缴纳“保护费”，还放火烧了一家拒绝交钱的店铺。今天下午警探逮捕了你们两人。敲诈勒索加上纵火都是严重重罪，刑期很长。",
    },
  },
  {
    id: "money-laundering",
    title: "Cartel money laundering",
    description:
      "For two years, you and {partner} laundered roughly $15 million in drug money for a cartel through a chain of car washes. Federal agents arrested you both this morning. Money laundering on this scale is a serious federal felony.",
    zh: {
      title: "为贩毒集团洗钱",
      description: "两年来，你和{partner}通过一系列洗车店为一个贩毒集团清洗了约1500万美元的毒资。今天早上联邦探员逮捕了你们两人。如此规模的洗钱是严重的联邦重罪。",
    },
  },
  {
    id: "jewellery-heist",
    title: "Armed jewellery heist",
    description:
      "On Wednesday afternoon, you and {partner} smashed the cases of a high-end jewellery store with hammers while brandishing a pistol at customers, and escaped with $2 million in diamonds. You were both arrested on Sunday. Armed robbery is a first-degree felony.",
    zh: {
      title: "持械抢劫珠宝店",
      description: "周三下午，你和{partner}用锤子砸碎了一家高档珠宝店的展柜，同时用手枪威胁顾客，抢走了价值200万美元的钻石后逃离。周日你们两人被捕。持械抢劫属于一级重罪。",
    },
  },
  {
    id: "pharmacy-robbery",
    title: "Armed pharmacy robbery",
    description:
      "On Tuesday evening, you and {partner} entered a late-night pharmacy with a gun. {partner} held the pharmacist at gunpoint while you emptied the controlled-medicine cabinet. Armed robbery of controlled substances is a serious felony. You were both arrested the following day.",
    zh: {
      title: "持枪抢劫药店",
      description: "周二晚上，你和{partner}持枪闯进一家深夜营业的药店。{partner}用枪指着药剂师，你则清空了管制药品柜。持械抢劫管制药品是严重重罪。第二天你们两人被捕。",
    },
  },
  {
    id: "identity-theft-ring",
    title: "Identity theft ring",
    description:
      "For a year, you and {partner} ran an identity theft operation that stole the details of over five thousand people and drained $3 million from their accounts. Federal agents arrested you both today. Aggravated identity theft and bank fraud are serious felonies.",
    zh: {
      title: "身份盗窃团伙",
      description: "一年来，你和{partner}经营着一个身份盗窃团伙，窃取了五千多人的个人信息，并从他们的账户里转走了300万美元。今天联邦探员逮捕了你们两人。加重身份盗窃和银行欺诈都是严重重罪。",
    },
  },
  {
    id: "art-museum-heist",
    title: "Museum art heist",
    description:
      "Three weeks ago, you and {partner} broke into a national museum at night, tied up a security guard and stole two paintings worth $40 million. The paintings are still missing. You were both arrested this morning. Theft of major cultural property with an assault on a guard is a serious felony.",
    zh: {
      title: "博物馆名画盗窃",
      description: "三周前，你和{partner}在夜间闯入一家国家博物馆，捆绑了一名保安，偷走了两幅价值4000万美元的画作。画作至今下落不明。今天早上你们两人被捕。盗窃重要文物并袭击保安属于严重重罪。",
    },
  },
  {
    id: "hit-and-run-cover-up",
    title: "Robbery and getaway crash",
    description:
      "After robbing a casino cashier at gunpoint last weekend, you and {partner} fled in a car that hit a pedestrian, who is now in critical condition. You did not stop. You were both arrested yesterday. Armed robbery and felony hit-and-run carry very long sentences.",
    zh: {
      title: "抢劫后肇事逃逸",
      description: "上周末，你和{partner}持枪抢劫了一家赌场的收银员，逃跑时驾车撞倒了一名行人，对方目前情况危急。你们没有停车。昨天你们两人被捕。持械抢劫加上重罪肇事逃逸将面临非常长的刑期。",
    },
  },
  {
    id: "embezzlement",
    title: "Hospital embezzlement",
    description:
      "Over four years, you and {partner} embezzled $4.5 million from the children's hospital where you both worked in finance, hiding the losses with forged invoices. Investigators arrested you both this morning. Embezzlement on this scale is a serious felony.",
    zh: {
      title: "儿童医院贪污",
      description: "四年来，你和{partner}从你们都在财务部门工作的儿童医院里贪污了450万美元，并用伪造的发票掩盖亏空。今天早上调查人员逮捕了你们两人。如此规模的贪污是严重重罪。",
    },
  },
  {
    id: "cargo-hijacking",
    title: "Cargo hijacking",
    description:
      "Last Monday, you and {partner} hijacked a truck carrying pharmaceuticals at gunpoint at a rest stop, leaving the driver tied up in a ditch. The cargo was worth $3 million. Armed hijacking is a serious federal felony. You were both arrested on Friday.",
    zh: {
      title: "劫持货运卡车",
      description: "上周一，你和{partner}在一个休息站持枪劫持了一辆运送药品的卡车，把司机捆起来扔在路边的沟里。这批货物价值300万美元。持械劫持是严重的联邦重罪。周五你们两人被捕。",
    },
  },
  {
    id: "ransomware",
    title: "Ransomware attack",
    description:
      "Two months ago, you and {partner} deployed ransomware against a city hospital network, shutting down emergency services for two days and collecting $2 million in cryptocurrency. Federal agents arrested you both today. This is a serious federal felony.",
    zh: {
      title: "勒索软件攻击",
      description: "两个月前，你和{partner}对一家市立医院的网络发动了勒索软件攻击，导致急诊服务瘫痪两天，并收取了价值200万美元的加密货币。今天联邦探员逮捕了你们两人。这是严重的联邦重罪。",
    },
  },
  {
    id: "witness-intimidation",
    title: "Witness intimidation",
    description:
      "Last month, you and {partner} broke into the home of a witness in a fraud trial, assaulted him and threatened his family to stop him from testifying. He is recovering in hospital. Witness tampering and aggravated assault are serious felonies. You were both arrested last night.",
    zh: {
      title: "恐吓证人",
      description: "上个月，你和{partner}闯入一起诈骗案证人的家中，殴打了他，并威胁他的家人，阻止他出庭作证。他目前仍在医院康复。妨碍证人作证和严重伤害都是严重重罪。昨晚你们两人被捕。",
    },
  },
];

export function scenarioForRound(round: number): Scenario {
  return SCENARIOS[(round - 1) % SCENARIOS.length];
}

/** Looks up a case by id, including cases from earlier versions (for resumed games). */
export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id) ?? LEGACY_SCENARIOS_V1.find((s) => s.id === id);
}

export function scenarioTitle(s: Scenario, lang: Lang = "en"): string {
  return lang === "zh" && s.zh ? s.zh.title : s.title;
}

export function renderScenario(s: Scenario, selfName: string, partnerName: string, lang: Lang = "en"): string {
  return (lang === "zh" && s.zh ? s.zh.description : s.description).replaceAll("{partner}", partnerName).replaceAll("{self}", selfName);
}
