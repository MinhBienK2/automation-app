import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { Button } from "./button";
import { Badge } from "./badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Label } from "./label";
import { ScrollArea } from "./scroll-area";
import { SegmentedControl } from "./segmented-control";
import { Switch, SwitchField } from "./switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

/*
  daisyUI 5 component smoke tests. The wrappers keep their public export
  surface so existing consumers keep working; only the classes change.
  These tests assert the new daisyUI class names + core behavior.
*/

describe("daisyUI UI components", () => {
  test("renders form primitives with daisyUI classes", () => {
    render(
      <form>
        <Label htmlFor="workflow-name">Workflow name</Label>
        <input id="workflow-name" type="text" className="input" placeholder="Login flow" />
        <Button type="submit">Create</Button>
      </form>,
    );

    expect(screen.getByPlaceholderText("Login flow")).toHaveClass("input");
    const button = screen.getByRole("button", { name: "Create" });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("btn");
  });

  test("renders daisyUI button variants", () => {
    const { container } = render(
      <>
        <Button>default</Button>
        <Button variant="ghost">ghost</Button>
        <Button variant="secondary">secondary</Button>
        <Button variant="destructive">delete</Button>
        <Button size="sm">small</Button>
        <Button size="icon" aria-label="icon">i</Button>
      </>,
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(6);
    expect(buttons[0]?.className).toContain("btn");
    expect(buttons[1]?.className).toContain("btn-ghost");
    expect(buttons[3]?.className).toContain("btn-error");
    expect(buttons[4]?.className).toContain("btn-sm");
    expect(buttons[5]?.className).toContain("btn-square");
  });

  test("button shows a spinner and disables interaction while loading", () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button.querySelector(".loading")).toBeInTheDocument();
  });

  test("renders daisyUI badge variants", () => {
    const { container } = render(
      <>
        <Badge variant="default">ok</Badge>
        <Badge variant="success">ok</Badge>
        <Badge variant="attention">warn</Badge>
        <Badge variant="failure">err</Badge>
        <Badge variant="running">run</Badge>
      </>,
    );
    const badges = container.querySelectorAll(".badge");
    expect(badges).toHaveLength(5);
    expect(badges[1]?.className).toContain("badge-success");
    expect(badges[2]?.className).toContain("badge-warning");
    expect(badges[3]?.className).toContain("badge-error");
    expect(badges[4]?.className).toContain("badge-primary");
  });

  test("opens an accessible dialog from a trigger", async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button">Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workflow</DialogTitle>
            <DialogDescription>Name the workflow before adding steps.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open dialog" }));

    // Dialog API stays accessible regardless of implementation.
    const close = screen.getByRole("button", { name: "Close dialog" });
    expect(close).toBeInTheDocument();
  });

  test("renders the remaining shared primitives", () => {
    render(
      <TooltipProvider>
        <Badge>running</Badge>
            <label className="label" htmlFor="condition">Condition</label>
            <select id="condition" className="select" defaultValue="duration">
              <option value="duration">Duration</option>
              <option value="element_visible">Element visible</option>
            </select>
            <textarea aria-label="Step notes" className="textarea" defaultValue="Check selector" />
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
      </TooltipProvider>,
    );

    expect(screen.getByText("running")).toBeInTheDocument();
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
