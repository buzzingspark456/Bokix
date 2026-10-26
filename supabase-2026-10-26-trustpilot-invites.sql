-- Private queue for one Trustpilot review invitation per Bokix account.
CREATE TABLE IF NOT EXISTS public.trustpilot_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_invoice_id text NOT NULL UNIQUE,
  customer_email text NOT NULL,
  paid_at timestamptz NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trustpilot_invites_due_idx
  ON public.trustpilot_invites (scheduled_at)
  WHERE status = 'pending';

ALTER TABLE public.trustpilot_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trustpilot_invites FROM anon, authenticated;
GRANT ALL ON public.trustpilot_invites TO service_role;
