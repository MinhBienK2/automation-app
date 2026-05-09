import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getWorkspacePolicy, saveWorkspacePolicy } from "../../../lib/workflowApi";
import { SettingsPage } from "./SettingsPage";

vi.mock("../../../lib/workflowApi", () => ({
  getWorkspacePolicy: vi.fn(),
  saveWorkspacePolicy: vi.fn(),
}));

const getWorkspacePolicyMock = vi.mocked(getWorkspacePolicy);
const saveWorkspacePolicyMock = vi.mocked(saveWorkspacePolicy);

describe("SettingsPage", () => {
  beforeEach(() => {
    getWorkspacePolicyMock.mockReset();
    saveWorkspacePolicyMock.mockReset();
  });

  test("loads and saves workspace operator policy", async () => {
    getWorkspacePolicyMock.mockResolvedValue({
      allowedOrigins: ["https://owned.example.test"],
      maxConcurrency: 1,
    });
    saveWorkspacePolicyMock.mockResolvedValue({
      allowedOrigins: ["https://owned.example.test", "https://staging.example.test"],
      maxConcurrency: 2,
    });

    render(
      <SettingsPage
        graphAutosaveEnabled
        onGraphAutosaveEnabledChange={vi.fn()}
      />,
    );

    const origins = await screen.findByLabelText("Allowed origins");
    expect(origins).toHaveValue("https://owned.example.test");

    await userEvent.clear(origins);
    await userEvent.type(
      origins,
      "https://owned.example.test{enter}https://staging.example.test/login",
    );
    await userEvent.clear(screen.getByLabelText("Max concurrency"));
    await userEvent.type(screen.getByLabelText("Max concurrency"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Save policy" }));

    await waitFor(() => {
      expect(saveWorkspacePolicyMock).toHaveBeenCalledWith({
        allowedOrigins: ["https://owned.example.test", "https://staging.example.test/login"],
        maxConcurrency: 2,
      });
    });
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });
});
