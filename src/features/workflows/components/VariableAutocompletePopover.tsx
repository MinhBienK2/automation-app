import { useState, useEffect, useRef, useMemo, useContext } from "react";
import { createPortal } from "react-dom";
import { Input } from "../../../components/ui/input";
import { VariableOptionsContext } from "./TemplateTextField";

export type VariableOption = {
  name: string;
  source: string;
  evaluation_type?: "static" | "dynamic";
  type?: "text" | "number" | "boolean" | "list" | "object";
};

type VariableAutocompletePopoverProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  variableOptions: VariableOption[];
  label: string;
  isJs?: boolean;
};

interface VariableTreeNode {
  label: string;
  fullName: string;
  type?: string;
  children: VariableTreeNode[];
}

interface SourceGroup {
  sourceName: string;
  children: VariableTreeNode[];
}

interface TreeRow {
  id: string;
  type: "group" | "folder" | "leaf";
  label: string;
  fullName?: string;
  sourceName?: string;
  varType?: string;
  level: number;
}

function buildVariableTree(options: VariableOption[]): SourceGroup[] {
  const groupsMap = new Map<string, VariableOption[]>();
  for (const option of options) {
    let list = groupsMap.get(option.source);
    if (!list) {
      list = [];
      groupsMap.set(option.source, list);
    }
    list.push(option);
  }

  const groups: SourceGroup[] = [];

  for (const [sourceName, optList] of groupsMap.entries()) {
    const trieRoot: { [key: string]: any } = {};

    for (const opt of optList) {
      const parts = opt.name.split(".");
      let current = trieRoot;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = {
            _fullName: parts.slice(0, i + 1).join("."),
            _type: i === parts.length - 1 ? opt.type : undefined,
            _children: {},
          };
        } else if (i === parts.length - 1 && opt.type) {
          current[part]._type = opt.type;
        }
        current = current[part]._children;
      }
    }

    function convertTrieToNodes(trieNode: any): VariableTreeNode[] {
      return Object.keys(trieNode)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => {
          const info = trieNode[key];
          return {
            label: key,
            fullName: info._fullName,
            type: info._type,
            children: convertTrieToNodes(info._children),
          };
        });
    }

    groups.push({
      sourceName,
      children: convertTrieToNodes(trieRoot),
    });
  }

  return groups.sort((a, b) => a.sourceName.localeCompare(b.sourceName));
}

export function VariableAutocompletePopover({
  open,
  onClose,
  anchorRef,
  inputRef,
  value,
  onChange,
  variableOptions,
  label,
  isJs = false,
}: VariableAutocompletePopoverProps) {
  const [query, setQuery] = useState("");
  const [popoverCoords, setPopoverCoords] = useState({ top: 0, left: 0, height: 0 });
  const [activeTab, setActiveTab] = useState<"static" | "dynamic">("static");
  const [activeType, setActiveType] = useState<"all" | "text" | "number" | "boolean" | "list" | "object">("all");
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const normalizedQuery = query.trim().toLowerCase();
  const contextOptions = useContext(VariableOptionsContext);
  
  const allOptions = useMemo(
    () => mergeVariableOptions(variableOptions, contextOptions),
    [variableOptions, contextOptions]
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      setQuery("");
      setActiveType("all");
      setActiveIndex(-1);
      setExpandedPaths({});
    }
  }, [open]);

  // Construct Tree Data
  const treeData = useMemo(() => {
    const filtered = allOptions.filter((option) => {
      // Tab filter
      const isDynamic = option.evaluation_type === "dynamic";
      if (activeTab === "dynamic" ? !isDynamic : isDynamic) return false;

      // Type filter
      if (activeType !== "all" && option.type !== activeType) return false;

      // Query search
      if (normalizedQuery) {
        return (
          option.name.toLowerCase().includes(normalizedQuery) ||
          option.source.toLowerCase().includes(normalizedQuery)
        );
      }
      return true;
    });

    return buildVariableTree(filtered);
  }, [allOptions, activeTab, activeType, normalizedQuery]);

  // Traverse tree to build flat list of visible rows for keyboard navigation
  const visibleRows = useMemo(() => {
    const rows: TreeRow[] = [];

    for (const group of treeData) {
      const groupKey = `group:${group.sourceName}`;
      const isGroupExpanded = expandedPaths[groupKey] !== false; // default to true
      rows.push({
        id: groupKey,
        type: "group",
        label: group.sourceName,
        level: 0,
      });

      if (isGroupExpanded) {
        function traverseNode(node: VariableTreeNode, level: number) {
          const hasChildren = node.children.length > 0;
          const nodeKey = `node:${group.sourceName}:${node.fullName}`;
          const isExpanded = expandedPaths[nodeKey] !== false; // default to true

          rows.push({
            id: nodeKey,
            type: hasChildren ? "folder" : "leaf",
            label: node.label,
            fullName: node.fullName,
            sourceName: group.sourceName,
            varType: node.type,
            level,
          });

          if (hasChildren && isExpanded) {
            for (const child of node.children) {
              traverseNode(child, level + 1);
            }
          }
        }

        for (const child of group.children) {
          traverseNode(child, 1);
        }
      }
    }

    return rows;
  }, [treeData, expandedPaths]);

  // Handle auto-scroll to highlighted item
  useEffect(() => {
    if (activeIndex >= 0 && activeIndex < visibleRows.length) {
      const activeRow = visibleRows[activeIndex];
      const el = rowRefs.current[activeRow.id];
      if (el) {
        el.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex, visibleRows]);

  const updateCoords = () => {
    const inspectorEl = document.querySelector(".graph-inspector-drawer");
    if (inspectorEl) {
      const rect = inspectorEl.getBoundingClientRect();
      const popoverWidth = 360;
      let left = rect.left - popoverWidth;
      if (left < 0) left = 0;

      setPopoverCoords({
        top: rect.top,
        left,
        height: rect.height,
      });
    } else {
      const popoverWidth = 360;
      const fallbackLeft = window.innerWidth - popoverWidth - 460;
      setPopoverCoords({
        top: 0,
        left: fallbackLeft < 0 ? 0 : fallbackLeft,
        height: window.innerHeight,
      });
    }
  };

  useEffect(() => {
    if (open) {
      updateCoords();
      const timer = setTimeout(updateCoords, 0);
      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, true);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", updateCoords);
        window.removeEventListener("scroll", updateCoords, true);
      };
    }
  }, [open, query, activeTab, activeType, expandedPaths]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        anchorRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  function insertVariable(name: string) {
    let token = `{{${name}}}`;
    if (isJs) {
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
        token = `outputs.${name}`;
      } else {
        token = `outputs["${name}"]`;
      }
    }
    const input = inputRef.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    onClose();

    setTimeout(() => {
      if (input) {
        input.focus();
        const newPos = start + token.length;
        input.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }

  // Keyboard navigation event handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || visibleRows.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1 < visibleRows.length ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < visibleRows.length) {
        const row = visibleRows[activeIndex];
        if (row.type === "leaf" && row.fullName) {
          insertVariable(row.fullName);
        } else {
          // Toggle group/folder expansion
          const isExpanded = expandedPaths[row.id] !== false;
          setExpandedPaths((prev) => ({ ...prev, [row.id]: !isExpanded }));
        }
      }
    } else if (e.key === "ArrowRight") {
      if (activeIndex >= 0 && activeIndex < visibleRows.length) {
        const row = visibleRows[activeIndex];
        if (row.type === "group" || row.type === "folder") {
          e.preventDefault();
          setExpandedPaths((prev) => ({ ...prev, [row.id]: true }));
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (activeIndex >= 0 && activeIndex < visibleRows.length) {
        const row = visibleRows[activeIndex];
        if (row.type === "group" || row.type === "folder") {
          e.preventDefault();
          setExpandedPaths((prev) => ({ ...prev, [row.id]: false }));
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  function getTypeBadgeClass(type: string): string {
    if (type === "text") return "badge-type-text";
    if (type === "number") return "badge-type-number";
    if (type === "boolean") return "badge-type-boolean";
    if (type === "list") return "badge-type-list";
    if (type === "object") return "badge-type-object";
    return "";
  }

  function getTypeBadgeLabel(type: string): string {
    if (type === "text") return "TXT";
    if (type === "number") return "NUM";
    if (type === "boolean") return "BOOL";
    if (type === "list") return "LIST";
    if (type === "object") return "OBJ";
    return type.toUpperCase();
  }

  return createPortal(
    <div
      ref={popoverRef}
      className="variable-picker variable-picker-tree absolute z-[9999] bg-[var(--app-surface)] border border-[var(--app-border)] rounded-md shadow-lg p-2.5 flex flex-col gap-2"
      style={{
        top: `${popoverCoords.top}px`,
        left: `${popoverCoords.left}px`,
        width: "360px",
        height: popoverCoords.height ? `${popoverCoords.height}px` : "100vh",
      }}
      role="listbox"
      aria-label={`${label} variables`}
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2 mb-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-xs text-[var(--app-text)]">Variables</span>
          <span className="text-[9px] bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text-muted)] px-1.5 py-0.5 rounded font-mono">
            {visibleRows.filter(r => r.type === "leaf").length} available
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--app-text-muted)] hover:text-[var(--app-text)] p-1 rounded hover:bg-[var(--app-surface-hover)] transition-colors"
          aria-label="Close variables panel"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Static / Dynamic Tabs */}
      <div className="flex border-b border-[var(--app-border)] pb-0.5">
        <button
          type="button"
          className={`flex-1 py-1 text-center text-xs font-semibold border-b-2 transition-all ${
            activeTab === "static"
              ? "border-[var(--app-accent)] text-[var(--app-accent-text)]"
              : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
          }`}
          onClick={() => {
            setActiveTab("static");
            setActiveIndex(-1);
          }}
        >
          Static
        </button>
        <button
          type="button"
          className={`flex-1 py-1 text-center text-xs font-semibold border-b-2 transition-all ${
            activeTab === "dynamic"
              ? "border-[var(--app-accent)] text-[var(--app-accent-text)]"
              : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
          }`}
          onClick={() => {
            setActiveTab("dynamic");
            setActiveIndex(-1);
          }}
        >
          Dynamic
        </button>
      </div>

      {/* Search Input with Keyboard Handler */}
      <Input
        ref={searchInputRef}
        aria-label="Search variables"
        value={query}
        placeholder="Search variables..."
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          setQuery(event.currentTarget.value);
          setActiveIndex(-1);
        }}
        className="h-8 text-xs bg-[var(--app-surface-hover)] border-[var(--app-border)]"
      />

      {/* Type Filter Pills */}
      <div className="variable-picker-type-filters flex gap-1 py-0.5 overflow-x-auto border-b border-[var(--app-border)] pb-1.5">
        {(["all", "text", "number", "boolean", "list", "object"] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={`type-filter-pill type-filter-${type} ${activeType === type ? "type-filter-active" : ""}`}
            onClick={() => {
              setActiveType(type);
              setActiveIndex(-1);
            }}
          >
            {type === "all" ? "All" : type.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tree view options */}
      <div className="variable-picker-options variable-tree-container overflow-y-auto flex flex-col gap-0.5 pr-0.5">
        {visibleRows.map((row, index) => {
          const isHighlighted = index === activeIndex;
          const isExpanded = expandedPaths[row.id] !== false;

          const handleRowClick = () => {
            setActiveIndex(index);
            if (row.type === "leaf" && row.fullName) {
              insertVariable(row.fullName);
            } else {
              setExpandedPaths((prev) => ({ ...prev, [row.id]: !isExpanded }));
            }
          };

          return (
            <div
              key={row.id}
              ref={(el) => {
                rowRefs.current[row.id] = el;
              }}
              onClick={handleRowClick}
              style={{ paddingLeft: `${row.level * 14}px` }}
              className={`tree-row-line flex items-center justify-between rounded px-1.5 py-1 transition-colors cursor-pointer select-none ${
                row.type === "group"
                  ? "tree-row-group text-[var(--app-text-muted)] font-semibold mt-1"
                  : row.type === "folder"
                  ? "tree-row-folder text-[var(--app-text)] font-medium"
                  : "tree-row-leaf text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]"
              } ${isHighlighted ? "tree-row-highlighted" : ""}`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {row.type !== "leaf" ? (
                  <span className="tree-toggle text-[10px] text-[var(--app-text-muted)]">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                ) : (
                  <span className="tree-bullet text-[9px] text-[var(--app-text-muted)] opacity-50">•</span>
                )}
                {row.type === "group" ? (
                  <span className="text-[10px] uppercase tracking-wider">{row.label}</span>
                ) : (
                  <span className="font-mono text-xs truncate">{row.label}</span>
                )}
              </div>

              {row.varType && (
                <span className={`type-badge font-mono text-[9px] px-1 py-0.5 rounded leading-none ${getTypeBadgeClass(row.varType)}`}>
                  {getTypeBadgeLabel(row.varType)}
                </span>
              )}
            </div>
          );
        })}

        {visibleRows.length === 0 && (
          <p className="text-xs text-[var(--app-text-muted)] p-4 text-center">No variables found</p>
        )}
      </div>
    </div>,
    document.body
  );
}

function mergeVariableOptions(
  primary: VariableOption[],
  secondary: VariableOption[],
): VariableOption[] {
  const seen = new Set<string>();
  const results: VariableOption[] = [];
  for (const option of primary) {
    seen.add(option.name);
    results.push(option);
  }
  for (const option of secondary) {
    if (!seen.has(option.name)) {
      seen.add(option.name);
      results.push(option);
    }
  }
  return results;
}
