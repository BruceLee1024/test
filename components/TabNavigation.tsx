import React from 'react';
import { FlaskConical, LineChart, BookOpen, Settings2, History, Grid3X3 } from 'lucide-react';

export type TabType = 'lab' | 'fem' | 'constitutive' | 'theory' | 'history' | 'settings';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs: { id: TabType; label: string; labelEn: string; icon: React.ReactNode }[] = [
  { id: 'lab', label: '虚拟实验室', labelEn: 'Virtual Lab', icon: <FlaskConical size={16} /> },
  { id: 'fem', label: '有限元', labelEn: 'FEM', icon: <Grid3X3 size={16} /> },
  { id: 'constitutive', label: '本构关系', labelEn: 'Constitutive', icon: <LineChart size={16} /> },
  { id: 'theory', label: '理论知识', labelEn: 'Theory', icon: <BookOpen size={16} /> },
  { id: 'history', label: '历史记录', labelEn: 'History', icon: <History size={16} /> },
  { id: 'settings', label: '系统设置', labelEn: 'Settings', icon: <Settings2 size={16} /> },
];

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="flex items-center gap-1 bg-slate-900/50 rounded-lg p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all ${
            activeTab === tab.id
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          {tab.icon}
          <span className="hidden sm:inline">{tab.label}</span>
          <span className="hidden lg:inline text-[10px] opacity-60">{tab.labelEn}</span>
        </button>
      ))}
    </div>
  );
};
