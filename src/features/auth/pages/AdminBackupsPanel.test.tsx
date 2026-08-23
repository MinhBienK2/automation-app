// @vitest-environment jsdom

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { AdminBackupsPanel } from "./AdminBackupsPanel";
import {
  listBackups,
  createBackup,
  deleteBackup,
  getBackupConfig,
  saveBackupConfig,
} from "../../../lib/api/workflowApi";

vi.mock("../../../lib/api/workflowApi", () => ({
  listBackups: vi.fn(),
  createBackup: vi.fn(),
  deleteBackup: vi.fn(),
  getBackupConfig: vi.fn(),
  saveBackupConfig: vi.fn(),
  openBackupsFolder: vi.fn(),
}));

const mockBackups = [
  { filename: "backup_20260705_120000.sql", createdAt: "2026-07-05T12:00:00Z", size: 102400 },
  { filename: "backup_20260705_130000.dump", createdAt: "2026-07-05T13:00:00Z", size: 204800 },
];

const mockConfig = {
  enabled: true,
  intervalHours: 24,
  maxKeepVersions: 10,
  lastBackupAt: "2026-07-05T13:00:00Z",
  format: "sql" as const,
};

describe("AdminBackupsPanel", () => {
  const showToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listBackups).mockResolvedValue(mockBackups);
    vi.mocked(getBackupConfig).mockResolvedValue(mockConfig);
  });

  test("loads and displays backup list and configuration on mount", async () => {
    render(<AdminBackupsPanel showToast={showToast} />);

    await waitFor(() => {
      expect(screen.getByText("backup_20260705_120000.sql")).toBeInTheDocument();
      expect(screen.getByText("backup_20260705_130000.dump")).toBeInTheDocument();
    });

    const checkbox = screen.getByRole("checkbox", { name: /enable automatic backups/i });
    expect(checkbox).toBeChecked();
  });

  test("triggers manual backup, shows success toast, and refreshes the list", async () => {
    vi.mocked(createBackup).mockResolvedValue({
      filename: "backup_20260705_140000.sql",
      createdAt: "2026-07-05T14:00:00Z",
      size: 150000,
    });
    vi.mocked(listBackups).mockResolvedValueOnce(mockBackups).mockResolvedValueOnce([
      ...mockBackups,
      { filename: "backup_20260705_140000.sql", createdAt: "2026-07-05T14:00:00Z", size: 150000 },
    ]);

    render(<AdminBackupsPanel showToast={showToast} />);

    const backupBtn = await screen.findByRole("button", { name: /backup now/i });
    fireEvent.click(backupBtn);

    await waitFor(() => {
      expect(createBackup).toHaveBeenCalledWith("sql");
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("Backup backup_20260705_140000.sql created successfully.")
      );
    });

    await waitFor(() => {
      expect(screen.getByText("backup_20260705_140000.sql")).toBeInTheDocument();
    });
  });

  test("shows toast warning/error on manual backup failure", async () => {
    vi.mocked(createBackup).mockRejectedValue(new Error("Backup system error"));

    render(<AdminBackupsPanel showToast={showToast} />);

    const backupBtn = await screen.findByRole("button", { name: /backup now/i });
    fireEvent.click(backupBtn);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining("Backup system error"));
    });
  });

  test("saving configuration displays success toast", async () => {
    vi.mocked(saveBackupConfig).mockResolvedValue({ ok: true });

    render(<AdminBackupsPanel showToast={showToast} />);

    const saveBtn = await screen.findByRole("button", { name: /save configuration/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(saveBackupConfig).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith("Backup configuration saved successfully.");
    });
  });

  test("clicking delete opens custom Dialog instead of system confirm, and confirming deletes backup", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockImplementation(() => true);
    vi.mocked(deleteBackup).mockResolvedValue({ ok: true });

    render(<AdminBackupsPanel showToast={showToast} />);

    const deleteButtons = await screen.findAllByRole("button", { name: /delete/i });
    // Click delete on the first item (backup_20260705_120000.sql)
    fireEvent.click(deleteButtons[0]);

    // Verify window.confirm was not called (we use custom Dialog now)
    expect(confirmSpy).not.toHaveBeenCalled();

    // Verify custom Dialog is visible
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Delete Backup\?/i)).toBeInTheDocument();

    // Click confirm "Delete/Xóa" button inside the dialog
    const dialog = screen.getByRole("dialog");
    const confirmDeleteBtn = within(dialog).getByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(deleteBackup).toHaveBeenCalledWith("backup_20260705_120000.sql");
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining("Deleted backup backup_20260705_120000.sql."));
    });

    confirmSpy.mockRestore();
  });
});
