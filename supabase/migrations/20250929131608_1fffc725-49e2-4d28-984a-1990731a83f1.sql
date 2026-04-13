-- Add invoice amount column to jobs table for storing invoice amounts
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC;

-- Add invoice_sent_at timestamp to track when invoice was sent
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS invoice_sent_at TIMESTAMP WITH TIME ZONE;

-- Create an invoices table to track multiple invoices for same job if needed
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'paid', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on invoices table
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create policies for invoices table
CREATE POLICY "Admins can manage all invoices" 
ON public.invoices 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Clients can view their own job invoices" 
ON public.invoices 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.jobs 
    WHERE jobs.id = invoices.job_id 
    AND jobs.client_id = auth.uid()
  )
);

-- Add trigger for updated_at on invoices
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();