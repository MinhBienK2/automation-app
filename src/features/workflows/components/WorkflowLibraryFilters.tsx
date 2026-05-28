import { DataToolbar } from "../../../components/patterns/DataToolbar";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import type {
  WorkflowLibraryFilterId,
  WorkflowLibraryFilterOption,
  WorkflowLibrarySortId,
} from "../lib/workflowLibrary";

type WorkflowLibraryFiltersProps = {
  search: string;
  filter: WorkflowLibraryFilterId;
  sort: WorkflowLibrarySortId;
  filters: WorkflowLibraryFilterOption[];
  resultCount: number;
  totalCount: number;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: WorkflowLibraryFilterId) => void;
  onSortChange: (sort: WorkflowLibrarySortId) => void;
  onClear: () => void;
};

export function WorkflowLibraryFilters({
  search,
  filter,
  sort,
  filters,
  resultCount,
  totalCount,
  onSearchChange,
  onFilterChange,
  onSortChange,
  onClear,
}: WorkflowLibraryFiltersProps) {
  return (
    <DataToolbar
      searchLabel="Search workflows"
      searchValue={search}
      onSearchChange={onSearchChange}
      filters={
        <>
          {filters.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={filter === option.id ? "primary" : "secondary"}
              disabled={option.disabled}
              title={option.reason}
              onClick={() => onFilterChange(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </>
      }
      resultSummary={`${resultCount} of ${totalCount} workflows`}
      actions={
        <>
          <Label className="workflow-library-sort">
            <span>Sort</span>
            <Select
              aria-label="Sort workflows"
              value={sort}
              onChange={(event) =>
                onSortChange(event.currentTarget.value as WorkflowLibrarySortId)
              }
            >
              <option value="recent">Recent</option>
              <option value="name">Name</option>
              <option value="run_state">Run state</option>
            </Select>
          </Label>
          {search || filter !== "all" ? (
            <Button type="button" variant="quiet" size="sm" onClick={onClear}>
              Clear
            </Button>
          ) : null}
        </>
      }
    />
  );
}
