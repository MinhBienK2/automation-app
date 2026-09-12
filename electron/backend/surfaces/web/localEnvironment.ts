export function localBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function localBrowserLocale() {
  return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
}
