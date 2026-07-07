export function getPath(obj: any, pathStr: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = pathStr.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

export function setPath(obj: any, pathStr: string, value: any): void {
  if (!obj || typeof obj !== "object") return;
  const parts = pathStr.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

export function deletePath(obj: any, pathStr: string): void {
  if (!obj || typeof obj !== "object") return;
  const parts = pathStr.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current === null || current === undefined || typeof current !== "object") {
      return;
    }
    current = current[part];
  }
  if (current && typeof current === "object") {
    delete current[parts[parts.length - 1]];
  }
}

export function hasPath(obj: any, pathStr: string): boolean {
  if (!obj || typeof obj !== "object") return false;
  const parts = pathStr.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current === null || current === undefined || typeof current !== "object" || !(part in current)) {
      return false;
    }
    current = current[part];
  }
  return current !== null && current !== undefined && typeof current === "object" && parts[parts.length - 1] in current;
}
