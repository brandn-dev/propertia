import { requireRole } from "@/lib/auth/user";
import { createUserAction } from "@/app/(dashboard)/users/actions";
import { UserForm } from "@/components/users/user-form";

export default async function NewUserPage() {
  await requireRole("ADMIN");

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.05em] sm:text-[2rem]">
          Create user
        </h1>
        <p className="text-sm text-muted-foreground">
          Add a staff account, access scope, and optional profile photo.
        </p>
      </header>

      <UserForm mode="create" formAction={createUserAction} />
    </div>
  );
}
