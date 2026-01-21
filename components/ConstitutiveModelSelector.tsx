import React, { useState, useEffect } from 'react';
import { MaterialType } from '../types';
import { ConstitutiveModelType } from '../services/settingsService';
import { Settings, ChevronDown, ChevronUp, Info } from 'lucide-react';

// 本构模型参数接口
export interface ConstitutiveParams {
  // 通用参数
  fc?: number;          // 抗压强度 (MPa)
  ft?: number;          // 抗拉强度 (MPa)
  E?: number;           // 弹性模量 (MPa)
  epsilon0?: number;    // 峰值应变
  epsilonU?: number;    // 极限应变
  nu?: number;          // 泊松比
  
  // Mander 模型特有参数
  fcc?: number;         // 约束混凝土强度 (MPa)
  epsilonCC?: number;   // 约束混凝土峰值应变
  
  // Eurocode 模型特有参数
  k?: number;           // 塑性系数
  
  // 中国规范特有参数
  alpha_a?: number;     // 上升段参数
}

// 本构模型配置
export interface ConstitutiveModelConfig {
  type: ConstitutiveModelType;
  name: string;
  nameEn: string;
  description: string;
  applicableMaterials: MaterialType[];
  defaultParams: ConstitutiveParams;
  paramDescriptions: {
    [key: string]: {
      label: string;
      unit: string;
      description: string;
      min?: number;
      max?: number;
    };
  };
}

// 预定义本构模型库
export const CONSTITUTIVE_MODELS: Record<ConstitutiveModelType, ConstitutiveModelConfig> = {
  hognestad: {
    type: 'hognestad',
    name: 'Hognestad 抛物线模型',
    nameEn: 'Hognestad Parabolic Model',
    description: '经典混凝土本构模型，适用于普通混凝土单轴压缩',
    applicableMaterials: [MaterialType.CONCRETE, MaterialType.MORTAR, MaterialType.SCC],
    defaultParams: {
      fc: 30,
      epsilon0: 0.002,
      epsilonU: 0.0038,
      E: 30000,
    },
    paramDescriptions: {
      fc: { label: '抗压强度', unit: 'MPa', description: '混凝土轴心抗压强度', min: 10, max: 100 },
      epsilon0: { label: '峰值应变', unit: '', description: '达到峰值应力时的应变', min: 0.0015, max: 0.003 },
      epsilonU: { label: '极限应变', unit: '', description: '混凝土破坏时的极限应变', min: 0.003, max: 0.005 },
      E: { label: '弹性模量', unit: 'MPa', description: '混凝土弹性模量', min: 20000, max: 50000 },
    },
  },
  eurocode: {
    type: 'eurocode',
    name: '欧洲规范 EC2',
    nameEn: 'Eurocode 2 Model',
    description: '欧洲规范 EN 1992-1-1 推荐的混凝土本构模型',
    applicableMaterials: [MaterialType.CONCRETE, MaterialType.HPC],
    defaultParams: {
      fc: 30,
      epsilon0: 0.0022,
      epsilonU: 0.0035,
      E: 31000,
      k: 1.05,
    },
    paramDescriptions: {
      fc: { label: '抗压强度', unit: 'MPa', description: '混凝土圆柱体抗压强度', min: 12, max: 90 },
      epsilon0: { label: '峰值应变', unit: '', description: '达到峰值应力时的应变', min: 0.0017, max: 0.0028 },
      epsilonU: { label: '极限应变', unit: '', description: '混凝土破坏时的极限应变', min: 0.0028, max: 0.0038 },
      E: { label: '弹性模量', unit: 'MPa', description: '混凝土弹性模量', min: 20000, max: 45000 },
      k: { label: '塑性系数', unit: '', description: 'k = 1.05Ecε₀/fc', min: 1.0, max: 2.0 },
    },
  },
  chinese_parabola: {
    type: 'chinese_parabola',
    name: '中国规范(抛物线)',
    nameEn: 'Chinese Code (Parabola)',
    description: 'GB 50010-2010 混凝土结构设计规范，上升段抛物线模型',
    applicableMaterials: [MaterialType.CONCRETE, MaterialType.HPC, MaterialType.SCC],
    defaultParams: {
      fc: 30,
      epsilon0: 0.002,
      epsilonU: 0.0033,
      E: 30000,
      alpha_a: 2.025,
    },
    paramDescriptions: {
      fc: { label: '抗压强度', unit: 'MPa', description: '混凝土轴心抗压强度', min: 10, max: 100 },
      epsilon0: { label: '峰值应变', unit: '', description: '达到峰值应力时的应变', min: 0.0015, max: 0.003 },
      epsilonU: { label: '极限应变', unit: '', description: '混凝土破坏时的极限应变', min: 0.003, max: 0.0038 },
      E: { label: '弹性模量', unit: 'MPa', description: '混凝土弹性模量', min: 20000, max: 50000 },
      alpha_a: { label: '上升段参数', unit: '', description: 'αa = 2.4 - 0.0125fc', min: 1.5, max: 2.4 },
    },
  },
  mander: {
    type: 'mander',
    name: 'Mander 约束混凝土模型',
    nameEn: 'Mander Confined Concrete Model',
    description: '考虑横向约束效应的混凝土本构模型',
    applicableMaterials: [MaterialType.CONCRETE, MaterialType.HPC],
    defaultParams: {
      fc: 30,
      fcc: 36,
      epsilon0: 0.002,
      epsilonCC: 0.006,
      epsilonU: 0.012,
      E: 30000,
    },
    paramDescriptions: {
      fc: { label: '无约束强度', unit: 'MPa', description: '无约束混凝土抗压强度', min: 10, max: 100 },
      fcc: { label: '约束强度', unit: 'MPa', description: '约束混凝土抗压强度', min: 10, max: 150 },
      epsilon0: { label: '无约束峰值应变', unit: '', description: '无约束混凝土峰值应变', min: 0.0015, max: 0.003 },
      epsilonCC: { label: '约束峰值应变', unit: '', description: '约束混凝土峰值应变', min: 0.004, max: 0.015 },
      epsilonU: { label: '极限应变', unit: '', description: '约束混凝土极限应变', min: 0.008, max: 0.05 },
      E: { label: '弹性模量', unit: 'MPa', description: '混凝土弹性模量', min: 20000, max: 50000 },
    },
  },
  kent_park: {
    type: 'kent_park',
    name: 'Kent-Park 模型',
    nameEn: 'Kent-Park Model',
    description: '考虑约束和软化的混凝土本构模型',
    applicableMaterials: [MaterialType.CONCRETE],
    defaultParams: {
      fc: 30,
      epsilon0: 0.002,
      epsilonU: 0.005,
      E: 30000,
    },
    paramDescriptions: {
      fc: { label: '抗压强度', unit: 'MPa', description: '混凝土抗压强度', min: 10, max: 100 },
      epsilon0: { label: '峰值应变', unit: '', description: '达到峰值应力时的应变', min: 0.0015, max: 0.003 },
      epsilonU: { label: '极限应变', unit: '', description: '混凝土破坏时的极限应变', min: 0.003, max: 0.01 },
      E: { label: '弹性模量', unit: 'MPa', description: '混凝土弹性模量', min: 20000, max: 50000 },
    },
  },
  gb50010: {
    type: 'gb50010',
    name: 'GB 50010 中国规范',
    nameEn: 'Chinese Code GB 50010',
    description: '中国混凝土结构设计规范 GB 50010-2010 本构模型',
    applicableMaterials: [MaterialType.CONCRETE, MaterialType.HPC, MaterialType.SCC],
    defaultParams: {
      fc: 30,
      epsilon0: 0.002,
      epsilonU: 0.0033,
      E: 30000,
    },
    paramDescriptions: {
      fc: { label: '抗压强度', unit: 'MPa', description: '混凝土轴心抗压强度', min: 10, max: 100 },
      epsilon0: { label: '峰值应变', unit: '', description: '达到峰值应力时的应变', min: 0.0015, max: 0.003 },
      epsilonU: { label: '极限应变', unit: '', description: '混凝土破坏时的极限应变', min: 0.003, max: 0.0038 },
      E: { label: '弹性模量', unit: 'MPa', description: '混凝土弹性模量', min: 20000, max: 50000 },
    },
  },
  damage: {
    type: 'damage',
    name: '损伤本构模型',
    nameEn: 'Damage Model',
    description: '基于连续损伤力学的混凝土本构模型，考虑刚度退化',
    applicableMaterials: [MaterialType.CONCRETE, MaterialType.HPC],
    defaultParams: {
      fc: 30,
      epsilon0: 0.002,
      epsilonU: 0.0033,
      E: 30000,
    },
    paramDescriptions: {
      fc: { label: '抗压强度', unit: 'MPa', description: '混凝土抗压强度', min: 10, max: 100 },
      epsilon0: { label: '峰值应变', unit: '', description: '达到峰值应力时的应变', min: 0.0015, max: 0.003 },
      epsilonU: { label: '极限应变', unit: '', description: '混凝土破坏时的极限应变', min: 0.003, max: 0.005 },
      E: { label: '弹性模量', unit: 'MPa', description: '混凝土弹性模量', min: 20000, max: 50000 },
    },
  },
  linear: {
    type: 'linear',
    name: '线弹性模型',
    nameEn: 'Linear Elastic Model',
    description: '简化的线弹性本构模型，仅用于弹性分析',
    applicableMaterials: [MaterialType.CONCRETE, MaterialType.STEEL, MaterialType.ROCK],
    defaultParams: {
      E: 30000,
      nu: 0.2,
    },
    paramDescriptions: {
      E: { label: '弹性模量', unit: 'MPa', description: '材料弹性模量', min: 1000, max: 210000 },
      nu: { label: '泊松比', unit: '', description: '材料泊松比', min: 0.1, max: 0.5 },
    },
  },
};

interface ConstitutiveModelSelectorProps {
  materialType: MaterialType;
  selectedModel: ConstitutiveModelType;
  customParams: ConstitutiveParams;
  useCustomParams: boolean;
  onModelChange: (model: ConstitutiveModelType) => void;
  onParamsChange: (params: ConstitutiveParams) => void;
  onUseCustomParamsChange: (use: boolean) => void;
  targetStrength?: number; // 目标强度，用于自动计算默认参数
}

export const ConstitutiveModelSelector: React.FC<ConstitutiveModelSelectorProps> = ({
  materialType,
  selectedModel,
  customParams,
  useCustomParams,
  onModelChange,
  onParamsChange,
  onUseCustomParamsChange,
  targetStrength = 30,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 获取适用于当前材料的模型列表
  const applicableModels = Object.values(CONSTITUTIVE_MODELS).filter(
    model => model.applicableMaterials.includes(materialType)
  );
  
  const currentModel = CONSTITUTIVE_MODELS[selectedModel];
  
  // 当材料类型改变时，自动选择第一个适用的模型
  useEffect(() => {
    if (!currentModel.applicableMaterials.includes(materialType)) {
      const firstApplicable = applicableModels[0];
      if (firstApplicable) {
        onModelChange(firstApplicable.type);
      }
    }
  }, [materialType, currentModel, applicableModels, onModelChange]);
  
  // 根据目标强度自动计算参数
  const calculateDefaultParams = (model: ConstitutiveModelConfig): ConstitutiveParams => {
    const params = { ...model.defaultParams };
    
    // 根据目标强度调整参数
    if (params.fc !== undefined) {
      params.fc = targetStrength;
    }
    
    if (params.E !== undefined && params.fc !== undefined) {
      // 使用经验公式计算弹性模量: E = 4730√fc (MPa)
      params.E = Math.round(4730 * Math.sqrt(params.fc));
    }
    
    if (params.epsilon0 !== undefined && params.fc !== undefined) {
      // 峰值应变随强度增加而增加
      params.epsilon0 = 0.002 + (params.fc - 30) * 0.00001;
    }
    
    if (model.type === 'mander' && params.fcc !== undefined && params.fc !== undefined) {
      // 约束强度通常为无约束强度的 1.2 倍
      params.fcc = params.fc * 1.2;
    }
    
    if (model.type === 'chinese_parabola' && params.alpha_a !== undefined && params.fc !== undefined) {
      // αa = 2.4 - 0.0125fc
      params.alpha_a = 2.4 - 0.0125 * params.fc;
    }
    
    return params;
  };
  
  // 当模型改变时，更新参数
  useEffect(() => {
    if (!useCustomParams) {
      const defaultParams = calculateDefaultParams(currentModel);
      onParamsChange(defaultParams);
    }
  }, [selectedModel, targetStrength, useCustomParams]);
  
  const handleParamChange = (key: string, value: number) => {
    onParamsChange({
      ...customParams,
      [key]: value,
    });
  };
  
  const currentParams = useCustomParams ? customParams : calculateDefaultParams(currentModel);
  
  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      {/* 标题栏 */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-400" />
          <span className="font-medium text-sm">本构模型参数</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{currentModel.name}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>
      
      {/* 展开内容 */}
      {isExpanded && (
        <div className="p-4 border-t border-slate-700 space-y-4">
          {/* 模型选择 */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              选择本构模型
            </label>
            <select
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value as ConstitutiveModelType)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {applicableModels.map((model) => (
                <option key={model.type} value={model.type}>
                  {model.name} ({model.nameEn})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1 flex items-start gap-1">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{currentModel.description}</span>
            </p>
          </div>
          
          {/* 自定义参数开关 */}
          <div className="flex items-center justify-between p-2 bg-slate-900/50 rounded">
            <span className="text-xs text-slate-300">使用自定义参数</span>
            <button
              onClick={() => onUseCustomParamsChange(!useCustomParams)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                useCustomParams ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  useCustomParams ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          
          {/* 参数输入 */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-slate-300 mb-2">模型参数</div>
            {Object.entries(currentModel.paramDescriptions).map(([key, desc]) => {
              const value = currentParams[key as keyof ConstitutiveParams];
              if (value === undefined) return null;
              
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-400">
                      {desc.label} {desc.unit && `(${desc.unit})`}
                    </label>
                    <span className="text-xs font-mono text-blue-400">
                      {typeof value === 'number' ? value.toFixed(value < 1 ? 6 : 0) : value}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={desc.min || 0}
                    max={desc.max || 100}
                    step={value < 1 ? 0.0001 : 1}
                    value={value}
                    onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
                    disabled={!useCustomParams}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: useCustomParams
                        ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                            ((value - (desc.min || 0)) / ((desc.max || 100) - (desc.min || 0))) * 100
                          }%, #334155 ${
                            ((value - (desc.min || 0)) / ((desc.max || 100) - (desc.min || 0))) * 100
                          }%, #334155 100%)`
                        : '#334155',
                    }}
                  />
                  <p className="text-xs text-slate-500">{desc.description}</p>
                </div>
              );
            })}
          </div>
          
          {/* 参数预览 */}
          {useCustomParams && (
            <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded text-xs">
              <div className="font-medium text-blue-300 mb-2">当前参数配置</div>
              <div className="font-mono text-slate-300 space-y-1">
                {Object.entries(currentParams).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}:</span>
                    <span className="text-blue-400">
                      {typeof value === 'number' ? value.toFixed(value < 1 ? 6 : 2) : value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
