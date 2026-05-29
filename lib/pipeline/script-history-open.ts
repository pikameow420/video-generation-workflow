/** Single entry contract for opening script history from nav (desktop + mobile). */

export const OPEN_SCRIPT_HISTORY_PARAM = "openScriptHistory";
export const OPEN_SCRIPT_HISTORY_VALUE = "1";

export function scriptHistoryOpenPath(): string {
  return `/?${OPEN_SCRIPT_HISTORY_PARAM}=${OPEN_SCRIPT_HISTORY_VALUE}`;
}
