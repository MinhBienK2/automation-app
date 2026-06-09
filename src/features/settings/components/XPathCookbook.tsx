import { useMemo, useState } from "react";
import { Input } from "../../../components/ui/input";
import { HelpDisclosure } from "../../workflows/components/HelpDisclosure";

type XPathRecipe = {
  title: string;
  category: string;
  intent: string;
  examples: string[];
  avoid?: string[];
  notes: string[];
  tags: string[];
};

const xpathRecipes: XPathRecipe[] = [
  {
    title: "Button by exact text",
    category: "Text",
    intent: "Click a visible button whose label is stable.",
    examples: ["//button[normalize-space(.)='Save']", "//button[normalize-space(.)='Login']"],
    avoid: ["/html/body/div[2]/div[1]/button", "//*[contains(., 'Save')]"],
    notes: ["Use normalize-space when labels may include extra whitespace.", "Prefer a button tag when the action target must receive the click."],
    tags: ["button", "text", "click", "save", "login"],
  },
  {
    title: "Link by exact text",
    category: "Text",
    intent: "Open a link by its visible label.",
    examples: ["//a[normalize-space(.)='Forgot password?']", "//a[normalize-space(.)='Settings']"],
    notes: ["Use this when link text is unique on the page.", "Scope to a nav, card, or dialog when the same link appears more than once."],
    tags: ["link", "anchor", "text", "navigation"],
  },
  {
    title: "Partial visible text",
    category: "Text",
    intent: "Find content when only part of the visible text is stable.",
    examples: ["//*[contains(normalize-space(.), 'Welcome')]", "//*[contains(normalize-space(.), 'invoice #')]"],
    avoid: ["//*[contains(., 'a')]"],
    notes: ["Partial text can match too broadly; combine it with a tag or container when possible."],
    tags: ["contains", "partial", "text", "message"],
  },
  {
    title: "Exact word match",
    category: "Text",
    intent: "Match a standalone word without accidentally matching a longer word.",
    examples: ["//*[contains(concat(' ', normalize-space(.), ' '), ' Save ')]"],
    notes: ["Use this to avoid matching words like Autosave when searching for Save."],
    tags: ["word", "contains", "autosave", "exact"],
  },
  {
    title: "Case-insensitive text",
    category: "Advanced",
    intent: "Match text regardless of uppercase or lowercase differences.",
    examples: [
      "//*[translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='login']",
    ],
    notes: ["This is useful, but verbose. Prefer stable attributes when available."],
    tags: ["case", "uppercase", "lowercase", "advanced", "text"],
  },
  {
    title: "Stable attribute",
    category: "Attributes",
    intent: "Target elements with stable id, name, test id, ARIA label, or placeholder values.",
    examples: [
      "//*[@id='email']",
      "//*[@name='email']",
      "//*[@data-testid='email-input']",
      "//*[@aria-label='Search']",
      "//*[@placeholder='Enter email']",
    ],
    notes: ["Prefer data-testid, name, and aria-label over generated ids or generated classes."],
    tags: ["attribute", "id", "name", "testid", "aria", "placeholder"],
  },
  {
    title: "Dynamic attribute prefix",
    category: "Attributes",
    intent: "Match generated attributes when a stable prefix exists.",
    examples: ["//*[starts-with(@id, 'user-')]", "//*[starts-with(@data-testid, 'row-action-')]"],
    avoid: ["//*[@id='user-482931']"],
    notes: ["Use prefix matching only when the prefix is meaningful and stable."],
    tags: ["dynamic", "starts-with", "id", "testid", "prefix"],
  },
  {
    title: "Dynamic attribute contains",
    category: "Attributes",
    intent: "Match generated attributes when only a middle token is stable.",
    examples: ["//*[contains(@id, 'submit')]", "//*[contains(@data-testid, 'workflow-row')]"],
    notes: ["Contains is broader than starts-with; scope by tag or container when possible."],
    tags: ["dynamic", "contains", "id", "testid"],
  },
  {
    title: "Class token",
    category: "Attributes",
    intent: "Match one exact class token safely.",
    examples: ["//*[contains(concat(' ', normalize-space(@class), ' '), ' active ')]"],
    avoid: ["//*[contains(@class, 'btn')]"],
    notes: ["The token form avoids matching class names that merely contain the same letters."],
    tags: ["class", "active", "token", "state"],
  },
  {
    title: "Form field by label",
    category: "Forms",
    intent: "Find an input close to a visible label.",
    examples: ["//label[normalize-space(.)='Email']/following::input[1]", "//*[normalize-space(.)='Password']/following::input[@type='password'][1]"],
    notes: ["Use following::input[1] when the label and input are not direct siblings.", "Prefer @name when it is stable."],
    tags: ["form", "label", "input", "email", "password"],
  },
  {
    title: "Form field by native attributes",
    category: "Forms",
    intent: "Target common native form controls.",
    examples: [
      "//input[@name='email']",
      "//textarea[@name='message']",
      "//input[@type='checkbox' and @name='terms']",
      "//select[@name='country']",
    ],
    notes: ["For Select Option, XPath should point at the select element, not an option."],
    tags: ["form", "input", "textarea", "checkbox", "select"],
  },
  {
    title: "Button inside a form",
    category: "Scoped Targets",
    intent: "Avoid matching the same button label elsewhere on the page.",
    examples: ["//form[@id='login-form']//button[normalize-space(.)='Submit']", "//form[.//input[@name='email']]//button[@type='submit']"],
    notes: ["Scope from the smallest stable container, then find the target inside it."],
    tags: ["form", "button", "scope", "submit"],
  },
  {
    title: "Section action",
    category: "Scoped Targets",
    intent: "Click a repeated action inside one named section.",
    examples: ["//section[.//h2[normalize-space(.)='Billing']]//button[normalize-space(.)='Save']"],
    notes: ["This is safer than picking the first Save button on a settings page."],
    tags: ["section", "heading", "button", "scope", "billing"],
  },
  {
    title: "Card action",
    category: "Scoped Targets",
    intent: "Find an action inside a card identified by a title or name.",
    examples: [
      "//article[.//h3[normalize-space(.)='Project A']]//button[normalize-space(.)='Delete']",
      "//div[@data-card='workflow'][.//h3[normalize-space(.)='Main']]//button[normalize-space(.)='Run']",
    ],
    notes: ["Use this for repeated workflow, project, or profile cards."],
    tags: ["card", "article", "project", "workflow", "delete", "run"],
  },
  {
    title: "Table row",
    category: "Tables and Lists",
    intent: "Find a row by one cell value.",
    examples: ["//tr[.//td[normalize-space(.)='john@example.com']]", "//tr[.//td[contains(normalize-space(.), 'Pending')]]"],
    notes: ["First select the row, then target a button or field inside the row."],
    tags: ["table", "row", "td", "email", "status"],
  },
  {
    title: "Table row action",
    category: "Tables and Lists",
    intent: "Click an action in the row that contains a known value.",
    examples: ["//tr[.//td[normalize-space(.)='john@example.com']]//button[normalize-space(.)='Edit']"],
    notes: ["This avoids fragile indexes such as the second Edit button on the page."],
    tags: ["table", "row", "button", "edit", "email"],
  },
  {
    title: "List option",
    category: "Tables and Lists",
    intent: "Select an option inside a listbox or menu-like list.",
    examples: ["//*[@role='listbox']//*[@role='option' and normalize-space(.)='Vietnam']", "//ul[@role='listbox']//li[normalize-space(.)='Vietnam']"],
    notes: ["Use role-based scoping when custom dropdowns do not use native select elements."],
    tags: ["list", "option", "listbox", "dropdown", "vietnam"],
  },
  {
    title: "Dialog button by title",
    category: "Modal and Dialog",
    intent: "Click a button inside the intended dialog only.",
    examples: ["//*[@role='dialog' and .//h2[normalize-space(.)='Delete workflow']]//button[normalize-space(.)='Delete']"],
    notes: ["Always scope destructive dialog actions to the dialog title or description."],
    tags: ["dialog", "modal", "delete", "confirm", "button"],
  },
  {
    title: "Dialog close button",
    category: "Modal and Dialog",
    intent: "Close the currently visible modal or dialog.",
    examples: ["//*[@role='dialog']//button[@aria-label='Close']", "//*[@role='dialog']//*[@aria-label='Close']"],
    notes: ["Prefer aria-label when the close button is icon-only."],
    tags: ["dialog", "modal", "close", "aria", "icon"],
  },
  {
    title: "Menu action",
    category: "Dropdown and Menu",
    intent: "Click an action inside an open menu.",
    examples: ["//*[@role='menu']//button[normalize-space(.)='Delete']", "//*[contains(@class, 'dropdown-menu')]//*[normalize-space(.)='Edit']"],
    notes: ["Scope to the menu so background buttons with the same label are ignored."],
    tags: ["menu", "dropdown", "button", "delete", "edit"],
  },
  {
    title: "ARIA state",
    category: "State",
    intent: "Target controls by accessible runtime state.",
    examples: ["//*[@aria-expanded='true']", "//*[@aria-invalid='true']", "//*[@aria-hidden='false']"],
    notes: ["Useful for expanded dropdowns, invalid fields, and visible panels."],
    tags: ["aria", "expanded", "invalid", "hidden", "state"],
  },
  {
    title: "Native state",
    category: "State",
    intent: "Target native controls by browser state attributes.",
    examples: ["//button[@disabled]", "//input[@checked]", "//option[@selected]", "//button[not(@disabled)]"],
    notes: ["Use not(@disabled) when an enabled button is required."],
    tags: ["disabled", "checked", "selected", "enabled", "state"],
  },
  {
    title: "Parent button from child text",
    category: "Ancestor and Sibling",
    intent: "Click the real button when inspect selected a span, icon label, or child node.",
    examples: ["//*[normalize-space(.)='Save']/ancestor::button[1]", "//span[normalize-space(.)='Edit']/ancestor::button[1]"],
    notes: ["The clicked target should usually be the interactive parent, not the inner span."],
    tags: ["ancestor", "parent", "button", "span", "icon"],
  },
  {
    title: "Sibling field",
    category: "Ancestor and Sibling",
    intent: "Find a field near a label or heading.",
    examples: ["//label[normalize-space(.)='Email']/following-sibling::input", "//h2[normalize-space(.)='Settings']/following::button[normalize-space(.)='Save'][1]"],
    notes: ["Use [1] after following:: to keep the first matching control near the anchor text."],
    tags: ["sibling", "following", "label", "heading", "field"],
  },
  {
    title: "SVG icon button",
    category: "SVG and Icons",
    intent: "Target icon-only controls built from SVG.",
    examples: ["//*[local-name()='svg' and @aria-label='Search']", "//button[.//*[local-name()='svg'] and @aria-label='Settings']"],
    notes: ["SVG often needs local-name() because of XML namespaces.", "Prefer the parent button when clicking."],
    tags: ["svg", "icon", "button", "local-name", "aria"],
  },
  {
    title: "Iframe target",
    category: "Iframe",
    intent: "Target an element inside an iframe using the app's separate iframe field.",
    examples: ["Iframe XPath: //iframe[@title='Payment']", "Target XPath: //input[@name='cardNumber']"],
    notes: ["Do not combine iframe and target into one XPath.", "Set Iframe XPath for the frame on the parent page, then target XPath inside that frame."],
    tags: ["iframe", "frame", "payment", "card", "target"],
  },
  {
    title: "Index fallback",
    category: "Fallbacks",
    intent: "Pick a repeated element by position when no stable scope exists.",
    examples: ["(//button[normalize-space(.)='Edit'])[2]", "(//input[@type='text'])[last()]"],
    avoid: ["(//button)[7]"],
    notes: ["Use indexes as a last resort. Prefer row, card, section, or dialog scoping first."],
    tags: ["index", "position", "last", "fallback"],
  },
  {
    title: "Ends-with fallback",
    category: "Advanced",
    intent: "Match suffixes in XPath 1.0 where ends-with() is unavailable.",
    examples: ["//*[substring(@href, string-length(@href) - string-length('/settings') + 1) = '/settings']"],
    notes: ["This is advanced and hard to read; use only when suffix matching is truly needed."],
    tags: ["ends-with", "suffix", "href", "advanced"],
  },
  {
    title: "Shadow DOM warning",
    category: "Warnings",
    intent: "Understand why a valid-looking XPath cannot find an element.",
    examples: ["XPath does not normally cross a shadow root boundary."],
    notes: ["If the target is inside Shadow DOM, use a supported locator strategy or a dedicated shadow-DOM action path instead of plain XPath."],
    tags: ["shadow", "dom", "warning", "web component"],
  },
  {
    title: "Debug checklist",
    category: "Debug",
    intent: "Validate a selector before saving it into a workflow.",
    examples: ["Match exactly one element.", "Target the real interactive element.", "Scope to iframe, dialog, row, card, or section when needed."],
    notes: ["Avoid generated ids/classes.", "Confirm the element is visible and enabled.", "Prefer stable attributes before index-based selectors."],
    tags: ["debug", "checklist", "visible", "enabled", "stable"],
  },
];

export function XPathCookbook() {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredRecipes = useMemo(() => {
    if (!normalizedQuery) return xpathRecipes;

    return xpathRecipes.filter((recipe) =>
      recipeSearchText(recipe).includes(normalizedQuery),
    );
  }, [normalizedQuery]);

  return (
    <section className="panel settings-panel xpath-cookbook-panel" aria-label="XPath cookbook">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Help</p>
          <h2>XPath cookbook</h2>
        </div>
      </div>

      <div className="xpath-cookbook-search">
        <label htmlFor="xpath-cookbook-search">Search XPath recipes</label>
        <Input
          id="xpath-cookbook-search"
          value={searchQuery}
          placeholder="Search by iframe, table, modal, button, aria..."
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <p className="muted">
          {filteredRecipes.length} of {xpathRecipes.length} recipes
        </p>
      </div>

      <div className="xpath-recipe-list">
        {filteredRecipes.map((recipe, index) => (
          <HelpDisclosure
            className="xpath-recipe"
            defaultOpen={Boolean(normalizedQuery) || index < 4}
            key={`${recipe.category}-${recipe.title}`}
            title={
              <span className="xpath-recipe-title">
                <span>{recipe.title}</span>
                <span>{recipe.category}</span>
              </span>
            }
          >
            <p>{recipe.intent}</p>
            <div className="xpath-recipe-examples" aria-label={`${recipe.title} examples`}>
              {recipe.examples.map((example) => (
                <code key={example}>{example}</code>
              ))}
            </div>
            {recipe.avoid?.length ? (
              <div className="xpath-recipe-block">
                <strong>Avoid</strong>
                <ul>
                  {recipe.avoid.map((item) => (
                    <li key={item}>
                      <code>{item}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="xpath-recipe-block">
              <strong>Notes</strong>
              <ul>
                {recipe.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </HelpDisclosure>
        ))}
      </div>

      {filteredRecipes.length === 0 ? (
        <p className="muted" role="status">
          No XPath recipes match this search.
        </p>
      ) : null}
    </section>
  );
}

function recipeSearchText(recipe: XPathRecipe) {
  return [
    recipe.title,
    recipe.category,
    recipe.intent,
    ...recipe.examples,
    ...(recipe.avoid ?? []),
    ...recipe.notes,
    ...recipe.tags,
  ].join(" ").toLowerCase();
}
