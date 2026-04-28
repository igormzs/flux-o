import { format, subMonths, startOfMonth } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  selectedMonth: Date;
  onMonthSelect: (month: Date) => void;
  customRange?: { from: Date; to?: Date };
}

const MonthPicker = ({ selectedMonth, onMonthSelect, customRange }: MonthPickerProps) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Generate all months of the current year
  const months = Array.from({ length: 12 }, (_, i) => {
    return new Date(currentYear, i, 1);
  });

  return (
    <div className="flex gap-3 overflow-x-auto pb-8 pt-2 scrollbar-none snap-x px-8 -mx-8">
      {/* Custom Range Chip (only visible if active) */}
      {customRange?.from && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1.1 }}
          className={cn(
            "flex-shrink-0 px-6 py-2.5 rounded-full font-display font-semibold text-sm snap-center transition-colors cursor-pointer",
            "bg-mint text-primary-foreground shadow-lg shadow-primary/25"
          )}
        >
          {format(customRange.from, 'MMM d')} - {customRange.to ? format(customRange.to, 'MMM d') : '...'}
        </motion.button>
      )}

      {months.map((month) => {
        const isSelected = !customRange && format(month, 'MMM yyyy') === format(selectedMonth, 'MMM yyyy');
        // Hide future months if they aren't the selected one? 
        // User said "at least all months of the year", so showing all is fine.
        
        return (
          <motion.button
            key={month.toISOString()}
            onClick={() => onMonthSelect(month)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{ 
              scale: isSelected ? 1.1 : 1,
              backgroundColor: isSelected ? "hsl(160 60% 60%)" : "hsl(var(--muted))",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={cn(
              "flex-shrink-0 px-6 py-2.5 rounded-full font-display font-semibold text-sm snap-center transition-colors cursor-pointer",
              isSelected 
                ? "text-primary-foreground shadow-lg shadow-primary/25" 
                : "text-muted-foreground hover:text-foreground border border-glass-border"
            )}
          >
            {format(month, 'MMMM')}
          </motion.button>
        );
      })}
    </div>
  );
};

export default MonthPicker;
