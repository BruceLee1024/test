import React, { useState } from 'react';
import { TabNavigation, TabType } from './components/TabNavigation';
import { VirtualLabPage } from './components/VirtualLabPage';
import { FEMPage } from './components/FEMPage';
import { ConstitutivePage } from './components/ConstitutivePage';
import { TheoryPage } from './components/TheoryPage';
import { HistoryPage } from './components/HistoryPage';
import { SettingsPage } from './components/SettingsPage';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('lab');

  const renderContent = () => {
    switch (activeTab) {
      case 'lab':
        return <VirtualLabPage />;
      case 'fem':
        return <FEMPage />;
      case 'constitutive':
        return <ConstitutivePage />;
      case 'theory':
        return <TheoryPage />;
      case 'history':
        return <HistoryPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <VirtualLabPage />;
    }
  };

  return (
    <div className="h-screen bg-[#0b0f19] text-slate-200 font-sans selection:bg-blue-500 selection:text-white flex flex-col overflow-hidden">
      {/* 顶部导航栏 */}
      <nav className="border-b border-slate-800 bg-[#080a10] px-4 py-2 flex items-center justify-between z-50 shadow-md flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-blue-700 h-8 w-8 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/50">C</div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white font-mono">
              CONCRETE<span className="text-blue-500">LAB</span> PRO
            </h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
              Virtual Material Testing Platform
            </p>
          </div>
        </div>
        
        {/* 标签导航 */}
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        
        {/* 右侧信息 */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono text-slate-500">
          <span>v1.0.0</span>
        </div>
      </nav>

      {/* 主内容区域 */}
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
