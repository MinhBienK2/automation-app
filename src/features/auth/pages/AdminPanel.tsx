import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Label } from "../../../components/ui/label";
import { Badge } from "../../../components/ui/badge";
import { listUsers, createUser, deleteUser } from "../../../lib/workflowApi";

interface User {
  id: string;
  email: string;
  role: "admin" | "user";
  created_at: string;
}

interface AdminPanelProps {
  currentUser?: User | null;
}

export function AdminPanel(_props: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; email: string } | null>(null);

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

  const handleDeleteUser = (id: string, userEmail: string) => {
    setDeleteCandidate({ id, email: userEmail });
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;

    const { id, email: userEmail } = deleteCandidate;
    setDeleteCandidate(null);
    setError(null);
    setSuccess(null);
    setDeletingUserId(id);

    try {
      await deleteUser({ id });
      setSuccess(`User ${userEmail} deleted successfully`);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <section className="app-screen admin-panel-screen" aria-label="Admin User Management">
      <header className="app-header mb-4">
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="text-2xl font-bold">User Management</h1>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
        {/* Create User Panel */}
        <section className="card bg-base-200 border border-base-300 card-body p-6" aria-label="Create User Account">
          <div className="panel-heading border-b border-base-300 pb-3 mb-4">
            <div>
              <p className="eyebrow">Account creation</p>
              <h2 className="text-lg font-bold">Add New User</h2>
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
            <div className="form-group flex flex-col gap-1">
              <Label htmlFor="create-email">Email Address</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-base-100 border-base-300 input-sm"
                required
              />
            </div>

            <div className="form-group flex flex-col gap-1">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-base-100 border-base-300 input-sm"
                required
              />
            </div>

            <div className="form-group flex flex-col gap-1">
              <Label htmlFor="create-role">Role</Label>
              <Select
                id="create-role"
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "user")}
                className="bg-base-100 border-base-300 select-sm"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </Select>
            </div>

            {error && <p className="text-error text-xs font-medium mt-1">{error}</p>}
            {success && <p className="text-success text-xs font-medium mt-1">{success}</p>}

            <Button type="submit" disabled={loading} loading={loading} className="btn-primary w-full mt-2">
              Create User
            </Button>
          </form>
        </section>

        {/* Users List Panel */}
        <section className="card bg-base-200 border border-base-300 card-body p-6" aria-label="Users List">
          <div className="panel-heading border-b border-base-300 pb-3 mb-4">
            <div>
              <p className="eyebrow">Registered Users</p>
              <h2 className="text-lg font-bold">Users Directory</h2>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            <table className="table table-sm table-zebra w-full">
              <thead>
                <tr>
                  <th className="text-base-content/75 font-semibold">Email</th>
                  <th className="text-base-content/75 font-semibold">Role</th>
                  <th className="text-base-content/75 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="hover">
                    <td className="font-mono text-xs">{u.email}</td>
                    <td>
                      <Badge variant={u.role === "admin" ? "running" : "secondary"}>
                        {u.role.toUpperCase()}
                      </Badge>
                    </td>
                    <td>
                      {u.role === "admin" ? (
                        <span className="text-secondary/50 text-xs">—</span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          className="btn-xs text-error hover:bg-error/10 hover:text-error"
                          disabled={deletingUserId !== null}
                          loading={deletingUserId === u.id}
                        >
                          Delete
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog open={!!deleteCandidate} onOpenChange={(o) => !o && setDeleteCandidate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa người dùng?</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa người dùng <strong>{deleteCandidate?.email}</strong> không? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setDeleteCandidate(null)}
              disabled={deletingUserId !== null}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={deletingUserId !== null}
              loading={deletingUserId !== null}
            >
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
