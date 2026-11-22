import { Link } from "@tanstack/react-router";
import { BadgeCheck, Eye, EyeOff, ShieldCheck, TrendingUp, UserPlus, Wallet } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BrandLogo } from "@/components/BrandLogo";
import { useI18n } from "@/hooks/useI18n";

/**
 * Full-screen investment-platform auth layout.
 * One viewport, no page scroll: brand panel on the left, form panel on the right.
 * `referralName` is shown in the top bar while a referred visitor registers.
 */
export function AuthTerminalShell({
  children,
  referralName,
}: {
  children: ReactNode;
  referralName?: string | null;
}) {
  const { t } = useI18n();

  return (
    <div className="auth-root">
      <header className="auth-top">
        <Link to="/" aria-label="JumboCM home" className="auth-brandmark">
          <BrandLogo className="h-7 auth-logo" />
        </Link>

        <div className="auth-top-mid">
          {referralName && (
            <div className="auth-refchip" title={`${t("auth.invitedBy")} ${referralName}`}>
              <UserPlus className="h-3.5 w-3.5 shrink-0" />
              <span className="auth-refchip-label">{t("auth.invitedBy")}</span>
              <strong>{referralName}</strong>
            </div>
          )}
        </div>

        <div className="auth-top-right">
          <span className="auth-secure">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("auth.secureSession")}
          </span>
          <LanguageToggle variant="auth" />
        </div>
      </header>

      <div className="auth-body">
        <aside className="auth-hero" aria-hidden="false">
          <span className="auth-kicker">
            <TrendingUp className="h-3.5 w-3.5" />
            {t("landing.badge")}
          </span>

          <h1 className="auth-hero-title">
            {t("auth.heroLine1")} <em>{t("auth.heroLine2")}</em>
          </h1>
          <p className="auth-hero-sub">{t("auth.heroSub")}</p>

          <ul className="auth-trust">
            <li className="auth-trust-item">
              <span className="auth-trust-icon">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <strong>{t("auth.trustPlans")}</strong>
                <span>{t("auth.trustPlansSub")}</span>
              </div>
            </li>
            <li className="auth-trust-item">
              <span className="auth-trust-icon">
                <Wallet className="h-4 w-4" />
              </span>
              <div>
                <strong>{t("auth.trustPayouts")}</strong>
                <span>{t("auth.trustPayoutsSub")}</span>
              </div>
            </li>
            <li className="auth-trust-item">
              <span className="auth-trust-icon">
                <BadgeCheck className="h-4 w-4" />
              </span>
              <div>
                <strong>{t("auth.trustSecurity")}</strong>
                <span>{t("auth.trustSecuritySub")}</span>
              </div>
            </li>
          </ul>

          <div className="auth-chart">
            <div className="auth-chart-head">
              <span>{t("auth.chartTitle")}</span>
              <span className="auth-chart-tag">XAF</span>
            </div>
            <svg viewBox="0 0 320 88" role="presentation" preserveAspectRatio="none">
              <defs>
                <linearGradient id="auth-chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e8c98a" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#e8c98a" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="auth-chart-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8fae9d" />
                  <stop offset="100%" stopColor="#e8c98a" />
                </linearGradient>
              </defs>
              <path
                d="M0,76 C28,72 46,60 70,62 C96,64 110,46 136,48 C160,50 176,36 200,32 C226,28 244,20 268,15 C288,11 304,8 320,4 L320,88 L0,88 Z"
                fill="url(#auth-chart-fill)"
              />
              <path
                d="M0,76 C28,72 46,60 70,62 C96,64 110,46 136,48 C160,50 176,36 200,32 C226,28 244,20 268,15 C288,11 304,8 320,4"
                fill="none"
                stroke="url(#auth-chart-line)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="auth-chart-foot">
              <span>{t("auth.chartFoot")}</span>
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
          </div>

          <p className="auth-hero-note">{t("auth.disclaimer")}</p>
        </aside>

        <main className="auth-pane">
          <div className="auth-pane-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
};

/** Labelled input; password fields get a show/hide toggle. */
export function TerminalField({ label, error, type = "text", id, ...rest }: FieldProps) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className={`auth-input${error ? " is-error" : ""}`}>
        <input id={id} type={isPw && show ? "text" : type} {...rest} />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="auth-eye"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
