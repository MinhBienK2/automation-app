import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Copy, Check } from "lucide-react";

type PrettyVariableViewerProps = {
  variables: Record<string, unknown>;
  highlightedKeys?: Set<string>;
};
export function PrettyVariableViewer({ variables, highlightedKeys = new Set() }: PrettyVariableViewerProps) {
  return (
    <div className="pretty-var-viewer" aria-label="Pretty Variable Viewer">
      {Object.entries(variables).map(([key, val]) => (
        <PrettyVariableNode
          key={key}
          name={key}
          value={val}
          path={key}
          highlighted={highlightedKeys.has(key)}
        />
      ))}
    </div>
  );
}


type NodeProps = {
  name: string;
  value: unknown;
  path: string;
  highlighted?: boolean;
  depth?: number;
};

function PrettyVariableNode({ name, value, path, highlighted = false, depth = 0 }: NodeProps) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [showAll, setShowAll] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    const textToCopy = typeof value === "object" ? JSON.stringify(value) : String(value);
    void navigator.clipboard?.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  // Formatting helper
  const renderPrimitive = (val: unknown) => {
    if (val === null || val === undefined) {
      return <span className="pretty-var-empty">(Trống)</span>;
    }
    if (typeof val === "boolean") {
      return val ? (
        <span className="pretty-var-badge pretty-var-badge-true" aria-label="Đúng">✓ Đúng</span>
      ) : (
        <span className="pretty-var-badge pretty-var-badge-false" aria-label="Sai">✗ Sai</span>
      );
    }
    if (typeof val === "number") {
      return <span className="pretty-var-value-number">{val.toLocaleString()}</span>;
    }
    if (typeof val === "string") {
      const isUrl = val.startsWith("http://") || val.startsWith("https://");
      const isLong = val.length > 100;
      
      const displayText = isLong && !showAll ? `${val.slice(0, 100)}...` : val;
      
      return (
        <span className="pretty-var-value-string">
          {displayText}
          {isUrl && (
            <a href={val} target="_blank" rel="noopener noreferrer" className="pretty-var-link" title="Mở liên kết">
              <ExternalLink className="h-3 w-3" style={{ display: "inline", marginLeft: "4px", verticalAlign: "middle" }} />
            </a>
          )}
          {isLong && (
            <button
              type="button"
              className="pretty-var-showmore"
              onClick={() => setShowAll((prev) => !prev)}
            >
              {showAll ? "Thu gọn" : "Xem thêm"}
            </button>
          )}
        </span>
      );
    }
    return <span className="pretty-var-value">{String(val)}</span>;
  };

  // If array
  if (Array.isArray(value)) {
    return (
      <div className="pretty-var-node" style={{ paddingLeft: depth > 0 ? "0px" : "0" }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", position: "relative" }} className="pretty-var-toggle-wrapper">
          <button
            type="button"
            className="pretty-var-toggle"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            style={{ flex: 1, paddingRight: "32px" }}
          >
            <span className="pretty-var-toggle-icon">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
            <span className="pretty-var-key">{name}</span>
            <span className="pretty-var-meta">Mảng · {value.length} phần tử</span>
          </button>
          <button
            type="button"
            className="pretty-var-copy-btn"
            onClick={handleCopy}
            title="Copy giá trị"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        {expanded && (
          <div className="pretty-var-children">
            {value.map((item, index) => (
              <div key={index} className="pretty-var-card">
                <div className="pretty-var-card-title">Phần tử {index + 1}</div>
                <PrettyVariableNode
                  name=""
                  value={item}
                  path={`${path}[${index}]`}
                  depth={0}
                />
              </div>
            ))}
            {value.length === 0 && (
              <div className="pretty-var-empty" style={{ paddingLeft: "10px" }}>
                (Mảng trống)
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // If object
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    // If the object name is empty, we don't render a wrapper collapser, just render children directly.
    // This happens inside arrays of objects.
    if (!name) {
      return (
        <div className="pretty-var-node">
          {entries.map(([childKey, childVal]) => (
            <PrettyVariableNode
              key={childKey}
              name={childKey}
              value={childVal}
              path={`${path}.${childKey}`}
              depth={depth + 1}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="pretty-var-node" style={{ paddingLeft: depth > 0 ? "0px" : "0" }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", position: "relative" }} className="pretty-var-toggle-wrapper">
          <button
            type="button"
            className="pretty-var-toggle"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            style={{ flex: 1, paddingRight: "32px" }}
          >
            <span className="pretty-var-toggle-icon">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
            <span className="pretty-var-key">{name}</span>
            <span className="pretty-var-meta">Đối tượng · {entries.length} thuộc tính</span>
          </button>
          <button
            type="button"
            className="pretty-var-copy-btn"
            onClick={handleCopy}
            title="Copy giá trị"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        {expanded && (
          <div className="pretty-var-children">
            {entries.map(([childKey, childVal]) => (
              <PrettyVariableNode
                key={childKey}
                name={childKey}
                value={childVal}
                path={`${path}.${childKey}`}
                depth={depth + 1}
              />
            ))}
            {entries.length === 0 && (
              <div className="pretty-var-empty" style={{ paddingLeft: "10px" }}>
                (Đối tượng trống)
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // If primitive
  const rowClass = `pretty-var-row ${highlighted ? "pretty-var-row-highlight" : ""}`;
  return (
    <div className={rowClass} style={{ marginLeft: depth > 0 ? "0" : "0" }}>
      {name && (
        <>
          <span className="pretty-var-key">{name}</span>
          <span className="pretty-var-separator">:</span>
        </>
      )}
      {renderPrimitive(value)}
      {value !== null && value !== undefined && (
        <button
          type="button"
          className="pretty-var-copy-btn"
          onClick={handleCopy}
          title="Copy giá trị"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}
