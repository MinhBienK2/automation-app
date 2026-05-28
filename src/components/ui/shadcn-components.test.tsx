import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { Button } from "./button";
import { Badge, StatusBadge } from "./badge";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Input } from "./input";
import { Label } from "./label";
import { ScrollArea } from "./scroll-area";
import { Select } from "./select";
import { SegmentedControl } from "./segmented-control";
import { Switch, SwitchField } from "./switch";
import { Textarea } from "./textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

describe("shadcn UI components", () => {
  test("renders form primitives with the project design tokens", () => {
    render(
      <form>
        <Label htmlFor="workflow-name">Workflow name</Label>
        <Input id="workflow-name" placeholder="Login flow" />
        <Button type="submit">Create</Button>
      </form>,
    );

    expect(screen.getByLabelText("Workflow name")).toHaveAttribute(
      "placeholder",
      "Login flow",
    );
    expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute(
      "data-slot",
      "button",
    );
  });

  test("supports the foundation button and status badge APIs", () => {
    render(
      <div>
        <Button type="button" variant="primary" size="md">Primary command</Button>
        <Button type="button" variant="quiet" size="sm">Quiet command</Button>
        <StatusBadge tone="warning">Needs review</StatusBadge>
      </div>,
    );

    expect(screen.getByRole("button", { name: "Primary command" }).className)
      .toContain("bg-[var(--app-accent)]");
    expect(screen.getByRole("button", { name: "Quiet command" }).className)
      .toContain("border-transparent");
    expect(screen.getByText("Needs review")).toHaveAttribute("data-tone", "warning");
  });

  test("opens an accessible dialog from a trigger", async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button">Open dialog</Button>
        </DialogTrigger>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Create Workflow</DialogTitle>
            <DialogDescription>Name the workflow before adding steps.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p>Dialog body content</p>
          </DialogBody>
          <DialogFooter>
            <Button type="button">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open dialog" }));

    expect(
      screen.getByRole("dialog", { name: "Create Workflow" }),
    ).toHaveAttribute("data-size", "lg");
    expect(screen.getByText("Dialog body content").parentElement)
      .toHaveAttribute("data-slot", "dialog-body");
    const closeButton = screen.getByRole("button", { name: "Close dialog" });
    expect(closeButton).toHaveTextContent("×");
    expect(closeButton.querySelector("svg")).not.toBeInTheDocument();
  });

  test("renders the remaining shared primitives", async () => {
    render(
      <TooltipProvider>
        <Card>
          <CardHeader>
            <CardTitle>Step Detail</CardTitle>
            <Badge>running</Badge>
          </CardHeader>
          <CardContent>
            <Label htmlFor="condition">Condition</Label>
            <Select id="condition" defaultValue="duration">
              <option value="duration">Duration</option>
              <option value="element_visible">Element visible</option>
            </Select>
            <Textarea aria-label="Step notes" defaultValue="Check selector" />
            <Switch aria-label="Use browser profile" checked onCheckedChange={() => {}} />
            <SwitchField
              checked={false}
              label="Autosave graph changes"
              description="Save edits automatically."
              onCheckedChange={() => {}}
            />
            <SegmentedControl
              ariaLabel="Help language"
              value="vi"
              options={[
                { value: "vi", label: "VI" },
                { value: "en", label: "EN" },
              ]}
              onValueChange={() => {}}
            />
            <ScrollArea>
              <p>Scrollable help</p>
            </ScrollArea>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button">Help</Button>
              </TooltipTrigger>
              <TooltipContent>Open help</TooltipContent>
            </Tooltip>
          </CardContent>
        </Card>
      </TooltipProvider>,
    );

    expect(screen.getByText("Step Detail")).toBeInTheDocument();
    expect(screen.getByText("running")).toHaveAttribute("data-slot", "badge");
    expect(screen.getByLabelText("Condition")).toHaveValue("duration");
    expect(screen.getByLabelText("Step notes")).toHaveValue("Check selector");

    expect(screen.getByRole("switch", { name: "Use browser profile" }))
      .toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Autosave graph changes" }))
      .toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "VI" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Scrollable help")).toBeInTheDocument();
  });
});
