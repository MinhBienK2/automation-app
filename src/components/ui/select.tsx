import * as React from "react";
import { ChevronDown, Check } from "lucide-react";

interface SelectProps extends Omit<React.ComponentProps<"select">, "onChange"> {
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  placeholder?: string;
}

function parseOptions(children: React.ReactNode) {
  const options: { value: string; label: string; disabled?: boolean }[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === "option") {
      const props = child.props as any;
      const val = String(props.value ?? "");
      const label = props.children ? String(props.children) : val;
      options.push({ value: val, label, disabled: !!props.disabled });
    }
  });
  return options;
}

function useClickOutside(ref: React.RefObject<HTMLDetailsElement | null>) {
  React.useEffect(() => {
    function handleGlobalClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        ref.current.removeAttribute("open");
      }
    }
    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, [ref]);
}

const Select = React.forwardRef<HTMLDetailsElement, SelectProps>(
  (
    {
      className,
      children,
      value,
      defaultValue,
      disabled,
      placeholder,
      onChange,
      ...props
    },
    ref,
  ) => {
    const detailsRef = React.useRef<HTMLDetailsElement>(null);
    React.useImperativeHandle(ref, () => detailsRef.current!);

    useClickOutside(detailsRef);

    const options = React.useMemo(() => parseOptions(children), [children]);
    const currentValue = value !== undefined ? String(value) : (defaultValue !== undefined ? String(defaultValue) : "");

    const selectedOption = options.find((opt) => opt.value === currentValue);
    const selectedLabel = selectedOption ? selectedOption.label : (placeholder || options[0]?.label || "");

    const handleSelect = (val: string, isDisabled?: boolean) => {
      if (isDisabled || disabled) return;
      detailsRef.current?.removeAttribute("open");

      if (val !== currentValue && onChange) {
        const syntheticEvent = {
          target: { value: val },
          currentTarget: { value: val },
        } as unknown as React.ChangeEvent<HTMLSelectElement>;
        onChange(syntheticEvent);
      }
    };

    const triggerClasses = [
      "select select-bordered w-full flex items-center justify-between font-normal text-left cursor-pointer",
      disabled ? "opacity-50 cursor-not-allowed" : "",
      className
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <details
        ref={detailsRef}
        className="dropdown w-full"
        {...(props as any)}
      >
        <summary
          className={triggerClasses}
          role="button"
          onClick={(e) => disabled && e.preventDefault()}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </summary>

        <ul className="dropdown-content menu bg-base-200 border border-base-300 rounded-box z-50 w-full p-1 shadow-md max-h-60 overflow-y-auto mt-1">
          {options.map((opt) => {
            const isSelected = opt.value === currentValue;
            const itemClasses = [
              "flex w-full items-center justify-between gap-2 rounded-btn px-3 py-2 text-sm text-left transition-colors select-none",
              opt.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
              isSelected ? "bg-primary text-primary-content font-medium" : "text-base-content hover:bg-base-300"
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li key={opt.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  disabled={opt.disabled}
                  className={itemClasses}
                  onClick={() => handleSelect(opt.value, opt.disabled)}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      </details>
    );
  }
);

Select.displayName = "Select";

export { Select };
