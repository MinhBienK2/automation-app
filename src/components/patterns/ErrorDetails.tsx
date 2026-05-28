import { useState } from "react";
import { Button } from "../ui/button";

type ErrorDetailsProps = {
  summary: string;
  details: string;
};

export function ErrorDetails({ summary, details }: ErrorDetailsProps) {
  const [copied, setCopied] = useState(false);

  async function copyDetails() {
    await navigator.clipboard?.writeText(details);
    setCopied(true);
  }

  return (
    <div className="error-details">
      <p className="error-details-summary">{summary}</p>
      <details>
        <summary>Technical details</summary>
        <div className="error-details-body">
          <pre>{details}</pre>
          <Button type="button" variant="secondary" size="sm" onClick={copyDetails}>
            {copied ? "Copied" : "Copy details"}
          </Button>
        </div>
      </details>
    </div>
  );
}
