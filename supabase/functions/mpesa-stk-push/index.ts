import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface STKPushRequest {
  jobId: string;
  amount: number;
  phoneNumber: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const getMpesaToken = async (): Promise<string> => {
  const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY');
  const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET');
  
  console.log('Getting M-Pesa token...');
  console.log('Consumer Key exists:', !!consumerKey);
  console.log('Consumer Secret exists:', !!consumerSecret);
  
  if (!consumerKey || !consumerSecret) {
    throw new Error('M-Pesa credentials not configured in edge function secrets');
  }

  const auth = btoa(`${consumerKey}:${consumerSecret}`);
  const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
  
  console.log('Fetching token from:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Token response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token request failed:', errorText);
      throw new Error(`Failed to get M-Pesa access token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Token received successfully');
    return data.access_token;
  } catch (error) {
    console.error('Error fetching M-Pesa token:', error);
    throw new Error(`M-Pesa token error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const generateTimestamp = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const generatePassword = (shortcode: string, passkey: string, timestamp: string): string => {
  const data = `${shortcode}${passkey}${timestamp}`;
  return btoa(data);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, amount, phoneNumber }: STKPushRequest = await req.json();

    // Validate required fields
    if (!jobId || !amount || !phoneNumber) {
      throw new Error('Missing required fields: jobId, amount, or phoneNumber');
    }

    // Validate amount
    if (typeof amount !== 'number' || amount < 1 || amount > 1000000 || !Number.isInteger(amount)) {
      throw new Error('Invalid amount. Must be a whole number between 1 and 1,000,000 KES');
    }

    // Validate phone number format
    const cleanPhone = phoneNumber.replace(/\s+/g, '');
    if (!/^(254|0)?[17]\d{8}$/.test(cleanPhone)) {
      throw new Error('Invalid Kenyan phone number format. Use 0712345678 or 254712345678');
    }

    console.log('Processing STK push for job:', jobId, 'Amount:', amount);

    // Verify job exists and get user info
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*, profiles(phone_number)')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    // Get M-Pesa token
    const accessToken = await getMpesaToken();
    
    const shortcode = Deno.env.get('MPESA_SHORTCODE');
    const passkey = Deno.env.get('MPESA_PASSKEY');
    
    if (!shortcode || !passkey) {
      throw new Error('M-Pesa configuration incomplete');
    }

    const timestamp = generateTimestamp();
    const password = generatePassword(shortcode, passkey, timestamp);

    // Format phone number (remove + and ensure it starts with 254)
    let formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    const stkPushPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`,
      AccountReference: `JOB-${jobId}`,
      TransactionDesc: `Payment for job: ${job.title}`,
    };

    console.log('Sending STK push request:', stkPushPayload);

    const stkResponse = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPushPayload),
    });

    if (!stkResponse.ok) {
      const errorText = await stkResponse.text();
      console.error('M-Pesa STK push failed:', errorText);
      throw new Error('Failed to initiate STK push');
    }

    const stkData = await stkResponse.json();
    console.log('STK push response:', stkData);

    if (stkData.ResponseCode === '0') {
      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          job_id: jobId,
          user_id: job.client_id,
          amount: amount,
          phone_number: formattedPhone,
          status: 'pending',
          payment_method: 'mpesa',
          mpesa_transaction_id: stkData.CheckoutRequestID,
        });

      if (paymentError) {
        console.error('Error creating payment record:', paymentError);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'STK push sent successfully',
        checkoutRequestId: stkData.CheckoutRequestID,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      throw new Error(stkData.ResponseDescription || 'STK push failed');
    }

  } catch (error) {
    console.error('Error in mpesa-stk-push function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error details:', errorMessage);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});