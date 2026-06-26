import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';

interface DonutChartProps {
    title: string;
    data: { name: string; value: number; fill: string }[];
}

const DonutChart: React.FC<DonutChartProps> = ({ title, data }) => {
    // Calculer le total pour le tooltip
    const total = data.reduce((sum, entry) => sum + entry.value, 0);

    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: any) => {
        const RADIAN = Math.PI / 180;
        const radius = outerRadius + 15;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        
        return (
            <text 
                x={x} 
                y={y} 
                fill="#4B5563" 
                className="text-xs font-bold fill-gray-700 dark:fill-gray-300"
                textAnchor={x > cx ? 'start' : 'end'} 
                dominantBaseline="central"
            >
                {`${(percent * 100).toFixed(1)}% (${value})`}
            </text>
        );
    };

    return (
        <ChartCard title={title}>
            <div className="flex-grow flex flex-col justify-between">
                <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={2}
                            dataKey="value"
                            nameKey="name"
                            label={renderCustomizedLabel}
                            labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                        <Tooltip 
                            formatter={(value: number) => {
                                const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return [`${value} accords (${percent}%)`, 'Valeur'];
                            }}
                            contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </ChartCard>
    );
};

export default DonutChart;
