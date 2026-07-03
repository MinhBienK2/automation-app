import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { listUsers, createUser, deleteUser } from "../../../lib/workflowApi";

interface User {
  id: string;
  email: string;
  role: "admin" | "user";
  created_at: string;
}

export function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      const u = await listUsers();
      setUsers(u as User[]);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await createUser({ email, password, role });
      setSuccess(`User ${email} created successfully`);
      setEmail("");
      setPassword("");
      setRole("user");
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}?`)) return;

    setError(null);
    setSuccess(null);

    try {
      await deleteUser({ id });
      setSuccess(`User ${userEmail} deleted successfully`);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to delete user");
    }
  };

  return (
    <section className="app-screen admin-panel-screen" aria-label="Admin User Management">
      <header className="app-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>User Management</h1>
        </div>
      </header>

      <div className="settings-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginTop: "1rem" }}>
        {/* Create User Panel */}
        <section className="panel" aria-label="Create User Account">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Account creation</p>
              <h2>Add New User</h2>
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="settings-maintenance-actions" style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem 0" }}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "user")}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  background: "rgba(2, 6, 17, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#f8fafc",
                }}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {error && <p className="error-message">{error}</p>}
            {success && <p style={{ color: "#4ade80", fontSize: "0.875rem", textAlign: "center" }}>{success}</p>}

            <Button type="submit" disabled={loading} style={{ marginTop: "1rem" }}>
              {loading ? "Creating..." : "Create User"}
            </Button>
          </form>
        </section>

        {/* Users List Panel */}
        <section className="panel" aria-label="Users List">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Registered Users</p>
              <h2>Users Directory</h2>
            </div>
          </div>

          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: u.role === "admin" ? "rgba(59, 130, 246, 0.2)" : "rgba(148, 163, 184, 0.2)",
                          color: u.role === "admin" ? "#60a5fa" : "#cbd5e1",
                        }}
                      >
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleDeleteUser(u.id, u.email)}
                        style={{ color: "#ef4444", padding: "4px 8px" }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
