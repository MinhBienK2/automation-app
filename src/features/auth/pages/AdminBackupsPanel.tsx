import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import {
  listBackups,
  createBackup,
  deleteBackup,
  getBackupConfig,
  saveBackupConfig,
  openBackupsFolder,
} from "../../../lib/workflowApi";
import { Database, Clock, RefreshCw, Trash2, Settings, AlertTriangle, FolderOpen } from "lucide-react";
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
    return d.toLocaleString("vi-VN") || d.toLocaleString();
  };

  return (
    <section className="app-screen admin-panel-screen" aria-label="Admin Database Backups">
      <header className="app-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Database Backups</h1>
        </div>
      </header>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", gap: "1rem" }}>
          <RefreshCw className="animate-spin" size={32} style={{ color: "#3b82f6" }} />
          <p style={{ color: "#94a3b8" }}>Loading backups metadata...</p>
        </div>
      ) : (
        <div className="settings-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "2rem", marginTop: "1rem" }}>
          {/* Backup Config & Manual Trigger */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <section className="panel" aria-label="Manual Backup">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Database actions</p>
                  <h2>Backup Database Now</h2>
                </div>
              </div>
              <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: "1rem 0" }}>
                Manually trigger a full backup of the database immediately. The backup file will be created and saved in local storage.
              </p>
              <Button
                type="button"
                onClick={handleManualBackup}
                disabled={actionLoading !== null}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
              >
                {actionLoading === "backup" ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    <span>Backing up...</span>
                  </>
                ) : (
                  <>
                    <Database size={16} />
                    <span>Backup Now</span>
                  </>
                )}
              </Button>
            </section>

            <section className="panel" aria-label="Automatic Backup Configuration">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Automation settings</p>
                  <h2>Backup Configuration</h2>
                </div>
              </div>

              <form onSubmit={handleSaveConfig} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", padding: "1rem 0" }}>
                <div className="form-group" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label htmlFor="auto-backup-enabled" style={{ cursor: "pointer", fontWeight: 500 }}>
                    Enable Automatic Backups
                  </label>
                  <input
                    id="auto-backup-enabled"
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    style={{ width: "1.25rem", height: "1.25rem", cursor: "pointer" }}
                  />
                </div>

                {config.enabled && (
                  <>
                    <div className="form-group">
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Clock size={15} style={{ color: "#94a3b8" }} />
                        <span>Backup Interval (hours)</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="8760"
                        value={config.intervalHours}
                        onChange={(e) => setConfig({ ...config, intervalHours: parseInt(e.target.value) || 24 })}
                        required
                        style={{ width: "100%" }}
                      />
                      <p style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                        How often to run automatic backups (e.g. 24 for daily, 168 for weekly).
                      </p>
                    </div>

                    <div className="form-group">
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Settings size={15} style={{ color: "#94a3b8" }} />
                        <span>Maximum Retention Versions</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={config.maxKeepVersions}
                        onChange={(e) => setConfig({ ...config, maxKeepVersions: parseInt(e.target.value) || 10 })}
                        required
                        style={{ width: "100%" }}
                      />
                      <p style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                        Limits the total number of versions stored. Older backups will be automatically deleted when new ones are created.
                      </p>
                    </div>
                  </>
                )}

                <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <label htmlFor="backup-format" style={{ fontWeight: 500 }}>
                    Backup Format
                  </label>
                  <select
                    id="backup-format"
                    value={config.format}
                    onChange={(e) => setConfig({ ...config, format: e.target.value as "sql" | "custom" })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "rgba(30, 41, 59, 0.5)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#f8fafc",
                      fontSize: "0.875rem",
                    }}
                  >
                    <option value="sql">Plain SQL Script (.sql)</option>
                    <option value="custom">Binary Archive (.dump)</option>
                  </select>
                  <p style={{ color: "#64748b", fontSize: "0.75rem" }}>
                    {config.format === "sql"
                      ? "Natively generated SQL script. Runs on any DB editor without external tools."
                      : "Generated via pg_dump. Binary file, restorable via pg_restore / DBeaver 'Restore' menu."}
                  </p>
                  {config.format === "custom" && (
                    <div style={{ display: "flex", gap: "0.5rem", padding: "0.75rem", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: "6px", color: "#fbbf24", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                      <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                      <span>Requires postgresql-client (pg_dump version 17+) installed on the host OS.</span>
                    </div>
                  )}
                </div>

                {config.lastBackupAt && (
                  <p style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                    Last automatic backup: {formatDate(config.lastBackupAt)}
                  </p>
                )}

                <Button type="submit" disabled={actionLoading !== null} style={{ width: "100%" }}>
                  {actionLoading === "config" ? "Saving..." : "Save Configuration"}
                </Button>
              </form>
            </section>
          </div>

          {/* Backups List */}
          <section className="panel" aria-label="Backups List" style={{ display: "flex", flexDirection: "column" }}>
            <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p className="eyebrow">Local storage history</p>
                <h2>Backup Versions ({backups.length})</h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => openBackupsFolder().catch(err => showToast(err.message || "Failed to open folder"))}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#60a5fa" }}
              >
                <FolderOpen size={16} />
                <span>Open Folder</span>
              </Button>
            </div>

            <div style={{ flex: 1, maxHeight: "550px", overflowY: "auto", marginTop: "1rem" }}>
              {backups.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", color: "#64748b" }}>
                  <Database size={32} style={{ marginBottom: "0.5rem", strokeWidth: 1.5 }} />
                  <p>No backups available locally.</p>
                </div>
              ) : (
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Created Time</th>
                      <th>Size</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b) => (
                      <tr key={b.filename}>
                        <td style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#cbd5e1" }}>
                          {b.filename}
                        </td>
                        <td>{formatDate(b.createdAt)}</td>
                        <td style={{ color: "#94a3b8" }}>{formatBytes(b.size)}</td>
                        <td style={{ textAlign: "right" }}>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleDeleteBackup(b.filename)}
                            disabled={actionLoading !== null}
                            style={{ color: "#ef4444", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                          >
                            {actionLoading === `delete-${b.filename}` ? (
                              <RefreshCw className="animate-spin" size={14} />
                            ) : (
                              <>
                                <Trash2 size={14} />
                                <span>Delete</span>
                              </>
                            )}
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
            <DialogTitle>Xóa bản sao lưu?</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa bản sao lưu <strong>{deleteCandidate}</strong> không? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setDeleteCandidate(null)}
              disabled={actionLoading === `delete-${deleteCandidate}`}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={actionLoading === `delete-${deleteCandidate}`}
            >
              {actionLoading === `delete-${deleteCandidate}` ? "Đang xóa..." : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
