import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import ChartCard from './ChartCard';

interface CouronneBarChartProps {
    title: string;
    data: {
        name: string;
        paris: number;
        pc: number;
        gc: number;
        details: string;
    }[];
}

const CouronneBarChart: React.FC<CouronneBarChartProps> = ({ title, data }) => {
    // Calculer la hauteur dynamique en fonction du nombre de lignes pour éviter que ce soit trop serré
    const chartHeight = Math.max(350, data.length * 50);

    return (
        <ChartCard title={title}>
            <div className="flex-grow flex flex-col justify-between" style={{ minHeight: `${chartHeight}px` }}>
                <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} opacity={0.3} />
                        <XAxis 
                            type="number" 
                            domain={[0, 100]} 
                            tickFormatter={(v) => `${v}%`}
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                        />
                        <YAxis 
                            type="category" 
                            dataKey="name" 
                            width={160}
                            tick={{ fontSize: 11, fill: '#4b5563' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(243, 244, 246, 0.4)' }}
                            formatter={(value: number, name: string, props: any) => {
                                return [`${value}%`, name];
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
                            dataKey="paris" 
                            name="Paris" 
                            fill="#3B82F6" 
                            radius={[0, 4, 4, 0]} 
                            barSize={10}
                        />
                        <Bar 
                            dataKey="pc" 
                            name="Petite Couronne (PC)" 
                            fill="#8B5CF6" 
                            radius={[0, 4, 4, 0]} 
                            barSize={10}
                        />
                        <Bar 
                            dataKey="gc" 
                            name="Grande Couronne (GC)" 
                            fill="#F59E0B" 
                            radius={[0, 4, 4, 0]} 
                            barSize={10}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </ChartCard>
    );
};

export default CouronneBarChart;
