import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUpCircle, Headphones, Home, Settings, TrendingUp } from "lucide-react";

function NavItem({
  to,
  label,
  icon: Icon,
  active = false,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  active?: boolean;
}) {
  return (
    <Link
      to={to as never}
      className={`flex flex-col items-center gap-1 py-1 text-[10px] font-medium transition ${
        active ? "text-[#00FF88]" : "text-white/45 hover:text-white/70"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="leading-none">{label}</span>
    </Link>
  );
}

/** App-wide bottom navigation for the customer dashboard. */
export function DashboardBottomNav({ className = "" }: { className?: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center ${className}`}>
      <div className="pointer-events-auto grid w-full max-w-md grid-cols-5 items-end border-t border-white/5 bg-[#0B0C0E]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.4rem)] pt-2 backdrop-blur-md">
        <NavItem to="/dashboard" label="Home" icon={Home} active={path === "/dashboard"} />
        <NavItem
          to="/dashboard/invest"
          label="Invest"
          icon={TrendingUp}
          active={path.startsWith("/dashboard/invest")}
        />
        <div className="flex flex-col items-center gap-1">
          <Link
            to="/plans"
            aria-label="Upgrade"
            className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-[#00FF88] text-[#04120B] shadow-[0_12px_30px_-6px_rgba(0,255,136,0.65)] ring-4 ring-[#0A0B0D] transition active:scale-95"
          >
            <ArrowUpCircle className="h-6 w-6" />
          </Link>
          <span className="text-[10px] font-medium leading-none text-white/45">Upgrade</span>
        </div>
        <NavItem
          to="/dashboard/profile"
          label="Settings"
          icon={Settings}
          active={path.startsWith("/dashboard/profile")}
        />
        <NavItem to="/contact" label="Support" icon={Headphones} active={path.startsWith("/contact")} />
      </div>
    </nav>
  );
}
