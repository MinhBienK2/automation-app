import { commandError } from "../../commandHelpers.js";
import {
  authenticateUser,
  verifyToken,
  listUsers,
  createUser,
  deleteUser
} from "../../db/pgSync.js";
import type { DbAdapter } from "../../db/dbAdapter.js";
import type { User } from "../../db/pgSync.js";

export function createAuthCommands(database: DbAdapter) {
  async function login(input: any) {
    const { email, password } = input;
    if (!email || !password) {
      throw commandError("Email and password are required", "email");
    }
    const result = await authenticateUser(email, password);
    if (!result) {
      throw commandError("Invalid email or password", "password");
    }
    
    // Set the owner ID on the database wrapper so that queries are isolated
    database.ownerId = result.user.id;
    
    return result;
  }

  async function logout() {
    database.ownerId = null;
    return { ok: true };
  }

  async function me(input: { token: string }) {
    if (!input.token) return null;
    const user = await verifyToken(input.token);
    if (user) {
      database.ownerId = user.id;
      return user;
    }
    return null;
  }

  async function listAllUsers() {
    return listUsers();
  }

  async function createNewUser(input: any) {
    const { email, password, role } = input;
    if (!email || !password || !role) {
      throw commandError("Email, password and role are required", "email");
    }
    return createUser(email, password, role);
  }

  async function removeUser(input: { id: string }) {
    if (!input.id) throw commandError("User ID is required", "id");
    
    const users = await listUsers() as User[];
    const targetUser = users.find(u => u.id === input.id);
    
    if (targetUser && targetUser.role === "admin") {
      throw commandError("Cannot delete admin accounts", "role");
    }
    
    await deleteUser(input.id);
    return { ok: true };
  }

  return {
    login,
    logout,
    me,
    listUsers: listAllUsers,
    createUser: createNewUser,
    deleteUser: removeUser,
  };
}
