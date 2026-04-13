import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentReceipt } from "@/components/PaymentReceipt";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Payment {
  id: string;
  job_id: string;
  amount: number;
  created_at: string;
  mpesa_receipt_number: string;
  phone_number: string;
  status: string;
  jobs?: {
    title: string;
  };
}

const ClientPaymentHistory = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPayments();

    // Set up realtime subscription for payment updates
    const paymentsChannel = supabase
      .channel('client-payments-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'payments' },
        () => fetchPayments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(paymentsChannel);
    };
  }, []);

  const fetchPayments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          jobs (
            title
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        title: "Error",
        description: "Failed to fetch payment history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Payment History | M-Pesa Flow Connect</title>
        <meta name="description" content="View your payment receipts and transaction history." />
      </Helmet>

      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Payment History</h1>
          <p className="text-muted-foreground">View all your payment receipts</p>
        </div>

        {payments.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No completed payments found.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {payments.map((payment) => (
              <PaymentReceipt
                key={payment.id}
                amount={payment.amount}
                receiptNumber={payment.mpesa_receipt_number || payment.id}
                transactionDate={payment.created_at}
                phoneNumber={payment.phone_number}
                status={payment.status}
                jobTitle={payment.jobs?.title}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default ClientPaymentHistory;