import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Referral = {
  user_id: string;
  full_name: string | null;
  joined_at: string | null;
  plan_name: string | null;
  invested: number | null;
  investment_status: string | null;
};

/** Loads the signed-in user's referral network from the `my_referrals` RPC. */
export function useMyReferrals() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: err } = await (supabase as any).rpc("my_referrals");
      if (err) setError(err.message);
      setRows((data as Referral[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  return { rows, loading, error };
}
