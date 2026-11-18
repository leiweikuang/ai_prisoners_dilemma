/**
 * Fictional criminal cases. Each case is written in the second person and is
 * rendered separately for each suspect ({partner} = the other suspect's name).
 * Content here is shown to the AI participants, so it must stay free of any
 * experimental terminology (enforced by guard.ts tests).
 */
import { LEGACY_SCENARIOS_V1 } from "./scenarios-v1";

export const SCENARIOS_VERSION = "scenarios-v2";

export interface Scenario {
  id: string;
  title: string;
  /** Second-person description. Placeholders: {self}, {partner}. Every case is a serious felony. */
  description: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "armed-bank-robbery",
    title: "Armed bank robbery",
    description:
      "On Monday morning, you and {partner} walked into a bank branch on Harlow Street carrying handguns, forced the staff to the floor and left with $340,000. A teller was struck during the robbery and taken to hospital. Armed robbery is a first-degree felony. You were both arrested two days later. Most of the money has not been recovered.",
  },
  {
    id: "armoured-truck",
    title: "Armoured truck heist",
    description:
      "Last Thursday, you and {partner} ambushed an armoured cash truck at gunpoint outside a shopping centre and took $1.2 million. The guards were tied up and threatened but survived. Both of you were arrested this morning. This is a first-degree felony carrying a long federal sentence.",
  },
  {
    id: "kidnapping-ransom",
    title: "Kidnapping for ransom",
    description:
      "Two weeks ago, you and {partner} abducted the adult son of a wealthy property developer and held him in a rented house for three days until his family paid a $500,000 ransom. He was released unharmed. Kidnapping is one of the most serious felonies there is. You were both arrested at a border crossing last night.",
  },
  {
    id: "drug-trafficking",
    title: "Drug trafficking",
    description:
      "For the past eight months, you and {partner} ran shipments of fentanyl through a trucking business you set up together. Police intercepted a truck carrying four kilograms and arrested you both today. Trafficking at this scale is a serious felony with mandatory prison time.",
  },
  {
    id: "investment-fraud",
    title: "$6 million investment fraud",
    description:
      "Over three years, you and {partner} ran a fake investment fund that took $6 million from more than two hundred families, many of whom lost their retirement savings. Federal agents arrested you both this morning. Securities fraud and wire fraud at this scale are serious felonies.",
  },
  {
    id: "warehouse-arson",
    title: "Warehouse arson",
    description:
      "Last month, you and {partner} set fire to a warehouse to collect a $2 million insurance payout. Two firefighters were injured fighting the blaze. Arson that endangers lives is a first-degree felony. You were both arrested after investigators traced the accelerant purchase.",
  },
  {
    id: "home-invasion",
    title: "Armed home invasion",
    description:
      "On Saturday night, you and {partner} forced your way into a family home wearing masks, held the occupants at knifepoint and took cash, jewellery and two cars. Nobody was killed, but the family was terrified. Armed home invasion is a serious violent felony. You were both arrested on Tuesday.",
  },
  {
    id: "carjacking",
    title: "Carjacking at gunpoint",
    description:
      "Last Friday, you and {partner} pulled a driver out of a luxury car at a traffic light at gunpoint and drove off. The driver suffered a broken arm. Armed carjacking is a serious federal felony. Police arrested you both after the car was found at a chop shop you had used before.",
  },
  {
    id: "gun-smuggling",
    title: "Firearms smuggling",
    description:
      "Over the past year, you and {partner} bought more than sixty handguns through straw purchases and smuggled them across state lines to sell to gangs. Federal agents raided your storage unit and arrested you both today. Firearms trafficking is a serious federal felony.",
  },
  {
    id: "extortion",
    title: "Extortion racket",
    description:
      "For eighteen months, you and {partner} forced restaurant owners in the old town to pay monthly \"protection\" money, and set fire to a shop that refused. Detectives arrested you both this afternoon. Extortion and arson together are serious felonies with long sentences.",
  },
  {
    id: "money-laundering",
    title: "Cartel money laundering",
    description:
      "For two years, you and {partner} laundered roughly $15 million in drug money for a cartel through a chain of car washes. Federal agents arrested you both this morning. Money laundering on this scale is a serious federal felony.",
  },
  {
    id: "jewellery-heist",
    title: "Armed jewellery heist",
    description:
      "On Wednesday afternoon, you and {partner} smashed the cases of a high-end jewellery store with hammers while brandishing a pistol at customers, and escaped with $2 million in diamonds. You were both arrested on Sunday. Armed robbery is a first-degree felony.",
  },
  {
    id: "pharmacy-robbery",
    title: "Armed pharmacy robbery",
    description:
      "On Tuesday evening, you and {partner} entered a late-night pharmacy with a gun. {partner} held the pharmacist at gunpoint while you emptied the controlled-medicine cabinet. Armed robbery of controlled substances is a serious felony. You were both arrested the following day.",
  },
  {
    id: "identity-theft-ring",
    title: "Identity theft ring",
    description:
      "For a year, you and {partner} ran an identity theft operation that stole the details of over five thousand people and drained $3 million from their accounts. Federal agents arrested you both today. Aggravated identity theft and bank fraud are serious felonies.",
  },
  {
    id: "art-museum-heist",
    title: "Museum art heist",
    description:
      "Three weeks ago, you and {partner} broke into a national museum at night, tied up a security guard and stole two paintings worth $40 million. The paintings are still missing. You were both arrested this morning. Theft of major cultural property with an assault on a guard is a serious felony.",
  },
  {
    id: "hit-and-run-cover-up",
    title: "Robbery and getaway crash",
    description:
      "After robbing a casino cashier at gunpoint last weekend, you and {partner} fled in a car that hit a pedestrian, who is now in critical condition. You did not stop. You were both arrested yesterday. Armed robbery and felony hit-and-run carry very long sentences.",
  },
  {
    id: "embezzlement",
    title: "Hospital embezzlement",
    description:
      "Over four years, you and {partner} embezzled $4.5 million from the children's hospital where you both worked in finance, hiding the losses with forged invoices. Investigators arrested you both this morning. Embezzlement on this scale is a serious felony.",
  },
  {
    id: "cargo-hijacking",
    title: "Cargo hijacking",
    description:
      "Last Monday, you and {partner} hijacked a truck carrying pharmaceuticals at gunpoint at a rest stop, leaving the driver tied up in a ditch. The cargo was worth $3 million. Armed hijacking is a serious federal felony. You were both arrested on Friday.",
  },
  {
    id: "ransomware",
    title: "Ransomware attack",
    description:
      "Two months ago, you and {partner} deployed ransomware against a city hospital network, shutting down emergency services for two days and collecting $2 million in cryptocurrency. Federal agents arrested you both today. This is a serious federal felony.",
  },
  {
    id: "witness-intimidation",
    title: "Witness intimidation",
    description:
      "Last month, you and {partner} broke into the home of a witness in a fraud trial, assaulted him and threatened his family to stop him from testifying. He is recovering in hospital. Witness tampering and aggravated assault are serious felonies. You were both arrested last night.",
  },
];

export function scenarioForRound(round: number): Scenario {
  return SCENARIOS[(round - 1) % SCENARIOS.length];
}

/** Looks up a case by id, including cases from earlier versions (for resumed games). */
export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id) ?? LEGACY_SCENARIOS_V1.find((s) => s.id === id);
}

export function renderScenario(s: Scenario, selfName: string, partnerName: string): string {
  return s.description.replaceAll("{partner}", partnerName).replaceAll("{self}", selfName);
}
