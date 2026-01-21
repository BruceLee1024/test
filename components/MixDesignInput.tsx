import React, { useState, useEffect } from 'react';
import { 
  ConcreteMixDesign, 
  MIX_DESIGN_TEMPLATES,
  calculateConcreteStrength,
  calculateWaterCementRatio,
  calculateSandRatio,
  validateMixDesign,
  recommendMixDesign,
} from '../services/mixDesignService';
import { Beaker, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Sparkles, Calculator } from 'lucide-react';

interface MixDesignInputProps {
  mixDesign: ConcreteMixDesign;
  onMixDesignChange: (mixDesign: ConcreteMixDesign) => void;
  onStrengthCalculated: (strength: number) => void;
}

export const MixDesignInput: React.FC<MixDesignInputProps> = ({
  mixDesign,
  onMixDesignChange,
  onStrengthCalculated,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [calculatedStrength, setCalculatedStrength] = useState<number>(0);
  const [validation, setValidation] = useState<{ valid: boolean; warnings: string[]; errors: string[] }>({
    valid: true,
    warnings: [],
    errors: [],
  });

  // 计算派生值
  const waterCementRatio = calculateWaterCementRatio(mixDesign.water, mixDesign.cement);
  const sandRatio = calculateSandRatio(mixDesign.fineAggregate, mixDesign.coarseAggregate);
  const totalMass = mixDesign.cement + mixDesign.water + mixDesign.fineAggregate + mixDesign.coarseAggregate + (mixDesign.admixture || 0);

  // 当配合比改变时，重新计算强度和验证
  useEffect(() => {
    const strength = calculateConcreteStrength(mixDesign);
    setCalculatedStrength(strength);
    onStrengthCalculated(strength);
    
    const validationResult = validateMixDesign(mixDesign);
    setValidation(validationResult);
  }, [mixDesign, onStrengthCalculated]);

  const handleInputChange = (field: keyof ConcreteMixDesign, value: number | string) => {
    onMixDesignChange({
      ...mixDesign,
      [field]: typeof value === 'string' ? value : value,
    });
  };

  const handleTemplateSelect = (templateIndex: number) => {
    const template = MIX_DESIGN_TEMPLATES[templateIndex];
    onMixDesignChange(template.mixDesign);
    setShowTemplates(false);
  };

  const handleAutoRecommend = () => {
    const recommended = recommendMixDesign(
      calculatedStrength || 30,
      mixDesign.cementStrength,
      mixDesign.aggregateType
    );
    onMixDesignChange(recommended);
  };

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      {/* 标题栏 */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Beaker className="w-4 h-4 text-green-400" />
          <span className="font-medium text-sm">混凝土配合比</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            计算强度: <span className="text-green-400 font-bold">{calculatedStrength.toFixed(1)} MPa</span>
          </span>
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
          {/* 快捷操作按钮 */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex-1 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded text-xs text-blue-300 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3 h-3" />
              预设模板
            </button>
            <button
              onClick={handleAutoRecommend}
              className="flex-1 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded text-xs text-purple-300 transition-colors flex items-center justify-center gap-2"
            >
              <Calculator className="w-3 h-3" />
              智能推荐
            </button>
          </div>

          {/* 预设模板选择 */}
          {showTemplates && (
            <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-slate-300 mb-2">选择预设配合比</div>
              {MIX_DESIGN_TEMPLATES.map((template, index) => (
                <button
                  key={index}
                  onClick={() => handleTemplateSelect(index)}
                  className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs transition-colors"
                >
                  <div className="font-medium text-slate-200">{template.name}</div>
                  <div className="text-slate-500 text-[10px] mt-0.5">{template.description}</div>
                </button>
              ))}
            </div>
          )}

          {/* 材料用量输入 */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-slate-300 mb-2">材料用量 (kg/m³)</div>
            
            {/* 水泥用量 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">水泥用量</label>
                <input
                  type="number"
                  value={mixDesign.cement}
                  onChange={(e) => handleInputChange('cement', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-right text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min="200"
                  max="700"
                  step="10"
                />
              </div>
              <input
                type="range"
                min="200"
                max="700"
                step="10"
                value={mixDesign.cement}
                onChange={(e) => handleInputChange('cement', parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* 用水量 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">用水量</label>
                <input
                  type="number"
                  value={mixDesign.water}
                  onChange={(e) => handleInputChange('water', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-right text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min="140"
                  max="230"
                  step="5"
                />
              </div>
              <input
                type="range"
                min="140"
                max="230"
                step="5"
                value={mixDesign.water}
                onChange={(e) => handleInputChange('water', parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* 细骨料（砂） */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">细骨料（砂）</label>
                <input
                  type="number"
                  value={mixDesign.fineAggregate}
                  onChange={(e) => handleInputChange('fineAggregate', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-right text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min="400"
                  max="900"
                  step="10"
                />
              </div>
              <input
                type="range"
                min="400"
                max="900"
                step="10"
                value={mixDesign.fineAggregate}
                onChange={(e) => handleInputChange('fineAggregate', parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* 粗骨料（石子） */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">粗骨料（石子）</label>
                <input
                  type="number"
                  value={mixDesign.coarseAggregate}
                  onChange={(e) => handleInputChange('coarseAggregate', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-right text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min="800"
                  max="1300"
                  step="10"
                />
              </div>
              <input
                type="range"
                min="800"
                max="1300"
                step="10"
                value={mixDesign.coarseAggregate}
                onChange={(e) => handleInputChange('coarseAggregate', parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* 外加剂（可选） */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">外加剂（可选）</label>
                <input
                  type="number"
                  value={mixDesign.admixture || 0}
                  onChange={(e) => handleInputChange('admixture', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-right text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min="0"
                  max="30"
                  step="1"
                />
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={mixDesign.admixture || 0}
                onChange={(e) => handleInputChange('admixture', parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* 材料特性 */}
          <div className="space-y-3 pt-3 border-t border-slate-700">
            <div className="text-xs font-medium text-slate-300 mb-2">材料特性</div>
            
            {/* 水泥强度等级 */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">水泥强度等级</label>
              <select
                value={mixDesign.cementStrength}
                onChange={(e) => handleInputChange('cementStrength', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="32.5">P.O 32.5</option>
                <option value="42.5">P.O 42.5</option>
                <option value="52.5">P.O 52.5</option>
                <option value="62.5">P.O 62.5</option>
              </select>
            </div>

            {/* 骨料类型 */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">骨料类型</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleInputChange('aggregateType', 'crushed')}
                  className={`px-3 py-2 rounded text-xs transition-colors ${
                    mixDesign.aggregateType === 'crushed'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  碎石
                </button>
                <button
                  onClick={() => handleInputChange('aggregateType', 'natural')}
                  className={`px-3 py-2 rounded text-xs transition-colors ${
                    mixDesign.aggregateType === 'natural'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  卵石
                </button>
              </div>
            </div>

            {/* 最大骨料粒径 */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">最大骨料粒径 (mm)</label>
              <select
                value={mixDesign.maxAggregateSize}
                onChange={(e) => handleInputChange('maxAggregateSize', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="16">16</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="31.5">31.5</option>
                <option value="40">40</option>
              </select>
            </div>

            {/* 养护条件 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">养护龄期 (天)</label>
                <select
                  value={mixDesign.curingDays}
                  onChange={(e) => handleInputChange('curingDays', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="7">7</option>
                  <option value="14">14</option>
                  <option value="28">28</option>
                  <option value="56">56</option>
                  <option value="90">90</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">养护条件</label>
                <select
                  value={mixDesign.curingCondition}
                  onChange={(e) => handleInputChange('curingCondition', e.target.value as 'standard' | 'natural')}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="standard">标准养护</option>
                  <option value="natural">自然养护</option>
                </select>
              </div>
            </div>
          </div>

          {/* 计算结果显示 */}
          <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-green-300 mb-2">计算结果</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400">水灰比 W/C:</span>
                <span className="ml-2 text-green-400 font-mono font-bold">{waterCementRatio.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-slate-400">砂率:</span>
                <span className="ml-2 text-green-400 font-mono font-bold">{sandRatio.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-slate-400">总质量:</span>
                <span className="ml-2 text-green-400 font-mono font-bold">{totalMass.toFixed(0)} kg/m³</span>
              </div>
              <div>
                <span className="text-slate-400">计算强度:</span>
                <span className="ml-2 text-green-400 font-mono font-bold">{calculatedStrength.toFixed(1)} MPa</span>
              </div>
            </div>
          </div>

          {/* 验证警告和错误 */}
          {(validation.warnings.length > 0 || validation.errors.length > 0) && (
            <div className="space-y-2">
              {validation.errors.map((error, index) => (
                <div key={`error-${index}`} className="flex items-start gap-2 p-2 bg-red-900/20 border border-red-700/30 rounded text-xs text-red-300">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ))}
              {validation.warnings.map((warning, index) => (
                <div key={`warning-${index}`} className="flex items-start gap-2 p-2 bg-yellow-900/20 border border-yellow-700/30 rounded text-xs text-yellow-300">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          {/* 验证通过提示 */}
          {validation.valid && validation.warnings.length === 0 && (
            <div className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-700/30 rounded text-xs text-green-300">
              <CheckCircle className="w-3 h-3 flex-shrink-0" />
              <span>配合比验证通过，参数合理</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
