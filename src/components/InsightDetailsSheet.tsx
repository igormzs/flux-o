import { motion, AnimatePresence } from "framer-motion";
import { X } from "@phosphor-icons/react";

interface InsightDetailsSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  data: { label: string; amount: number }[];
  currencySymbol: string;
}

const InsightDetailsSheet = ({ open, onClose, title, data, currencySymbol }: InsightDetailsSheetProps) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed bottom-0 left-0 right-0 z-[60] bg-card border-t border-glass-border rounded-t-3xl p-6 pb-10 max-h-[82vh] overflow-auto scrollbar-none max-w-xl mx-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-bold text-lg text-foreground">{title}</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} weight="bold" />
              </button>
            </div>
            
            <div className="space-y-2">
              {data.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-glass-border/5">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <span className="font-display font-bold text-foreground">{currencySymbol}{item.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default InsightDetailsSheet;
