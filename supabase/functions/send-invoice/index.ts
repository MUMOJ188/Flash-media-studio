import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvoiceRequest {
  jobId: string;
  amount: number;
  notes?: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, amount, notes }: InvoiceRequest = await req.json();

    console.log('Sending invoice for job:', jobId, 'Amount:', amount);

    // Verify job exists and get client info
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        *,
        profiles!jobs_client_id_fkey (
          full_name,
          email,
          phone_number
        )
      `)
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    // Create invoice record
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        job_id: jobId,
        amount: amount,
        notes: notes,
        status: 'sent'
      })
      .select()
      .single();

    if (invoiceError) {
      throw new Error('Failed to create invoice record');
    }

    // Update job with invoice info
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        payment_status: 'invoice_sent',
        invoice_amount: amount,
        invoice_sent_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('Error updating job status:', updateError);
    }

    // Create notification for client
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        recipient_id: job.client_id,
        job_id: jobId,
        title: 'Invoice Sent',
        message: `An invoice for KES ${amount} has been sent for your job "${job.title}". ${notes ? 'Notes: ' + notes : ''}`,
      });

    if (notificationError) {
      console.error('Error creating invoice notification:', notificationError);
    }

    console.log('Invoice sent successfully for job:', jobId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Invoice sent successfully',
      jobId: jobId,
      amount: amount,
      clientName: job.profiles?.full_name,
      clientEmail: job.profiles?.email,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-invoice function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});