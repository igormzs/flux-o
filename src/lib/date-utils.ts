import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  subMonths, 
  addMonths, 
  setDay, 
  setDate as setDayOfMonth,
  isAfter,
  isBefore,
  format
} from "date-fns";

export type PeriodType = 'all' | 'week' | 'month' | 'billing_cycle' | 'custom';

export interface SettingsData {
  budgetGoal: number;
  currency: string;
  notifications: {
    overBudget: boolean;
    weeklyReport: boolean;
    dailyReminder: boolean;
  };
  periodType?: PeriodType;
  billingCycleStartDay?: number;
  customStartDate?: string;
  customEndDate?: string;
}

export function getPeriodRange(settings: SettingsData): { start: Date, end: Date } {
  const now = new Date();
  const type = settings.periodType || 'month';

  switch (type) {
    case 'all':
      return { start: new Date(0), end: new Date(2100, 0, 1) };
    case 'week':
      return { start: startOfWeek(now), end: endOfWeek(now) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'custom':
      return { 
        start: settings.customStartDate ? new Date(settings.customStartDate + "T00:00:00") : startOfMonth(now),
        end: settings.customEndDate ? new Date(settings.customEndDate + "T23:59:59") : endOfMonth(now)
      };
    case 'billing_cycle': {
      const startDay = settings.billingCycleStartDay || 1;
      let start = setDayOfMonth(new Date(now), startDay);
      start.setHours(0, 0, 0, 0);

      // If today is before the start day of this month, the cycle started last month
      if (isAfter(start, now)) {
        start = subMonths(start, 1);
      }
      
      const end = subMonths(addMonths(start, 1), 0); // Effectively start + 1 month
      // The end should be 1 day before the next start day, or exactly the next start day's 00:00
      // User says "25th of the previous month to 25th of the next month"
      // If today is April 1st, and cycle is 25th, it should be March 25th to April 25th.
      const actualEnd = setDayOfMonth(addMonths(start, 1), startDay);
      actualEnd.setHours(0, 0, 0, 0);

      return { start, end: actualEnd };
    }
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}
