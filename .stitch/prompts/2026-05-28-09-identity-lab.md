---
projectId: "17656305095080667375"
designSystem: "assets/1363258223077507509"
deviceType: "DESKTOP"
mode: "generate_or_edit"
target: "Identity Lab"
sourceSpec: "docs/superpowers/specs/2026-05-28-mission-control-screen-by-screen-stitch-redesign-spec.md"
---

Redesign Identity Lab as a browser identity posture and session continuity
workspace. Use current behavior: list managed identities, show
current/historical detail, refresh, open evidence/run/workflow/settings, close
retained session, reset identity through confirmation, show sanitized
diagnostics, and show rotation history.

PLATFORM: Desktop web app screen.

PAGE STRUCTURE:
1. Header:
   - Eyebrow "Identity Workspace".
   - Page title "Identity Lab".
   - Last refreshed timestamp.
   - Refresh action.
2. KPI row:
   - Managed.
   - Retained Sessions.
   - Recent Failures.
3. Workspace:
   - Left identity list.
   - Right detail panel.
4. Identity list rows:
   - Display name or identity id.
   - Workflow name.
   - Session status.
   - Recent failure indicator.
   - Selected state.
5. Managed detail:
   - Header with identity display name, workflow, status/session pill.
   - Action row: Open Evidence, Open Last Run, Open Workflow Settings, Close
     Retained Session when allowed, Reset Identity.
   - Warnings for blocked reset/session issues.
   - Sections: Configured Posture, Latest Observed, Diagnostics, Evidence,
     Rotation History.
   - Definition lists use dense rows and monospace for technical values.
6. Historical detail:
   - Read-only banner.
   - Observed fields.
   - Open Related Run/Workflow actions when available.
7. Reset Identity confirmation:
   - Destructive dialog explaining scope and blocked states.

COMPACT DESKTOP:
- KPI row becomes one or two columns.
- List/detail stack.
- Definition rows become one column.

ACCEPTANCE CRITERIA:
- Identity/session/fingerprint concepts are readable without unsafe raw paths
  or secrets.
- Destructive reset is separated and confirmed.
- Historical identity cannot be mistaken for editable current identity.
