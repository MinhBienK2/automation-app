use crate::runner::RunnerError;

use super::js::json_string;

pub(super) fn type_text_script(xpath: &str, text: &str) -> Result<String, RunnerError> {
    let xpath = json_string(xpath)?;
    let text = json_string(text)?;

    Ok(format!(
        r#"
        (() => {{
          const node = document.evaluate({xpath}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          if (!node) return {{ ok: false, reason: "XPath not found" }};

          const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
          const setNativeValue = (element, value) => {{
            if (element instanceof HTMLTextAreaElement && textareaSetter) {{
              textareaSetter.call(element, value);
              return true;
            }}
            if (element instanceof HTMLInputElement && inputSetter) {{
              inputSetter.call(element, value);
              return true;
            }}
            if ("value" in element) {{
              element.value = value;
              return true;
            }}
            return false;
          }};

          node.focus?.();
          if (setNativeValue(node, {text})) {{
            node.dispatchEvent(new InputEvent("input", {{ bubbles: true, inputType: "insertText", data: {text} }}));
            node.dispatchEvent(new Event("change", {{ bubbles: true }}));
            return {{ ok: true, reason: "" }};
          }}

          if (node.isContentEditable) {{
            node.textContent = {text};
            node.dispatchEvent(new InputEvent("input", {{ bubbles: true, inputType: "insertText", data: {text} }}));
            node.dispatchEvent(new Event("change", {{ bubbles: true }}));
            return {{ ok: true, reason: "" }};
          }}

          return {{ ok: false, reason: "Element cannot receive text" }};
        }})()
        "#
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn type_text_script_uses_native_value_setter_for_controlled_inputs() {
        let script = type_text_script("//input[@id='email']", "user@example.com").unwrap();

        assert!(script.contains("HTMLInputElement.prototype"));
        assert!(script.contains("HTMLTextAreaElement.prototype"));
        assert!(script.contains("setNativeValue(node"));
        assert!(script.contains("new InputEvent(\"input\""));
    }

    #[test]
    fn type_text_script_supports_contenteditable_elements() {
        let script = type_text_script("//*[@contenteditable='true']", "hello").unwrap();

        assert!(script.contains("node.isContentEditable"));
        assert!(script.contains("node.textContent"));
    }
}
