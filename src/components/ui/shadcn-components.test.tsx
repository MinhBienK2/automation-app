import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { Button } from "./button";
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
});
