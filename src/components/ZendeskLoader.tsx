import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

function extractWidgetKey(value: string) {
  const trimmed = value.trim();
  const snippetMatch = trimmed.match(/snippet\.js\?key=([^"'&\s>]+)/i);
  const key = (snippetMatch?.[1] ?? trimmed).trim();
  return /^[a-z0-9-]{10,}$/i.test(key) ? key : "";
}

export function ZendeskLoader() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from("public_settings")
        .select("zendesk_widget_key")
        .eq("id", 1)
        .maybeSingle();

      const key = extractWidgetKey(data?.zendesk_widget_key ?? "");
      if (cancelled || !key || document.getElementById("ze-snippet")) return;

      const script = document.createElement("script");
      script.id = "ze-snippet";
      script.async = true;
      script.src = `https://static.zdassets.com/ekr/snippet.js?key=${encodeURIComponent(key)}`;
      script.onerror = () => script.remove();
      document.body.appendChild(script);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}