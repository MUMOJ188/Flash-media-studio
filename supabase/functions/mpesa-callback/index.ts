import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // M-Pesa IP whitelisting for security (verify these IPs with Safaricom)
    const allowedIPs = [
      '196.201.214.200', 
      '196.201.214.206',
      '196.201.214.207',
      '196.201.214.208'
    ];
    
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    // Log all callback attempts for audit trail
    console.log(`[M-Pesa Callback] Request from IP: ${clientIP}`);
    
    // In production, enforce IP whitelisting
    // Commented out for testing - ENABLE IN PRODUCTION
    // if (!allowedIPs.includes(clientIP)) {
    //   console.warn(`[SECURITY] Unauthorized callback attempt from IP: ${clientIP}`);
    //   return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    // }

    const callbackData = await req.json();
    console.log('[M-Pesa Callback] Data received');

    const stkCallback = callbackData.Body?.stkCallback;
    if (!stkCallback) {
      console.log('[M-Pesa Callback] No stkCallback found');
      return new Response('OK', { status: 200 });
    }

    const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = stkCallback;
    
    console.log(`[M-Pesa Callback] Processing - ResultCode: ${ResultCode}`);

    // Find the payment record
    const { data: payment, error: findError } = await supabase
      .from('payments')
      .select('*')
      .eq('mpesa_transaction_id', CheckoutRequestID)
      .single();

    if (findError || !payment) {
      console.error('[M-Pesa Callback] Payment not found');
      return new Response('Payment not found', { status: 404 });
    }

    // Prevent duplicate processing
    if (payment.status !== 'pending') {
      console.warn(`[SECURITY] Duplicate callback for payment ${payment.id} with status ${payment.status}`);
      return new Response('Payment already processed', { status: 200, headers: corsHeaders });
    }

    if (ResultCode === 0) {
      // Payment successful
      console.log('[M-Pesa Callback] Payment successful');
      
      let mpesaReceiptNumber = '';
      if (CallbackMetadata?.Item) {
        const receiptItem = CallbackMetadata.Item.find((item: any) => item.Name === 'MpesaReceiptNumber');
        if (receiptItem) {
          mpesaReceiptNumber = receiptItem.Value;
        }
      }

      // Update payment status
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          status: 'completed',
          mpesa_receipt_number: mpesaReceiptNumber,
        })
        .eq('id', payment.id);

      if (updateError) {
        console.error('Error updating payment status:', updateError);
        return new Response('Error updating payment', { status: 500 });
      }

      // Update job payment status
      const { error: jobUpdateError } = await supabase
        .from('jobs')
        .update({
          payment_status: 'paid',
          payment_confirmed: true,
        })
        .eq('id', payment.job_id);

      if (jobUpdateError) {
        console.error('Error updating job payment status:', jobUpdateError);
      }

      // Mark invoice as paid
      const { error: invoiceUpdateError } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
        })
        .eq('job_id', payment.job_id)
        .eq('status', 'sent');

      if (invoiceUpdateError) {
        console.error('Error updating invoice status:', invoiceUpdateError);
      }

      // Create notification for successful payment
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          recipient_id: payment.user_id,
          job_id: payment.job_id,
          title: 'Payment Confirmed',
          message: `Your payment of KES ${payment.amount} has been received successfully. Receipt: ${mpesaReceiptNumber}`,
        });

      if (notificationError) {
        console.error('Error creating payment notification:', notificationError);
      }

      console.log('[M-Pesa Callback] Payment processed successfully');
      
    } else {
      // Payment failed
      console.log(`[M-Pesa Callback] Payment failed: ${ResultDesc}`);
      
      // Update payment status to failed
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          status: 'failed',
        })
        .eq('id', payment.id);

      if (updateError) {
        console.error('Error updating payment status to failed:', updateError);
      }

      // Create notification for failed payment
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          recipient_id: payment.user_id,
          job_id: payment.job_id,
          title: 'Payment Failed',
          message: `Your payment attempt failed. Reason: ${ResultDesc}. Please try again.`,
        });

      if (notificationError) {
        console.error('Error creating failed payment notification:', notificationError);
      }
    }

    return new Response('OK', {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Error in mpesa-callback function:', error);
    return new Response('Internal error', {
      status: 500,
      headers: corsHeaders,
    });
  }
});