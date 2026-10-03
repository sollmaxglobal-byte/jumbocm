import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadPersonalizedMacro } from "@/lib/macrodroid";

type Props = {
  siteUrl?: string | null;
  secret?: string | null;
  pin?: string | null;
};

export function MacroDownloadButton({ siteUrl, secret, pin }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    if (!secret) {
      toast.error("Save your webhook secret before downloading the macro");
      return;
    }
    if (!pin) {
      toast.error("Add your Mobile Money PIN before downloading the macro");
      return;
    }
    setBusy(true);
    try {
      await downloadPersonalizedMacro({ siteUrl: siteUrl ?? "", secret, pin });
      toast.success("Macro downloaded — import it into MacroDroid");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={handleDownload}>
      <Download className="mr-2 h-4 w-4" />
      {busy ? "Preparing…" : "Download ready-to-use macro"}
    </Button>
  );
}
