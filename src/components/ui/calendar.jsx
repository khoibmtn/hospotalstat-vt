import { DayPicker } from 'react-day-picker';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

import 'react-day-picker/style.css';

export function Calendar({ className, ...props }) {
  return (
    <DayPicker
      locale={vi}
      showOutsideDays
      className={cn('p-3', className)}
      classNames={{
        months: 'relative flex flex-col',
        month_caption: 'flex justify-center items-center h-7 mb-2',
        caption_label: 'text-sm font-medium capitalize',
        nav: 'absolute top-0 flex w-full justify-between z-10',
        button_previous: 'inline-flex items-center justify-center h-7 w-7 bg-transparent border border-input rounded-md opacity-50 hover:opacity-100 cursor-pointer',
        button_next: 'inline-flex items-center justify-center h-7 w-7 bg-transparent border border-input rounded-md opacity-50 hover:opacity-100 cursor-pointer',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'text-muted-foreground w-8 text-[0.8rem] font-normal text-center',
        week: 'flex mt-1',
        day: 'p-0 text-center',
        day_button: 'inline-flex items-center justify-center h-8 w-8 rounded-md text-sm font-normal cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors',
        selected: '[&_.rdp-day_button]:bg-primary [&_.rdp-day_button]:text-primary-foreground [&_.rdp-day_button]:hover:bg-primary',
        today: '[&_.rdp-day_button]:bg-accent [&_.rdp-day_button]:text-accent-foreground',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50 [&_.rdp-day_button]:cursor-not-allowed [&_.rdp-day_button]:hover:bg-transparent',
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left'
            ? <ChevronLeft className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
