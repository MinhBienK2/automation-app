# Behavioral Analytics Lab Design

## Context

This repository is an internal adversarial browser automation lab for authorized testing of owned production and staging systems. Current code already provides useful browser automation primitives: real CDP mouse clicks, hover, scroll, per-character typing, random waits, persistent browser profiles, device profile settings, proxy configuration, cookies/storage, challenge detection, and pause-for-human controls.

Those primitives are not yet enough to model behavioral analytics as a system. They reduce some obvious automation signals, but they do not provide a coherent persona, session-level behavior policy, evidence trail, or scoring loop. Behavioral analytics work needs to measure the run first, then tune behavior with repeatable profiles.

## Goals

- Add a Behavioral Analytics Lab that models realistic user behavior for authorized red-team simulations on allowlisted owned domains.
- Preserve auditability through named test accounts, domain allowlists, seeded runs, explicit behavior profiles, and evidence reports.
- Keep CAPTCHA and challenge handling honest: detect, pause, and resume after authorized human action; do not solve or bypass challenges automatically.
- Make behavior improvements measurable through telemetry and scoring, not only configurable through random delays.
- Keep action semantics stable. Behavior modulation can change how an action is approached, but not what the workflow intends to do.

## Non-Goals

- No third-party target automation outside owned or explicitly authorized systems.
- No CAPTCHA solving, hidden challenge bypass, account-control bypass, or stealth wording in the UI.
- No proxy rotation or automatic reputation management in this design.
- No attempt to imitate a specific real person.
- No large workflow rewrite; the lab layers on top of the existing graph compile and runner flow.

## Recommended Approach

Use a full Behavioral Analytics Lab rather than isolated primitive patches.

The system should be built in phases:

1. Observe and score current behavior.
2. Add profile-level timing and velocity controls.
3. Add pointer, typing, and scroll modulation.
4. Add engagement semantics and scenario presets.
5. Add richer reports and run comparisons.

This order avoids tuning behavior blindly. The first phase creates evidence about where current workflows look mechanical.

## Architecture

### BehaviorProfile

`BehaviorProfile` is the persona and policy source for a run. It should be tied to a workflow, account label, target domain set, and deterministic seed.

It owns:

- pace and reaction timing;
- pointer behavior;
- typing behavior;
- scroll and reading behavior;
- velocity budgets and cooldowns;
- session continuity expectations;
- evidence and redaction policy.

### BehaviorEngine

`BehaviorEngine` sits between compiled action configs and browser action execution. It receives the current action, runtime context, profile, and deterministic random source.

It can add:

- pre-action reaction delay;
- hover or dwell before click;
- scroll scan before a target action;
- click offsets that remain inside target bounds;
- key timing jitter and typo/correction behavior;
- scroll chunks and pause timing;
- post-action contextual delay.

It must not silently change workflow intent. If modulation would make an action unreliable, the runner should fail clearly or follow an explicit fallback policy.

### BehaviorTelemetry

`BehaviorTelemetry` records what actually happened during the run. It is separate from the desired profile because behavioral analytics requires measured evidence.

Telemetry should include:

- run id, workflow id, behavior profile name, account label, target domain, and seed;
- action start and end times;
- selected delay values;
- click coordinates, target rects, and offset from center;
- mouse movement summary when available;
- scroll deltas, chunk count, direction, and pauses;
- key intervals, typo/correction events, and paste/type choices;
- dwell time near important content or controls;
- page URL/domain markers;
- challenge, manual pause, and resume markers;
- scorer output and report metadata.

### BehaviorScorer

`BehaviorScorer` analyzes telemetry after the run. It should produce machine-readable anomaly codes and human-readable evidence.

Initial anomaly categories:

- timing too uniform;
- action rate too high;
- click positions too centered or too exact;
- missing dwell before important actions;
- typing too uniform;
- scroll too linear or too fast;
- repeated workflow path too identical across runs;
- velocity budget exceeded;
- inconsistent browser identity for a named account;
- telemetry incomplete.

### BehaviorReport

`BehaviorReport` turns telemetry and scoring into evidence for security, trust, anti-abuse, and production teams.

It should include:

- summary score and severity;
- behavior profile and seed used;
- target domains and test account label;
- anomaly list with timestamps and action references;
- histograms for action intervals, key intervals, scroll chunks, and click offsets;
- screenshots or checkpoints when enabled;
- remediation suggestions such as adding dwell, reducing rate, or using stable device identity.

### Guardrails

Guardrails remain product requirements:

- domain allowlist before run;
- named test accounts or operator labels;
- stable profile/device/network identity per persona;
- explicit seed for reproducibility;
- challenge detection and pause-for-human behavior;
- sensitive value redaction in telemetry and reports;
- run failure when a required guardrail is missing.

## Data Model

### BehaviorProfile

Fields:

- `enabled: boolean`
- `profile_name: string`
- `persona_type: "new_user" | "returning_user" | "power_user" | "mobile_user" | "reader" | "viewer" | "buyer" | "operator_defined"`
- `seed: string | null`
- `strictness: "observe_only" | "assistive" | "realistic" | "stress_test"`
- `account_ref: string`
- `target_domains: string[]`
- `timing: BehaviorTimingPolicy`
- `pointer: BehaviorPointerPolicy`
- `typing: BehaviorTypingPolicy`
- `scroll: BehaviorScrollPolicy`
- `velocity: BehaviorVelocityBudget`
- `evidence: BehaviorEvidencePolicy`

### BehaviorTimingPolicy

Fields:

- `reaction_time_ms: { min, max, distribution }`
- `between_actions_ms: { min, max, distribution }`
- `burst_action_count: { min, max }`
- `burst_cooldown_ms: { min, max, probability }`
- `long_pause_ms: { min, max, probability }`
- `max_actions_per_minute: number | null`

Supported distributions should start small: `uniform`, `normal`, and `log_normal`.

### BehaviorPointerPolicy

Fields:

- `path_style: "direct" | "curved" | "hesitant"`
- `click_offset_policy: "center_biased" | "area_weighted" | "operator_defined"`
- `hover_before_click_probability: number`
- `dwell_before_click_ms: { min, max }`
- `overshoot_probability: number`
- `move_speed_profile: "slow" | "normal" | "fast" | "variable"`

### BehaviorTypingPolicy

Fields:

- `mode: "set_value" | "human_type" | "mixed"`
- `key_delay_ms: { min, max, distribution }`
- `word_pause_ms: { min, max, probability }`
- `sentence_pause_ms: { min, max, probability }`
- `typo_probability: number`
- `correction_policy: "backspace" | "select_all_rewrite" | "none"`
- `paste_probability: number`

### BehaviorScrollPolicy

Fields:

- `scroll_chunk_px: { min, max, distribution }`
- `pause_between_scrolls_ms: { min, max, distribution }`
- `backtrack_probability: number`
- `read_dwell_per_100_words_ms: { min, max }`
- `video_watch_policy: { min_ratio, max_ratio, skip_probability, replay_probability }`

### BehaviorVelocityBudget

Fields:

- `per_domain_actions_per_minute: number | null`
- `per_action_caps: Array<{ action_type, max_per_minute }>`
- `cooldown_windows: Array<{ action_type, min_ms, max_ms }>`
- `session_duration_ms: { min, max } | null`
- `daily_action_budget: number | null`
- `on_budget_exceeded: "pause" | "fail" | "manual_approval"`

### BehaviorEvidencePolicy

Fields:

- `timeline_enabled: boolean`
- `screenshots_enabled: boolean`
- `histograms_enabled: boolean`
- `redact_sensitive_values: boolean`
- `export_format: "json" | "json_and_markdown"`

### BehaviorRunTelemetry

Fields:

- `run_id`
- `workflow_id`
- `profile_name`
- `account_ref`
- `seed`
- `started_at`
- `finished_at`
- `events`
- `score`
- `anomalies`
- `report_path`

Telemetry can initially persist as JSON output attached to run state or a report file. A dedicated database table can follow once report retention and query needs are clear.

## Behavior Dimensions

The lab should model more than the obvious request timing and click speed signals.

### Timing

Model action intervals, reaction times after page changes, short bursts, long pauses, and context-sensitive waits. The timing policy should avoid perfectly even intervals and avoid unrealistically fast post-load action.

### Pointer

Model pointer movement, click offsets, dwell, hover, overshoot, correction, and target-bound safety. Clicks should not always land in the exact center. Pointer modulation must keep the click inside the intended target unless the profile explicitly disables offset.

### Scroll And Reading

Model scroll chunks, pause rhythm, backtrack, scan behavior, and reading/viewing dwell. Content-heavy pages should produce longer dwell than simple forms.

### Typing

Model key jitter, word and sentence pauses, typo/correction, paste-vs-type decisions, and field-specific behavior. Passwords, codes, short IDs, long text, and comments should not all use the same typing pattern.

### Action Order

Model side behavior that users naturally produce: hover, focus, scroll, hesitation, retry, and occasional revisit. This should be conservative and never create unrelated engagement unless explicitly configured.

### Frequency And Velocity

Model per-account, per-domain, and per-action budgets. A realistic single action is not enough if the session performs too many actions too quickly.

### Identity Consistency

Keep profile, user agent, viewport, timezone, locale, geolocation, proxy, cookies, and storage coherent for a named account. Randomizing these between runs can look less realistic than keeping a stable identity.

### Session Continuity

Differentiate new, returning, warmed, and power-user sessions. A brand-new profile performing high-volume engagement immediately should be flagged by the scorer.

### Content Engagement

Model dwell by content length, video watch ratio, pauses, skips, and replays. This should support owned-system testing of engagement analytics without representing fake engagement as a production objective.

### Error And Recovery Behavior

Model human-like correction behavior: typo correction, retry after UI lag, small waits after unexpected state, and clear failure when a challenge or checkpoint appears.

### Replayability

Every behavior-modulated run should record its seed and profile so security teams can reproduce the run and compare before/after detector behavior.

## Runner Flow

1. Compile the saved graph into action configs as today.
2. Load Workflow Settings and behavior profile.
3. Validate behavior profile, target domains, account label, and guardrails before browser launch.
4. Initialize `BehaviorEngine` with profile, seed, and run context.
5. For each action:
   - emit telemetry for action start;
   - apply budget and allowlist checks;
   - run pre-action behavior;
   - execute the action with action-specific modulation when enabled;
   - run post-action delay;
   - emit telemetry for action end.
6. On terminal run state:
   - score telemetry;
   - generate report;
   - attach report path and summary to run outputs.

## Error Handling

- Invalid behavior profile blocks the run before browser launch.
- Missing domain allowlist blocks the run when behavior lab is enabled.
- Missing account label warns in observe-only mode and blocks in realistic or stress-test mode.
- Velocity budget exceeded follows `on_budget_exceeded`.
- Challenge detection pauses for human action according to existing challenge policy.
- Behavior modulation that would leave target bounds fails clearly.
- Telemetry write failure marks the report incomplete; it should not necessarily fail the workflow unless evidence is required by policy.
- Sensitive values are redacted before report persistence.

## UI Surface

Behavior controls should live under Workflow Settings, likely as a new `Behavior` section after Execution and Browser. The section should not be hidden inside individual action forms because behavior is a run-level policy.

The first UI can be compact:

- enable behavior lab;
- choose profile/persona;
- strictness mode;
- account label;
- target domains;
- seed;
- evidence logging toggle;
- scorer report visibility.

Advanced policy editors can come later. Defaults should be conservative and explainable.

## Testing Strategy

- Rust domain validation tests for behavior profiles and guardrails.
- Deterministic seed tests: the same profile and seed produce the same timing and offset sequence.
- Runner fixture tests for telemetry emission with behavior disabled and enabled.
- Runner fixture tests for click offset target-bound safety.
- Runner fixture tests for typing jitter and correction events.
- Runner fixture tests for scroll chunking and dwell telemetry.
- Scorer unit tests with synthetic timelines for uniform timing, high velocity, exact clicks, missing dwell, and telemetry gaps.
- Frontend tests for Workflow Settings Behavior UI.
- Contract tests for TypeScript/Rust behavior DTO compatibility.
- Regression tests proving behavior disabled preserves current runner semantics.

## Phase Plan

### Phase 1: Observe And Score

Add telemetry, scorer, and report generation without changing action behavior by default. This phase answers: "How mechanical do current workflows look?"

Deliverables:

- behavior telemetry event model;
- run report output;
- initial scorer anomaly codes;
- report UI or output link;
- tests for telemetry and scoring.

### Phase 2: Timing And Velocity

Add profile-level timing policies, contextual delays, action budgets, and cooldowns.

Deliverables:

- `BehaviorProfile` settings;
- deterministic seeded delay generation;
- velocity budget enforcement;
- report comparison before and after timing profile.

### Phase 3: Pointer, Typing, And Scroll

Add action-level modulation for pointer paths, click offsets, hover/dwell, typing jitter, typo correction, paste policy, scroll chunks, and read dwell.

Deliverables:

- behavior-aware click execution;
- behavior-aware typing execution;
- behavior-aware scroll execution;
- telemetry for generated modulation values;
- fixture tests for target safety and determinism.

### Phase 4: Engagement Semantics

Add content-aware dwell, video watch policy, warm-up flows, and scenario presets. This phase should remain bounded to owned target testing and produce evidence rather than optimize fake engagement.

Deliverables:

- content dwell helper actions or engine hooks;
- video watch telemetry;
- session aging scorer;
- scenario presets for owned-system detector testing.

### Phase 5: Reports And Comparisons

Add richer reports and cross-run comparison tools.

Deliverables:

- run comparison report;
- anomaly trend summaries;
- export bundle for security review;
- remediation suggestions tied to action ids and profile fields.

## Documentation Impact

Implementation will need updates to:

- `docs/domain/product-model.md`;
- `docs/domain/user-visible-invariants.md`;
- `docs/domain/execution-semantics.md`;
- `docs/architecture/runner.md`;
- `docs/architecture/frontend.md`;
- `docs/contracts/workflow-types.md`;
- `docs/contracts/run-state.md` if report outputs become part of run state;
- `README.md` smoke checklist for behavior settings and reports.

## Open Decisions For Implementation Planning

- Whether behavior settings belong inside `WorkflowSettings` or a dedicated `workflow_behavior_profiles` table.
- Whether Phase 1 report files should be stored under app data or only attached to run outputs.
- Whether strictness mode should block missing account labels in Phase 1 or only warn.
- Whether pointer path simulation should use CDP mouse events from the start or begin with telemetry plus click offset only.

## Approval State

The user approved the full Behavioral Analytics Lab direction, the architecture, the data model and behavior dimensions, and the runner/data-flow plus phase plan before this spec was written.
