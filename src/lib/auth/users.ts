import type { AuthUser } from "@/lib/auth/types";

type LocalUser = AuthUser & {
  password: string;
};

const users: LocalUser[] = [
  {
    id: "caleb",
    firstName: "Caleb",
    lastName: "Houston",
    password: "calebadmin",
    role: "admin"
  },
  {
    id: "field",
    firstName: "Field",
    lastName: "User",
    password: "field",
    role: "standard"
  }
];

export function validateLocalUser(userId: string, password: string): AuthUser | null {
  const user = users.find((candidate) => candidate.id === userId && candidate.password === password);

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
