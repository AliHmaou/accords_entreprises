import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ChartCard from './ChartCard';

interface TopMeasuresProps {
    title: string;
    data: { name: string; value: number }[];
}

const COLORS = ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'];

const TopMeasuresBarChart: React.FC<TopMeasuresProps> = ({ title, data }) => {
    return (
        <ChartCard title={title}>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <XAxis type="number" hide />
                    <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={200}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        cursor={{fill: 'rgba(243, 244, 246, 0.4)'}}
                        contentStyle={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    );
};

export default TopMeasuresBarChart;
