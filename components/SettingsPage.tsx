import React, { useState, useEffect } from 'react';
import { Settings2, Monitor, Palette, Volume2, Info, FileText, Play, Plus, Trash2, Save, RotateCcw, Copy, FlaskConical } from 'lucide-react';
import { 
  ConstitutiveModelType, 
  CONSTITUTIVE_MODELS, 
  loadSettings, 
  saveSettings,
  GlobalSettings 
} from '../services/settingsService';

// 预设试验方案类型
interface TestPreset {
  id: string;
  name: string;
  description: string;
  type: 'compression' | 'tension' | 'modulus' | 'fatigue';
  params: {
    loadingRate?: number;
    cycleCount?: number;
    maxStress?: number;
    minStress?: number;
    holdTime?: number;
    dispTargets?: number[];
  };
}

// 预设试验方案
const DEFAULT_PRESETS: TestPreset[] = [
  {
    id: 'standard-compression',
    name: '标准抗压试验',
    description: 'GB/T 50081 标准混凝土抗压强度试验',
    type: 'compression',
    params: { loadingRate: 0.6 }
  },
  {
    id: 'astm-c39',
    name: 'ASTM C39 抗压',
    description: 'ASTM C39 圆柱体抗压试验',
    type: 'compression',
    params: { loadingRate: 0.25 }
  },
  {
    id: 'elastic-modulus',
    name: '弹性模量测定',
    description: 'GB/T 50081 静态弹性模量试验',
    type: 'modulus',
    params: { cycleCount: 3, holdTime: 60 }
  },
  {
    id: 'cyclic-loading',
    name: '循环加载试验',
    description: '位移控制循环加载试验',
    type: 'compression',
    params: { 
      cycleCount: 10, 
      dispTargets: [0.15, 0.30, 0.45, 0.60, 0.90, 1.20, 1.50, 1.80, 2.10, 2.40]
    }
  },
  {
    id: 'fatigue-low',
    name: '低周疲劳试验',
    description: '低周疲劳试验 (10-100次循环)',
    type: 'fatigue',
    params: { cycleCount: 50, maxStress: 0.8, minStress: 0.1 }
  },
  {
    id: 'fatigue-high',
    name: '高周疲劳试验',
    description: '高周疲劳试验 (1000+次循环)',
    type: 'fatigue',
    params: { cycleCount: 1000, maxStress: 0.6, minStress: 0.2 }
  },
];

// 自定义加载步骤类型
interface LoadingStep {
  id: number;
  type: 'load' | 'unload' | 'hold' | 'cycle';
  target: number; // 目标值 (应力比或位移)
  rate: number;   // 速率
  duration?: number; // 持续时间 (hold)
  cycles?: number;   // 循环次数 (cycle)
}

export const SettingsPage: React.FC = () => {
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [language, setLanguage] = useState<'zh' | 'en' | 'both'>('both');
  
  // 试验方案设置
  const [activeTab, setActiveTab] = useState<'display' | 'constitutive' | 'presets' | 'program' | 'fatigue'>('display');
  
  // 本构模型设置
  const [constitutiveModel, setConstitutiveModel] = useState<ConstitutiveModelType>('hognestad');
  const [useCustomParams, setUseCustomParams] = useState(false);
  const [customFc, setCustomFc] = useState<number>(30);
  const [customEpsilon0, setCustomEpsilon0] = useState<number>(0.002);
  const [customEpsilonU, setCustomEpsilonU] = useState<number>(0.0035);
  
  // 加载保存的设置
  useEffect(() => {
    const settings = loadSettings();
    setConstitutiveModel(settings.constitutiveModel);
    setUseCustomParams(settings.useCustomParams);
    if (settings.customParams.fc) setCustomFc(settings.customParams.fc);
    if (settings.customParams.epsilon0) setCustomEpsilon0(settings.customParams.epsilon0);
    if (settings.customParams.epsilonU) setCustomEpsilonU(settings.customParams.epsilonU);
    setAnimationSpeed(settings.animationSpeed);
    setShowGrid(settings.showGrid);
    setSoundEnabled(settings.soundEnabled);
    setTheme(settings.theme);
    setLanguage(settings.language);
  }, []);
  
  // 保存本构模型设置
  const saveConstitutiveSettings = () => {
    saveSettings({
      constitutiveModel,
      useCustomParams,
      customParams: {
        fc: customFc,
        epsilon0: customEpsilon0,
        epsilonU: customEpsilonU
      }
    });
    alert('本构模型设置已保存！');
  };
  const [presets, setPresets] = useState<TestPreset[]>(DEFAULT_PRESETS);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  
  // 自定义加载程序
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([
    { id: 1, type: 'load', target: 0.3, rate: 0.5 },
    { id: 2, type: 'hold', target: 0.3, rate: 0, duration: 60 },
    { id: 3, type: 'unload', target: 0.05, rate: 1.0 },
  ]);
  const [programName, setProgramName] = useState('自定义程序 1');
  
  // 疲劳试验设置
  const [fatigueCycles, setFatigueCycles] = useState(1000);
  const [fatigueMaxStress, setFatigueMaxStress] = useState(0.7);
  const [fatigueMinStress, setFatigueMinStress] = useState(0.1);
  const [fatigueFrequency, setFatigueFrequency] = useState(1); // Hz
  const [fatigueWaveform, setFatigueWaveform] = useState<'sine' | 'triangle' | 'square'>('sine');
  
  // 添加加载步骤
  const addLoadingStep = () => {
    const newId = Math.max(...loadingSteps.map(s => s.id), 0) + 1;
    setLoadingSteps([...loadingSteps, { id: newId, type: 'load', target: 0.5, rate: 0.5 }]);
  };
  
  // 删除加载步骤
  const removeLoadingStep = (id: number) => {
    setLoadingSteps(loadingSteps.filter(s => s.id !== id));
  };
  
  // 更新加载步骤
  const updateLoadingStep = (id: number, field: keyof LoadingStep, value: number | string) => {
    setLoadingSteps(loadingSteps.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };
  
  // 保存自定义程序为预设
  const saveAsPreset = () => {
    const newPreset: TestPreset = {
      id: `custom-${Date.now()}`,
      name: programName,
      description: `自定义加载程序 (${loadingSteps.length} 步)`,
      type: 'compression',
      params: { cycleCount: loadingSteps.filter(s => s.type === 'cycle').reduce((sum, s) => sum + (s.cycles || 1), 0) }
    };
    setPresets([...presets, newPreset]);
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* 左侧侧边栏导航 */}
      <div className="w-56 flex-shrink-0 bg-slate-900/50 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">系统设置</h2>
          <p className="text-[10px] text-slate-500 mt-1">Settings</p>
        </div>
        
        <nav className="flex-1 p-2 space-y-1">
          {[
            { id: 'display', label: '显示', labelEn: 'Display', icon: Monitor },
            { id: 'constitutive', label: '本构模型', labelEn: 'Constitutive', icon: FlaskConical },
            { id: 'presets', label: '预设方案', labelEn: 'Presets', icon: FileText },
            { id: 'program', label: '加载程序', labelEn: 'Program', icon: Play },
            { id: 'fatigue', label: '疲劳试验', labelEn: 'Fatigue', icon: RotateCcw },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <tab.icon size={18} />
              <div className="text-left">
                <div>{tab.label}</div>
                <div className={`text-[10px] ${activeTab === tab.id ? 'text-blue-200' : 'text-slate-500'}`}>{tab.labelEn}</div>
              </div>
            </button>
          ))}
        </nav>
        
        {/* 底部信息 */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <Info size={12} />
            <span>ConcreteLab Pro v1.0.0</span>
          </div>
        </div>
      </div>

      {/* 右侧内容区域 */}
      <div className="flex-1 p-6 overflow-auto">
      {/* 显示设置标签页 */}
      {activeTab === 'display' && (
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 显示设置 */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Monitor size={16} className="text-blue-400" />
            显示设置 Display
          </h3>
          
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-400">动画速度 Animation Speed</span>
                <span className="text-white font-mono">{animationSpeed}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.5"
                value={animationSpeed}
                onChange={(e) => setAnimationSpeed(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>0.5x 慢速</span>
                <span>3x 快速</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">显示网格 Show Grid</div>
                <div className="text-[10px] text-slate-600">在图表中显示背景网格</div>
              </div>
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`w-12 h-6 rounded-full transition-all ${
                  showGrid ? 'bg-blue-600' : 'bg-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  showGrid ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* 主题设置 */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Palette size={16} className="text-purple-400" />
            主题设置 Theme
          </h3>
          
          <div className="space-y-4">
            <div>
              <div className="text-xs text-slate-400 mb-3">颜色主题 Color Theme</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTheme('dark')}
                  className={`p-3 rounded-lg border transition-all ${
                    theme === 'dark'
                      ? 'border-blue-500 bg-slate-800'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="w-full h-8 bg-slate-900 rounded mb-2" />
                  <div className="text-xs text-slate-400">深色 Dark</div>
                </button>
                <button
                  onClick={() => setTheme('light')}
                  disabled
                  className="p-3 rounded-lg border border-slate-700 bg-slate-800/30 opacity-50 cursor-not-allowed"
                >
                  <div className="w-full h-8 bg-slate-200 rounded mb-2" />
                  <div className="text-xs text-slate-500">浅色 Light (开发中)</div>
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-3">语言显示 Language</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'zh', label: '中文' },
                  { value: 'en', label: 'English' },
                  { value: 'both', label: '双语' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setLanguage(opt.value as typeof language)}
                    className={`py-2 px-3 rounded-lg text-xs transition-all ${
                      language === opt.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 音效设置 */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Volume2 size={16} className="text-green-400" />
            音效设置 Sound
          </h3>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">启用音效 Enable Sound</div>
              <div className="text-[10px] text-slate-600">试验过程中播放音效（开发中）</div>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              disabled
              className={`w-12 h-6 rounded-full transition-all opacity-50 cursor-not-allowed ${
                soundEnabled ? 'bg-green-600' : 'bg-slate-700'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>

        {/* 关于 */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Info size={16} className="text-cyan-400" />
            关于 About
          </h3>
          
          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">版本 Version</span>
              <span className="text-slate-300 font-mono">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">框架 Framework</span>
              <span className="text-slate-300 font-mono">React + TypeScript</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">图表 Charts</span>
              <span className="text-slate-300 font-mono">Recharts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">样式 Styling</span>
              <span className="text-slate-300 font-mono">TailwindCSS</span>
            </div>
            
            <div className="pt-3 mt-3 border-t border-slate-800">
              <p className="text-slate-500 leading-relaxed">
                ConcreteLab Pro 是一个用于教学演示的虚拟材料试验模拟器，
                模拟混凝土、钢材、岩石等材料的力学试验过程。
              </p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 本构模型标签页 */}
      {activeTab === 'constitutive' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 本构模型选择 */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <FlaskConical size={16} className="text-amber-400" />
              本构模型 Constitutive Model
            </h3>
            <p className="text-xs text-slate-500 mb-4">选择材料本构模型，将应用于虚拟试验室</p>
            
            <div className="space-y-3">
              {CONSTITUTIVE_MODELS.map(model => (
                <button
                  key={model.type}
                  onClick={() => setConstitutiveModel(model.type)}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    constitutiveModel === model.type
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      constitutiveModel === model.type ? 'bg-amber-500' : 'bg-slate-600'
                    }`} />
                    <div>
                      <div className="text-sm font-medium text-white">{model.name}</div>
                      <div className="text-[10px] text-slate-500">{model.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 本构参数设置 */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Settings2 size={16} className="text-blue-400" />
              本构参数 Parameters
            </h3>
            
            <div className="space-y-4">
              {/* 使用自定义参数开关 */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                <div>
                  <div className="text-xs text-slate-400">使用自定义参数</div>
                  <div className="text-[10px] text-slate-600">覆盖材料默认参数</div>
                </div>
                <button
                  onClick={() => setUseCustomParams(!useCustomParams)}
                  className={`w-12 h-6 rounded-full transition-all ${
                    useCustomParams ? 'bg-amber-600' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    useCustomParams ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              
              {/* 参数输入 */}
              <div className={`space-y-4 ${!useCustomParams ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">抗压强度 f<sub>c</sub></span>
                    <span className="text-white font-mono">{customFc} MPa</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={customFc}
                    onChange={(e) => setCustomFc(Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>10 MPa (C10)</span>
                    <span>100 MPa (C100)</span>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">峰值应变 ε<sub>0</sub></span>
                    <span className="text-white font-mono">{(customEpsilon0 * 1000).toFixed(2)} ‰</span>
                  </div>
                  <input
                    type="range"
                    min="0.0015"
                    max="0.004"
                    step="0.0001"
                    value={customEpsilon0}
                    onChange={(e) => setCustomEpsilon0(Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>1.5‰</span>
                    <span>4.0‰</span>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">极限应变 ε<sub>u</sub></span>
                    <span className="text-white font-mono">{(customEpsilonU * 1000).toFixed(2)} ‰</span>
                  </div>
                  <input
                    type="range"
                    min="0.003"
                    max="0.01"
                    step="0.0005"
                    value={customEpsilonU}
                    onChange={(e) => setCustomEpsilonU(Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>3.0‰</span>
                    <span>10.0‰</span>
                  </div>
                </div>
              </div>
              
              {/* 保存按钮 */}
              <button
                onClick={saveConstitutiveSettings}
                className="w-full mt-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg font-medium text-sm hover:from-amber-500 hover:to-orange-500 transition-all flex items-center justify-center gap-2"
              >
                <Save size={16} />
                保存设置 Save Settings
              </button>
            </div>
            
            {/* 本构曲线预览 */}
            <div className="mt-6 pt-4 border-t border-slate-700">
              <div className="text-xs text-slate-400 mb-3">本构曲线预览 Preview</div>
              <div className="bg-slate-800 rounded-lg p-4 h-40 flex items-center justify-center">
                <svg viewBox="0 0 200 100" className="w-full h-full">
                  {/* 坐标轴 */}
                  <line x1="20" y1="90" x2="190" y2="90" stroke="#475569" strokeWidth="1" />
                  <line x1="20" y1="90" x2="20" y2="10" stroke="#475569" strokeWidth="1" />
                  
                  {/* 轴标签 */}
                  <text x="105" y="98" fontSize="8" fill="#64748b" textAnchor="middle">ε</text>
                  <text x="12" y="50" fontSize="8" fill="#64748b" textAnchor="middle">σ</text>
                  
                  {/* Hognestad 曲线 */}
                  {constitutiveModel === 'hognestad' && (
                    <path
                      d="M 20 90 Q 60 85, 80 40 Q 100 10, 120 20 L 180 60"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />
                  )}
                  
                  {/* Mander 曲线 */}
                  {constitutiveModel === 'mander' && (
                    <path
                      d="M 20 90 Q 50 80, 70 30 Q 90 10, 110 15 Q 140 25, 180 50"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />
                  )}
                  
                  {/* Eurocode 曲线 */}
                  {constitutiveModel === 'eurocode' && (
                    <path
                      d="M 20 90 Q 40 80, 60 50 Q 80 20, 100 15 L 180 15"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />
                  )}
                  
                  {/* GB 50010 中国规范曲线 */}
                  {constitutiveModel === 'gb50010' && (
                    <path
                      d="M 20 90 Q 45 85, 60 60 Q 75 30, 90 20 Q 110 15, 130 25 L 180 55"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />
                  )}
                  
                  {/* 损伤本构曲线 */}
                  {constitutiveModel === 'damage' && (
                    <>
                      <path
                        d="M 20 90 Q 50 80, 70 35 Q 85 15, 100 20 Q 130 35, 180 65"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2"
                      />
                      {/* 损伤卸载路径示意 */}
                      <path
                        d="M 100 20 L 60 70"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1"
                        strokeDasharray="3,2"
                        opacity="0.5"
                      />
                    </>
                  )}
                  
                  {/* 线弹性 */}
                  {constitutiveModel === 'linear' && (
                    <line x1="20" y1="90" x2="180" y2="15" stroke="#f59e0b" strokeWidth="2" />
                  )}
                  
                  {/* 峰值点标记 */}
                  {constitutiveModel !== 'linear' && (
                    <circle 
                      cx={constitutiveModel === 'eurocode' ? 100 : constitutiveModel === 'gb50010' ? 90 : constitutiveModel === 'damage' ? 100 : 80} 
                      cy={constitutiveModel === 'eurocode' ? 15 : constitutiveModel === 'gb50010' ? 20 : constitutiveModel === 'damage' ? 20 : 40} 
                      r="4" 
                      fill="#f59e0b" 
                    />
                  )}
                </svg>
              </div>
              <div className="text-[10px] text-slate-500 mt-2 text-center">
                {constitutiveModel === 'hognestad' && 'σ = fc × [2(ε/ε₀) - (ε/ε₀)²]'}
                {constitutiveModel === 'gb50010' && 'σ = fc × [αa·x + (3-2αa)x² + (αa-2)x³]'}
                {constitutiveModel === 'damage' && 'σ = (1-d) × E × ε'}
                {constitutiveModel === 'mander' && 'σ = fcc × xr / (r - 1 + xʳ)'}
                {constitutiveModel === 'eurocode' && 'σ = fcm × [kη - η²] / [1 + (k-2)η]'}
                {constitutiveModel === 'linear' && 'σ = E × ε'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 预设方案标签页 */}
      {activeTab === 'presets' && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <FileText size={16} className="text-green-400" />
              预设试验方案 Test Presets
            </h3>
            <p className="text-xs text-slate-500 mb-4">选择预设方案快速配置试验参数</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {presets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset.id)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedPreset === preset.id
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      preset.type === 'compression' ? 'bg-blue-500/20 text-blue-400' :
                      preset.type === 'modulus' ? 'bg-purple-500/20 text-purple-400' :
                      preset.type === 'fatigue' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-cyan-500/20 text-cyan-400'
                    }`}>
                      {preset.type === 'compression' ? '抗压' :
                       preset.type === 'modulus' ? '模量' :
                       preset.type === 'fatigue' ? '疲劳' : '抗拉'}
                    </span>
                    {preset.id.startsWith('custom-') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPresets(presets.filter(p => p.id !== preset.id));
                        }}
                        className="text-slate-500 hover:text-red-400"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <div className="text-sm font-medium text-white mb-1">{preset.name}</div>
                  <div className="text-[10px] text-slate-500">{preset.description}</div>
                  {preset.params.loadingRate && (
                    <div className="text-[10px] text-slate-400 mt-2">
                      加载速率: {preset.params.loadingRate} MPa/s
                    </div>
                  )}
                  {preset.params.cycleCount && (
                    <div className="text-[10px] text-slate-400">
                      循环次数: {preset.params.cycleCount}
                    </div>
                  )}
                </button>
              ))}
            </div>
            
            {selectedPreset && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-green-400">
                    已选择: {presets.find(p => p.id === selectedPreset)?.name}
                  </span>
                  <button className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors">
                    应用到试验
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 自定义加载程序标签页 */}
      {activeTab === 'program' && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Play size={16} className="text-yellow-400" />
                自定义加载程序 Custom Program
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={saveAsPreset}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors"
                >
                  <Save size={12} />
                  保存为预设
                </button>
              </div>
            </div>
            
            {/* 程序名称 */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">程序名称</label>
              <input
                type="text"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            
            {/* 加载步骤列表 */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">加载步骤</span>
                <button
                  onClick={addLoadingStep}
                  className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors"
                >
                  <Plus size={12} />
                  添加步骤
                </button>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {loadingSteps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700">
                    <span className="text-xs text-slate-500 w-6">{index + 1}.</span>
                    
                    <select
                      value={step.type}
                      onChange={(e) => updateLoadingStep(step.id, 'type', e.target.value)}
                      className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                    >
                      <option value="load">加载 Load</option>
                      <option value="unload">卸载 Unload</option>
                      <option value="hold">保载 Hold</option>
                      <option value="cycle">循环 Cycle</option>
                    </select>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500">目标:</span>
                      <input
                        type="number"
                        value={step.target}
                        onChange={(e) => updateLoadingStep(step.id, 'target', Number(e.target.value))}
                        className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                        step="0.1"
                      />
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500">速率:</span>
                      <input
                        type="number"
                        value={step.rate}
                        onChange={(e) => updateLoadingStep(step.id, 'rate', Number(e.target.value))}
                        className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                        step="0.1"
                      />
                    </div>
                    
                    {step.type === 'hold' && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">时间(s):</span>
                        <input
                          type="number"
                          value={step.duration || 0}
                          onChange={(e) => updateLoadingStep(step.id, 'duration', Number(e.target.value))}
                          className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                        />
                      </div>
                    )}
                    
                    {step.type === 'cycle' && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">次数:</span>
                        <input
                          type="number"
                          value={step.cycles || 1}
                          onChange={(e) => updateLoadingStep(step.id, 'cycles', Number(e.target.value))}
                          className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                        />
                      </div>
                    )}
                    
                    <button
                      onClick={() => removeLoadingStep(step.id)}
                      className="ml-auto text-slate-500 hover:text-red-400 transition-colors"
                      disabled={loadingSteps.length <= 1}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 程序预览 */}
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="text-xs text-slate-400 mb-2">程序预览</div>
              <div className="flex items-center gap-1 flex-wrap">
                {loadingSteps.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <span className={`px-2 py-1 rounded text-[10px] font-mono ${
                      step.type === 'load' ? 'bg-green-500/20 text-green-400' :
                      step.type === 'unload' ? 'bg-blue-500/20 text-blue-400' :
                      step.type === 'hold' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>
                      {step.type === 'load' ? '↑' : step.type === 'unload' ? '↓' : step.type === 'hold' ? '—' : '↻'}
                      {step.target}
                    </span>
                    {index < loadingSteps.length - 1 && (
                      <span className="text-slate-600">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 疲劳试验设置标签页 */}
      {activeTab === 'fatigue' && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <RotateCcw size={16} className="text-orange-400" />
              疲劳试验设置 Fatigue Test Settings
            </h3>
            <p className="text-xs text-slate-500 mb-4">配置疲劳试验的循环参数</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 循环次数 */}
              <div>
                <label className="text-xs text-slate-400 mb-2 block">循环次数 Cycle Count</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="10000"
                    step="10"
                    value={fatigueCycles}
                    onChange={(e) => setFatigueCycles(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <input
                    type="number"
                    value={fatigueCycles}
                    onChange={(e) => setFatigueCycles(Number(e.target.value))}
                    className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white text-center font-mono"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                  <span>10 (低周)</span>
                  <span>10000 (高周)</span>
                </div>
              </div>
              
              {/* 应力上限 */}
              <div>
                <label className="text-xs text-slate-400 mb-2 block">应力上限 σ_max (相对于 fc)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.3"
                    max="0.95"
                    step="0.05"
                    value={fatigueMaxStress}
                    onChange={(e) => setFatigueMaxStress(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  <span className="w-16 text-sm text-white font-mono text-center">{(fatigueMaxStress * 100).toFixed(0)}%</span>
                </div>
              </div>
              
              {/* 应力下限 */}
              <div>
                <label className="text-xs text-slate-400 mb-2 block">应力下限 σ_min (相对于 fc)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.05"
                    value={fatigueMinStress}
                    onChange={(e) => setFatigueMinStress(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="w-16 text-sm text-white font-mono text-center">{(fatigueMinStress * 100).toFixed(0)}%</span>
                </div>
              </div>
              
              {/* 加载频率 */}
              <div>
                <label className="text-xs text-slate-400 mb-2 block">加载频率 Frequency (Hz)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={fatigueFrequency}
                    onChange={(e) => setFatigueFrequency(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                  <span className="w-16 text-sm text-white font-mono text-center">{fatigueFrequency.toFixed(1)} Hz</span>
                </div>
              </div>
              
              {/* 波形选择 */}
              <div className="md:col-span-2">
                <label className="text-xs text-slate-400 mb-2 block">加载波形 Waveform</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'sine', label: '正弦波 Sine', icon: '∿' },
                    { value: 'triangle', label: '三角波 Triangle', icon: '△' },
                    { value: 'square', label: '方波 Square', icon: '□' },
                  ].map(wf => (
                    <button
                      key={wf.value}
                      onClick={() => setFatigueWaveform(wf.value as typeof fatigueWaveform)}
                      className={`p-3 rounded-lg border transition-all ${
                        fatigueWaveform === wf.value
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-2xl mb-1">{wf.icon}</div>
                      <div className="text-xs text-slate-400">{wf.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* 参数摘要 */}
            <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="text-xs text-slate-400 mb-3">参数摘要 Summary</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-orange-400 font-mono">{fatigueCycles}</div>
                  <div className="text-[10px] text-slate-500">循环次数</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white font-mono">
                    {(fatigueMaxStress * 100).toFixed(0)}% - {(fatigueMinStress * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-slate-500">应力范围</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-400 font-mono">{fatigueFrequency.toFixed(1)} Hz</div>
                  <div className="text-[10px] text-slate-500">加载频率</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-cyan-400 font-mono">
                    {(fatigueCycles / fatigueFrequency / 60).toFixed(1)} min
                  </div>
                  <div className="text-[10px] text-slate-500">预计时长</div>
                </div>
              </div>
            </div>
            
            {/* 快速预设 */}
            <div className="mt-4">
              <div className="text-xs text-slate-400 mb-2">快速预设 Quick Presets</div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => { setFatigueCycles(50); setFatigueMaxStress(0.8); setFatigueMinStress(0.1); setFatigueFrequency(0.5); }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition-colors"
                >
                  低周疲劳 (50次)
                </button>
                <button
                  onClick={() => { setFatigueCycles(1000); setFatigueMaxStress(0.6); setFatigueMinStress(0.2); setFatigueFrequency(2); }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition-colors"
                >
                  中周疲劳 (1000次)
                </button>
                <button
                  onClick={() => { setFatigueCycles(10000); setFatigueMaxStress(0.5); setFatigueMinStress(0.2); setFatigueFrequency(5); }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition-colors"
                >
                  高周疲劳 (10000次)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
