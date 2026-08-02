import {
  Badge,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'automation-app-ui';

export function RunHistory() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Run</TableHead>
          <TableHead>Workflow</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Duration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>run_8c21a4</TableCell>
          <TableCell>Nightly inventory sync</TableCell>
          <TableCell>
            <StatusBadge status="success" />
          </TableCell>
          <TableCell>4m 12s</TableCell>
        </TableRow>
        <TableRow>
          <TableCell style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>run_7f9b30</TableCell>
          <TableCell>Supplier portal export</TableCell>
          <TableCell>
            <StatusBadge status="running" />
          </TableCell>
          <TableCell>1m 38s</TableCell>
        </TableRow>
        <TableRow>
          <TableCell style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>run_6a1d55</TableCell>
          <TableCell>Invoice reconciliation</TableCell>
          <TableCell>
            <StatusBadge status="failed" />
          </TableCell>
          <TableCell>0m 47s</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

export function StepList() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Selector</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>1</TableCell>
          <TableCell>Navigate</TableCell>
          <TableCell style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            https://portal.supplier.internal/login
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell>2</TableCell>
          <TableCell>Type text</TableCell>
          <TableCell style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>#username</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>3</TableCell>
          <TableCell>Click element</TableCell>
          <TableCell style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            button[type=&quot;submit&quot;]
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell>4</TableCell>
          <TableCell>Wait for selector</TableCell>
          <TableCell style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            .dashboard-header
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

export function WithAlignedActions() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Identity</TableHead>
          <TableHead>Project</TableHead>
          <TableHead style={{ textAlign: 'right' }}>Sessions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>
            <Badge variant="secondary">ops-bot-01</Badge>
          </TableCell>
          <TableCell>Warehouse ops</TableCell>
          <TableCell style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            42
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell>
            <Badge variant="secondary">finance-bot</Badge>
          </TableCell>
          <TableCell>Invoicing</TableCell>
          <TableCell style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            17
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
