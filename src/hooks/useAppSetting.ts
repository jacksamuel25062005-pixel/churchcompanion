import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAppSetting(key: string, defaultValue: boolean) {
  const [value, setValue] = useState<boolean>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (!cancelled) {
        if (!error && data) setValue(Boolean(data.value));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

  const updateSetting = useCallback(async (newValue: boolean) => {
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value: newValue, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
    setValue(newValue);
  }, [key]);

  return { value, loading, updateSetting };
}
