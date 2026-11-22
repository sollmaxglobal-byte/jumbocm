import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle, MapPin } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useI18n } from "@/hooks/useI18n";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — JumboCM" },
      { name: "description", content: "Reach the JumboCM team by phone, WhatsApp or email." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="bg-hero py-20 text-primary-foreground">
        <div className="mx-auto max-w-4xl px-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            {t("Contact")}
          </div>
          <h1 className="mt-3 font-display text-5xl md:text-6xl">{t("We're here to help.")}</h1>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { i: Mail, t: t("Email"), d: "support@camvcc.com" },
            { i: MessageCircle, t: "WhatsApp", d: "+237 6 70 00 00 00" },
            { i: MapPin, t: t("Office"), d: t("Douala, Cameroon") },
          ].map(({ i: Icon, t: label, d }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-gold">
                <Icon className="h-5 w-5" />
              </div>
              <div className="font-display text-xl text-primary">{label}</div>
              <div className="mt-1 text-sm text-muted-foreground">{d}</div>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
