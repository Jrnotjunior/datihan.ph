CREATE OR REPLACE FUNCTION public.get_shipping_fee(
  p_owner_id uuid,
  p_shipping_address jsonb
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city text;
  v_province text;
  v_area_name text;
  v_shipping_fee numeric;
BEGIN
  v_city := lower(trim(coalesce(p_shipping_address->>'city', '')));
  v_province := lower(trim(coalesce(p_shipping_address->>'province', '')));

  IF v_province IN (
    'metro manila',
    'metropolitan manila',
    'ncr',
    'national capital region'
  ) THEN
    v_area_name := 'Metro Manila';

  ELSIF v_province IN (
    'cebu', 'bohol', 'iloilo', 'negros occidental', 'negros oriental',
    'leyte', 'southern leyte', 'eastern samar', 'northern samar', 'samar',
    'biliran', 'capiz', 'aklan', 'antique', 'guimaras', 'romblon', 'siquijor'
  ) THEN
    v_area_name := 'Visayas';

  ELSIF v_province IN (
    'davao del sur', 'davao del norte', 'davao de oro', 'davao occidental',
    'davao oriental', 'misamis occidental', 'misamis oriental', 'bukidnon',
    'camiguin', 'lanao del norte', 'lanao del sur', 'maguindanao', 'cotabato',
    'south cotabato', 'sultan kudarat', 'sarangani', 'zamboanga del norte',
    'zamboanga del sur', 'zamboanga sibugay', 'basilan', 'sulu', 'tawi-tawi',
    'agusan del norte', 'agusan del sur', 'surigao del norte',
    'surigao del sur', 'dinagat islands'
  ) THEN
    v_area_name := 'Mindanao';

  ELSE
    v_area_name := 'Luzon (Outside Metro Manila)';
  END IF;

  SELECT shipping_fee
  INTO v_shipping_fee
  FROM public.shipping_rates
  WHERE owner_id = p_owner_id
    AND lower(trim(area_name)) = lower(trim(v_area_name))
    AND is_active = true
  ORDER BY sort_order
  LIMIT 1;

  IF v_shipping_fee IS NULL THEN
    RAISE EXCEPTION 'No active shipping rate configured for %', v_area_name;
  END IF;

  RETURN v_shipping_fee;
END;
$$;
