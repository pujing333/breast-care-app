import React from 'react';

interface HeaderProps {
  onBack?: () => void;
  title: string;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ onBack, title, rightAction }) => {
  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100 h-14 flex items-center px-4 justify-between">
      <div className="flex items-center">
        {onBack && (
          <button 
            onClick={onBack}
            className="mr-3 text-gray-600 hover:text-medical-600 p-1 rounded-full active:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
        )}
        <h1 className="text-lg font-bold text-gray-800 truncate max-w-[200px]">{title}</h1>
      </div>
      <div>
        {rightAction}
      </div>
    </header>
  );
};