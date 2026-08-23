import type { ActionSchema } from "./schema";

export const frameSchemas: Partial<Record<string, ActionSchema>> = {
  switch_frame: {
    sections: [
      {
        title: "Frame target",
        fields: [
          {
            widget: "template",
            key: "iframe_xpath",
            label: "Iframe XPath",
            placeholder: "//iframe[@id='my-iframe']",
          },
        ],
      },
    ],
  },
  switch_to_parent_frame: {
    sections: [
      {
        title: "",
        fields: [
          {
            widget: "custom",
            render: () => (
              <div className="text-sm text-muted-foreground p-2">
                This action switches the execution context back to the main/top-level page document.
              </div>
            ),
          },
        ],
      },
    ],
  },
};
