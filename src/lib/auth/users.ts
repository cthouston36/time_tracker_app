import type { AuthUser } from "@/lib/auth/types";

type LocalUser = AuthUser & {
  password?: string;
};

const users: LocalUser[] = [
  {
    id: "caleb",
    firstName: "Caleb",
    lastName: "Houston",
    password: process.env.LOCAL_ADMIN_PASSWORD,
    role: "admin"
  },
  {
    id: "calebpm",
    firstName: "Caleb",
    lastName: "Houston",
    password: process.env.LOCAL_PM_PASSWORD,
    role: "project_manager"
  },
  {
    id: "field",
    firstName: "Field",
    lastName: "User",
    password: process.env.LOCAL_FIELD_PASSWORD,
    role: "standard"
  }
];

export function validateLocalUser(userId: string, password: string): AuthUser | null {
  const user = users.find((candidate) => candidate.id === userId && candidate.password && candidate.password === password);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role
  };
}
