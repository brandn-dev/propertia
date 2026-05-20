import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/user";
import {
  deleteOwnUserAction,
  updateUserAction,
} from "@/app/(dashboard)/users/actions";
import { UserForm } from "@/components/users/user-form";
import { prisma } from "@/lib/prisma";

type EditUserPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

export default async function EditUserPage({ params }: EditUserPageProps) {
  const currentUser = await requireRole("ADMIN");
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      capabilities: true,
      avatarUrl: true,
      isActive: true,
    },
  });

  if (!user) {
    notFound();
  }

  const isSelf = currentUser.id === user.id;
  const otherAdminCount = isSelf
    ? await prisma.user.count({
        where: {
          role: "ADMIN",
          id: { not: user.id },
          isActive: true,
        },
      })
    : 0;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">
          Users
        </p>
        <h1 className="text-2xl font-semibold tracking-[-0.05em] sm:text-[1.9rem]">
          Edit user
        </h1>
        <p className="text-sm text-muted-foreground">
          Update account details, access, password, and avatar.
        </p>
      </header>

      <UserForm
        mode="edit"
        formAction={updateUserAction.bind(null, user.id)}
        selfDeleteAction={isSelf ? deleteOwnUserAction.bind(null, user.id) : undefined}
        selfDeleteDisabledReason={
          isSelf && otherAdminCount === 0
            ? "Create another active admin before deleting this account."
            : undefined
        }
        initialValues={{
          displayName: user.displayName,
          username: user.username,
          role: user.role,
          capabilities: user.capabilities,
          avatarUrl: user.avatarUrl ?? "",
          isActive: user.isActive,
        }}
      />
    </div>
  );
}
