import { test, expect } from "./support/electronFixture";
import { createAndRunGraph } from "./support/workflows";
import type {
  ActionConfig,
  ElementTarget,
  GraphEdge,
  GraphNode,
  WorkflowGraph,
} from "../../src/types/workflow";

const REAL_WEB_RUN_TIMEOUT_MS = 90_000;
const REAL_WEB_TEST_TIMEOUT_MS = 150_000;

test.describe("real-world public website workflow journeys", () => {
  test.skip(
    process.env.E2E_REAL_WEB !== "1",
    "Set E2E_REAL_WEB=1 to run workflows against public external websites.",
  );
  test.describe.configure({ mode: "serial" });

  test("reads reference and documentation pages across real external tabs", async ({
    appWindow,
  }, testInfo) => {
    test.setTimeout(REAL_WEB_TEST_TIMEOUT_MS);
    testInfo.annotations.push(
      { type: "external sites", description: "example.com, playwright.dev" },
      {
        type: "nodes",
        description: "navigate, domain_allowlist, extract_text, extract_attribute, open_new_tab, switch_tab, close_tab",
      },
      {
        type: "real-web depth",
        description: "Read-only workflow over documentation/reference domains with tab continuity.",
      },
    );

    const { state } = await createAndRunGraph(
      appWindow,
      "Real web reference and docs",
      realWebGraph(["example.com", "playwright.dev"], [
        {
          id: "navigate-example",
          label: "Navigate Example Domain",
          config: {
            type: "navigate",
            config: { url: "https://example.com/", wait_until: "dom_content_loaded" },
          },
        },
        {
          id: "extract-example-heading",
          label: "Extract Example Heading",
          config: {
            type: "extract_text",
            config: { target: roleTarget("heading", "Example Domain"), output_name: "example_heading" },
          },
        },
        {
          id: "extract-example-link",
          label: "Extract Example Link",
          config: {
            type: "extract_attribute",
            config: { target: cssTarget("a"), attribute: "href", output_name: "example_link" },
          },
        },
        {
          id: "open-playwright-docs",
          label: "Open Playwright Docs",
          config: { type: "open_new_tab", config: { url: "https://playwright.dev/docs/intro" } },
        },
        {
          id: "switch-playwright-tab",
          label: "Switch Playwright Tab",
          config: { type: "switch_tab", config: { index: 1 } },
        },
        {
          id: "wait-playwright-heading",
          label: "Wait Playwright Heading",
          config: {
            type: "wait",
            config: { condition: "element_visible", target: cssTarget("main h1"), timeout_ms: 30_000 },
          },
        },
        {
          id: "extract-playwright-heading",
          label: "Extract Playwright Heading",
          config: {
            type: "extract_text",
            config: { target: cssTarget("main h1"), output_name: "playwright_heading" },
          },
        },
        {
          id: "close-playwright-tab",
          label: "Close Playwright Tab",
          config: { type: "close_tab", config: { index: 1 } },
        },
        {
          id: "switch-example-tab",
          label: "Switch Example Tab",
          config: { type: "switch_tab", config: { index: 0 } },
        },
        {
          id: "extract-example-after-tab",
          label: "Extract Example After Tab",
          config: {
            type: "extract_text",
            config: { target: roleTarget("heading", "Example Domain"), output_name: "example_heading_after_tab" },
          },
        },
      ]),
      { timeoutMs: REAL_WEB_RUN_TIMEOUT_MS },
    );

    expect(state.outputs.example_heading).toBe("Example Domain");
    expect(state.outputs.example_link).toBe("https://iana.org/domains/example");
    expect(state.outputs.playwright_heading).toBe("Installation");
    expect(state.outputs.example_heading_after_tab).toBe("Example Domain");
  });

  test("completes a real demo-commerce checkout workflow", async ({ appWindow }, testInfo) => {
    test.setTimeout(REAL_WEB_TEST_TIMEOUT_MS);
    testInfo.annotations.push(
      { type: "external site", description: "www.saucedemo.com" },
      {
        type: "nodes",
        description:
          "navigate, domain_allowlist, input_text, click, wait(url_contains/text_visible), select_option, extract_text",
      },
      {
        type: "real-web depth",
        description: "Uses the public Sauce Demo application credentials and completes an inventory/cart/checkout journey.",
      },
    );

    const { state } = await createAndRunGraph(
      appWindow,
      "Real web demo commerce checkout",
      realWebGraph(["www.saucedemo.com"], [
        {
          id: "navigate-sauce-demo",
          label: "Navigate Sauce Demo",
          config: {
            type: "navigate",
            config: { url: "https://www.saucedemo.com/", wait_until: "dom_content_loaded" },
          },
        },
        {
          id: "fill-demo-username",
          label: "Fill Demo Username",
          config: {
            type: "input_text",
            config: {
              target: cssTarget("#user-name"),
              text: "standard_user",
              clear_before_input: true,
              timeout_ms: 30_000,
            },
          },
        },
        {
          id: "fill-demo-password",
          label: "Fill Demo Password",
          config: {
            type: "input_text",
            config: {
              target: attributeTarget("data-test", "password"),
              text: "secret_sauce",
              clear_before_input: true,
            },
          },
        },
        {
          id: "submit-demo-login",
          label: "Submit Demo Login",
          config: { type: "click", config: { target: attributeTarget("data-test", "login-button") } },
        },
        {
          id: "wait-inventory-url",
          label: "Wait Inventory URL",
          config: { type: "wait", config: { condition: "url_contains", url: "/inventory.html", timeout_ms: 30_000 } },
        },
        {
          id: "sort-products-low-high",
          label: "Sort Products Low High",
          config: {
            type: "select_option",
            config: {
              target: attributeTarget("data-test", "product-sort-container"),
              match_by: "value",
              value: "lohi",
            },
          },
        },
        {
          id: "add-backpack-to-cart",
          label: "Add Backpack To Cart",
          config: { type: "click", config: { target: attributeTarget("data-test", "add-to-cart-sauce-labs-backpack") } },
        },
        {
          id: "open-cart",
          label: "Open Cart",
          config: { type: "click", config: { target: attributeTarget("data-test", "shopping-cart-link") } },
        },
        {
          id: "wait-cart-item",
          label: "Wait Cart Item",
          config: { type: "wait", config: { condition: "text_visible", text: "Sauce Labs Backpack", timeout_ms: 30_000 } },
        },
        {
          id: "checkout",
          label: "Checkout",
          config: { type: "click", config: { target: attributeTarget("data-test", "checkout") } },
        },
        {
          id: "fill-first-name",
          label: "Fill First Name",
          config: {
            type: "input_text",
            config: { target: attributeTarget("data-test", "firstName"), text: "Real", clear_before_input: true },
          },
        },
        {
          id: "fill-last-name",
          label: "Fill Last Name",
          config: {
            type: "input_text",
            config: { target: attributeTarget("data-test", "lastName"), text: "Workflow", clear_before_input: true },
          },
        },
        {
          id: "fill-postal-code",
          label: "Fill Postal Code",
          config: {
            type: "input_text",
            config: { target: attributeTarget("data-test", "postalCode"), text: "10001", clear_before_input: true },
          },
        },
        {
          id: "continue-checkout",
          label: "Continue Checkout",
          config: { type: "click", config: { target: attributeTarget("data-test", "continue") } },
        },
        {
          id: "extract-order-summary",
          label: "Extract Order Summary",
          config: {
            type: "extract_text",
            config: { target: cssTarget(".summary_info"), output_name: "order_summary" },
          },
        },
        {
          id: "finish-checkout",
          label: "Finish Checkout",
          config: { type: "click", config: { target: attributeTarget("data-test", "finish") } },
        },
        {
          id: "extract-checkout-complete",
          label: "Extract Checkout Complete",
          config: {
            type: "extract_text",
            config: { target: attributeTarget("data-test", "complete-header"), output_name: "checkout_complete" },
          },
        },
      ]),
      { timeoutMs: REAL_WEB_RUN_TIMEOUT_MS },
    );

    expect(String(state.outputs.order_summary)).toContain("Payment Information");
    expect(String(state.outputs.order_summary)).toContain("Total");
    expect(String(state.outputs.checkout_complete).toLowerCase()).toContain("thank you");
  });

  test("extracts paginated catalog and quote content from public scraping sandboxes", async ({
    appWindow,
  }, testInfo) => {
    test.setTimeout(REAL_WEB_TEST_TIMEOUT_MS);
    testInfo.annotations.push(
      { type: "external sites", description: "books.toscrape.com, quotes.toscrape.com" },
      {
        type: "nodes",
        description: "navigate, domain_allowlist, extract_text, extract_list, click, wait(url_contains)",
      },
      {
        type: "real-web depth",
        description: "Read-only catalog/list extraction and pagination over public scraping practice websites.",
      },
    );

    const { state } = await createAndRunGraph(
      appWindow,
      "Real web catalogs and quotes",
      realWebGraph(["books.toscrape.com", "quotes.toscrape.com"], [
        {
          id: "navigate-books",
          label: "Navigate Books",
          config: {
            type: "navigate",
            config: { url: "https://books.toscrape.com/", wait_until: "dom_content_loaded" },
          },
        },
        {
          id: "extract-books-heading",
          label: "Extract Books Heading",
          config: {
            type: "extract_text",
            config: { target: cssTarget(".header .h1 a"), output_name: "books_heading" },
          },
        },
        {
          id: "extract-books-page-one",
          label: "Extract Books Page One",
          config: {
            type: "extract_list",
            config: { target: cssTarget(".product_pod h3 a"), output_name: "book_titles_page_one" },
          },
        },
        {
          id: "next-books-page",
          label: "Next Books Page",
          config: { type: "click", config: { target: cssTarget(".pager .next a") } },
        },
        {
          id: "wait-books-page-two",
          label: "Wait Books Page Two",
          config: { type: "wait", config: { condition: "url_contains", url: "page-2.html", timeout_ms: 30_000 } },
        },
        {
          id: "extract-books-page-two",
          label: "Extract Books Page Two",
          config: {
            type: "extract_list",
            config: { target: cssTarget(".product_pod h3 a"), output_name: "book_titles_page_two" },
          },
        },
        {
          id: "navigate-quotes",
          label: "Navigate Quotes",
          config: {
            type: "navigate",
            config: { url: "https://quotes.toscrape.com/", wait_until: "dom_content_loaded" },
          },
        },
        {
          id: "extract-quote-authors",
          label: "Extract Quote Authors",
          config: {
            type: "extract_list",
            config: { target: cssTarget(".quote .author"), output_name: "quote_authors_page_one" },
          },
        },
        {
          id: "next-quotes-page",
          label: "Next Quotes Page",
          config: { type: "click", config: { target: cssTarget(".pager .next a") } },
        },
        {
          id: "wait-quotes-page-two",
          label: "Wait Quotes Page Two",
          config: { type: "wait", config: { condition: "url_contains", url: "/page/2/", timeout_ms: 30_000 } },
        },
        {
          id: "extract-quote-tags",
          label: "Extract Quote Tags",
          config: {
            type: "extract_list",
            config: { target: cssTarget(".quote .tag"), output_name: "quote_tags_page_two" },
          },
        },
      ]),
      { timeoutMs: REAL_WEB_RUN_TIMEOUT_MS },
    );

    expect(state.outputs.books_heading).toBe("Books to Scrape");
    expect(state.outputs.book_titles_page_one).toEqual(
      expect.arrayContaining([expect.stringContaining("A Light in the")]),
    );
    expect(state.outputs.book_titles_page_two).toEqual(
      expect.arrayContaining([expect.stringContaining("In Her Wake")]),
    );
    expect(state.outputs.quote_authors_page_one).toEqual(expect.arrayContaining(["Albert Einstein"]));
    expect(state.outputs.quote_tags_page_two).toEqual(expect.arrayContaining(["friends"]));
  });

  test("handles public form auth, dynamic loading, and browser alert flows", async ({
    appWindow,
  }, testInfo) => {
    test.setTimeout(REAL_WEB_TEST_TIMEOUT_MS);
    testInfo.annotations.push(
      { type: "external site", description: "the-internet.herokuapp.com" },
      {
        type: "nodes",
        description: "navigate, domain_allowlist, input_text, click, wait(text_visible), accept_dialog, extract_text",
      },
      {
        type: "real-web depth",
        description: "Exercises login, asynchronous page state, and JavaScript alert handling on a public automation practice app.",
      },
    );

    const { state } = await createAndRunGraph(
      appWindow,
      "Real web auth dynamic alert",
      realWebGraph(["the-internet.herokuapp.com"], [
        {
          id: "navigate-internet-login",
          label: "Navigate Internet Login",
          config: {
            type: "navigate",
            config: { url: "https://the-internet.herokuapp.com/login", wait_until: "dom_content_loaded" },
          },
        },
        {
          id: "fill-internet-username",
          label: "Fill Internet Username",
          config: {
            type: "input_text",
            config: { target: cssTarget("#username"), text: "tomsmith", clear_before_input: true },
          },
        },
        {
          id: "fill-internet-password",
          label: "Fill Internet Password",
          config: {
            type: "input_text",
            config: { target: cssTarget("#password"), text: "SuperSecretPassword!", clear_before_input: true },
          },
        },
        {
          id: "submit-internet-login",
          label: "Submit Internet Login",
          config: { type: "click", config: { target: cssTarget("button[type='submit']") } },
        },
        {
          id: "wait-secure-area",
          label: "Wait Secure Area",
          config: {
            type: "wait",
            config: { condition: "text_visible", text: "You logged into a secure area!", timeout_ms: 30_000 },
          },
        },
        {
          id: "extract-login-flash",
          label: "Extract Login Flash",
          config: {
            type: "extract_text",
            config: { target: cssTarget("#flash"), output_name: "login_flash" },
          },
        },
        {
          id: "navigate-dynamic-loading",
          label: "Navigate Dynamic Loading",
          config: {
            type: "navigate",
            config: { url: "https://the-internet.herokuapp.com/dynamic_loading/1", wait_until: "dom_content_loaded" },
          },
        },
        {
          id: "start-dynamic-loading",
          label: "Start Dynamic Loading",
          config: { type: "click", config: { target: cssTarget("#start button") } },
        },
        {
          id: "wait-dynamic-finish",
          label: "Wait Dynamic Finish",
          config: { type: "wait", config: { condition: "text_visible", text: "Hello World!", timeout_ms: 30_000 } },
        },
        {
          id: "extract-dynamic-finish",
          label: "Extract Dynamic Finish",
          config: {
            type: "extract_text",
            config: { target: cssTarget("#finish"), output_name: "dynamic_finish" },
          },
        },
        {
          id: "navigate-alerts",
          label: "Navigate Alerts",
          config: {
            type: "navigate",
            config: { url: "https://the-internet.herokuapp.com/javascript_alerts", wait_until: "dom_content_loaded" },
          },
        },
        {
          id: "accept-alert",
          label: "Accept Alert",
          config: { type: "accept_dialog", config: {} },
        },
        {
          id: "click-alert",
          label: "Click Alert",
          config: { type: "click", config: { target: cssTarget("button[onclick='jsAlert()']") } },
        },
        {
          id: "wait-alert-result",
          label: "Wait Alert Result",
          config: {
            type: "wait",
            config: { condition: "text_visible", text: "You successfully clicked an alert", timeout_ms: 30_000 },
          },
        },
        {
          id: "extract-alert-result",
          label: "Extract Alert Result",
          config: {
            type: "extract_text",
            config: { target: cssTarget("#result"), output_name: "alert_result" },
          },
        },
      ]),
      { timeoutMs: REAL_WEB_RUN_TIMEOUT_MS },
    );

    expect(String(state.outputs.login_flash)).toContain("You logged into a secure area!");
    expect(String(state.outputs.dynamic_finish).trim()).toBe("Hello World!");
    expect(String(state.outputs.alert_result).trim()).toBe("You successfully clicked an alert");
  });
});

function realWebGraph(
  domains: string[],
  steps: Array<{ id: string; label: string; config: ActionConfig }>,
): WorkflowGraph {
  const [firstStep, ...remainingSteps] = steps;
  if (!firstStep) throw new Error("realWebGraph requires at least one step");

  const nodes: GraphNode[] = [
    {
      id: "start",
      node_type: "start",
      label: "Start",
      position: { x: 0, y: 0 },
      config: null,
      ports: [{ id: "out", label: "Out", direction: "output" }],
    },
    actionNode(firstStep, 1),
    {
      id: "allow-real-web-domains",
      node_type: "domain_allowlist",
      label: "Allow Real Web Domains",
      position: { x: 440, y: 0 },
      config: { domains: [...new Set(domains)] },
      ports: [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
      ],
    },
    ...remainingSteps.map((step, index) => actionNode(step, index + 3)),
  ];

  const chain = ["start", firstStep.id, "allow-real-web-domains", ...remainingSteps.map((step) => step.id)];
  const edges: GraphEdge[] = [];
  for (let index = 1; index < chain.length; index += 1) {
    const sourceNodeId = chain[index - 1]!;
    const targetNodeId = chain[index]!;
    edges.push({
      id: `edge-${sourceNodeId}-${targetNodeId}`,
      source_node_id: sourceNodeId,
      source_port: "out",
      target_node_id: targetNodeId,
      target_port: "in",
    });
  }

  return {
    version: 2,
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
  };
}

function actionNode(
  step: { id: string; label: string; config: ActionConfig },
  column: number,
): GraphNode {
  return {
    id: step.id,
    node_type: "action",
    label: step.label,
    position: { x: column * 220, y: 0 },
    config: step.config,
    ports: [
      { id: "in", label: "In", direction: "input" },
      { id: "out", label: "Out", direction: "output" },
    ],
  };
}

function cssTarget(selector: string): ElementTarget {
  return { locators: [{ kind: "css", value: selector }] };
}

function attributeTarget(attribute: string, value: string): ElementTarget {
  return { locators: [{ kind: "attribute", attribute, value }] };
}

function roleTarget(role: string, name: string): ElementTarget {
  return { locators: [{ kind: "role", role, value: name, exact: true }] };
}
