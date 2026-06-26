import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import ChartCard from './ChartCard';

interface DistributionChartProps {
    title: string;
    data: any[];
    categories: string[];
}

const COLORS: Record<string, string> = {
    'GE': '#3B82F6',          // Bleu
    'ETI': '#8B5CF6',         // Violet
    'PME': '#10B981',         // Vert
    'INDETERMINE': '#F59E0B',  // Ambre
    'Non classifié': '#9CA3AF' // Gris
};

const CategoryMeasuresDistributionChart: React.FC<DistributionChartProps> = ({ title, data, categories }) => {
    return (
        <ChartCard title={title}>
            <div className="flex-grow flex flex-col justify-between" style={{ minHeight: '320px' }}>
                <ResponsiveContainer width="100%" height={320}>
                    <LineChart
                        data={data}
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} opacity={0.3} />
                        <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 11, fill: '#4b5563' }}
                        />
                        <YAxis 
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickFormatter={(v) => `${v}`}
                        />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            labelStyle={{ fontWeight: 'bold', color: '#111827' }}
                            contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                        />
                        <Legend 
                            verticalAlign="top" 
                            height={36} 
                            iconType="circle" 
                            wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }} 
                        />
                        {categories.map(cat => (
                            <Line
                                key={cat}
                                type="monotone"
                                dataKey={cat}
                                name={cat}
                                stroke={COLORS[cat] || '#6B7280'}
                                strokeWidth={2.5}
                                activeDot={{ r: 6 }}
                                dot={{ r: 3 }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </ChartCard>
    );
};

export default CategoryMeasuresDistributionChart;
