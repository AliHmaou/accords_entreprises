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

    return (
        <ChartCard title={title}>
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
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
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
            </ResponsiveContainer>
        </ChartCard>
    );
};

export default DonutChart;
