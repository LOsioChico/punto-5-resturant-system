import { PosClient } from "@/components/pos/pos-client";
import { AuthGuard } from "@/components/auth/auth-guard";

export const metadata = { title: "Mesero (POS)" };

export default function PosPage() {
  return (
    <AuthGuard role="waiter">
      <PosClient />
    </AuthGuard>
  );
}
