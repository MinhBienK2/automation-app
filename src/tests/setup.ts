import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

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
