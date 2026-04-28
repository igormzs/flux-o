import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "@phosphor-icons/react"
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  date: DateRange | undefined
  onDateChange: (date: DateRange | undefined) => void
}

export function DateRangePicker({
  date,
  onDateChange,
}: DateRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "w-10 h-10 rounded-full bg-muted border-glass-border hover:border-primary/50 transition-all cursor-pointer hover:scale-[1.02]",
            date?.from && "text-primary border-primary/30"
          )}
        >
          <CalendarIcon size={20} weight="duotone" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-glass-border glass-card" align="end">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={onDateChange}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  )
}
