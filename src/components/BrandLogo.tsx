import { Link } from "@tanstack/react-router";

export function BrandLogo({ className = "", link = false }: { className?: string; link?: boolean }) {
  const logo = (
    <span className={`brand-logo ${className}`} role="img" aria-label="JumboCM">
      <span className="brand-logo-mark" aria-hidden="true">↗</span>
      <span className="brand-logo-wordmark">JumboCM <strong>Invest</strong></span>
    </span>
  );

  return link ? <Link to="/login">{logo}</Link> : logo;
}
