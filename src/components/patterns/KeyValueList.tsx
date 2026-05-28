import type { ReactNode } from "react";

type KeyValueItem = {
  label: ReactNode;
  value: ReactNode;
  monospace?: boolean;
  redacted?: boolean;
};

type KeyValueListProps = {
  items: KeyValueItem[];
};

export function KeyValueList({ items }: KeyValueListProps) {
  return (
    <dl className="key-value-list">
      {items.map((item, index) => (
        <div key={index}>
          <dt>{item.label}</dt>
          <dd
            data-monospace={item.monospace ? "true" : undefined}
            data-redacted={item.redacted ? "true" : undefined}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
