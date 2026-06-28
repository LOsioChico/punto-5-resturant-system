import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { AuthGuard } from "@/components/auth/auth-guard";

export const metadata = { title: "Panel principal" };

export default function DashboardPage() {
  return (
    <AuthGuard role="admin">
      <DashboardClient />
    </AuthGuard>
  );
}
