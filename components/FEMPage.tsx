/**
 * FEM 有限元分析页面
 * FEM Analysis Page
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Play, RotateCcw, Settings2, Grid3X3, Layers, Eye, EyeOff, ZoomIn, ZoomOut } from 'lucide-react';
import { FEMContourPlot } from './FEMContourPlot';
import { 
  Mesh, FEMResult, ContourType, COLOR_MAPS,
  Material, NodalLoad, DisplacementBC
} from '../services/fem/types';
import { 
  generateRectangularMesh, 
  applyBottomFixedBC, 
  getTopNodeIds,
  createConcreteMaterial,
  getMeshStats
} from '../services/fem/mesh';
import { solve } from '../services/fem/solver';

// 云图类型选项
const CONTOUR_OPTIONS: { value: ContourType; label: string; group: string }[] = [
  { value: 'displacement_x', label: 'Ux 位移', group: '位移' },
  { value: 'displacement_y', label: 'Uy 位移', group: '位移' },
  { value: 'displacement_mag', label: '位移幅值', group: '位移' },
  { value: 'stress_x', label: 'σx 应力', group: '应力' },
  { value: 'stress_y', label: 'σy 应力', group: '应力' },
  { value: 'stress_xy', label: 'τxy 剪应力', group: '应力' },
  { value: 'stress_1', label: 'σ1 主应力', group: '应力' },
  { value: 'stress_2', label: 'σ2 主应力', group: '应力' },
  { value: 'von_mises', label: 'von Mises', group: '应力' },
  { value: 'strain_x', label: 'εx 应变', group: '应变' },
  { value: 'strain_y', label: 'εy 应变', group: '应变' },
];

export const FEMPage: React.FC = () => {
  // 网格参数
  const [specimenWidth, setSpecimenWidth] = useState(150);  // mm
  const [specimenHeight, setSpecimenHeight] = useState(150); // mm
  const [meshNx, setMeshNx] = useState(10);
  const [meshNy, setMeshNy] = useState(10);
  
  // 材料参数
  const [concreteGrade, setConcreteGrade] = useState(30);
  const [elasticModulus, setElasticModulus] = useState(30000); // MPa
  const [poissonRatio, setPoissonRatio] = useState(0.2);
  
  // 载荷参数
  const [appliedStress, setAppliedStress] = useState(-30); // MPa (负值=压缩)
  const [analysisType, setAnalysisType] = useState<'plane_stress' | 'plane_strain'>('plane_stress');
  
  // 显示参数
  const [contourType, setContourType] = useState<ContourType>('von_mises');
  const [colorMapName, setColorMapName] = useState('jet');
  const [showMesh, setShowMesh] = useState(true);
  const [showDeformed, setShowDeformed] = useState(true);
  const [deformationScale, setDeformationScale] = useState(100);
  
  // 分析状态
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mesh, setMesh] = useState<Mesh | null>(null);
  const [result, setResult] = useState<FEMResult | null>(null);
  const [analysisTime, setAnalysisTime] = useState<number | null>(null);
  
  // 生成网格
  const generateMesh = useCallback(() => {
    const material: Material = {
      id: 1,
      name: `C${concreteGrade} 混凝土`,
      E: elasticModulus,
      nu: poissonRatio,
      fc: concreteGrade,
    };
    
    const newMesh = generateRectangularMesh(
      specimenWidth, 
      specimenHeight, 
      meshNx, 
      meshNy, 
      material
    );
    
    // 应用底部固定边界
    applyBottomFixedBC(newMesh);
    
    setMesh(newMesh);
    setResult(null);
    
    console.log('Mesh generated:', getMeshStats(newMesh));
  }, [specimenWidth, specimenHeight, meshNx, meshNy, concreteGrade, elasticModulus, poissonRatio]);
  
  // 运行分析
  const runAnalysis = useCallback(() => {
    if (!mesh) {
      generateMesh();
      return;
    }
    
    setIsAnalyzing(true);
    const startTime = performance.now();
    
    // 使用 setTimeout 让 UI 更新
    setTimeout(() => {
      try {
        // 获取顶部节点
        const topNodeIds = getTopNodeIds(mesh);
        const dx = specimenWidth / meshNx;
        
        // 计算节点力 (均布压力转节点力)
        const forcePerNode = appliedStress * dx * 1; // 厚度=1
        
        const nodalLoads: NodalLoad[] = topNodeIds.map((nodeId, idx) => ({
          nodeId,
          fy: idx === 0 || idx === topNodeIds.length - 1 
            ? forcePerNode / 2  // 边缘节点力减半
            : forcePerNode,
        }));
        
        // 求解
        const femResult = solve(mesh, nodalLoads, [], analysisType);
        
        const endTime = performance.now();
        setAnalysisTime(endTime - startTime);
        setResult(femResult);
        
      } catch (error) {
        console.error('FEM Analysis failed:', error);
        alert('分析失败: ' + (error as Error).message);
      } finally {
        setIsAnalyzing(false);
      }
    }, 50);
  }, [mesh, specimenWidth, meshNx, appliedStress, analysisType, generateMesh]);
  
  // 重置
  const reset = useCallback(() => {
    setMesh(null);
    setResult(null);
    setAnalysisTime(null);
  }, []);
  
  // 网格统计
  const meshStats = useMemo(() => {
    if (!mesh) return null;
    return getMeshStats(mesh);
  }, [mesh]);
  
  return (
    <div className="h-full flex overflow-hidden">
      {/* 左侧控制面板 */}
      <div className="w-72 flex-shrink-0 bg-slate-900/50 border-r border-slate-800 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Grid3X3 size={20} className="text-cyan-400" />
            有限元分析
          </h2>
          <p className="text-[10px] text-slate-500 mt-1">FEM Analysis</p>
        </div>
        
        {/* 试件参数 */}
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2">
            <Layers size={14} />
            试件尺寸 Specimen
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">宽度 Width (mm)</label>
              <input
                type="number"
                value={specimenWidth}
                onChange={(e) => setSpecimenWidth(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">高度 Height (mm)</label>
              <input
                type="number"
                value={specimenHeight}
                onChange={(e) => setSpecimenHeight(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white"
              />
            </div>
          </div>
        </div>
        
        {/* 网格参数 */}
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2">
            <Grid3X3 size={14} />
            网格划分 Mesh
          </h3>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">X方向</label>
              <input
                type="number"
                value={meshNx}
                onChange={(e) => setMeshNx(Math.max(2, Number(e.target.value)))}
                min={2}
                max={50}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Y方向</label>
              <input
                type="number"
                value={meshNy}
                onChange={(e) => setMeshNy(Math.max(2, Number(e.target.value)))}
                min={2}
                max={50}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white"
              />
            </div>
          </div>
          
          {meshStats && (
            <div className="mt-2 text-[10px] text-slate-500">
              节点: {meshStats.nodeCount} | 单元: {meshStats.elementCount}
            </div>
          )}
        </div>
        
        {/* 材料参数 */}
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2">
            <Settings2 size={14} />
            材料参数 Material
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">混凝土等级</label>
              <select
                value={concreteGrade}
                onChange={(e) => {
                  const grade = Number(e.target.value);
                  setConcreteGrade(grade);
                  // 自动更新弹性模量
                  setElasticModulus(Math.round(4730 * Math.sqrt(grade)));
                }}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white"
              >
                {[20, 25, 30, 35, 40, 45, 50, 55, 60].map(g => (
                  <option key={g} value={g}>C{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">弹性模量 E (MPa)</label>
              <input
                type="number"
                value={elasticModulus}
                onChange={(e) => setElasticModulus(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">泊松比 ν</label>
              <input
                type="number"
                value={poissonRatio}
                onChange={(e) => setPoissonRatio(Number(e.target.value))}
                step={0.05}
                min={0}
                max={0.5}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white"
              />
            </div>
          </div>
        </div>
        
        {/* 载荷参数 */}
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-400 mb-3">载荷 Loading</h3>
          
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">施加应力 (MPa)</label>
              <input
                type="number"
                value={appliedStress}
                onChange={(e) => setAppliedStress(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white"
              />
              <div className="text-[10px] text-slate-600 mt-1">负值=压缩, 正值=拉伸</div>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">分析类型</label>
              <select
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value as typeof analysisType)}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white"
              >
                <option value="plane_stress">平面应力</option>
                <option value="plane_strain">平面应变</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="p-4 space-y-2">
          <button
            onClick={generateMesh}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
          >
            <Grid3X3 size={16} />
            生成网格
          </button>
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg transition-colors"
          >
            <Play size={16} />
            {isAnalyzing ? '分析中...' : '运行分析'}
          </button>
          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm rounded-lg transition-colors"
          >
            <RotateCcw size={16} />
            重置
          </button>
        </div>
      </div>
      
      {/* 右侧结果显示 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 工具栏 */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800">
          <div className="flex items-center gap-4">
            {/* 云图类型选择 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">云图:</span>
              <select
                value={contourType}
                onChange={(e) => setContourType(e.target.value as ContourType)}
                className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
              >
                {CONTOUR_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            
            {/* 颜色映射 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">配色:</span>
              <select
                value={colorMapName}
                onChange={(e) => setColorMapName(e.target.value)}
                className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
              >
                {Object.entries(COLOR_MAPS).map(([key, cm]) => (
                  <option key={key} value={key}>{cm.name}</option>
                ))}
              </select>
            </div>
            
            {/* 显示选项 */}
            <button
              onClick={() => setShowMesh(!showMesh)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                showMesh ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Grid3X3 size={12} />
              网格
            </button>
            
            <button
              onClick={() => setShowDeformed(!showDeformed)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                showDeformed ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {showDeformed ? <Eye size={12} /> : <EyeOff size={12} />}
              变形
            </button>
            
            {/* 变形放大系数 */}
            {showDeformed && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDeformationScale(s => Math.max(1, s / 2))}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-400"
                >
                  <ZoomOut size={12} />
                </button>
                <span className="text-xs text-slate-400 w-12 text-center">{deformationScale}x</span>
                <button
                  onClick={() => setDeformationScale(s => Math.min(1000, s * 2))}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-400"
                >
                  <ZoomIn size={12} />
                </button>
              </div>
            )}
          </div>
          
          {/* 分析信息 */}
          {analysisTime !== null && (
            <div className="text-xs text-slate-500">
              分析耗时: {analysisTime.toFixed(0)} ms
            </div>
          )}
        </div>
        
        {/* 云图显示区域 */}
        <div className="flex-1 p-4 overflow-auto flex items-center justify-center bg-slate-950">
          {mesh ? (
            <FEMContourPlot
              mesh={mesh}
              result={result}
              contourType={contourType}
              colorMapName={colorMapName}
              showMesh={showMesh}
              showDeformed={showDeformed}
              deformationScale={deformationScale}
              width={500}
              height={600}
              showColorBar={true}
            />
          ) : (
            <div className="text-center text-slate-500">
              <Grid3X3 size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm">点击"生成网格"开始</p>
              <p className="text-xs mt-1">Generate mesh to start</p>
            </div>
          )}
        </div>
        
        {/* 结果摘要 */}
        {result && (
          <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-800">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-cyan-400 font-mono">
                  {result.maxDisplacement.toFixed(4)}
                </div>
                <div className="text-[10px] text-slate-500">最大位移 (mm)</div>
              </div>
              <div>
                <div className="text-lg font-bold text-orange-400 font-mono">
                  {result.maxStress.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500">最大应力 (MPa)</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-400 font-mono">
                  {result.maxVonMises.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500">von Mises (MPa)</div>
              </div>
              <div>
                <div className={`text-lg font-bold font-mono ${result.converged ? 'text-green-400' : 'text-red-400'}`}>
                  {result.converged ? '收敛' : '未收敛'}
                </div>
                <div className="text-[10px] text-slate-500">求解状态</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FEMPage;
