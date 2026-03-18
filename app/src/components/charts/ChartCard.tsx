
import React from 'react';

interface ChartCardProps {
    title: string;
    children: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, children }) => {
    return (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 sm:p-6 h-full flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
            <div className="flex-grow">
                {children}
            </div>
        </div>
    );
};

export default ChartCard;
