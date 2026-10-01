import { useState } from "react";
import { Send, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatXAF } from "@/lib/format";

export function TransferSheet({
  open,
  onOpenChange,
  userId,
  onTransferSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  onTransferSuccess: (amount: number) => void;
}) {
  const [transferBusy, setTransferBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [transferDraft, setTransferDraft] = useState<{
    email: string;
    amount: number;
    note: string | null;
  } | null>(null);
  const [confirmPin, setConfirmPin] = useState("");

  function sendTransfer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;
    const values = new FormData(e.currentTarget);
    const amount = Number(values.get("transfer_amount"));
    setTransferDraft({
      email: String(values.get("recipient_email") ?? "").trim(),
      amount,
      note: String(values.get("transfer_note") ?? "").trim() || null,
    });
  }

  async function submitPin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;
    setPinBusy(true);
    const pin = String(new FormData(e.currentTarget).get("new_pin") ?? "");
    const { error } = await supabase.rpc("set_transfer_pin", { _pin: pin });
    setPinBusy(false);
    if (error) return toast.error(error.message);
    e.currentTarget.reset();
    toast.success("Transfer PIN saved");
  }

  async function confirmTransfer() {
    if (!transferDraft) return;
    setTransferBusy(true);
    const { error } = await supabase.rpc("create_transfer", {
      _recipient_email: transferDraft.email,
      _amount: transferDraft.amount,
      _pin: confirmPin,
      _note: transferDraft.note ?? undefined,
    });
    setTransferBusy(false);
    if (error) return toast.error(error.message);
    onTransferSuccess(transferDraft.amount);
    setTransferDraft(null);
    setConfirmPin("");
    toast.success("Transfer sent securely");
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl px-5 pb-8 pt-3"
        >
          {/* Drag handle */}
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
          <SheetHeader className="px-0 text-center">
            <SheetTitle className="text-base">Transfer</SheetTitle>
          </SheetHeader>

          <Tabs defaultValue="send" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="send">Send</TabsTrigger>
              <TabsTrigger value="pin">Set PIN</TabsTrigger>
            </TabsList>

            <TabsContent value="send" className="mt-4 space-y-3">
              <form onSubmit={sendTransfer} className="space-y-3">
                <div>
                  <Label htmlFor="recipient_email" className="text-xs">
                    Recipient email
                  </Label>
                  <Input
                    id="recipient_email"
                    name="recipient_email"
                    type="email"
                    required
                    maxLength={254}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="transfer_amount" className="text-xs">
                    Amount
                  </Label>
                  <Input
                    id="transfer_amount"
                    name="transfer_amount"
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    className="mt-1"
                  />
                </div>
                <Input
                  name="transfer_note"
                  placeholder="Note (optional)"
                  maxLength={160}
                />
                <Button type="submit" disabled={transferBusy} className="w-full">
                  <Send className="mr-2 h-4 w-4" />
                  {transferBusy ? "Sending…" : "Send transfer"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="pin" className="mt-4 space-y-3">
              <form onSubmit={submitPin} className="space-y-3">
                <div>
                  <Label htmlFor="new_pin" className="text-xs">
                    Transfer PIN
                  </Label>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Choose a 4–6 digit PIN and keep it private.
                  </p>
                  <Input
                    id="new_pin"
                    name="new_pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{4,6}"
                    minLength={4}
                    maxLength={6}
                    placeholder="4–6 digits"
                    required
                  />
                </div>
                <Button type="submit" disabled={pinBusy} className="w-full">
                  <KeyRound className="mr-2 h-4 w-4" />
                  {pinBusy ? "Saving…" : "Save PIN"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Transfer confirmation dialog (nested, renders above the sheet) */}
      <Dialog
        open={Boolean(transferDraft)}
        onOpenChange={(open) => {
          if (!open && !transferBusy) {
            setTransferDraft(null);
            setConfirmPin("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm transfer</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter your transfer PIN to send{" "}
            {transferDraft ? formatXAF(transferDraft.amount) : ""}.
          </p>
          <Input
            value={confirmPin}
            onChange={(e) =>
              setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="4–6 digit PIN"
            aria-label="Transfer PIN"
          />
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setTransferDraft(null);
                setConfirmPin("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={transferBusy || confirmPin.length < 4}
              onClick={confirmTransfer}
            >
              {transferBusy ? "Sending…" : "Confirm transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
