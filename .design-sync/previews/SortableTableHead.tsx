import {
  SortableTableHead,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'automation-app-ui';

const workflows = [
  { name: 'Invoice reconciliation', updated: 'Yesterday, 23:31', status: 'failed' as const },
  { name: 'Nightly inventory sync', updated: 'Today, 02:00', status: 'success' as const },
  { name: 'Supplier portal export', updated: 'Today, 09:14', status: 'running' as const },
];

function WorkflowTable({
  activeKey,
  direction,
}: {
  activeKey: string | null;
  direction: 'asc' | 'desc';
}) {
  const rows =
    activeKey === 'updated' ? [...workflows].reverse() : workflows;
  const ordered = direction === 'desc' && activeKey ? [...rows].reverse() : rows;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead
            label="Workflow"
            sortKey="name"
            activeKey={activeKey}
            direction={direction}
            onSort={() => undefined}
          />
          <SortableTableHead
            label="Last run"
            sortKey="updated"
            activeKey={activeKey}
            direction={direction}
            onSort={() => undefined}
          />
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ordered.map((workflow) => (
          <TableRow key={workflow.name}>
            <TableCell>{workflow.name}</TableCell>
            <TableCell>{workflow.updated}</TableCell>
            <TableCell>
              <StatusBadge status={workflow.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function SortedAscending() {
  return <WorkflowTable activeKey="name" direction="asc" />;
}

export function SortedDescending() {
  return <WorkflowTable activeKey="name" direction="desc" />;
}

export function Unsorted() {
  return <WorkflowTable activeKey={null} direction="asc" />;
}
