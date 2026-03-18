
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ChartCard from './ChartCard';

interface SectorChartProps {
    data: { name: string; value: number }[];
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a05195', '#d45087'];

const SectorChart: React.FC<SectorChartProps> = ({ data }) => {
    return (
        <ChartCard title="Top 10 des Mesures (sélection actuelle)">
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={180} 
                        tick={{ fontSize: 11 }} 
                        interval={0}
                    />
                    <Tooltip 
                        cursor={{fill: 'rgba(240, 240, 240, 0.5)'}}
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc', borderRadius: '4px', color: '#333' }}
                        itemStyle={{ color: '#333' }}
                    />
                    <Bar dataKey="value" name="Nombre d'accords" barSize={18} radius={[0, 4, 4, 0]}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    );
};

export default SectorChart;
