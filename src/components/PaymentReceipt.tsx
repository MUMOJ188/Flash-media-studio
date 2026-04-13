import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Receipt } from "lucide-react";

interface PaymentReceiptProps {
  amount: number;
  receiptNumber: string;
  transactionDate: string;
  phoneNumber: string;
  status: string;
  jobTitle?: string;
}

export const PaymentReceipt = ({
  amount,
  receiptNumber,
  transactionDate,
  phoneNumber,
  status,
  jobTitle,
}: PaymentReceiptProps) => {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Payment Receipt
          </CardTitle>
          <CheckCircle className="h-6 w-6" />
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="text-center border-b pb-4">
          <p className="text-sm text-muted-foreground mb-1">Amount Paid</p>
          <p className="text-3xl font-bold text-primary">KES {amount.toLocaleString()}</p>
        </div>

        {jobTitle && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Job Title</p>
            <p className="font-medium">{jobTitle}</p>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Receipt Number</p>
          <p className="font-mono font-medium">{receiptNumber}</p>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Transaction Date</p>
          <p className="font-medium">{new Date(transactionDate).toLocaleString()}</p>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Phone Number</p>
          <p className="font-medium">{phoneNumber}</p>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge variant={status === 'completed' ? 'default' : 'secondary'}>
            {status === 'completed' ? 'The service request is processed successfully' : status}
          </Badge>
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-center text-muted-foreground">
            This is an automatically generated receipt. Keep this for your records.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};