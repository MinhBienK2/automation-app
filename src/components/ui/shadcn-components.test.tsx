import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { Button } from "./button";
import { Badge } from "./badge";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Input } from "./input";
import { Label } from "./label";
import { ScrollArea } from "./scroll-area";
import { Select } from "./select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
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

    expect(
      screen.getByRole("dialog", { name: "Create Workflow" }),
    ).toBeInTheDocument();
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
            <Tabs defaultValue="vi">
              <TabsList>
                <TabsTrigger value="vi">Tiếng Việt</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
              </TabsList>
              <TabsContent value="vi">Nội dung</TabsContent>
              <TabsContent value="en">Content</TabsContent>
            </Tabs>
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

    await userEvent.click(screen.getByRole("tab", { name: "English" }));

    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});
