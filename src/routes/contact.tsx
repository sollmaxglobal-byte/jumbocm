import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Clock, Headphones, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { telegramLinks, whatsappLinks, type SupportLink } from "@/lib/support-links";
import { useI18n } from "@/hooks/useI18n";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Support — JumboCM" },
      {
        name: "description",
        content: "Reach the JumboCM support team on WhatsApp or Telegram for fast, human help.",
      },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { t } = useI18n();
  const [channels, setChannels] = useState<{ whatsapp: SupportLink[]; telegram: SupportLink[] }>({
    whatsapp: [],
    telegram: [],
  });

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase
          .from("public_settings")
          .select("support_whatsapp,support_telegram")
          .eq("id", 1)
          .maybeSingle();
        if (!data) return;
        setChannels({
          whatsapp: whatsappLinks(data.support_whatsapp),
          telegram: telegramLinks(data.support_telegram),
        });
      } catch {
        /* keep the channel cards in their unconfigured state */
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#06333B] via-[#0B4E57] to-[#127A6E] py-16 text-white md:py-24">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[#7BE3C4]/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
            <Headphones className="h-3 w-3" /> {t("Support center")}
          </span>
          <h1 className="mt-4 max-w-xl font-display text-4xl leading-[1.05] md:text-6xl">
            {t("We're here to help.")}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75 md:text-base">
            {t(
              "Talk to a real person from our Douala team. Fast answers on WhatsApp or Telegram — every day of the week.",
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { icon: MessageCircle, label: t("Real human support") },
              { icon: Clock, label: t("Replies in minutes") },
              { icon: ShieldCheck, label: t("Mon–Sat · 8:00–20:00 WAT") },
            ].map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/80"
              >
                <chip.icon className="h-3.5 w-3.5" /> {chip.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Support channels — one button per WhatsApp number and per Telegram link. */}
      <section className="mx-auto -mt-10 max-w-6xl px-4 pb-16 md:-mt-14 md:pb-24">
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <ChannelCard
            title={t("WhatsApp support")}
            description={t(
              "Chat one-to-one with our support team about deposits, withdrawals and your account.",
            )}
            cta={t("Chat on WhatsApp")}
            links={channels.whatsapp}
            icon={MessageCircle}
            tone="whatsapp"
          />
          <ChannelCard
            title={t("Telegram support")}
            description={t(
              "Join our official Telegram channel for updates, announcements and quick help.",
            )}
            cta={t("Open Telegram")}
            links={channels.telegram}
            icon={Send}
            tone="telegram"
          />
        </div>
      </section>
    </div>
  );
}

function ChannelCard({
  title,
  description,
  cta,
  links,
  icon: Icon,
  tone,
}: {
  title: string;
  description: string;
  cta: string;
  links: SupportLink[];
  icon: typeof MessageCircle;
  tone: "whatsapp" | "telegram";
}) {
  const { t } = useI18n();
  const accent =
    tone === "whatsapp"
      ? "bg-[#25D366]/12 text-[#128C7E] ring-[#25D366]/25"
      : "bg-[#229ED9]/12 text-[#1B7FAD] ring-[#229ED9]/25";
  const button =
    tone === "whatsapp"
      ? "bg-[#128C7E] text-white hover:bg-[#0F7568]"
      : "bg-[#1B7FAD] text-white hover:bg-[#166A91]";

  return (
    <div className="flex h-full flex-col rounded-3xl border border-border bg-card p-6 shadow-sm md:p-7">
      <span className={`grid h-12 w-12 place-items-center rounded-2xl ring-1 ring-inset ${accent}`}>
        <Icon className="h-6 w-6" />
      </span>
      <h2 className="mt-5 font-display text-2xl text-primary">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>

      {links.length ? (
        <div className="mt-6 flex flex-col gap-2">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`${cta} — ${link.label}`}
              className={`inline-flex items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${button}`}
            >
              <span className="truncate">{link.label}</span>
              <ArrowUpRight className="h-4 w-4 shrink-0" />
            </a>
          ))}
        </div>
      ) : (
        <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted-foreground">
          {t("Coming soon")}
        </span>
      )}
    </div>
  );
}
