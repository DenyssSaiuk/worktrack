'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  productiveMinutes: number;
  neutralMinutes: number;
  distractingMinutes: number;
}

const COLORS = ['#16a34a', '#94a3b8', '#dc2626'];

export function CategoryPie({ productiveMinutes, neutralMinutes, distractingMinutes }: Props) {
  const data = [
    { name: 'Productive', value: productiveMinutes },
    { name: 'Neutral', value: neutralMinutes },
    { name: 'Distracting', value: distractingMinutes },
  ];
  const total = productiveMinutes + neutralMinutes + distractingMinutes;
  if (total === 0) return <div className="text-sm text-slate-500">No data.</div>;

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => `${v} min`} />
          <Legend verticalAlign="bottom" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
