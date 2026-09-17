import LoginForm from "./LoginForm";
import { all } from "@/lib/db";
import { GROUPS, GROUP_ORDER, ROLES, type Group, type Role } from "@/lib/policy";

export const dynamic = "force-dynamic";

type Row = { code: string; name: string; group_key: Group; role: Role; division: string };

export default function LoginPage() {
  // Бүлэг тус бүрээс нэг энгийн гишүүн, дээр нь эрх бүхий бүх хүн.
  const members = GROUP_ORDER.flatMap((g) =>
    all<Row>(
      `SELECT code, name, group_key, role, division FROM users
       WHERE active = 1 AND role = 'MEMBER' AND group_key = ? ORDER BY id LIMIT 1`,
      g
    )
  );
  const officers = all<Row>(
    `SELECT code, name, group_key, role, division FROM users
     WHERE active = 1 AND role != 'MEMBER' ORDER BY id`
  );
  const demo = [...members, ...officers].map((r) => ({
    code: r.code,
    name: r.name,
    role:
      r.role === "MEMBER"
        ? GROUPS[r.group_key].label
        : r.role === "HANDLER"
          ? `Хариуцагч · ${r.division}`
          : `${GROUPS[r.group_key].label} · ${ROLES[r.role].label}`,
  }));
  return <LoginForm demo={demo} />;
}
