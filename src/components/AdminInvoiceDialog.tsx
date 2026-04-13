import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const invoiceSchema = z.object({
  amount: z.number()
    .int('Amount must be a whole number')
    .min(1, 'Minimum amount is 1 KES')
    .max(10000000, 'Maximum amount is 10,000,000 KES'),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional()
});

interface AdminInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
  clientName?: string;
}

export const AdminInvoiceDialog = ({ isOpen, onClose, jobId, jobTitle, clientName }: AdminInvoiceDialogProps) => {
  const { toast } = useToast();
  const [amount, setAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendInvoice = async () => {
    // Validate inputs using zod schema
    const validation = invoiceSchema.safeParse({
      amount,
      notes: notes.trim() || undefined
    });

    if (!validation.success) {
      toast({
        title: "Invalid Input",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    const { amount: validAmount, notes: validNotes } = validation.data;

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invoice', {
        body: { 
          jobId, 
          amount: validAmount, 
          notes: validNotes
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Invoice Sent",
          description: `Invoice for KES ${amount} sent to ${data.clientName || clientName}`,
        });
        onClose();
      } else {
        throw new Error(data?.error || 'Failed to send invoice');
      }
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invoice",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send Invoice</DialogTitle>
          <DialogDescription>
            Create and send invoice for: {jobTitle}
            {clientName && ` (Client: ${clientName})`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount (KES)</Label>
            <Input
              id="amount"
              type="number"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Enter invoice amount"
              min="1"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for the client..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSendInvoice} disabled={isSending}>
            {isSending ? "Sending..." : "Send Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};