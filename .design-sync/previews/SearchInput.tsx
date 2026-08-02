import { SearchInput } from 'automation-app-ui';

const stack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 360,
};

const noop = () => {};

export function Default() {
  return (
    <div style={stack}>
      <SearchInput value="" placeholder="Search workflows…" onChange={noop} />
    </div>
  );
}

export function Filled() {
  return (
    <div style={stack}>
      <SearchInput
        value="nightly inventory"
        label="Search workflows"
        placeholder="Search workflows…"
        onChange={noop}
      />
    </div>
  );
}

export function Contexts() {
  return (
    <div style={stack}>
      <SearchInput value="" placeholder="Filter runs by status or id…" onChange={noop} />
      <SearchInput value="ops-eu@" placeholder="Search identities…" onChange={noop} />
      <SearchInput value="" placeholder="Find a browser step…" onChange={noop} />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={stack}>
      <SearchInput value="" placeholder="Search unavailable while syncing" disabled onChange={noop} />
    </div>
  );
}
