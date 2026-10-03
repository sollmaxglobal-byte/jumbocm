// Builds a ready-to-import MacroDroid macro file from the public template,
// injecting the admin's Site URL, webhook secret and Mobile Money PIN so the
// downloaded file works immediately without hand-editing any variable.

export type MacroConfig = {
  siteUrl: string;
  secret: string;
  pin: string;
};

const TEMPLATE_PATH = "/jumbocm-auto-withdrawal.macro.json";
const MACRO_FILENAME = "jumbocm-auto-withdrawal.macro.json";

type MacroVariable = { m_name?: string; m_stringValue?: string };
type MacroFile = { variables?: MacroVariable[] };

function setGlobalVariable(macro: MacroFile, name: string, value: string) {
  const variable = (macro.variables ?? []).find((v) => v?.m_name === name);
  if (variable) variable.m_stringValue = value;
}

export async function downloadPersonalizedMacro({ siteUrl, secret, pin }: MacroConfig) {
  const res = await fetch(TEMPLATE_PATH, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load the macro template");
  const macro = (await res.json()) as MacroFile;

  const base = (siteUrl || window.location.origin).replace(/\/$/, "");
  setGlobalVariable(macro, "jumbo_site", base);
  setGlobalVariable(macro, "jumbo_secret", secret);
  setGlobalVariable(macro, "jumbo_pin", pin);

  const blob = new Blob([JSON.stringify(macro, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = MACRO_FILENAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
