import { createFileRoute } from "@tanstack/react-router";
import { InvestmentWizard } from "@/components/invest/InvestmentWizard";

export const Route = createFileRoute("/dashboard/invest")({
  component: InvestPage,
});

function InvestPage() {
  return <InvestmentWizard />;
}
