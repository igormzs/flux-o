import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Expense, CustomCategory } from "@/lib/expenses";

export const useExpenses = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ["expenses", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("date", startDate.toISOString())
        .lte("date", endDate.toISOString())
        .order("date", { ascending: false });

      if (error) throw error;
      return data as Expense[];
    },
  });
};

export const useCustomCategories = () => {
  return useQuery({
    queryKey: ["custom_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_categories")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as CustomCategory[];
    },
  });
};
