
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-md">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
          Dashboard d'Exploration des Accords d'Entreprise
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Explorez et recherchez des mesures innovantes pour les mobilités durables.
        </p>
      </div>
    </header>
  );
};

export default Header;
