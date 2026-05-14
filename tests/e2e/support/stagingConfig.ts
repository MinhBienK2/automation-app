import fs from "node:fs";

export type StagingTarget = {
  key: string;
  baseUrl: string;
  allowedDomains: string[];
  smoke?: {
    path?: string;
    expectedText?: string;
  };
};

export type StagingAccount = {
  label: string;
  usernameEnv?: string;
  passwordEnv?: string;
};

export type StagingConfig = {
  targets: StagingTarget[];
  accounts: StagingAccount[];
};

type TargetsFile = {
  targets?: StagingTarget[];
};

type AccountsFile = {
  accounts?: StagingAccount[];
};

export function stagingEnabled() {
  return process.env.E2E_STAGING === "1";
}

export function loadStagingConfig(): StagingConfig {
  if (!stagingEnabled()) {
    throw new Error("Set E2E_STAGING=1 before loading staging E2E config");
  }

  const targetsPath = requiredEnvPath("E2E_STAGING_TARGETS_FILE");
  const accountsPath = requiredEnvPath("E2E_STAGING_ACCOUNTS_FILE");
  const targetsFile = readJson<TargetsFile>(targetsPath);
  const accountsFile = readJson<AccountsFile>(accountsPath);
  const targets = targetsFile.targets ?? [];
  const accounts = accountsFile.accounts ?? [];

  if (targets.length === 0) {
    throw new Error("Staging E2E targets file must contain at least one target");
  }
  if (accounts.length === 0) {
    throw new Error("Staging E2E accounts file must contain at least one named account");
  }

  for (const target of targets) validateTarget(target);
  for (const account of accounts) validateAccount(account);

  return { targets, accounts };
}

export function smokeUrlForTarget(target: StagingTarget) {
  const url = new URL(target.smoke?.path ?? "/", target.baseUrl);
  assertUrlAllowed(url, target.allowedDomains);
  return url.toString();
}

export function assertUrlAllowed(url: URL, allowedDomains: string[]) {
  const hostname = url.hostname.toLowerCase();
  if (allowedDomains.some((domain) => hostnameAllowed(hostname, domain))) return;
  throw new Error(
    `Staging target ${url.toString()} is not covered by allowedDomains: ${allowedDomains.join(", ")}`,
  );
}

function validateTarget(target: StagingTarget) {
  if (!target.key?.trim()) throw new Error("Every staging target needs a key");
  if (!target.baseUrl?.trim()) throw new Error(`Staging target ${target.key} needs baseUrl`);
  const baseUrl = new URL(target.baseUrl);
  if (!["https:", "http:"].includes(baseUrl.protocol)) {
    throw new Error(`Staging target ${target.key} baseUrl must be http(s)`);
  }
  if (!target.allowedDomains?.length) {
    throw new Error(`Staging target ${target.key} needs allowedDomains`);
  }
  assertUrlAllowed(baseUrl, target.allowedDomains);
}

function validateAccount(account: StagingAccount) {
  if (!account.label?.trim()) throw new Error("Every staging account needs a label");
  for (const envName of [account.usernameEnv, account.passwordEnv]) {
    if (envName && !process.env[envName]) {
      throw new Error(`Staging account ${account.label} expects missing env var ${envName}`);
    }
  }
}

function requiredEnvPath(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required when E2E_STAGING=1`);
  return value;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function hostnameAllowed(hostname: string, allowedDomain: string) {
  const normalized = allowedDomain.trim().toLowerCase();
  return hostname === normalized || hostname.endsWith(`.${normalized}`);
}
