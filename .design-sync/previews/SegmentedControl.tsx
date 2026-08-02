import { FormField, Input, SegmentedControl } from 'automation-app-ui';

const stack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  maxWidth: 420,
};

const noop = () => {};

export function Default() {
  return (
    <div style={stack}>
      <SegmentedControl
        ariaLabel="Theme"
        value="dark"
        options={[
          { label: 'Dark', value: 'dark' },
          { label: 'Light', value: 'light' },
        ]}
        onValueChange={noop}
      />
    </div>
  );
}

export function OptionCounts() {
  return (
    <div style={stack}>
      <SegmentedControl
        ariaLabel="Density"
        value="normal"
        options={[
          { label: 'Compact', value: 'compact' },
          { label: 'Normal', value: 'normal' },
          { label: 'Spacious', value: 'spacious' },
        ]}
        onValueChange={noop}
      />
      <SegmentedControl
        ariaLabel="Run history range"
        value="7d"
        options={[
          { label: '24h', value: '24h' },
          { label: '7d', value: '7d' },
          { label: '30d', value: '30d' },
          { label: 'All runs', value: 'all' },
        ]}
        onValueChange={noop}
      />
    </div>
  );
}

export function SelectionAxis() {
  return (
    <div style={stack}>
      <SegmentedControl
        ariaLabel="Target source, locator selected"
        value="locator"
        options={[
          { label: 'Use locator', value: 'locator' },
          { label: 'Use Find Element ref', value: 'ref' },
        ]}
        onValueChange={noop}
      />
      <SegmentedControl
        ariaLabel="Target source, ref selected"
        value="ref"
        options={[
          { label: 'Use locator', value: 'locator' },
          { label: 'Use Find Element ref', value: 'ref' },
        ]}
        onValueChange={noop}
      />
    </div>
  );
}

export function InFormField() {
  return (
    <div style={stack}>
      <FormField
        label="Element target"
        description="Choose how this browser step finds the element on the page."
      >
        <SegmentedControl
          ariaLabel="Element target"
          value="css"
          options={[
            { label: 'CSS', value: 'css' },
            { label: 'XPath', value: 'xpath' },
            { label: 'Text', value: 'text' },
          ]}
          onValueChange={noop}
        />
      </FormField>
      <FormField label="CSS selector" htmlFor="seg-selector">
        <Input id="seg-selector" defaultValue="[data-testid='order-row'] button.confirm" />
      </FormField>
    </div>
  );
}
