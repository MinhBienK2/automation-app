import { useState } from "react";
import type { CloakBrowserDiagnostics } from "../../types/workflow";
import {
  cleanupOrphanedBrowserProfiles,
  getCloakBrowserDiagnostics,
  installCloakBrowserBinary,
} from "../../lib/workflowApi";
import { formatMaintenanceBytes } from "../../lib/appState";
import { commandMessage } from "../../lib/workflowUi";

export function useSettingsDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<CloakBrowserDiagnostics | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState("");
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  async function loadSettingsDiagnostics() {
    setDiagnosticsLoading(true);
    try {
      setDiagnostics(await getCloakBrowserDiagnostics());
      setDiagnosticsError("");
    } catch (error) {
      setDiagnosticsError(commandMessage(error));
    } finally {
      setDiagnosticsLoading(false);
    }
  }

  async function installSettingsBrowserBinary() {
    setMaintenanceMessage("");
    try {
      setDiagnostics(await installCloakBrowserBinary());
      setDiagnosticsError("");
      setMaintenanceMessage("CloakBrowser binary install check completed.");
    } catch (error) {
      setDiagnosticsError(commandMessage(error));
    }
  }

  async function cleanupSettingsBrowserProfiles() {
    setMaintenanceMessage("");
    try {
      const result = await cleanupOrphanedBrowserProfiles();
      setMaintenanceMessage(
        `Deleted ${result.deleted_profiles.length} orphaned profile${
          result.deleted_profiles.length === 1 ? "" : "s"
        }; reclaimed ${formatMaintenanceBytes(result.reclaimed_bytes)}.`,
      );
      await loadSettingsDiagnostics();
    } catch (error) {
      setDiagnosticsError(commandMessage(error));
    }
  }

  return {
    diagnostics,
    diagnosticsLoading,
    diagnosticsError,
    maintenanceMessage,
    loadSettingsDiagnostics,
    installSettingsBrowserBinary,
    cleanupSettingsBrowserProfiles,
  };
}
