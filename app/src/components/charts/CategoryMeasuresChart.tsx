import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import ChartCard from './ChartCard';

interface CategoryMeasuresChartProps {
    title: string;
    data: {
        name: string;
        moyenne: number;
        mediane: number;
    }[];
}

const CategoryMeasuresChart: React.FC<CategoryMeasuresChartProps> = ({ title, data }) => {
    return (
        <ChartCard title={title}>
            <div className="flex-grow flex flex-col justify-between" style={{ minHeight: '320px' }}>
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                        data={data}
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} opacity={0.3} />
                        <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 12, fill: '#4b5563' }}
                        />
                        <YAxis 
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickFormatter={(v) => `${v}`}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(243, 244, 246, 0.4)' }}
                            formatter={(value: number, name: string) => {
                                return [value, name.charAt(0).toUpperCase() + name.slice(1)];
                            }}
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
                        <Bar 
                            dataKey="moyenne" 
                            name="Moyenne" 
                            fill="#3B82F6" 
                            radius={[4, 4, 0, 0]} 
                            barSize={16}
                        />
                        <Bar 
                            dataKey="mediane" 
                            name="Médiane" 
                            fill="#10B981" 
                            radius={[4, 4, 0, 0]} 
                            barSize={16}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </ChartCard>
    );
};

export default CategoryMeasuresChart;
