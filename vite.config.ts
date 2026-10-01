import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };

  const viteEnvDefine = Object.fromEntries(
    Object.entries(loadEnv(mode, process.cwd(), "VITE_")).map(([key, value]) => [
      `import.meta.env.${key}`,
      JSON.stringify(value),
    ]),
  );

  return {
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Route the bundled server entry through src/server.ts (SSR error wrapper + security headers).
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      // Explicitly select the Vercel preset when building on Vercel so the Nitro
    // beta generates the Build Output API (.vercel/output.json) regardless of
    // auto-detection quirks.  Local builds fall back to the default preset.
    ...(command === "build" ? [nitro(process.env.VERCEL ? { preset: "vercel" } : {})] : []),
      viteReact(),
    ],
    // The project stores Supabase variables with NEXT_PUBLIC_* names in Vercel,
    // while the browser bundle reads VITE_* values at build time.
    define: {
      ...viteEnvDefine,
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "",
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
          env.SUPABASE_ANON_KEY ||
          env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          env.SUPABASE_PUBLISHABLE_KEY ||
          "",
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "",
      ),
      "import.meta.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "",
      ),
      "import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          env.SUPABASE_PUBLISHABLE_KEY ||
          env.SUPABASE_ANON_KEY ||
          "",
      ),
    },
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: { host: true },
  };
});
