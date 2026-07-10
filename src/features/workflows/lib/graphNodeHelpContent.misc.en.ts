import type { GraphNodeType } from "../../../types/workflow";
import type { GraphNodeHelpContent } from "./graphNodeHelpContent";

export const miscNodesEn: Partial<Record<GraphNodeType, GraphNodeHelpContent>> = {
  transform_variable: {
    title: "Transform Variable Help",
    summary: "Create a new output variable by transforming an existing variable with an expression.",
    useWhen: ["Use when you need to format, scale, or lightly alter a value before moving to downstream nodes."],
    fields: [
      {
        name: "Source output",
        description: "Name of the input variable to transform.",
        details: ["Must be defined in a prior step."]
      },
      {
        name: "Target output",
        description: "Name of the new variable receiving the result.",
        details: ["Subsequent nodes can read values via this new variable name."]
      },
      {
        name: "Expression",
        description: "The transformation expression.",
        details: [
          "Keep expressions simple. Use double curly braces {{}} to represent the source variable.",
          "For example: {{price}} * 2."
        ]
      }
    ],
    examples: ["Source: product_price, Target: discount_price, Expression: {{product_price}} * 0.9"],
    commonMistakes: ["Omitting double curly braces {{}} around the source variable in the Expression, treating it as a literal string."],
  },
  assert_output: {
    title: "Assert Output Help",
    summary: "Assert that an output variable matches or contains an expected value.",
    useWhen: ["Use for test assertions. Failing assertions immediately halts the workflow with an error."],
    fields: [
      {
        name: "Output name",
        description: "Name of the variable to validate.",
        details: ["The variable must exist before asserting."]
      },
      {
        name: "Match",
        description: "Match type (Equals for exact matches; Contains to check if string contains substring).",
        details: ["Use Contains for long texts or values with dynamic components."]
      },
      {
        name: "Expected value",
        description: "The expected value to match against.",
        details: ["Verify casing and whitespace matches exactly."]
      }
    ],
    examples: ["Output name: register_status, Match: Equals, Expected: 'success'"],
    commonMistakes: ["Mismatched capitalization or extra trailing whitespace in Expected value, causing false failures."],
  },
  domain_allowlist: {
    title: "Domain Allowlist Help",
    summary: "Restrict browser navigation to a list of allowed host domains.",
    useWhen: ["Use to enforce execution safety, preventing bots from navigating to malicious external websites."],
    fields: [
      {
        name: "Allowed domains",
        description: "Allowed host domains, configured one domain per line.",
        details: [
          "Enter hostnames only. Do not include protocols or paths (e.g. use 'example.com', not 'https://example.com/path').",
          "Navigating outside this list immediately halts the workflow run."
        ]
      }
    ],
    examples: ["Allowed domains: github.com\\ngoogle.com"],
    commonMistakes: ["Including protocols ('https://') or path details in the domain list, breaking allowlist matching rules."],
  },
  get_current_url: {
    title: "Get Current URL Help",
    summary: "Retrieve the current webpage URL and store it inside system.current_url.",
    useWhen: ["Use to parse query parameters or verify successful navigation redirects."],
    fields: [
      {
        name: "Output",
        description: "Complete URL details saved in system.current_url.",
        details: [
          "No inputs required.",
          "The Out port forwards execution flow."
        ]
      }
    ],
    examples: ["Run Get Current URL after Clicking redirects, then use If to check system.current_url.pathname."],
    commonMistakes: ["Running this when pages are still loading or redirecting, yielding outdated or empty URLs."],
  },
  quarantined: {
    title: "Quarantined Help",
    summary: "Placeholder node marking an invalid configuration schema or unsupported feature.",
    useWhen: ["Automatically appears when importing outdated workflows with unsupported settings."],
    fields: [
      {
        name: "Trạng thái",
        description: "Retained for reference but will not be compiled or executed.",
        details: ["Remove or replace this node before attempting execution."]
      }
    ],
    examples: ["No executable examples. Serves as a canvas warning marker."],
    commonMistakes: ["Leaving quarantined nodes inside the graph, which blocks workflow compilation."],
  },
};
