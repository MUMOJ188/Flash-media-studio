import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { z } from "zod";

const paymentSchema = z.object({
  phoneNumber: z.string()
    .regex(/^(254|0)[17]\d{8}$/, 'Invalid Kenyan phone number. Use format: 0712345678 or 254712345678')
    .transform(val => val.startsWith('0') ? `254${val.slice(1)}` : val),
  amount: z.number()
    .int('Amount must be a whole number')
    .min(1, 'Minimum payment is 1 KES')
    .max(1000000, 'Maximum payment is 1,000,000 KES')
});

interface JobPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
  amount?: number;
}

export const JobPaymentDialog = ({ isOpen, onClose, jobId, jobTitle, amount = 0 }: JobPaymentDialogProps) => {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(amount);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    // Validate inputs using zod schema
    const validation = paymentSchema.safeParse({
      phoneNumber: phoneNumber.trim(),
      amount: paymentAmount
    });

    if (!validation.success) {
      toast({
        title: "Invalid Input",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    const { phoneNumber: validPhone, amount: validAmount } = validation.data;

    setIsProcessing(true);
    try {
      logger.debug('Initiating M-Pesa payment...');
      
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: { 
          jobId, 
          amount: validAmount, 
          phoneNumber: validPhone 
        }
      });

      logger.debug('M-Pesa response received');

      if (error) {
        logger.error('Edge function error:', error);
        throw new Error('Failed to connect to payment service. Please try again.');
      }

      if (data?.success) {
        toast({
          title: "STK Push Sent",
          description: "Please check your phone to complete the payment.",
        });
        onClose();
      } else {
        throw new Error(data?.error || 'Failed to initiate payment. Please check your M-Pesa credentials.');
      }
    } catch (error) {
      logger.error('Error initiating M-Pesa payment:', error);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to initiate payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Pay for Job</DialogTitle>
          <DialogDescription>
            Make payment for: {jobTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount (KES)</Label>
            <Input
              id="amount"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
              min="1"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">M-Pesa Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="0712345678 or 254712345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handlePayment} disabled={isProcessing}>
            {isProcessing ? "Processing..." : "Pay Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};