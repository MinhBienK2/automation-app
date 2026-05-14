# Freshness Checklist

Use this when docs look stale or the task touches documented behavior.

## Check Source Paths

- Do the docs name current files?
- Did files move from `src/components` to `src/features` or another folder?
- Are tests still at the documented paths?

## Check Contracts

- Do TypeScript DTOs match Electron bridge/backend payloads?
- Do command names and bridge payload keys still match?
- Does `CommandError` still serialize as `{ message, field }`?
- Do action config type strings still match the TypeScript `ActionType` union?

## Check Behavior

- Does workflow lifecycle behavior match current UI and commands?
- Does runner progress match current command run state and monitor behavior?
- Does persistence still preserve step ordering and parent `updated_at`?

## Check Verification

- Are focused test commands still valid?
- Did a new touched area require an additional check?
- Did a documented smoke checklist expectation change?

## Fix Rule

If a doc is wrong for the touched area, update it in the same task.
