import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReferralNetwork } from "@/components/referral/ReferralNetwork";
import { useMyReferrals } from "@/hooks/useMyReferrals";

export const Route = createFileRoute("/dashboard/referrals")({
  head: () => ({
    meta: [
      { title: "My referrals — JumboCM" },
      {
        name: "description",
        content: "Track everyone you referred to JumboCM and the investment plan they are running.",
      },
      { property: "og:title", content: "My referrals — JumboCM" },
      {
        property: "og:description",
        content: "See your referral team and their active investment plans.",
      },
      { property: "og:type", content: "website" },
      { property: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const { rows, loading, error } = useMyReferrals();
  const active = rows.filter((r) => r.investment_status === "active").length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="px-2">
          <Link to="/dashboard/refer">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl text-primary md:text-3xl">My referrals</h1>
          <p className="text-xs text-muted-foreground">Everyone who joined with your link.</p>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to="/dashboard/refer">
            <Share2 className="h-4 w-4" /> Invite
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total referrals
          </div>
          <div className="mt-1 font-display text-2xl font-bold uppercase tabular-nums text-primary">
            {rows.length}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            With active plan
          </div>
          <div className="mt-1 font-display text-2xl font-bold uppercase tabular-nums text-success">
            {active}
          </div>
        </div>
      </div>

      <ReferralNetwork rows={rows} loading={loading} error={error} />
    </motion.div>
  );
}
