import { useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ActionType, WorkflowStep } from "../../../types/workflow";
import {
  actionGroups,
  actionLabels,
  actionOptions,
  stepSummary,
} from "../../../lib/workflowUi";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";

type StepListProps = {
  steps: WorkflowStep[];
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onAddStep: (actionType: ActionType) => void;
  onDragEnd: (event: DragEndEvent) => void;
};

export function StepList({
  steps,
  selectedStepId,
  onSelectStep,
  onAddStep,
  onDragEnd,
}: StepListProps) {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <section aria-label="Builder Steps" className="step-list-panel panel">
      <div className="panel-heading">
        <h2 className="builder-steps-title">Builder Steps</h2>
        <Badge variant="secondary">{steps.length} total</Badge>
      </div>

      <Button shape="pill" type="button" onClick={() => setIsPaletteOpen(true)}>
        Add Step
      </Button>

      {steps.length === 0 ? (
        <p className="muted">No steps yet</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={steps.map((step) => step.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="step-list">
              {steps.map((step, index) => (
                <SortableStepItem
                  index={index}
                  isSelected={step.id === selectedStepId}
                  key={step.id}
                  step={step}
                  onSelectStep={onSelectStep}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddStepPalette
        open={isPaletteOpen}
        onOpenChange={setIsPaletteOpen}
        onSelectAction={(actionType) => {
          onAddStep(actionType);
          setIsPaletteOpen(false);
        }}
      />
    </section>
  );
}

type AddStepPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAction: (actionType: ActionType) => void;
};

const commonActionTypes: ActionType[] = [
  "navigate",
  "click",
  "input_text",
  "wait",
  "extract_text",
  "take_screenshot",
];

const actionDescriptions: Record<ActionType, string> = {
  navigate: "Open a page",
  open_url: "Open a URL with the legacy action",
  sleep: "Pause for a fixed duration",
  wait: "Pause or wait for a condition",
  input_text: "Fill a field",
  type_text: "Type text with the legacy action",
  clear_input: "Clear a field",
  click: "Click an element",
  scroll: "Move the page or an element",
  select_option: "Choose a native select option",
  set_checkbox: "Set checkbox state",
  press_key: "Press one key",
  hotkey: "Press a keyboard shortcut",
  hover: "Move over an element",
  double_click: "Double click an element",
  right_click: "Open a context click",
  drag_and_drop: "Drag one element to another",
  focus_element: "Focus an element",
  blur_element: "Remove focus from an element",
  type_sequence: "Type text as a sequence",
  set_clipboard: "Store clipboard text",
  paste_clipboard: "Paste stored clipboard text",
  check: "Check a checkbox",
  uncheck: "Uncheck a checkbox",
  toggle_checkbox: "Toggle a checkbox",
  select_radio: "Select a radio option",
  upload_file: "Upload a local file",
  submit_form: "Submit a form",
  select_custom_option: "Choose a custom dropdown option",
  set_contenteditable: "Fill editable content",
  extract_text: "Capture page text",
  extract_attribute: "Capture an element attribute",
  extract_input_value: "Capture a field value",
  extract_table: "Capture table data",
  extract_list: "Capture repeated items",
  take_screenshot: "Save visual evidence",
  go_back: "Go back in history",
  go_forward: "Go forward in history",
  reload: "Reload the page",
  open_new_tab: "Open a browser tab",
  switch_tab: "Change the active tab",
  close_tab: "Close a browser tab",
  switch_frame: "Target an iframe",
  accept_dialog: "Accept a browser dialog",
  dismiss_dialog: "Dismiss a browser dialog",
  set_download_directory: "Choose download location",
  wait_for_download: "Wait for a download",
  set_variable: "Store a workflow value",
  assert_element: "Require an element state",
  assert_text: "Require matching text",
  if_condition: "Run steps conditionally",
  repeat_times: "Repeat nested steps",
  repeat_for_each: "Repeat for each item",
  retry_block: "Retry a group of steps",
  stop_workflow: "Stop execution",
  use_profile: "Use a browser profile",
  save_session: "Save browser session",
  load_session: "Load browser session",
  set_cookie: "Set a browser cookie",
  clear_cookies: "Clear browser cookies",
  set_secret: "Store a secret value",
  use_proxy: "Route traffic through a proxy",
  set_user_agent: "Set user agent string",
  set_viewport: "Set viewport size",
  set_geolocation: "Set location data",
  set_extra_headers: "Attach request headers",
  grant_permission: "Grant browser permission",
  detect_challenge: "Detect human verification",
  pause_for_human: "Pause for manual action",
  resume_when_condition: "Resume after a condition",
  fallback_selector: "Use a fallback selector",
  retry_step: "Retry one flaky step",
  checkpoint: "Save a recovery point",
  execute_js: "Run JavaScript",
  wait_for_request: "Wait for a request",
  wait_for_response: "Wait for a response",
  block_request: "Block matching requests",
  mock_response: "Mock a response",
  set_local_storage: "Set local storage",
  set_session_storage: "Set session storage",
};

function AddStepPalette({
  open,
  onOpenChange,
  onSelectAction,
}: AddStepPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const normalizedQuery = query.trim().toLowerCase();

  const visibleActions = useMemo(() => {
    const sourceActions =
      activeCategory === "All"
        ? actionOptions
        : activeCategory === "Common"
        ? commonActionTypes
        : actionGroups.find((group) => group.label === activeCategory)?.actions ?? [];

    if (!normalizedQuery) return sourceActions;

    return actionGroups
      .flatMap((group) => group.actions)
      .filter((actionType) => {
        const label = actionLabels[actionType].toLowerCase();
        const description = actionDescriptions[actionType].toLowerCase();
        return label.includes(normalizedQuery) || description.includes(normalizedQuery);
      });
  }, [activeCategory, normalizedQuery]);

  function selectAction(actionType: ActionType) {
    onSelectAction(actionType);
    setQuery("");
    setActiveCategory("All");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setQuery("");
          setActiveCategory("All");
        }
      }}
    >
      <DialogContent className="add-step-palette">
        <DialogHeader>
          <p className="eyebrow">Add Step</p>
          <DialogTitle>Choose an action type</DialogTitle>
          <DialogDescription>
            Search or browse categories, then choose an action to add it.
          </DialogDescription>
        </DialogHeader>

        <Input
          aria-label="Search actions"
          placeholder="Search actions..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="add-step-palette-body">
          <div aria-label="Action categories" className="action-category-list">
            {["All", "Common", ...actionGroups.map((group) => group.label)].map((label) => (
              <Button
                aria-pressed={activeCategory === label && !normalizedQuery}
                className={
                  activeCategory === label && !normalizedQuery
                    ? "action-category action-category-active"
                    : "action-category"
                }
                key={label}
                type="button"
                variant="ghost"
                onClick={() => {
                  setActiveCategory(label);
                  setQuery("");
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          <div aria-label="Action results" className="action-result-list">
            {visibleActions.length === 0 ? (
              <p className="muted">No matching actions</p>
            ) : (
              visibleActions.map((actionType) => (
                <Button
                  className="action-result"
                  data-value={actionType}
                  key={actionType}
                  type="button"
                  variant="ghost"
                  onClick={() => selectAction(actionType)}
                >
                  <span>{actionLabels[actionType]}</span>
                  <small>{actionDescriptions[actionType]}</small>
                </Button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type SortableStepItemProps = {
  step: WorkflowStep;
  index: number;
  isSelected: boolean;
  onSelectStep: (stepId: string) => void;
};

function SortableStepItem({
  step,
  index,
  isSelected,
  onSelectStep,
}: SortableStepItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: step.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div className="step-item-wrap" ref={setNodeRef} style={style}>
      <Button
        className={isSelected ? "step-item step-item-selected" : "step-item"}
        type="button"
        onClick={() => onSelectStep(step.id)}
      >
        <span>{index + 1}</span>
        <strong>{step.name || actionLabels[step.action_type]}</strong>
        <small>
          {actionLabels[step.action_type]} - {stepSummary(step)}
        </small>
      </Button>
      <Button
        aria-label={`Drag step ${index + 1}`}
        className="step-drag-handle"
        variant="ghost"
        size="icon"
        type="button"
        {...attributes}
        {...listeners}
      >
        ::
      </Button>
    </div>
  );
}
