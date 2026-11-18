import { COMMUNICATION_SYSTEM_PROMPT_VERSION, DECISION_SYSTEM_PROMPT_VERSION } from "./system";
import { INDEPENDENT_USER_PROMPT_VERSION } from "./independent";
import { HISTORY_USER_PROMPT_VERSION } from "./history";
import { COMMUNICATION_USER_PROMPT_VERSION } from "./communication";
import { RESPONSE_SCHEMAS_VERSION } from "./schemas";
import { SCENARIOS_VERSION } from "./scenarios";
import type { PromptVersions } from "../game/types";

export const PROMPT_VERSIONS: PromptVersions = {
  decisionSystem: DECISION_SYSTEM_PROMPT_VERSION,
  communicationSystem: COMMUNICATION_SYSTEM_PROMPT_VERSION,
  independentUser: INDEPENDENT_USER_PROMPT_VERSION,
  historyUser: HISTORY_USER_PROMPT_VERSION,
  communicationUser: COMMUNICATION_USER_PROMPT_VERSION,
  responseSchemas: RESPONSE_SCHEMAS_VERSION,
  scenarios: SCENARIOS_VERSION,
};
