use chromiumoxide::Page;
use serde::Deserialize;

use crate::{domain::ElementTarget, runner::RunnerError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ResolvedTarget {
    pub xpath: String,
    pub iframe_xpath: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ResolveTargetResult {
    ok: bool,
    reason: String,
    xpath: Option<String>,
    iframe_xpath: Option<String>,
}

pub(super) async fn resolve_element_target(
    page: &Page,
    target: Option<&ElementTarget>,
    legacy_xpath: Option<&str>,
    legacy_iframe_xpath: Option<&str>,
) -> Result<Option<ResolvedTarget>, RunnerError> {
    let Some(target) = target else {
        return Ok(legacy_xpath.map(|xpath| ResolvedTarget {
            xpath: xpath.to_string(),
            iframe_xpath: legacy_iframe_xpath.map(ToString::to_string),
        }));
    };

    let script = target_resolution_script(target)?;
    let result: ResolveTargetResult = page.evaluate(script).await?.into_value()?;
    if !result.ok {
        return Err(RunnerError::ActionFailed(result.reason));
    }

    let xpath = result
        .xpath
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| RunnerError::ActionFailed("Target resolver did not return XPath".into()))?;
    Ok(Some(ResolvedTarget {
        xpath,
        iframe_xpath: result
            .iframe_xpath
            .filter(|value| !value.trim().is_empty())
            .or_else(|| legacy_iframe_xpath.map(ToString::to_string)),
    }))
}

pub(super) async fn resolve_required_element_target(
    page: &Page,
    target: Option<&ElementTarget>,
    legacy_xpath: &str,
    legacy_iframe_xpath: Option<&str>,
) -> Result<ResolvedTarget, RunnerError> {
    resolve_element_target(page, target, Some(legacy_xpath), legacy_iframe_xpath)
        .await?
        .ok_or_else(|| RunnerError::ActionFailed("Element target is required".into()))
}

pub(super) fn target_resolution_script(target: &ElementTarget) -> Result<String, RunnerError> {
    let target_json = serde_json::to_string(target)?;
    Ok(String::from(
        r#"
        (() => {
          const target = "#,
    ) + &target_json
        + r#";

          const xpathLiteral = (value) => {
            if (!value.includes("'")) return `'${value}'`;
            if (!value.includes('"')) return `"${value}"`;
            return `concat(${value.split("'").map((part) => `'${part}'`).join(`, "\"", `)})`;
          };

          const absoluteXPath = (node) => {
            if (!node || node.nodeType !== Node.ELEMENT_NODE) return "";
            if (node.id) return `//*[@id=${xpathLiteral(node.id)}]`;
            const parts = [];
            let current = node;
            while (current && current.nodeType === Node.ELEMENT_NODE) {
              const tag = current.localName.toLowerCase();
              let index = 1;
              let sibling = current.previousElementSibling;
              while (sibling) {
                if (sibling.localName.toLowerCase() === tag) index += 1;
                sibling = sibling.previousElementSibling;
              }
              parts.unshift(`${tag}[${index}]`);
              current = current.parentElement;
            }
            return "/" + parts.join("/");
          };

          const cssEscape = (value) => {
            if (globalThis.CSS?.escape) return CSS.escape(value);
            return String(value).replace(/["\\]/g, "\\$&");
          };

          const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
          const textMatches = (actual, expected, exact) => {
            const lhs = normalize(actual);
            const rhs = normalize(expected);
            return exact ? lhs === rhs : lhs.includes(rhs);
          };
          const visible = (node) => {
            if (!node || !node.getBoundingClientRect) return false;
            const view = node.ownerDocument.defaultView;
            const style = view.getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
          };
          const enabled = (node) => !node.disabled && node.getAttribute?.("aria-disabled") !== "true";
          const implicitRole = (node) => {
            const tag = node.localName?.toLowerCase();
            if (tag === "button") return "button";
            if (tag === "a" && node.hasAttribute("href")) return "link";
            if (tag === "input") {
              const type = (node.getAttribute("type") || "text").toLowerCase();
              if (type === "checkbox") return "checkbox";
              if (type === "radio") return "radio";
              if (["button", "submit", "reset"].includes(type)) return "button";
              return "textbox";
            }
            if (tag === "textarea") return "textbox";
            if (tag === "select") return "combobox";
            return "";
          };
          const accessibleName = (node) => {
            const doc = node.ownerDocument;
            const labelledBy = node.getAttribute?.("aria-labelledby");
            if (labelledBy) {
              const text = labelledBy.split(/\s+/).map((id) => doc.getElementById(id)?.innerText || "").join(" ");
              if (normalize(text)) return text;
            }
            const aria = node.getAttribute?.("aria-label");
            if (aria) return aria;
            if (node.id) {
              const label = doc.querySelector(`label[for="${cssEscape(node.id)}"]`);
              if (label) return label.innerText;
            }
            return node.innerText || node.value || node.getAttribute?.("title") || "";
          };
          const allElements = (doc) => Array.from(doc.querySelectorAll("*"));
          const byXPath = (doc, xpath) => {
            const snapshot = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            const nodes = [];
            for (let i = 0; i < snapshot.snapshotLength; i += 1) nodes.push(snapshot.snapshotItem(i));
            return nodes.filter((node) => node instanceof Element);
          };
          const queryLocator = (doc, locator) => {
            const value = locator.value || "";
            const exact = locator.exact === true;
            try {
              if (locator.kind === "test_id") {
                const escaped = cssEscape(value);
                return Array.from(doc.querySelectorAll(`[data-testid="${escaped}"],[data-test="${escaped}"],[data-cy="${escaped}"]`));
              }
              if (locator.kind === "css") return Array.from(doc.querySelectorAll(value));
              if (locator.kind === "xpath") return byXPath(doc, value);
              if (locator.kind === "placeholder") {
                return allElements(doc).filter((node) => textMatches(node.getAttribute?.("placeholder"), value, exact));
              }
              if (locator.kind === "label") {
                const labels = Array.from(doc.querySelectorAll("label")).filter((label) => textMatches(label.innerText, value, exact));
                return labels.map((label) => label.control || (label.getAttribute("for") ? doc.getElementById(label.getAttribute("for")) : null)).filter(Boolean);
              }
              if (locator.kind === "text") {
                return allElements(doc).filter((node) => textMatches(node.innerText || node.textContent, value, exact));
              }
              if (locator.kind === "role") {
                const role = locator.role || value;
                return allElements(doc).filter((node) => {
                  const nodeRole = node.getAttribute?.("role") || implicitRole(node);
                  return nodeRole === role && (!locator.role || textMatches(accessibleName(node), value, exact));
                });
              }
              if (locator.kind === "attribute") {
                const attribute = locator.attribute || "";
                return allElements(doc).filter((node) => textMatches(node.getAttribute?.(attribute), value, exact));
              }
            } catch (error) {
              return [];
            }
            return [];
          };
          const applyConstraints = (nodes, constraints) => {
            if (!constraints) return nodes;
            let candidates = nodes;
            if (constraints.visible === true) candidates = candidates.filter(visible);
            if (constraints.visible === false) candidates = candidates.filter((node) => !visible(node));
            if (constraints.enabled === true) candidates = candidates.filter(enabled);
            if (constraints.enabled === false) candidates = candidates.filter((node) => !enabled(node));
            if (constraints.contains_text) {
              candidates = candidates.filter((node) => textMatches(node.innerText || node.textContent || node.value, constraints.contains_text, false));
            }
            if (Number.isInteger(constraints.index)) {
              const node = candidates[constraints.index];
              return node ? [node] : [];
            }
            return candidates;
          };
          const resolveInDocument = (doc, spec) => {
            for (const locator of spec.locators || []) {
              const candidates = applyConstraints(queryLocator(doc, locator), spec.constraints);
              if (candidates.length > 0) return candidates[0];
            }
            return null;
          };

          let rootDocument = document;
          let iframeXPath = null;
          if (target.iframe) {
            const iframe = resolveInDocument(document, target.iframe);
            if (!iframe) return { ok: false, reason: "Target iframe not found" };
            if (!iframe.contentDocument) return { ok: false, reason: "Target iframe document is not accessible" };
            rootDocument = iframe.contentDocument;
            iframeXPath = absoluteXPath(iframe);
          }

          const node = resolveInDocument(rootDocument, target);
          if (!node) return { ok: false, reason: "Target not found" };
          return { ok: true, reason: "", xpath: absoluteXPath(node), iframe_xpath: iframeXPath };
        })()
        "#)
}

#[cfg(test)]
mod tests {
    use crate::domain::{ElementLocator, ElementLocatorKind};

    use super::*;

    #[test]
    fn target_resolution_script_contains_ordered_locator_support() {
        let target = ElementTarget {
            locators: vec![
                ElementLocator {
                    kind: ElementLocatorKind::TestId,
                    value: "submit".to_string(),
                    role: None,
                    attribute: None,
                    exact: None,
                },
                ElementLocator {
                    kind: ElementLocatorKind::Role,
                    value: "Submit".to_string(),
                    role: Some("button".to_string()),
                    attribute: None,
                    exact: Some(true),
                },
            ],
            constraints: None,
            iframe: None,
        };

        let script = target_resolution_script(&target).unwrap();

        assert!(script.contains(r#""kind":"test_id""#));
        assert!(script.contains("locator.kind === \"role\""));
        assert!(script.contains("absoluteXPath"));
    }
}
