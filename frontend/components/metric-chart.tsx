'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MetricChartProps {
  data: Array<{ time: string; value: number }>;
  label: string;
  color?: string;
  unit?: string;
}

export function MetricChart({ data, label, color = 'hsl(var(--primary))', unit = '%' }: MetricChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-muted-foreground text-xs">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
        <defs>
          <linearGradient id={`gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
        <XAxis 
          dataKey="time" 
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          stroke="none"
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis 
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          stroke="none"
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          width={30}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '12px',
          }}
          labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '11px' }}
          formatter={(value: number) => [`${value.toFixed(1)}${unit}`, label]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#gradient-${label})`}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

