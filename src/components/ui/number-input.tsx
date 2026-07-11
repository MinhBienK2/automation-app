import * as React from "react";
import { Input } from "./input";

interface NumberInputProps extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  fallback?: number;
  allowDecimals?: boolean;
  allowNegative?: boolean;
}

export function NumberInput({
  value,
  onChange,
  fallback,
  allowDecimals,
  allowNegative,
  min,
  step,
  ...props
}: NumberInputProps) {
  const [localVal, setLocalVal] = React.useState<string>(
    value !== null && value !== undefined ? String(value) : ""
  );

  React.useEffect(() => {
    setLocalVal(value !== null && value !== undefined ? String(value) : "");
  }, [value]);

  const minVal = min !== undefined ? Number(min) : undefined;
  const isNegativeAllowed = allowNegative !== undefined ? allowNegative : (minVal === undefined || minVal < 0);
  
  const isDecimalAllowed = allowDecimals !== undefined 
    ? allowDecimals 
    : (step !== undefined && step !== "any" && Number(step) !== 1 && Number(step) % 1 !== 0);

  const regex = React.useMemo(() => {
    const signPart = isNegativeAllowed ? "[+-]?" : "[+]?";
    if (isDecimalAllowed) {
      return new RegExp(`^${signPart}[0-9]*(\\.[0-9]*)?([eE][+-]?[0-9]*)?$`);
    }
    return new RegExp(`^${signPart}[0-9]*$`);
  }, [isNegativeAllowed, isDecimalAllowed]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!regex.test(val)) {
      return;
    }
    setLocalVal(val);

    if (val === "") {
      if (fallback === undefined) {
        onChange(null);
      }
      return;
    }

    const parsed = Number(val);
    if (Number.isFinite(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (localVal === "" || !Number.isFinite(Number(localVal))) {
      const nextVal = fallback !== undefined ? fallback : null;
      setLocalVal(nextVal !== null ? String(nextVal) : "");
      onChange(nextVal);
    } else {
      const parsed = Number(localVal);
      setLocalVal(String(parsed));
      onChange(parsed);
    }
    
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  return (
    <Input
      type="number"
      min={min}
      step={step}
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      {...props}
    />
  );
}
