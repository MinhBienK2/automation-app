import type { ActionSchema } from "./schema";

export const browserSchemas: Partial<Record<string, ActionSchema>> = {
  open_new_tab: {
    sections: [
      {
        title: "Tab target",
        fields: [
          {
            widget: "template",
            key: "url",
            label: "URL",
            placeholder: "Optional URL",
          },
        ],
      },
    ],
  },
  switch_tab: {
    sections: [
      {
        title: "Tab selection",
        fields: [{ widget: "numeric", key: "index", label: "Tab index", min: 0 }],
      },
    ],
  },
  close_tab: {
    sections: [
      {
        title: "Tab selection",
        fields: [
          {
            widget: "numeric",
            key: "index",
            label: "Tab index",
            min: 0,
            placeholder: "Current tab",
          },
        ],
      },
    ],
  },
  accept_dialog: {
    sections: [
      {
        title: "Dialog response",
        fields: [
          {
            widget: "template",
            key: "prompt_text",
            label: "Prompt text",
            placeholder: "Optional prompt response",
          },
        ],
      },
    ],
  },
  wait_for_download: {
    sections: [
      {
        title: "Download output",
        fields: [{ widget: "text", key: "output_name", label: "Output name" }],
      },
      {
        title: "Download wait",
        fields: [
          { widget: "numeric", key: "timeout_ms", label: "Timeout ms", min: 1 },
        ],
      },
    ],
  },
};
