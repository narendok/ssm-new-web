const MISSING_STAGE_RPC =
  /PGRST202|schema cache|could not find the function|function .* does not exist/i;

const STAGE_ACTIONS = new Set(["request_stage_completion", "advance_stage"]);

export function sharedStageSaveError(action: string, message: string): string {
  if (STAGE_ACTIONS.has(action) && MISSING_STAGE_RPC.test(message)) {
    return "Stage review is not available in this shared TEST database yet. Ask the database owner to deploy and verify the lifecycle review migration, then refresh. No stage change was saved.";
  }
  return message;
}
