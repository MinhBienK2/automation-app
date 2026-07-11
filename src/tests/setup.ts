import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Load .env manually for tests if process.env.MONGODB_URI is not set
if (!process.env.MONGODB_URI) {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let val = match[2].trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
          }
          process.env[key] = val;
        }
      }
    }
  } catch (e) {
    console.error("Failed to load .env in test setup", e);
  }
}

class MockCollection {
  private data: any[] = [];
  async insertMany(docs: any[]) {
    this.data.push(...docs);
    return { insertedIds: docs.map((_, i) => i) };
  }
  async deleteMany(_query: any) {
    this.data = [];
    return { deletedCount: 0 };
  }
  find(query: any) {
    let filtered = [...this.data];
    if (query && Object.keys(query).length > 0) {
      filtered = filtered.filter(doc => {
        for (const [key, val] of Object.entries(query)) {
          if (doc[key] !== val) return false;
        }
        return true;
      });
    }
    return {
      sort(sortQuery: any) {
        if (sortQuery && sortQuery.step_number) {
          const dir = sortQuery.step_number;
          filtered.sort((a, b) => (a.step_number - b.step_number) * dir);
        }
        return {
          toArray: async () => filtered,
        };
      },
      toArray: async () => filtered,
    };
  }
  async countDocuments(query: any) {
    let filtered = [...this.data];
    if (query && Object.keys(query).length > 0) {
      filtered = filtered.filter(doc => {
        for (const [key, val] of Object.entries(query)) {
          if (doc[key] !== val) return false;
        }
        return true;
      });
    }
    return filtered.length;
  }
}

const mockCollections: Record<string, MockCollection> = {};

vi.mock("../../electron/backend/db/mongo.js", () => {
  return {
    getMongoClient: async () => ({}),
    getMongoCollection: async (name: string) => {
      if (!mockCollections[name]) {
        mockCollections[name] = new MockCollection();
      }
      return mockCollections[name];
    },
    closeMongoClient: async () => {},
  };
});

class DOMMatrixReadOnlyMock {
  m22 = 1;

  constructor(transform?: string) {
    const scaleMatch = transform?.match(/scale\(([^)]+)\)/);
    if (scaleMatch) {
      this.m22 = Number(scaleMatch[1]) || 1;
    }
  }
}

const resizeObserverTargets = new WeakSet<Element>();

class ResizeObserverMock implements ResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    if (resizeObserverTargets.has(target)) return;
    resizeObserverTargets.add(target);

    const contentRect = {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      top: 0,
      right: 800,
      bottom: 600,
      left: 0,
      toJSON: () => ({}),
    } as DOMRectReadOnly;

    queueMicrotask(() => {
      this.callback(
        [
          {
            target,
            contentRect,
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          } as ResizeObserverEntry,
        ],
        this,
      );
    });
  }

  unobserve() {}
  disconnect() {}
}

if (typeof HTMLElement !== "undefined") {
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: {
      configurable: true,
      get() {
        return this.classList?.contains("react-flow__node") ? 64 : 600;
      },
    },
    offsetWidth: {
      configurable: true,
      get() {
        return this.classList?.contains("react-flow__node") ? 160 : 800;
      },
    },
  });
}

if (typeof SVGElement !== "undefined") {
  const svgPrototype = SVGElement.prototype as unknown as {
    getBBox?: () => DOMRect;
  };

  if (!svgPrototype.getBBox) {
    svgPrototype.getBBox = () => ({
      x: 0,
      y: 0,
      width: 80,
      height: 20,
    } as DOMRect);
  }
}

if (typeof window !== "undefined") {
  vi.stubGlobal("DOMMatrixReadOnly", DOMMatrixReadOnlyMock);
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
