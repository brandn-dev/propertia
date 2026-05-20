import Link from "next/link";
import { PencilLine, Plus, ShieldCheck, UserRoundCheck, UserRoundX, Users2 } from "lucide-react";
import { toggleUserActiveAction } from "@/app/(dashboard)/users/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/user";
import { CAPABILITY_LABELS, ROLE_LABELS } from "@/lib/auth/roles";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function describeCapabilities(capabilities: string[]) {
  if (capabilities.length === 0) {
    return "Full access";
  }

  const labels = capabilities.map(
    (capability) => CAPABILITY_LABELS[capability as keyof typeof CAPABILITY_LABELS]
  );

  if (labels.length <= 3) {
    return labels.join(" · ");
  }

  return `${labels.slice(0, 3).join(" · ")} +${labels.length - 3} more`;
}

function MetricPill({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users2;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <span className="text-xl font-semibold tracking-[-0.04em]">{value}</span>
      </div>
    </div>
  );
}

export default async function UsersPage() {
  const currentUser = await requireRole("ADMIN");
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      capabilities: true,
      isActive: true,
      lastLoginAt: true,
      avatarUrl: true,
    },
  });

  const adminCount = users.filter((user) => user.role === "ADMIN").length;
  const activeCount = users.filter((user) => user.isActive).length;
  const staffCount = users.length - adminCount;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.05em] sm:text-[2rem]">
          Users
        </h1>
        <Button render={<Link href="/users/new" />} className="rounded-full">
          <Plus />
          New user
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricPill label="Records" value={String(users.length)} icon={Users2} />
        <MetricPill label="Admins" value={String(adminCount)} icon={ShieldCheck} />
        <MetricPill label="Staff" value={String(staffCount)} icon={UserRoundCheck} />
        <MetricPill label="Active" value={String(activeCount)} icon={UserRoundCheck} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Registry
          </h2>
          <Badge variant="outline" className="rounded-full">
            {users.length} users
          </Badge>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60">
                <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  User
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Role
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Access
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Last login
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="border-border/60">
                  <TableCell className="px-3 py-3 align-top">
                    <div className="flex items-start gap-3">
                      <Avatar size="lg">
                        {user.avatarUrl ? (
                          <AvatarImage src={user.avatarUrl} alt={`${user.displayName} avatar`} />
                        ) : null}
                        <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                          {getInitials(user.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-medium">{user.displayName}</p>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3 align-top">
                    {ROLE_LABELS[user.role]}
                  </TableCell>
                  <TableCell className="px-3 py-3 align-top">
                    <p className="max-w-[26rem] text-sm text-muted-foreground">
                      {user.role === "ADMIN"
                        ? "Full access"
                        : describeCapabilities(user.capabilities)}
                    </p>
                  </TableCell>
                  <TableCell className="px-3 py-3 align-top">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                  </TableCell>
                  <TableCell className="px-3 py-3 align-top">
                    <Badge variant={user.isActive ? "secondary" : "outline"} className="rounded-full">
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right align-top">
                    <div className="flex justify-end gap-2">
                      <Button
                        render={<Link href={`/users/${user.id}/edit`} />}
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                      >
                        <PencilLine />
                        Edit
                      </Button>
                      <form
                        action={toggleUserActiveAction.bind(
                          null,
                          user.id,
                          !user.isActive
                        )}
                      >
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          disabled={currentUser.id === user.id && user.isActive}
                        >
                          {user.isActive ? <UserRoundX /> : <UserRoundCheck />}
                          {user.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
