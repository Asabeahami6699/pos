import React, { useState } from 'react';
import type{ DateRange } from '../../types/index.ts';
import { 
  getTodayRange, 
  getYesterdayRange, 
  getLast7DaysRange, 
  getThisMonthRange,
  formatDateForDisplay 
} from '../../utils/dateUtils';

interface DateRangePickerProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ range, onChange }) => {
  const [showCustom, setShowCustom] = useState(false);
  
  const presets = [
    { label: 'Today', range: getTodayRange() },
    { label: 'Yesterday', range: getYesterdayRange() },
    { label: 'Last 7 Days', range: getLast7DaysRange() },
    { label: 'This Month', range: getThisMonthRange() },
  ];

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset, index) => (
          <button
            key={`preset-${index}`}
            onClick={() => onChange(preset.range)}
            className={`
              px-3 py-1 text-xs rounded-full transition-colors
              ${JSON.stringify(range) === JSON.stringify(preset.range)
                ? 'bg-indigo-500/15 text-indigo-700 border border-indigo-300'
                : 'bg-secondary text-foreground hover:bg-muted border border-border'
              }
            `}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`
            px-3 py-1 text-xs rounded-full transition-colors
            ${showCustom
              ? 'bg-amber-500/15 text-amber-700 border border-amber-300'
              : 'bg-secondary text-foreground hover:bg-muted border border-border'
            }
          `}
        >
          {showCustom ? 'Hide Custom' : 'Custom Range'}
        </button>
      </div>
      
      {showCustom && (
        <div className="flex space-x-2 bg-card p-3 rounded-lg border">
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-1">From</label>
            <input
              type="date"
              value={range.from.split('T')[0]}
              onChange={(e) => {
                const date = new Date(e.target.value);
                date.setHours(0, 0, 0, 0);
                onChange({
                  ...range,
                  from: date.toISOString()
                });
              }}
              className="w-full text-sm px-2 py-1 border rounded"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-1">To</label>
            <input
              type="date"
              value={range.to.split('T')[0]}
              onChange={(e) => {
                const date = new Date(e.target.value);
                date.setHours(23, 59, 59, 999);
                onChange({
                  ...range,
                  to: date.toISOString()
                });
              }}
              className="w-full text-sm px-2 py-1 border rounded"
            />
          </div>
        </div>
      )}
      
      <div className="text-xs text-muted-foreground">
        Showing: {formatDateForDisplay(range.from)} - {formatDateForDisplay(range.to)}
      </div>
    </div>
  );
};