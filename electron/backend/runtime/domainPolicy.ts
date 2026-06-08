type PageLike = {
  evaluate<T = unknown>(script: string): Promise<T>;
};

export async function currentPageHostname(page: PageLike) {
  const href = await page.evaluate<string>("window.location.href");
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function hostnameAllowed(hostname: string, domains: string[]) {
  return domains.some((domain) => {
    const normalized = normalizeDomain(domain);
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
}

export function normalizeDomain(domain: string) {
  try {
    return new URL(domain).hostname.toLowerCase();
  } catch {
    return domain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  }
}
