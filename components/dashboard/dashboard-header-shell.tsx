import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { requireUser } from "@/lib/auth/user";
import { getNotificationSummaryForUser } from "@/lib/notifications";

export async function DashboardHeaderShell() {
  const user = await requireUser();
  const notificationSummary = await getNotificationSummaryForUser(user);

  return <DashboardHeader user={user} notificationSummary={notificationSummary} />;
}
