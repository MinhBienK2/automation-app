// @vitest-environment node
import { describe, expect, test } from "vitest";
import { parseRoutes, findRouteForFile } from "./agent-router.mjs";

const sampleMarkdown = `
# Task Routes

### Understand Product Or Plan Broad Work
- **Read**: \`domain/product-model.md\`, \`architecture/overview.md\`

### Change Evidence Explorer
- **Read**: \`domain/invariants/runner.md\`, \`architecture/frontend.md\`
- **Verify**: \`src/features/evidence/\`, \`electron/backend/evidence/\`, \`electron/backend/commands.ts\`
- **Checks**: \`npm test -- electron/backend/commands.test.ts\`

### Fix A Bug
- **Read**: \`docs/domain/cross-feature-impact-map.md\`
- **Checks**: \`npm test\`
`;

describe("Agent Router", () => {
  test("parseRoutes parses routes correctly from markdown", () => {
    const routes = parseRoutes(sampleMarkdown);
    expect(routes.length).toBe(3);
    
    expect(routes[0].name).toBe("Understand Product Or Plan Broad Work");
    expect(routes[0].read).toContain("docs/domain/product-model.md");
    
    expect(routes[1].name).toBe("Change Evidence Explorer");
    expect(routes[1].verify).toContain("src/features/evidence/");
    expect(routes[1].checks).toContain("npm test -- electron/backend/commands.test.ts");
  });

  test("findRouteForFile matches file correctly by exact verify match", () => {
    const routes = parseRoutes(sampleMarkdown);
    
    const match = findRouteForFile("electron/backend/commands.ts", routes);
    expect(match).not.toBeNull();
    expect(match.route.name).toBe("Change Evidence Explorer");
    expect(match.score).toBe(3);
  });

  test("findRouteForFile matches file correctly by verify directory prefix", () => {
    const routes = parseRoutes(sampleMarkdown);
    
    const match = findRouteForFile("src/features/evidence/pages/EvidencePage.tsx", routes);
    expect(match).not.toBeNull();
    expect(match.route.name).toBe("Change Evidence Explorer");
    expect(match.score).toBe(2);
  });

  test("findRouteForFile matches file correctly by read prefix as fallback", () => {
    const routes = parseRoutes(sampleMarkdown);
    
    const match = findRouteForFile("docs/domain/product-model.md", routes);
    expect(match).not.toBeNull();
    expect(match.route.name).toBe("Understand Product Or Plan Broad Work");
    expect(match.score).toBe(1);
  });

  test("findRouteForFile returns null if no match found", () => {
    const routes = parseRoutes(sampleMarkdown);
    
    const match = findRouteForFile("some/unknown/file.txt", routes);
    expect(match).toBeNull();
  });
});
