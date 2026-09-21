import React from 'react';
import {
  BarChart3,
  Sparkles,
  Cpu,
  UserCheck,
  Table,
  BookOpen
} from 'lucide-react';

export type TabKey = 'eda' | 'cleaning' | 'models' | 'simulator' | 'batch' | 'fdp_hub';

interface TabsNavProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  atRiskCount: number;
}

export const TabsNav: React.FC<TabsNavProps> = ({
  activeTab,
  onSelectTab,
  atRiskCount
}) => {
  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] = [
    { key: 'eda', label: '1. EDA & Charts', icon: BarChart3 },
    { key: 'cleaning', label: '2. Data Cleaning & Split', icon: Sparkles },
    { key: 'models', label: '3. Model Training (LR & RF)', icon: Cpu },
    { key: 'simulator', label: '4. New Student Predictor', icon: UserCheck },
    { key: 'batch', label: '5. 1,000-Student Batch & CSV', icon: Table, badge: `${atRiskCount} At-Risk` },
    { key: 'fdp_hub', label: '6. FDP Hub & FastAPI Backend', icon: BookOpen }
  ];

  return (
    <div className="border-b border-slate-200 mb-6">
      <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto pb-1 scrollbar-thin">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onSelectTab(tab.key)}
              className={`whitespace-nowrap flex items-center gap-2 py-2.5 px-3.5 rounded-t-lg font-semibold text-xs sm:text-sm transition-all border-b-2 ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 bg-white shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
