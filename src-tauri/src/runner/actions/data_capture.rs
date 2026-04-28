use crate::runner::RunnerError;

use super::js::{json_string, optional_json_string};

pub(super) enum ExtractKind<'a> {
    Text,
    Attribute(&'a str),
    InputValue,
    Table,
    List,
}

pub(super) fn extract_data_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
    output_name: &str,
    timeout_ms: Option<u64>,
    kind: ExtractKind<'_>,
) -> Result<String, RunnerError> {
    let xpath = json_string(xpath)?;
    let iframe_xpath = optional_json_string(iframe_xpath)?;
    let output_name = json_string(output_name)?;
    let timeout_ms = timeout_ms.unwrap_or(5000);
    let kind_value = match kind {
        ExtractKind::Text => "text".to_string(),
        ExtractKind::InputValue => "input_value".to_string(),
        ExtractKind::Table => "table".to_string(),
        ExtractKind::List => "list".to_string(),
        ExtractKind::Attribute(attribute) => {
            format!("attribute:{}", json_string(attribute)?)
        }
    };
    let kind_value = json_string(&kind_value)?;

    Ok(format!(
        r#"
        (() => new Promise((resolve) => {{
          const xpath = {xpath};
          const iframeXPath = {iframe_xpath};
          const outputName = {output_name};
          const timeoutMs = {timeout_ms};
          const kind = {kind_value};
          const startedAt = Date.now();
          const byXpath = (value, root = document) => root.evaluate(value, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          const targetDocument = () => {{
            if (!iframeXPath) return document;
            const frame = byXpath(iframeXPath, document);
            return frame && frame.contentDocument ? frame.contentDocument : null;
          }};
          const text = (node) => (node.innerText ?? node.textContent ?? "").trim();
          const extractTable = (node) => Array.from(node.querySelectorAll("tr")).map((row) =>
            Array.from(row.querySelectorAll("th,td")).map((cell) => text(cell))
          );
          const extractList = (node) => Array.from(node.querySelectorAll("li")).map((item) => text(item));
          const store = (value) => {{
            window.__wamOutputs = window.__wamOutputs || {{}};
            window.__wamOutputs[outputName] = value;
          }};
          const valueFor = (node) => {{
            if (kind === "text") return text(node);
            if (kind === "input_value") {{
              if ("value" in node) return node.value;
              return text(node);
            }}
            if (kind === "table") return extractTable(node);
            if (kind === "list") return extractList(node);
            if (kind.startsWith("attribute:")) {{
              const attribute = JSON.parse(kind.slice("attribute:".length));
              return node.getAttribute(attribute) ?? "";
            }}
            return "";
          }};
          const tick = () => {{
            const doc = targetDocument();
            if (!doc) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Iframe XPath not found" }});
              return setTimeout(tick, 50);
            }}
            const node = byXpath(xpath, doc);
            if (node) {{
              store(valueFor(node));
              return resolve({{ ok: true, reason: "" }});
            }}
            if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "XPath not found" }});
            setTimeout(tick, 50);
          }};
          tick();
        }}))()
        "#
    ))
}

pub(super) fn store_output_script(output_name: &str, value: &str) -> Result<String, RunnerError> {
    let output_name = json_string(output_name)?;
    let value = json_string(value)?;

    Ok(format!(
        r#"
        (() => {{
          window.__wamOutputs = window.__wamOutputs || {{}};
          window.__wamOutputs[{output_name}] = {value};
          return {{ ok: true, reason: "" }};
        }})()
        "#
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_data_script_stores_named_outputs() {
        let text = extract_data_script(
            "//*[@id='title']",
            None,
            "title",
            Some(3000),
            ExtractKind::Text,
        )
        .unwrap();
        let table = extract_data_script(
            "//*[@id='orders']",
            None,
            "orders",
            None,
            ExtractKind::Table,
        )
        .unwrap();

        assert!(text.contains("__wamOutputs"));
        assert!(text.contains("outputName"));
        assert!(table.contains("querySelectorAll(\"tr\")"));
    }

    #[test]
    fn screenshot_output_script_stores_path() {
        let script = store_output_script("screenshot_path", "/tmp/result.png").unwrap();

        assert!(script.contains("__wamOutputs"));
        assert!(script.contains("/tmp/result.png"));
    }
}
