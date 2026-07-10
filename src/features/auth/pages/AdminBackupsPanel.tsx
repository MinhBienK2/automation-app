import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Label } from "../../../components/ui/label";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  listBackups,
  createBackup,
  deleteBackup,
  getBackupConfig,
  saveBackupConfig,
  openBackupsFolder,
} from "../../../lib/workflowApi";
import { Database, Clock, Trash2, Settings, AlertTriangle, FolderOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";

interface BackupFile {
  filename: string;
  createdAt: string;
  size: number;
}

interface BackupConfig {
  enabled: boolean;
  intervalHours: number;
  maxKeepVersions: number;
  lastBackupAt: string | null;
  format: "sql" | "custom";
}

export function AdminBackupsPanel({ showToast }: { showToast: (message: string) => void }) {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [config, setConfig] = useState<BackupConfig>({
    enabled: false,
    intervalHours: 24,
    maxKeepVersions: 10,
    lastBackupAt: null,
    format: "sql",
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [files, cfg] = await Promise.all([listBackups(), getBackupConfig()]);
      setBackups(files);
      setConfig(cfg);
    } catch (err: any) {
      showToast(err.message || "Failed to load backups data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleManualBackup = async () => {
    setActionLoading("backup");
    try {
      const newBackup = await createBackup(config.format);
      showToast(`Backup ${newBackup.filename} created successfully.`);
      // Refresh list
      const files = await listBackups();
      setBackups(files);
    } catch (err: any) {
      showToast(err.message || "Manual backup failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteBackup = (filename: string) => {
    setDeleteCandidate(filename);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    const filename = deleteCandidate;
    setDeleteCandidate(null);
    setActionLoading(`delete-${filename}`);
    try {
      await deleteBackup(filename);
      showToast(`Deleted backup ${filename}.`);
      // Refresh list
      const files = await listBackups();
      setBackups(files);
    } catch (err: any) {
      showToast(err.message || "Failed to delete backup file");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("config");
    try {
      await saveBackupConfig(config);
      showToast("Backup configuration saved successfully.");
      // Refresh config to be sure
      const cfg = await getBackupConfig();
      setConfig(cfg);
    } catch (err: any) {
      showToast(err.message || "Failed to save configuration");
    } finally {
      setActionLoading(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString() || d.toLocaleString();
  };

  return (
    <section className="app-screen admin-panel-screen" aria-label="Admin Database Backups">
      <header className="app-header mb-4">
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="text-2xl font-bold">Database Backups</h1>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-[300px] gap-4 text-secondary">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-sm">Loading backups metadata...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
          {/* Backup Config & Manual Trigger */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <section className="card bg-base-200 border border-base-300 card-body p-6" aria-label="Manual Backup">
              <div className="panel-heading border-b border-base-300 pb-3 mb-4">
                <div>
                  <p className="eyebrow">Database actions</p>
                  <h2 className="text-lg font-bold">Backup Database Now</h2>
                </div>
              </div>
              <p className="text-secondary text-sm mb-4">
                Manually trigger a full backup of the database immediately. The backup file will be created and saved in local storage.
              </p>
              <Button
                type="button"
                onClick={handleManualBackup}
                disabled={actionLoading !== null}
                loading={actionLoading === "backup"}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Database size={16} />
                <span>Backup Now</span>
              </Button>
            </section>

            <section className="card bg-base-200 border border-base-300 card-body p-6" aria-label="Automatic Backup Configuration">
              <div className="panel-heading border-b border-base-300 pb-3 mb-4">
                <div>
                  <p className="eyebrow">Automation settings</p>
                  <h2 className="text-lg font-bold">Backup Configuration</h2>
                </div>
              </div>

              <form onSubmit={handleSaveConfig} className="flex flex-col gap-4">
                <div className="flex items-center justify-between py-1">
                  <Label htmlFor="auto-backup-enabled" className="cursor-pointer font-semibold text-sm text-base-content">
                    Enable Automatic Backups
                  </Label>
                  <Checkbox
                    id="auto-backup-enabled"
                    className="checkbox-sm"
                    checked={config.enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                  />
                </div>

                {config.enabled && (
                  <>
                    <div className="form-group flex flex-col gap-1">
                      <Label className="flex items-center gap-2">
                        <Clock size={15} className="text-secondary" />
                        <span>Backup Interval (hours)</span>
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        max="8760"
                        value={config.intervalHours}
                        onChange={(e) => setConfig({ ...config, intervalHours: parseInt(e.target.value) || 24 })}
                        className="bg-base-100 border-base-300 input-sm"
                        required
                      />
                      <p className="text-secondary/70 text-xs mt-0.5">
                        How often to run automatic backups (e.g. 24 for daily, 168 for weekly).
                      </p>
                    </div>

                    <div className="form-group flex flex-col gap-1">
                      <Label className="flex items-center gap-2">
                        <Settings size={15} className="text-secondary" />
                        <span>Maximum Retention Versions</span>
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={config.maxKeepVersions}
                        onChange={(e) => setConfig({ ...config, maxKeepVersions: parseInt(e.target.value) || 10 })}
                        className="bg-base-100 border-base-300 input-sm"
                        required
                      />
                      <p className="text-secondary/70 text-xs mt-0.5">
                        Limits the total number of versions stored. Older backups will be automatically deleted when new ones are created.
                      </p>
                    </div>
                  </>
                )}

                <div className="form-group flex flex-col gap-1">
                  <Label htmlFor="backup-format">Backup Format</Label>
                  <Select
                    id="backup-format"
                    value={config.format}
                    onChange={(e) => setConfig({ ...config, format: e.target.value as "sql" | "custom" })}
                    className="bg-base-100 border-base-300 select-sm"
                  >
                    <option value="sql">Plain SQL Script (.sql)</option>
                    <option value="custom">Binary Archive (.dump)</option>
                  </Select>
                  <p className="text-secondary/70 text-xs mt-0.5">
                    {config.format === "sql"
                      ? "Natively generated SQL script. Runs on any DB editor without external tools."
                      : "Generated via pg_dump. Binary file, restorable via pg_restore / DBeaver 'Restore' menu."}
                  </p>
                  {config.format === "custom" && (
                    <div className="alert alert-warning text-xs p-3 flex gap-2 items-start mt-1">
                      <AlertTriangle size={16} className="shrink-0" />
                      <span>Requires postgresql-client (pg_dump version 17+) installed on the host OS.</span>
                    </div>
                  )}
                </div>

                {config.lastBackupAt && (
                  <p className="text-secondary/80 text-xs italic">
                    Last automatic backup: {formatDate(config.lastBackupAt)}
                  </p>
                )}

                <Button type="submit" disabled={actionLoading !== null} loading={actionLoading === "config"} className="btn-primary w-full mt-2">
                  Save Configuration
                </Button>
              </form>
            </section>
          </div>

          {/* Backups List */}
          <section className="card bg-base-200 border border-base-300 card-body p-6 lg:col-span-2 flex flex-col" aria-label="Backups List">
            <div className="panel-heading border-b border-base-300 pb-3 mb-4 flex justify-between items-center">
              <div>
                <p className="eyebrow">Local storage history</p>
                <h2 className="text-lg font-bold">Backup Versions ({backups.length})</h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => openBackupsFolder().catch(err => showToast(err.message || "Failed to open folder"))}
                className="flex items-center gap-2 text-primary hover:bg-primary/10 hover:text-primary btn-sm"
              >
                <FolderOpen size={16} />
                <span>Open Folder</span>
              </Button>
            </div>

            <div className="flex-1 max-h-[550px] overflow-y-auto mt-2">
              {backups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-secondary">
                  <Database size={32} className="mb-2 stroke-[1.5]" />
                  <p className="text-sm">No backups available locally.</p>
                </div>
              ) : (
                <table className="table table-sm table-zebra w-full">
                  <thead>
                    <tr>
                      <th className="text-base-content/75 font-semibold">Filename</th>
                      <th className="text-base-content/75 font-semibold">Created Time</th>
                      <th className="text-base-content/75 font-semibold">Size</th>
                      <th className="text-base-content/75 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b) => (
                      <tr key={b.filename} className="hover">
                        <td className="font-mono text-xs text-base-content font-medium">
                          {b.filename}
                        </td>
                        <td className="text-xs">{formatDate(b.createdAt)}</td>
                        <td className="text-secondary text-xs">{formatBytes(b.size)}</td>
                        <td className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleDeleteBackup(b.filename)}
                            disabled={actionLoading !== null}
                            loading={actionLoading === `delete-${b.filename}`}
                            className="btn-xs text-error hover:bg-error/10 hover:text-error inline-flex items-center gap-1"
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}

      <Dialog open={!!deleteCandidate} onOpenChange={(o) => !o && setDeleteCandidate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Backup?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete backup <strong>{deleteCandidate}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setDeleteCandidate(null)}
              disabled={actionLoading === `delete-${deleteCandidate}`}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={actionLoading === `delete-${deleteCandidate}`}
              loading={actionLoading === `delete-${deleteCandidate}`}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
