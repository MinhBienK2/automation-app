type RegressionStatus = "passed" | "warning" | "failed" | "missing";

export type FingerprintRegressionCheck = {
  id: string;
  category: string;
  label: string;
  status: RegressionStatus;
  evidence_path: string;
  expected?: string | null;
  observed?: string | null;
  reason: string;
};

export type FingerprintRegressionReport = {
  schema_version: 1;
  preflight_run_id: string | null;
  profile_id: string | null;
  persona_id: string | null;
  identity_id: string | null;
  checks: FingerprintRegressionCheck[];
  summary: Record<RegressionStatus | "total", number>;
  present_paths: string[];
  missing_paths: string[];
};

type BuildFingerprintRegressionReportRequest = {
  browserIdentity: Record<string, unknown> | null | undefined;
  preflight: Record<string, unknown> | null | undefined;
};

export function buildFingerprintRegressionReport({
  browserIdentity,
  preflight,
}: BuildFingerprintRegressionReportRequest): FingerprintRegressionReport {
  const identity = asRecord(browserIdentity);
  const persona = asRecord(identity.persona);
  const evidence = asRecord(asRecord(preflight).evidence);
  const checks: FingerprintRegressionCheck[] = [];
  const presentPaths = new Set<string>();
  const missingPaths = new Set<string>();
  const recordCheck = (check: FingerprintRegressionCheck) => {
    checks.push(check);
    if (check.status === "missing") {
      missingPaths.add(check.evidence_path);
    } else {
      presentPaths.add(check.evidence_path);
    }
  };

  recordCheck(booleanLeakCheck({
    id: "navigator.webdriver",
    category: "navigator",
    label: "Navigator webdriver flag is not exposed",
    evidence,
    path: "navigator.webdriver",
    expected: false,
  }));
  recordCheck(presenceCheck({
    id: "navigator.user_agent",
    category: "navigator",
    label: "Navigator user agent is recorded",
    evidence,
    paths: ["navigator.user_agent", "navigator.userAgent", "user_agent"],
  }));
  recordCheck(presenceCheck({
    id: "navigator.languages",
    category: "navigator",
    label: "Navigator languages are recorded",
    evidence,
    paths: ["navigator.languages", "languages", "accepted_languages"],
  }));
  recordCheck(presenceCheck({
    id: "canvas.hash",
    category: "fingerprint_hash",
    label: "Canvas hash bucket is recorded",
    evidence,
    paths: ["hashes.canvas", "canvas.hash", "canvas_hash", "canvas_hash_bucket"],
  }));
  recordCheck(presenceCheck({
    id: "webgl.hash",
    category: "fingerprint_hash",
    label: "WebGL hash or renderer label is recorded",
    evidence,
    paths: ["hashes.webgl", "webgl.hash", "webgl_hash", "webgl_renderer_label"],
  }));
  recordCheck(presenceCheck({
    id: "audio.hash",
    category: "fingerprint_hash",
    label: "Audio hash bucket is recorded",
    evidence,
    paths: ["hashes.audio", "audio.hash", "audio_hash", "audio_hash_bucket"],
  }));
  recordCheck(presenceCheck({
    id: "fonts.hash",
    category: "font_inventory",
    label: "Font inventory count or hash is recorded",
    evidence,
    paths: ["fonts.hash", "fonts.count", "font_hash", "font_count"],
  }));
  recordCheck(stringMatchCheck({
    id: "timezone.match",
    category: "locale_geo",
    label: "Timezone matches selected persona",
    evidence,
    paths: ["timezone.observed", "timezone", "intl.timezone"],
    expected: stringValue(persona.timezone) ?? stringValue(identity.timezone),
  }));
  recordCheck(stringMatchCheck({
    id: "locale.match",
    category: "locale_geo",
    label: "Locale matches selected persona",
    evidence,
    paths: ["locale.observed", "locale", "navigator.language"],
    expected: stringValue(persona.locale) ?? stringValue(identity.locale),
  }));
  recordCheck(webrtcCheck(evidence, stringValue(identity.webrtc_policy) ?? stringValue(persona.webrtc_mode)));
  recordCheck(dimensionsCheck({
    id: "display.viewport",
    label: "Viewport dimensions match selected persona",
    evidence,
    path: "viewport",
    expected: dimensionsValue(persona.viewport),
  }));
  recordCheck(dimensionsCheck({
    id: "display.window",
    label: "Window dimensions match selected persona",
    evidence,
    path: "window",
    expected: dimensionsValue(persona.window),
  }));
  recordCheck(dimensionsCheck({
    id: "display.screen",
    label: "Screen dimensions are coherent with selected persona",
    evidence,
    path: "screen",
    expected: dimensionsValue(persona.window),
  }));
  recordCheck(proxyGeoCheck(evidence, {
    expectedRegion: stringValue(persona.proxy_region) ?? stringValue(identity.proxy_region),
    policy: stringValue(persona.proxy_geo_policy),
  }));
  recordCheck(storageContinuityCheck(evidence, stringValue(identity.session_mode) === "persistent_profile"));
  recordCheck(automationLeakCheck(evidence));

  return {
    schema_version: 1,
    preflight_run_id: stringValue(asRecord(preflight).run_id),
    profile_id: stringValue(asRecord(preflight).profile_id),
    persona_id: stringValue(persona.id),
    identity_id: stringValue(identity.identity_id),
    checks,
    summary: summarizeChecks(checks),
    present_paths: Array.from(presentPaths).sort(),
    missing_paths: Array.from(missingPaths).sort(),
  };
}

function presenceCheck({
  id,
  category,
  label,
  evidence,
  paths,
}: {
  id: string;
  category: string;
  label: string;
  evidence: Record<string, unknown>;
  paths: string[];
}): FingerprintRegressionCheck {
  const found = firstPathValue(evidence, paths);
  return {
    id,
    category,
    label,
    evidence_path: found.path ?? paths[0],
    status: found.present ? "passed" : "missing",
    observed: found.present ? printable(found.value) : null,
    reason: found.present ? "Metric was present in owned preflight evidence" : "Metric was missing from owned preflight evidence",
  };
}

function booleanLeakCheck({
  id,
  category,
  label,
  evidence,
  path,
  expected,
}: {
  id: string;
  category: string;
  label: string;
  evidence: Record<string, unknown>;
  path: string;
  expected: boolean;
}): FingerprintRegressionCheck {
  const observed = valueAtPath(evidence, path);
  if (typeof observed !== "boolean") {
    return {
      id,
      category,
      label,
      evidence_path: path,
      status: "missing",
      expected: String(expected),
      observed: null,
      reason: "Boolean leak signal was missing from owned preflight evidence",
    };
  }
  return {
    id,
    category,
    label,
    evidence_path: path,
    status: observed === expected ? "passed" : "failed",
    expected: String(expected),
    observed: String(observed),
    reason: observed === expected ? "Leak signal matched expectation" : "Leak signal did not match expectation",
  };
}

function stringMatchCheck({
  id,
  category,
  label,
  evidence,
  paths,
  expected,
}: {
  id: string;
  category: string;
  label: string;
  evidence: Record<string, unknown>;
  paths: string[];
  expected: string | null;
}): FingerprintRegressionCheck {
  const found = firstPathValue(evidence, paths);
  if (!expected) {
    return {
      id,
      category,
      label,
      evidence_path: found.path ?? paths[0],
      status: "warning",
      expected: null,
      observed: found.present ? printable(found.value) : null,
      reason: "Selected identity did not define an expected value",
    };
  }
  if (!found.present) {
    return {
      id,
      category,
      label,
      evidence_path: paths[0],
      status: "missing",
      expected,
      observed: null,
      reason: "Owned preflight evidence did not include the observed value",
    };
  }
  const observed = printable(found.value);
  return {
    id,
    category,
    label,
    evidence_path: found.path ?? paths[0],
    status: observed === expected ? "passed" : "failed",
    expected,
    observed,
    reason: observed === expected ? "Observed value matched selected persona" : "Observed value did not match selected persona",
  };
}

function webrtcCheck(
  evidence: Record<string, unknown>,
  expectedMode: string | null,
): FingerprintRegressionCheck {
  const mode = firstPathValue(evidence, ["webrtc.mode", "webrtc_mode"]);
  const leak = firstPathValue(evidence, ["webrtc.leak_status", "webrtc_leak_status"]);
  if (!mode.present && !leak.present) {
    return {
      id: "webrtc.mode",
      category: "network",
      label: "WebRTC behavior is recorded",
      evidence_path: "webrtc.leak_status",
      status: "missing",
      expected: expectedMode,
      observed: null,
      reason: "Owned preflight evidence did not include WebRTC mode or leak status",
    };
  }
  const observedLeak = leak.present ? printable(leak.value) : null;
  const leakFailed = observedLeak ? /leak|mismatch|failed|exposed/i.test(observedLeak) : false;
  return {
    id: "webrtc.mode",
    category: "network",
    label: "WebRTC behavior is recorded and acceptable",
    evidence_path: leak.path ?? mode.path ?? "webrtc",
    status: leakFailed ? "failed" : "passed",
    expected: expectedMode,
    observed: [mode.present ? printable(mode.value) : null, observedLeak].filter(Boolean).join(" / "),
    reason: leakFailed ? "WebRTC leak status indicates exposure" : "WebRTC evidence was present and did not report a leak",
  };
}

function dimensionsCheck({
  id,
  label,
  evidence,
  path,
  expected,
}: {
  id: string;
  label: string;
  evidence: Record<string, unknown>;
  path: string;
  expected: { width: number; height: number } | null;
}): FingerprintRegressionCheck {
  const observed = dimensionsValue(valueAtPath(evidence, path));
  if (!expected) {
    return {
      id,
      category: "display",
      label,
      evidence_path: path,
      status: "warning",
      expected: null,
      observed: observed ? dimensionsLabel(observed) : null,
      reason: "Selected persona did not define expected dimensions",
    };
  }
  if (!observed) {
    return {
      id,
      category: "display",
      label,
      evidence_path: path,
      status: "missing",
      expected: dimensionsLabel(expected),
      observed: null,
      reason: "Owned preflight evidence did not include dimensions",
    };
  }
  const matches = observed.width === expected.width && observed.height === expected.height;
  return {
    id,
    category: "display",
    label,
    evidence_path: path,
    status: matches ? "passed" : "failed",
    expected: dimensionsLabel(expected),
    observed: dimensionsLabel(observed),
    reason: matches ? "Observed dimensions matched selected persona" : "Observed dimensions did not match selected persona",
  };
}

function proxyGeoCheck(
  evidence: Record<string, unknown>,
  expected: { expectedRegion: string | null; policy: string | null },
): FingerprintRegressionCheck {
  const aligned = firstPathValue(evidence, ["proxy.aligned", "proxy_geo.aligned"]);
  const region = firstPathValue(evidence, ["proxy.observed_region", "proxy.region", "proxy_geo.region"]);
  if (!expected.expectedRegion && expected.policy !== "match_proxy_region") {
    return {
      id: "proxy.geo",
      category: "network",
      label: "Proxy geography is aligned with persona policy",
      evidence_path: aligned.path ?? region.path ?? "proxy",
      status: "passed",
      expected: expected.policy,
      observed: region.present ? printable(region.value) : null,
      reason: "Selected persona does not require proxy region evidence",
    };
  }
  if (!aligned.present && !region.present) {
    return {
      id: "proxy.geo",
      category: "network",
      label: "Proxy geography is aligned with persona policy",
      evidence_path: "proxy.aligned",
      status: "missing",
      expected: expected.expectedRegion,
      observed: null,
      reason: "Owned preflight evidence did not include proxy geography alignment",
    };
  }
  const alignedValue = aligned.value === true ||
    (expected.expectedRegion != null && printable(region.value) === expected.expectedRegion);
  return {
    id: "proxy.geo",
    category: "network",
    label: "Proxy geography is aligned with persona policy",
    evidence_path: aligned.path ?? region.path ?? "proxy",
    status: alignedValue ? "passed" : "failed",
    expected: expected.expectedRegion,
    observed: region.present ? printable(region.value) : printable(aligned.value),
    reason: alignedValue ? "Proxy geography evidence matched persona policy" : "Proxy geography evidence did not match persona policy",
  };
}

function storageContinuityCheck(
  evidence: Record<string, unknown>,
  persistentExpected: boolean,
): FingerprintRegressionCheck {
  const persistent = firstPathValue(evidence, ["storage.persistent", "storage.persistent_profile"]);
  const continuity = firstPathValue(evidence, ["storage.continuity", "storage.continuity_status"]);
  if (!persistent.present && !continuity.present) {
    return {
      id: "storage.continuity",
      category: "storage",
      label: "Storage continuity matches session mode",
      evidence_path: "storage.continuity",
      status: "missing",
      expected: persistentExpected ? "persistent" : "temporary",
      observed: null,
      reason: "Owned preflight evidence did not include storage continuity",
    };
  }
  const persistentMatches = typeof persistent.value === "boolean"
    ? persistent.value === persistentExpected
    : true;
  const continuityValue = continuity.present ? printable(continuity.value) : null;
  const continuityFailed = continuityValue ? /mismatch|lost|missing|failed/i.test(continuityValue) : false;
  return {
    id: "storage.continuity",
    category: "storage",
    label: "Storage continuity matches session mode",
    evidence_path: continuity.path ?? persistent.path ?? "storage",
    status: persistentMatches && !continuityFailed ? "passed" : "failed",
    expected: persistentExpected ? "persistent" : "temporary",
    observed: [persistent.present ? printable(persistent.value) : null, continuityValue].filter(Boolean).join(" / "),
    reason: persistentMatches && !continuityFailed
      ? "Storage continuity evidence matched session mode"
      : "Storage continuity evidence did not match session mode",
  };
}

function automationLeakCheck(evidence: Record<string, unknown>): FingerprintRegressionCheck {
  const headless = firstPathValue(evidence, ["automation.headless_leak", "headless_leak"]);
  const webdriver = firstPathValue(evidence, ["navigator.webdriver"]);
  const leaked = headless.value === true || webdriver.value === true;
  if (!headless.present && !webdriver.present) {
    return {
      id: "automation.headless",
      category: "automation",
      label: "No obvious automation or headless leak is reported",
      evidence_path: "automation.headless_leak",
      status: "missing",
      expected: "false",
      observed: null,
      reason: "Owned preflight evidence did not include automation leak status",
    };
  }
  return {
    id: "automation.headless",
    category: "automation",
    label: "No obvious automation or headless leak is reported",
    evidence_path: headless.path ?? webdriver.path ?? "automation",
    status: leaked ? "failed" : "passed",
    expected: "false",
    observed: String(leaked),
    reason: leaked ? "Owned preflight evidence reported an automation leak" : "Owned preflight evidence did not report an automation leak",
  };
}

function summarizeChecks(checks: FingerprintRegressionCheck[]) {
  const summary: Record<RegressionStatus | "total", number> = {
    passed: 0,
    warning: 0,
    failed: 0,
    missing: 0,
    total: checks.length,
  };
  for (const check of checks) {
    summary[check.status] += 1;
  }
  return summary;
}

function firstPathValue(record: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = valueAtPath(record, path);
    if (value !== undefined && value !== null && value !== "") {
      return { present: true, path, value };
    }
  }
  return { present: false, path: null, value: null };
}

function valueAtPath(record: Record<string, unknown>, path: string) {
  let cursor: unknown = record;
  for (const part of path.split(".")) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function dimensionsValue(value: unknown): { width: number; height: number } | null {
  const record = asRecord(value);
  const width = numberValue(record.width);
  const height = numberValue(record.height);
  return width && height ? { width, height } : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}

function dimensionsLabel(dimensions: { width: number; height: number }) {
  return `${dimensions.width}x${dimensions.height}`;
}

function printable(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => printable(item)).join(",");
  return "";
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
