import { Button } from "./button";

type SegmentedControlOption<Value extends string> = {
  label: string;
  value: Value;
};

function SegmentedControl<Value extends string>({
  ariaLabel,
  className = "",
  onValueChange,
  options,
  value,
}: {
  ariaLabel: string;
  className?: string;
  onValueChange: (value: Value) => void;
  options: Array<SegmentedControlOption<Value>>;
  value: Value;
}) {
  const containerClasses = [
    "join",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      aria-label={ariaLabel}
      className={containerClasses}
      data-slot="segmented-control"
      role="group"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Button
            key={option.value}
            aria-pressed={active}
            className={`join-item ${active ? "btn-active" : ""}`}
            data-state={active ? "active" : "inactive"}
            size="sm"
            type="button"
            variant={active ? "default" : "ghost"}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

export { SegmentedControl };
export type { SegmentedControlOption };

