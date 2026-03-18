
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';

interface MonthlyTrendChartProps {
    data: { date: string; value: number }[];
}

const MonthlyTrendChart: React.FC<MonthlyTrendChartProps> = ({ data }) => {
    return (
        <ChartCard title="Évolution mensuelle des mesures déposées">
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11 }} 
                        stroke="#9ca3af"
                        tickMargin={10}
                    />
                    <YAxis 
                        tick={{ fontSize: 11 }} 
                        stroke="#9ca3af"
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '6px', color: '#1f2937' }}
                        itemStyle={{ color: '#4f46e5' }}
                        labelStyle={{ color: '#6b7280', marginBottom: '0.25rem' }}
                    />
                    <Line 
                        type="monotone" 
                        dataKey="value" 
                        name="Nombre d'accords" 
                        stroke="#4f46e5" 
                        strokeWidth={3} 
                        dot={{ r: 3, fill: '#4f46e5' }} 
                        activeDot={{ r: 6 }} 
                    />
                </LineChart>
            </ResponsiveContainer>
        </ChartCard>
    );
};

export default MonthlyTrendChart;
