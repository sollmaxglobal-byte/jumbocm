import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Loads Tidio only when an administrator has configured a real public key. */
export function TidioLoader() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let key = "";
      try {
        const { data } = await supabase
          .from("public_settings")
          .select("tidio_public_key")
          .maybeSingle();
        const saved = data?.tidio_public_key?.trim();
        if (saved) key = saved;
      } catch {
        return;
      }
      if (cancelled || !key) return;
      if (document.getElementById("tidio-script")) return;
      const s = document.createElement("script");
      s.id = "tidio-script";
      s.src = `//code.tidio.co/${key}.js`;
      s.async = true;
      document.body.appendChild(s);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
