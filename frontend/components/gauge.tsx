'use client'

import { Progress } from '@/components/ui/progress';

interface GaugeProps {
  value: number;
  max?: number;
  label: string;
  unit?: string;
  color?: string;
}

export function Gauge({ value, max = 100, label, unit = '%', color }: GaugeProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const normalizedValue = Math.min(value, max);

  const getColor = () => {
    if (color) return color;
    if (percentage < 50) return 'hsl(142, 76%, 36%)';
    if (percentage < 75) return 'hsl(38, 92%, 50%)';
    return 'hsl(0, 84%, 60%)';
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      <div className="relative w-full max-w-[140px] aspect-square">
        <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="50"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-muted/30"
          />
          <circle
            cx="60"
            cy="60"
            r="50"
            stroke={getColor()}
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * (1 - percentage / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: getColor() }}>
              {normalizedValue.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">{unit}</div>
          </div>
        </div>
      </div>
      <div className="text-xs font-medium text-center text-muted-foreground mt-2">{label}</div>
    </div>
  );
}

