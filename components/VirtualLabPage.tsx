import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { TestCanvas } from './TestCanvas';
import { DataChart } from './DataChart';
import { ConstitutiveModelSelector, ConstitutiveParams } from './ConstitutiveModelSelector';
import { MixDesignInput } from './MixDesignInput';
import { ConcreteMixDesign, MIX_DESIGN_TEMPLATES } from '../services/mixDesignService';

// 懒加载 3D 组件
const Specimen3DViewer = lazy(() => import('./Specimen3DViewer'));
const SpecimenFEMViewer = lazy(() => import('./SpecimenFEMViewer'));
import { generateLabReport } from '../services/geminiService';
import { saveTestRecord } from '../services/historyService';
import { loadSettings, ConstitutiveModelType } from '../services/settingsService';
import { TestType, TestStatus, DataPoint, MaterialType } from '../types';
import { Play, Square, RefreshCw, FileText, Settings, Lock, Unlock, AlertTriangle, Download, Copy, Check, Save, Box, Grid3X3 } from 'lucide-react';
import { 
  generateMaterialProperties,
  generateConcreteProperties, 
  calculateStress as calcConcreteStress, 
  addRealisticNoise,
  getFailureWarning,
  generateCrackPaths,
  ConcreteProperties,
  MaterialProperties,
  StressStrainPoint,
  SPECIMEN_SIZES,
  MATERIAL_INFO,
} from '../services/concreteModel';


export const VirtualLabPage: React.FC = () => {
  // State
  const [testType, setTestType] = useState<TestType>(TestType.COMPRESSION);
  const [status, setStatus] = useState<TestStatus>(TestStatus.IDLE);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [currentLoad, setCurrentLoad] = useState(0);
  const [currentStress, setCurrentStress] = useState(0);
  const [currentStrain, setCurrentStrain] = useState(0);
  const [simulationTime, setSimulationTime] = useState(0);
  const [failureProgress, setFailureProgress] = useState(0); // 0 to 1
  
  // Machine Physics State
  const [actuatorPos, setActuatorPos] = useState(0); // 0 = Home (Gap), 1 = Contact
  
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [safetyDoorOpen, setSafetyDoorOpen] = useState(false);
  
  // 材料和试块参数
  const [materialType, setMaterialType] = useState<MaterialType>(MaterialType.CONCRETE);
  const [specimenSizeIndex, setSpecimenSizeIndex] = useState(0); // SPECIMEN_SIZES 索引
  const specimenSize = SPECIMEN_SIZES[specimenSizeIndex];
  const materialInfo = MATERIAL_INFO[materialType];
  
  // Params
  const [targetStrength, setTargetStrength] = useState(30); // Target MPa (e.g. C30)
  const [loadingRate, setLoadingRate] = useState(0.6); // MPa/s (ASTM C39 标准: 0.25±0.05 MPa/s)
  
  // 混凝土配合比参数
  const [useMixDesign, setUseMixDesign] = useState(false); // 是否使用配合比计算强度
  const [mixDesign, setMixDesign] = useState<ConcreteMixDesign>(MIX_DESIGN_TEMPLATES[1].mixDesign); // 默认使用C30配合比
  const [peakLoad, setPeakLoad] = useState(0);
  const [peakStress, setPeakStress] = useState(0);
  
  // 控制模式参数
  const [controlMode, setControlMode] = useState<'force' | 'displacement' | 'program'>('force'); // 控制模式
  const [forceRate, setForceRate] = useState(10); // kN/s 力加载速率
  const [displacementRate, setDisplacementRate] = useState(0.5); // mm/min 位移速率
  const [preloadForce, setPreloadForce] = useState(1.0); // kN 预加载力
  const [holdTime, setHoldTime] = useState(0); // s 保载时间
  const [cycleCount, setCycleCount] = useState(3); // 循环次数
  
  // 程序控制 - 循环加载参数（位移控制加载 + 力控制卸载）
  const [loadingDispRate, setLoadingDispRate] = useState(0.1); // mm/s 加载位移速率（模拟加速10倍）
  const [unloadingForceRate, setUnloadingForceRate] = useState(50); // kN/s 卸载力速率（模拟加速）
  const [cycleHoldTime, setCycleHoldTime] = useState(2); // 每个循环的保载时间 (s)
  const [finalLoadToFailure, setFinalLoadToFailure] = useState(true); // 最后一个循环加载至破坏
  const [dispTargets] = useState([0.15, 0.30, 0.45, 0.60, 0.90, 1.20, 1.50, 1.80, 2.10, 2.40, 2.70, 3.00, 3.30, 3.60, 3.90, 4.20]); // mm 位移目标序列
  const [unloadDispTarget, setUnloadDispTarget] = useState(0.05); // mm 卸载目标位移

  // 本构模型设置（从系统设置加载）
  const [constitutiveModel, setConstitutiveModel] = useState<ConstitutiveModelType>('hognestad');
  const [customConstitutiveParams, setCustomConstitutiveParams] = useState<ConstitutiveParams>({
    fc: 30,
    epsilon0: 0.002,
    epsilonU: 0.0038,
    E: 30000,
  });
  const [useCustomParams, setUseCustomParams] = useState(false);
  
  // 混凝土材料属性（每次试验随机生成）
  const [concreteProps, setConcreteProps] = useState<ConcreteProperties | null>(null);
  const [currentPhase, setCurrentPhase] = useState<StressStrainPoint['phase']>('seating');
  const [failureWarning, setFailureWarning] = useState<{ level: string; message: string }>({ level: 'none', message: '' });
  const [crackPaths, setCrackPaths] = useState<string[]>([]);
  
  // 交互状态
  const [showSpecimenInfo, setShowSpecimenInfo] = useState(false);
  const [showMachineInfo, setShowMachineInfo] = useState(false);
  const [testSeed, setTestSeed] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'fem'>('2d'); // 视图模式: 2D/3D/FEM
  const [showFEMContour, setShowFEMContour] = useState(true); // 2D视图中是否显示FEM云图
  
  // 程序控制 - 循环加载状态 (用于 UI 显示)
  const [currentCycle, setCurrentCycle] = useState(0); // 当前循环次数
  const [cyclePhase, setCyclePhase] = useState<'loading' | 'holding_upper' | 'unloading' | 'holding_lower' | 'final'>('loading');
  const [holdTimer, setHoldTimer] = useState(0); // 保载计时器
  const [currentDisplacement, setCurrentDisplacement] = useState(0); // mm 当前位移
  const [targetDisplacement, setTargetDisplacement] = useState(0.15); // mm 当前目标位移
  
  // 弹性模量试验状态
  const [modulusPhase, setModulusPhase] = useState<'preload1' | 'unload1' | 'hold1' | 'load2' | 'hold2' | 'load3' | 'complete'>('preload1');
  const [modulusResults, setModulusResults] = useState<{
    E_secant: number;      // 割线模量 GPa
    E_tangent: number;     // 切线模量 GPa
    E_initial: number;     // 初始切线模量 GPa
    stress_a: number;      // 应力下限 (0.5 MPa)
    stress_b: number;      // 应力上限 (1/3 fc)
    strain_a: number;      // 应变下限
    strain_b: number;      // 应变上限
  } | null>(null);
  const [modulusCycleCount, setModulusCycleCount] = useState(0); // 弹性模量试验循环次数

  // 加载本构模型设置
  useEffect(() => {
    const settings = loadSettings();
    console.log('加载本构模型设置:', settings.constitutiveModel);
    setConstitutiveModel(settings.constitutiveModel);
    setUseCustomParams(settings.useCustomParams);
    setCustomConstitutiveParams(settings.customParams);
  }, []);
  
  // Refs for loop - 用于 simulateStep 内部状态追踪，避免依赖问题
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  
  // 循环加载内部状态 refs（避免 useCallback 依赖导致的无限循环）
  const cycleStateRef = useRef({
    currentCycle: 0,
    cyclePhase: 'loading' as 'loading' | 'holding_upper' | 'unloading' | 'holding_lower' | 'final',
    holdTimer: 0,
    currentStress: 0,
    currentStrain: 0,
    currentDisplacement: 0, // mm 当前位移
    targetDisplacement: 0.15, // mm 当前循环目标位移
    // 滞回效应参数
    unloadStartStrain: 0, // 卸载起始应变
    unloadStartStress: 0, // 卸载起始应力
    plasticStrain: 0, // 塑性残余应变
    isOnEnvelope: true, // 是否在包络线上
    // 弹性模量试验参数
    modulusPhase: 'preload1' as 'preload1' | 'unload1' | 'hold1' | 'load2' | 'hold2' | 'load3' | 'complete',
    modulusCycle: 0,
    stress_a: 0.5, // 应力下限 MPa
    stress_b: 0, // 应力上限 (1/3 fc)
    strain_a: 0, // 应变下限
    strain_b: 0, // 应变上限
    strainReadings: [] as { stress: number; strain: number }[], // 用于计算模量的读数
  });

  // 根据试块尺寸计算面积
  const getArea = useCallback(() => {
    return specimenSize.area;
  }, [specimenSize]);
  
  // 获取试块高度
  const getSpecimenHeight = useCallback(() => {
    return specimenSize.dimensions.height;
  }, [specimenSize]);

  const calculateLoadFromStress = useCallback((stressMPa: number) => {
    return (stressMPa * getArea()) / 1000; // kN
  }, [getArea]);

  const resetTest = useCallback(() => {
    setStatus(TestStatus.IDLE);
    setDataPoints([]);
    setCurrentLoad(0);
    setCurrentStress(0);
    setCurrentStrain(0);
    setPeakLoad(0);
    setPeakStress(0);
    setSimulationTime(0);
    setFailureProgress(0);
    setActuatorPos(0);
    setAiReport(null);
    setConcreteProps(null);
    setCurrentPhase('seating');
    setFailureWarning({ level: 'none', message: '' });
    setCrackPaths([]);
    // 重置循环加载状态
    setCurrentCycle(0);
    setCyclePhase('loading');
    setHoldTimer(0);
    setCurrentDisplacement(0);
    setTargetDisplacement(0.15);
    // 重置弹性模量试验状态
    setModulusPhase('preload1');
    setModulusResults(null);
    setModulusCycleCount(0);
    // 重置 ref 状态
    cycleStateRef.current = {
      currentCycle: 0,
      cyclePhase: 'loading',
      holdTimer: 0,
      currentStress: 0,
      currentStrain: 0,
      currentDisplacement: 0,
      targetDisplacement: 0.15,
      unloadStartStrain: 0,
      unloadStartStress: 0,
      plasticStrain: 0,
      isOnEnvelope: true,
      modulusPhase: 'preload1',
      modulusCycle: 0,
      stress_a: 0.5,
      stress_b: 0,
      strain_a: 0,
      strain_b: 0,
      strainReadings: [],
    };
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  }, []);

  const toggleTestType = (type: TestType) => {
    if (status !== TestStatus.IDLE) return;
    setTestType(type);
    // 根据试验类型设置默认强度
    if (type === TestType.COMPRESSION) {
      setTargetStrength(40);
    } else if (type === TestType.TENSION) {
      setTargetStrength(4.0);
    } else if (type === TestType.ELASTIC_MODULUS) {
      setTargetStrength(40); // 弹性模量试验使用抗压强度
      setControlMode('force'); // 弹性模量试验使用力控制
    }
    resetTest();
  };

  // 数据导出功能
  const exportToCSV = useCallback(() => {
    if (dataPoints.length === 0) return;
    
    const headers = ['Time (s)', 'Load (kN)', 'Stress (MPa)', 'Strain', 'Displacement (mm)'];
    const rows = dataPoints.map(d => [
      d.time.toFixed(4),
      d.load.toFixed(4),
      d.stress.toFixed(4),
      d.strain.toFixed(6),
      (d.strain * getSpecimenHeight()).toFixed(4)
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `test_data_${materialInfo.name}_${targetStrength}MPa_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [dataPoints, getSpecimenHeight, materialInfo.name, targetStrength]);

  const exportToJSON = useCallback(() => {
    if (dataPoints.length === 0) return;
    
    const exportData = {
      testInfo: {
        type: testType,
        material: materialInfo.name,
        targetStrength,
        specimenSize: specimenSize.name,
        controlMode,
        loadingRate: controlMode === 'force' ? loadingRate : displacementRate,
        date: new Date().toISOString(),
      },
      materialProperties: concreteProps ? {
        actualStrength: concreteProps.fc,
        elasticModulus: concreteProps.E,
        peakStrain: concreteProps.epsilon0,
        ultimateStrain: concreteProps.epsilonU,
      } : null,
      results: {
        peakLoad,
        peakStress,
        totalTime: simulationTime,
        dataPointCount: dataPoints.length,
      },
      data: dataPoints.map(d => ({
        time: d.time,
        load: d.load,
        stress: d.stress,
        strain: d.strain,
        displacement: d.strain * getSpecimenHeight()
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `test_data_${materialInfo.name}_${targetStrength}MPa_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [dataPoints, testType, materialInfo.name, targetStrength, specimenSize.name, controlMode, loadingRate, displacementRate, concreteProps, peakLoad, peakStress, simulationTime, getSpecimenHeight]);

  const copyToClipboard = useCallback(async () => {
    if (dataPoints.length === 0) return;
    
    const headers = 'Time\tLoad\tStress\tStrain\tDisplacement';
    const rows = dataPoints.map(d => 
      `${d.time.toFixed(4)}\t${d.load.toFixed(4)}\t${d.stress.toFixed(4)}\t${d.strain.toFixed(6)}\t${(d.strain * getSpecimenHeight()).toFixed(4)}`
    );
    
    const text = [headers, ...rows].join('\n');
    await navigator.clipboard.writeText(text);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2000);
    setShowExportMenu(false);
  }, [dataPoints, getSpecimenHeight]);

  const startTest = () => {
      if (safetyDoorOpen) {
          alert("SAFETY INTERLOCK: Close the safety door before starting the hydraulic pump.");
          return;
      }
      
      // 生成本次试验的材料属性（带随机性）
      const seed = Date.now();
      setTestSeed(seed);
      const props = generateMaterialProperties(materialType, targetStrength, seed) as ConcreteProperties;
      // 添加向后兼容的属性
      props.fcu = props.fc;
      props.Ec = props.E;
      
      // 应用系统设置中的本构模型
      props.constitutiveModel = constitutiveModel;
      
      // 应用系统设置中的自定义本构参数
      if (useCustomParams && customConstitutiveParams) {
        if (customConstitutiveParams.fc) {
          props.fc = customConstitutiveParams.fc;
          props.fcu = customConstitutiveParams.fc;
        }
        if (customConstitutiveParams.epsilon0) {
          props.epsilon0 = customConstitutiveParams.epsilon0;
        }
        if (customConstitutiveParams.epsilonU) {
          props.epsilonU = customConstitutiveParams.epsilonU;
        }
      }
      
      setConcreteProps(props);
      
      console.log('试件材料属性:', {
        '材料类型': materialInfo.name,
        '试块尺寸': specimenSize.name,
        '目标强度': targetStrength,
        '实际强度': props.fc.toFixed(2),
        '弹性模量': props.E.toFixed(0),
        '峰值应变': props.epsilon0.toFixed(5),
        '本构模型': constitutiveModel,
        '材料属性中的本构': props.constitutiveModel,
        '使用自定义参数': useCustomParams
      });
      
      // 初始化循环加载状态（程序控制模式）
      if (controlMode === 'program') {
          const firstTarget = dispTargets[0] || 0.15;
          setCurrentCycle(0);
          setCyclePhase('loading');
          setHoldTimer(0);
          setCurrentDisplacement(0);
          setTargetDisplacement(firstTarget);
          // 初始化 ref 状态
          cycleStateRef.current = {
            currentCycle: 0,
            cyclePhase: 'loading',
            holdTimer: 0,
            currentStress: 0,
            currentStrain: 0,
            currentDisplacement: 0,
            targetDisplacement: firstTarget,
            unloadStartStrain: 0,
            unloadStartStress: 0,
            plasticStrain: 0,
            isOnEnvelope: true,
          };
          console.log('程序控制模式（位移控制加载 + 力控制卸载）:', {
            '位移目标序列': dispTargets.join(', ') + ' mm',
            '加载速率': `${loadingDispRate} mm/s (位移控制)`,
            '卸载速率': `${unloadingForceRate} kN/s (力控制)`,
            '保载时间': `${cycleHoldTime}s`,
            '最终破坏': finalLoadToFailure
          });
      }
      
      // Start with Approach Phase
      setStatus(TestStatus.APPROACHING);
  }

  const finishTest = useCallback(async () => {
    setStatus(TestStatus.FAILED);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    
    // 保存试验记录到历史
    try {
      // 获取当前数据点
      const currentDataPoints = dataPoints.length > 0 ? dataPoints : [];
      const maxStrain = currentDataPoints.length > 0 
        ? Math.max(...currentDataPoints.map(d => d.strain)) 
        : 0;
      
      saveTestRecord({
        testType,
        materialType,
        specimenSize: specimenSize.name,
        targetStrength,
        controlMode,
        results: {
          peakLoad,
          peakStress,
          peakStrain: maxStrain,
          elasticModulus: modulusResults?.E_secant,
          duration: simulationTime,
          cycleCount: controlMode === 'program' ? currentCycle : testType === TestType.ELASTIC_MODULUS ? modulusCycleCount : undefined,
        },
        dataPoints: currentDataPoints,
      });
      console.log('试验记录已保存');
    } catch (err) {
      console.error('保存试验记录失败:', err);
    }
    
    setIsGeneratingReport(true);
    
    const report = await generateLabReport(
      testType,
      peakStress, 
      peakLoad,
      simulationTime
    );
    setAiReport(report);
    setIsGeneratingReport(false);
  }, [peakLoad, peakStress, simulationTime, testType, dataPoints, materialType, specimenSize.name, targetStrength, controlMode, currentCycle, modulusResults, modulusCycleCount]);

  const simulateStep = useCallback((time: number) => {
    if (status === TestStatus.IDLE || status === TestStatus.FAILED || status === TestStatus.PAUSED) return;
    if (!concreteProps) return;
    
    const dt = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    // PHASE 1: APPROACH (Closing the gap)
    if (status === TestStatus.APPROACHING) {
        setActuatorPos(prev => {
            const speed = 0.5; // Approach speed
            const next = prev + (speed * dt);
            if (next >= 1) {
                // Contact made, switch to loading
                setStatus(TestStatus.RUNNING);
                return 1;
            }
            return next;
        });
        requestRef.current = requestAnimationFrame(simulateStep);
        return;
    }

    // PHASE 2: LOADING (Running) - 使用真实本构模型
    if (status === TestStatus.RUNNING) {
        setSimulationTime(prev => prev + dt);
        
        // 弹性模量试验模式 - 按 GB/T 50081 规范
        if (testType === TestType.ELASTIC_MODULUS) {
            const state = cycleStateRef.current;
            const specimenHeight = getSpecimenHeight();
            const fc = concreteProps.fc; // 实际抗压强度
            
            // 应力上限：1/3 fc，应力下限：0.5 MPa
            if (state.stress_b === 0) {
                state.stress_b = fc / 3;
            }
            const stress_a = state.stress_a; // 0.5 MPa
            const stress_b = state.stress_b; // 1/3 fc
            
            // 加载/卸载速率 (MPa/s) - 规范要求 0.5-0.8 MPa/s
            const modulusLoadingRate = 0.6;
            
            // 根据当前阶段执行
            if (state.modulusPhase === 'preload1') {
                // 第一次预加载：加载到应力上限
                state.currentStress += modulusLoadingRate * dt;
                if (state.currentStress >= stress_b) {
                    state.currentStress = stress_b;
                    state.modulusPhase = 'unload1';
                    state.holdTimer = 0;
                }
            } else if (state.modulusPhase === 'unload1') {
                // 第一次卸载：卸载到应力下限
                state.currentStress -= modulusLoadingRate * dt;
                if (state.currentStress <= stress_a) {
                    state.currentStress = stress_a;
                    state.modulusPhase = 'hold1';
                    state.holdTimer = 0;
                    state.modulusCycle = 1;
                    setModulusCycleCount(1);
                }
            } else if (state.modulusPhase === 'hold1') {
                // 保载 60 秒（模拟中缩短为 2 秒）
                state.holdTimer += dt;
                setHoldTimer(state.holdTimer);
                if (state.holdTimer >= 2) {
                    // 记录应力下限对应的应变
                    state.strain_a = state.currentStrain;
                    state.strainReadings.push({ stress: stress_a, strain: state.strain_a });
                    state.modulusPhase = 'load2';
                }
            } else if (state.modulusPhase === 'load2') {
                // 第二次加载：加载到应力上限
                state.currentStress += modulusLoadingRate * dt;
                if (state.currentStress >= stress_b) {
                    state.currentStress = stress_b;
                    state.modulusPhase = 'hold2';
                    state.holdTimer = 0;
                }
            } else if (state.modulusPhase === 'hold2') {
                // 保载 60 秒（模拟中缩短为 2 秒）
                state.holdTimer += dt;
                setHoldTimer(state.holdTimer);
                if (state.holdTimer >= 2) {
                    // 记录应力上限对应的应变
                    state.strain_b = state.currentStrain;
                    state.strainReadings.push({ stress: stress_b, strain: state.strain_b });
                    
                    // 检查是否需要更多循环（规范要求至少 2 次）
                    if (state.modulusCycle < 2) {
                        state.modulusCycle += 1;
                        setModulusCycleCount(state.modulusCycle);
                        state.modulusPhase = 'unload1';
                    } else {
                        state.modulusPhase = 'load3';
                    }
                }
            } else if (state.modulusPhase === 'load3') {
                // 第三次加载：继续加载至破坏
                state.currentStress += modulusLoadingRate * dt;
                
                // 计算应变
                const result = calcConcreteStress(state.currentStrain, concreteProps);
                if (result.phase === 'failed' || state.currentStrain > concreteProps.epsilonU) {
                    // 计算弹性模量
                    const deltaStress = stress_b - stress_a;
                    const deltaStrain = state.strain_b - state.strain_a;
                    const E_secant = deltaStrain > 0 ? (deltaStress / deltaStrain) / 1000 : 0; // GPa
                    
                    // 初始切线模量（从原点的斜率）
                    const E_initial = state.strain_a > 0 ? (stress_a / state.strain_a) / 1000 : concreteProps.E / 1000;
                    
                    // 切线模量（在应力下限处的斜率，近似）
                    const E_tangent = E_secant * 1.05; // 近似值
                    
                    setModulusResults({
                        E_secant,
                        E_tangent,
                        E_initial,
                        stress_a,
                        stress_b,
                        strain_a: state.strain_a,
                        strain_b: state.strain_b,
                    });
                    
                    state.modulusPhase = 'complete';
                    setModulusPhase('complete');
                    finishTest();
                    return;
                }
            }
            
            // 根据应力计算应变（使用弹性关系）
            // 在弹性阶段，应变 = 应力 / E
            const E = concreteProps.Ec; // MPa
            state.currentStrain = state.currentStress / E;
            state.currentDisplacement = state.currentStrain * specimenHeight;
            
            // 添加噪声
            const noisyResult = addRealisticNoise(state.currentStress, state.currentStrain, 'elastic');
            
            const load = calculateLoadFromStress(noisyResult.stress);
            
            // 更新 UI 状态
            setCurrentStrain(state.currentStrain);
            setCurrentStress(noisyResult.stress);
            setCurrentLoad(load);
            setCurrentDisplacement(state.currentDisplacement);
            setModulusPhase(state.modulusPhase);
            
            // 更新峰值
            if (noisyResult.stress > peakStress) {
                setPeakStress(noisyResult.stress);
                setPeakLoad(load);
            }
            
            // 添加数据点
            setDataPoints(prevData => {
                const lastTime = prevData.length > 0 ? prevData[prevData.length - 1].time : -1;
                if (simulationTime - lastTime >= 0.05) {
                    return [...prevData, { 
                        time: simulationTime, 
                        load, 
                        stress: noisyResult.stress, 
                        strain: state.currentStrain 
                    }];
                }
                return prevData;
            });
            
            requestRef.current = requestAnimationFrame(simulateStep);
            return;
        }
        
        // 程序控制模式 - 位移控制加载 + 力控制卸载（带滞回效应）
        if (controlMode === 'program') {
            const state = cycleStateRef.current;
            const specimenHeight = getSpecimenHeight(); // mm
            
            // 滞回效应参数
            // 塑性应变比例：卸载起始应变的一定比例会成为塑性应变
            const epsilon0 = concreteProps.epsilon0 || 0.002;
            const plasticStrainRatio = 0.3 + 0.4 * Math.min(state.unloadStartStrain / epsilon0, 1);
            
            // 根据当前循环阶段确定控制模式
            if (state.cyclePhase === 'loading') {
                // 位移控制加载：0.01 mm/s
                state.currentDisplacement += loadingDispRate * dt;
                setCurrentDisplacement(state.currentDisplacement);
                
                // 位移转应变
                state.currentStrain = state.currentDisplacement / specimenHeight;
                
                // 计算应力（考虑是否在包络线上）
                if (state.isOnEnvelope) {
                    // 在包络线上，使用本构模型
                    const result = calcConcreteStress(state.currentStrain, concreteProps);
                    state.currentStress = result.stress;
                } else {
                    // 再加载路径：从塑性应变点线性加载到卸载起始点
                    if (state.currentStrain <= state.unloadStartStrain) {
                        // 线性再加载
                        const elasticStrain = state.unloadStartStrain - state.plasticStrain;
                        if (elasticStrain > 0.00001) {
                            const reloadSlope = state.unloadStartStress / elasticStrain;
                            state.currentStress = reloadSlope * (state.currentStrain - state.plasticStrain);
                            state.currentStress = Math.max(0, state.currentStress);
                        } else {
                            // 弹性应变太小，直接使用包络线
                            state.isOnEnvelope = true;
                            const result = calcConcreteStress(state.currentStrain, concreteProps);
                            state.currentStress = result.stress;
                        }
                    } else {
                        // 超过卸载起始点，回到包络线
                        state.isOnEnvelope = true;
                        const result = calcConcreteStress(state.currentStrain, concreteProps);
                        state.currentStress = result.stress;
                    }
                }
                
                // 到达目标位移
                if (state.currentDisplacement >= state.targetDisplacement) {
                    // 记录卸载起始点
                    state.unloadStartStrain = state.currentStrain;
                    state.unloadStartStress = state.currentStress;
                    // 计算塑性应变
                    state.plasticStrain = state.unloadStartStrain * plasticStrainRatio;
                    
                    state.cyclePhase = 'holding_upper';
                    state.holdTimer = 0;
                    setCyclePhase('holding_upper');
                    setHoldTimer(0);
                }
            } else if (state.cyclePhase === 'holding_upper') {
                // 保载
                state.holdTimer += dt;
                setHoldTimer(state.holdTimer);
                if (state.holdTimer >= cycleHoldTime) {
                    state.cyclePhase = 'unloading';
                    setCyclePhase('unloading');
                }
            } else if (state.cyclePhase === 'unloading') {
                // 力控制卸载：沿着卸载路径（近似线性，指向塑性应变点）
                const forceDecrement = unloadingForceRate * dt; // kN
                const stressDecrement = forceDecrement * 1000 / getArea(); // MPa
                
                state.currentStress -= stressDecrement;
                state.currentStress = Math.max(0, state.currentStress);
                
                // 卸载路径：从卸载起始点线性下降到塑性应变点
                // 应变 = 塑性应变 + (当前应力 / 卸载起始应力) * (卸载起始应变 - 塑性应变)
                if (state.unloadStartStress > 0) {
                    const stressRatio = state.currentStress / state.unloadStartStress;
                    state.currentStrain = state.plasticStrain + stressRatio * (state.unloadStartStrain - state.plasticStrain);
                }
                state.currentDisplacement = state.currentStrain * specimenHeight;
                setCurrentDisplacement(state.currentDisplacement);
                
                // 到达卸载目标（应力接近零或位移足够小）
                if (state.currentStress <= 0.5 || state.currentDisplacement <= state.plasticStrain * specimenHeight * 1.1) {
                    state.isOnEnvelope = false; // 离开包络线
                    state.cyclePhase = 'holding_lower';
                    state.holdTimer = 0;
                    setCyclePhase('holding_lower');
                    setHoldTimer(0);
                }
            } else if (state.cyclePhase === 'holding_lower') {
                // 保载
                state.holdTimer += dt;
                setHoldTimer(state.holdTimer);
                if (state.holdTimer >= cycleHoldTime) {
                    // 完成一个循环，进入下一级位移目标
                    state.currentCycle += 1;
                    setCurrentCycle(state.currentCycle);
                    
                    if (state.currentCycle >= dispTargets.length) {
                        // 所有位移级别完成
                        if (finalLoadToFailure) {
                            state.cyclePhase = 'final';
                            state.isOnEnvelope = true;
                            setCyclePhase('final');
                        } else {
                            finishTest();
                            return;
                        }
                    } else {
                        // 设置下一级位移目标
                        state.targetDisplacement = dispTargets[state.currentCycle];
                        setTargetDisplacement(state.targetDisplacement);
                        state.cyclePhase = 'loading';
                        setCyclePhase('loading');
                    }
                }
            } else if (state.cyclePhase === 'final') {
                // 最终加载至破坏（位移控制）
                state.currentDisplacement += loadingDispRate * dt;
                setCurrentDisplacement(state.currentDisplacement);
                state.currentStrain = state.currentDisplacement / specimenHeight;
                
                // 最终阶段使用包络线
                const result = calcConcreteStress(state.currentStrain, concreteProps);
                state.currentStress = result.stress;
            }
            
            // 添加噪声
            const noisyResult = addRealisticNoise(state.currentStress, state.currentStrain, 'elastic');
            state.currentStress = noisyResult.stress;
            
            const load = calculateLoadFromStress(state.currentStress);
            
            // 获取当前阶段（用于 UI 显示）
            const phaseResult = calcConcreteStress(state.currentStrain, concreteProps);
            
            // 更新 UI 状态
            setCurrentStrain(state.currentStrain);
            setCurrentStress(state.currentStress);
            setCurrentLoad(load);
            setCurrentPhase(phaseResult.phase);
            
            // 更新峰值
            if (state.currentStress > peakStress) {
                setPeakStress(state.currentStress);
                setPeakLoad(load);
            }
            
            // 破坏进度
            const progress = Math.min(state.currentStrain / (concreteProps.epsilonU * 1.2), 1);
            if (state.cyclePhase === 'final' || progress > 0.5) {
                setFailureProgress(progress);
                
                const warning = getFailureWarning(state.currentStrain, concreteProps);
                setFailureWarning(warning);
                
                if (progress > 0.7) {
                    const cracks = generateCrackPaths(
                        progress, 
                        testType === TestType.COMPRESSION ? 'compression' : 'tension',
                        testSeed
                    );
                    setCrackPaths(cracks);
                }
                
                // 检查是否完全破坏
                if (phaseResult.phase === 'failed' || progress >= 1) {
                    finishTest();
                    return;
                }
            }
            
            // 添加数据点
            setDataPoints(prevData => {
                const lastTime = prevData.length > 0 ? prevData[prevData.length - 1].time : -1;
                if (simulationTime - lastTime >= 0.05) {
                    return [...prevData, { 
                        time: simulationTime, 
                        load, 
                        stress: state.currentStress, 
                        strain: state.currentStrain 
                    }];
                }
                return prevData;
            });
            
            requestRef.current = requestAnimationFrame(simulateStep);
            return;
        }
        
        // 力控制或位移控制模式
        const specimenHeight = getSpecimenHeight();
        const area = getArea();
        
        if (controlMode === 'force') {
            // 力控制：力以恒定速率增加
            // 力-时间曲线是直线
            setCurrentLoad(prevLoad => {
                const newLoad = prevLoad + forceRate * dt; // kN
                const newStress = newLoad * 1000 / area; // MPa
                
                // 从应力反算应变（使用数值迭代法，适用于所有本构模型）
                const fc = concreteProps.fc;
                const epsilon0 = concreteProps.epsilon0;
                
                // 使用二分法迭代求解应变
                let newStrain: number;
                if (newStress <= fc * 1.1) {
                    // 在合理范围内迭代求解
                    let strainMin = 0;
                    let strainMax = epsilon0 * 2;
                    let iterations = 0;
                    const maxIterations = 50;
                    const tolerance = 0.01; // MPa
                    
                    while (iterations < maxIterations && (strainMax - strainMin) > 1e-8) {
                        const strainMid = (strainMin + strainMax) / 2;
                        const result = calcConcreteStress(strainMid, concreteProps);
                        const stressMid = result.stress;
                        
                        if (Math.abs(stressMid - newStress) < tolerance) {
                            newStrain = strainMid;
                            break;
                        }
                        
                        if (stressMid < newStress) {
                            strainMin = strainMid;
                        } else {
                            strainMax = strainMid;
                        }
                        iterations++;
                    }
                    newStrain = (strainMin + strainMax) / 2;
                } else {
                    // 超过峰值，力控制下不稳定
                    newStrain = concreteProps.epsilonU;
                }
                
                // 使用本构模型计算实际应力和阶段
                const result = calcConcreteStress(newStrain, concreteProps);
                const noisyResult = addRealisticNoise(newStress, newStrain, result.phase);
                
                setCurrentStrain(newStrain);
                setCurrentStress(newStress);
                setCurrentPhase(result.phase);
                
                // 更新峰值
                if (newStress > peakStress) {
                    setPeakStress(newStress);
                    setPeakLoad(newLoad);
                }
                
                // 破坏进度
                const progress = Math.min(newStrain / (concreteProps.epsilonU * 1.2), 1);
                setFailureProgress(progress);
                
                const warning = getFailureWarning(newStrain, concreteProps);
                setFailureWarning(warning);
                
                if (progress > 0.7) {
                    const cracks = generateCrackPaths(
                        progress, 
                        testType === TestType.COMPRESSION ? 'compression' : 'tension',
                        testSeed
                    );
                    setCrackPaths(cracks);
                }
                
                // 添加数据点
                setDataPoints(prevData => {
                    const lastTime = prevData.length > 0 ? prevData[prevData.length - 1].time : -1;
                    if (simulationTime - lastTime >= 0.05) {
                        return [...prevData, { 
                            time: simulationTime, 
                            load: newLoad, 
                            stress: newStress, 
                            strain: newStrain 
                        }];
                    }
                    return prevData;
                });
                
                // 力控制下，达到峰值后会突然破坏
                if (newStress >= fc * 0.98 || result.phase === 'failed' || progress >= 1) {
                    setTimeout(() => finishTest(), 0);
                }
                
                return newLoad;
            });
        } else {
            // 位移控制：位移以恒定速率增加
            // 位移-时间曲线是直线
            const dispRate = displacementRate / 60; // mm/min -> mm/s
            
            setCurrentStrain(prevStrain => {
                const newDisp = prevStrain * specimenHeight + dispRate * dt;
                const newStrain = newDisp / specimenHeight;
                
                // 使用本构模型计算应力
                const result = calcConcreteStress(newStrain, concreteProps);
                const noisyResult = addRealisticNoise(result.stress, newStrain, result.phase);
                
                const stress = noisyResult.stress;
                const load = calculateLoadFromStress(stress);
                
                setCurrentStress(stress);
                setCurrentLoad(load);
                setCurrentPhase(result.phase);
                
                // 更新峰值
                if (stress > peakStress) {
                    setPeakStress(stress);
                    setPeakLoad(load);
                }
                
                // 破坏进度
                const progress = Math.min(newStrain / (concreteProps.epsilonU * 1.2), 1);
                setFailureProgress(progress);
                
                const warning = getFailureWarning(newStrain, concreteProps);
                setFailureWarning(warning);
                
                if (progress > 0.7) {
                    const cracks = generateCrackPaths(
                        progress, 
                        testType === TestType.COMPRESSION ? 'compression' : 'tension',
                        testSeed
                    );
                    setCrackPaths(cracks);
                }
                
                // 添加数据点
                setDataPoints(prevData => {
                    const lastTime = prevData.length > 0 ? prevData[prevData.length - 1].time : -1;
                    if (simulationTime - lastTime >= 0.05) {
                        return [...prevData, { 
                            time: simulationTime, 
                            load, 
                            stress, 
                            strain: newStrain 
                        }];
                    }
                    return prevData;
                });
                
                if (result.phase === 'failed' || progress >= 1) {
                    setTimeout(() => finishTest(), 0);
                }
                
                return newStrain;
            });
        }

        requestRef.current = requestAnimationFrame(simulateStep);
    }
  }, [status, forceRate, displacementRate, concreteProps, finishTest, calculateLoadFromStress, getArea, getSpecimenHeight, simulationTime, testType, testSeed, peakStress, controlMode, loadingDispRate, unloadingForceRate, unloadDispTarget, cycleHoldTime, dispTargets, finalLoadToFailure]);

  useEffect(() => {
    if (status === TestStatus.APPROACHING || status === TestStatus.RUNNING) {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(simulateStep);
    }
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [status, simulateStep]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 状态栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <span className="text-slate-500">控制器 Controller:</span>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status === TestStatus.IDLE ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`}></span>
            {status === TestStatus.IDLE ? '待机 STANDBY' : status === TestStatus.APPROACHING ? '寻找接触 SEEKING' : status === TestStatus.RUNNING ? '试验中 TESTING' : '已停止 STOPPED'}
          </div>
        </div>
        <div className="text-xs font-mono text-slate-500">
          MTS Series 3000 伺服液压系统
        </div>
      </div>

      <main className="flex-1 w-full p-3 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
        
        {/* LEFT: Machine Visual (5 cols) - 固定不滚动 */}
        <div className="lg:col-span-5 flex flex-col gap-2 h-full overflow-hidden">
            <div className="flex-1 bg-[#121620] rounded-lg border border-slate-800 p-2 shadow-2xl relative flex flex-col min-h-0">
                <div className="absolute top-4 left-4 z-20 flex gap-2 pointer-events-none">
                     <span className="bg-black/50 backdrop-blur px-2 py-1 text-[10px] font-mono border border-slate-700 text-slate-300">
                        CAM 1: MAIN_VIEW
                     </span>
                </div>
                <div className="absolute bottom-16 left-4 z-20 pointer-events-none">
                     <span className="bg-black/50 backdrop-blur px-2 py-1 text-[9px] font-mono text-slate-500">
                        💡 点击试件或底座查看详情 Click specimen or base for info
                     </span>
                </div>
                
                <div className="flex-1 rounded-lg overflow-hidden relative bg-gradient-to-b from-[#1a1f2e] to-[#0f121a]">
                    {/* 视图模式切换按钮 */}
                    <div className="absolute top-3 right-3 z-20 flex gap-1">
                      <button
                        onClick={() => setViewMode('2d')}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                          viewMode === '2d' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600/80'
                        }`}
                      >
                        2D
                      </button>
                      <button
                        onClick={() => setViewMode('3d')}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                          viewMode === '3d' 
                            ? 'bg-cyan-600 text-white' 
                            : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600/80'
                        }`}
                      >
                        <Box className="w-3 h-3" />
                        3D
                      </button>
                      <button
                        onClick={() => setViewMode('fem')}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                          viewMode === 'fem' 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600/80'
                        }`}
                      >
                        <Grid3X3 className="w-3 h-3" />
                        FEM
                      </button>
                      
                      {/* 2D视图云图开关 */}
                      {viewMode === '2d' && (
                        <button
                          onClick={() => setShowFEMContour(!showFEMContour)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ml-1 ${
                            showFEMContour 
                              ? 'bg-green-600 text-white' 
                              : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600/80'
                          }`}
                          title={showFEMContour ? '关闭应力云图' : '显示应力云图'}
                        >
                          <Grid3X3 className="w-3 h-3" />
                          云图
                        </button>
                      )}
                    </div>
                    
                    {/* 2D 视图 */}
                    {viewMode === '2d' && (
                      <TestCanvas 
                        testType={testType} 
                        status={status} 
                        progress={failureProgress} 
                        stress={currentStress}
                        safetyDoorOpen={safetyDoorOpen}
                        actuatorPos={actuatorPos}
                        crackPaths={crackPaths}
                        phase={currentPhase}
                        onSpecimenClick={() => setShowSpecimenInfo(true)}
                        onMachineClick={() => setShowMachineInfo(true)}
                        controlMode={controlMode}
                        cyclePhase={cyclePhase}
                        specimenDimensions={specimenSize.dimensions}
                        specimenLabel={specimenSize.name}
                        showFEMContour={showFEMContour}
                        E={concreteProps?.E || 30000}
                        fc={concreteProps?.fc}
                        epsilon0={concreteProps?.epsilon0}
                        constitutiveModel={constitutiveModel as 'linear' | 'hognestad' | 'gb50010' | 'damage' | 'mander' | 'eurocode'}
                      />
                    )}
                    
                    {/* 3D 视图 */}
                    {viewMode === '3d' && (
                      <Suspense fallback={
                        <div className="w-full h-full flex items-center justify-center bg-slate-900">
                          <div className="text-slate-500 text-sm">加载 3D 视图...</div>
                        </div>
                      }>
                        <Specimen3DViewer
                          shape={specimenSize.shape}
                          dimensions={specimenSize.dimensions}
                          progress={failureProgress}
                          status={status}
                          stress={currentStress}
                          label={specimenSize.name}
                          showCracks={true}
                        />
                      </Suspense>
                    )}
                    
                    {/* FEM 应力云图视图 */}
                    {viewMode === 'fem' && (
                      <Suspense fallback={
                        <div className="w-full h-full flex items-center justify-center bg-slate-900">
                          <div className="text-slate-500 text-sm">加载 FEM 视图...</div>
                        </div>
                      }>
                        <SpecimenFEMViewer
                          width={specimenSize.dimensions.width || 150}
                          height={specimenSize.dimensions.height}
                          depth={specimenSize.dimensions.depth || specimenSize.dimensions.width || 150}
                          stress={currentStress}
                          status={status}
                          progress={failureProgress}
                          E={concreteProps?.E || 30000}
                          nu={0.2}
                          contourType="vonMises"
                          showWireframe={true}
                          showBoundary={true}
                          showLoads={true}
                          deformScale={100}
                          label={specimenSize.name}
                        />
                      </Suspense>
                    )}
                    
                    {/* 试件信息弹窗 Specimen Info Modal */}
                    {showSpecimenInfo && (
                      <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30" onClick={() => setShowSpecimenInfo(false)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 max-w-xs" onClick={e => e.stopPropagation()}>
                          <h4 className="text-sm font-bold text-white mb-3">试件信息 Specimen Info</h4>
                          <div className="space-y-2 text-xs font-mono">
                            <div className="flex justify-between">
                              <span className="text-slate-500">类型 Type:</span>
                              <span className="text-slate-300">{testType === TestType.COMPRESSION ? '立方体 Cube 150mm' : '圆柱体 Cylinder Φ150×300'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">目标强度 Target:</span>
                              <span className="text-slate-300">C{targetStrength} ({targetStrength} MPa)</span>
                            </div>
                            {concreteProps && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">实际强度 Actual:</span>
                                  <span className="text-orange-400">{concreteProps.fcu.toFixed(2)} MPa</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">弹性模量 E:</span>
                                  <span className="text-slate-300">{(concreteProps.Ec/1000).toFixed(1)} GPa</span>
                                </div>
                              </>
                            )}
                            <div className="flex justify-between">
                              <span className="text-slate-500">标准 Standard:</span>
                              <span className="text-slate-300">{testType === TestType.COMPRESSION ? 'ASTM C39' : 'ASTM C496'}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => setShowSpecimenInfo(false)}
                            className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-400"
                          >
                            关闭 Close
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 设备信息弹窗 Machine Info Modal */}
                    {showMachineInfo && (
                      <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30" onClick={() => setShowMachineInfo(false)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 max-w-xs" onClick={e => e.stopPropagation()}>
                          <h4 className="text-sm font-bold text-white mb-3">设备信息 Machine Info</h4>
                          <div className="space-y-2 text-xs font-mono">
                            <div className="flex justify-between">
                              <span className="text-slate-500">型号 Model:</span>
                              <span className="text-slate-300">MTS Series 3000</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">最大荷载 Max Load:</span>
                              <span className="text-slate-300">100 kN</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">精度等级 Accuracy:</span>
                              <span className="text-slate-300">0.5级 Class 0.5</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">传感器 Sensor:</span>
                              <span className="text-slate-300">应变式 Strain Gauge</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">控制方式 Control:</span>
                              <span className="text-slate-300">闭环伺服 Closed-loop</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => setShowMachineInfo(false)}
                            className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-400"
                          >
                            关闭 Close
                          </button>
                        </div>
                      </div>
                    )}
                </div>

                {/* Safety Toggle Below Canvas 安全门联锁 */}
                <div className="h-12 mt-1 flex items-center justify-between px-3 bg-black/30 rounded-lg border border-slate-800/50 flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${safetyDoorOpen ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                      <span className="text-xs font-mono text-slate-400">安全联锁 INTERLOCK</span>
                    </div>
                    <button 
                        onClick={() => setSafetyDoorOpen(!safetyDoorOpen)}
                        disabled={status !== TestStatus.IDLE && status !== TestStatus.FAILED}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all transform active:scale-95 ${
                            safetyDoorOpen 
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 hover:bg-yellow-500/30' 
                            : 'bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30'
                        } ${status !== TestStatus.IDLE && status !== TestStatus.FAILED ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {safetyDoorOpen ? <><Unlock size={14}/> 开门 OPEN</> : <><Lock size={14}/> 关门 CLOSED</>}
                    </button>
                </div>
            </div>
        </div>

        {/* CENTER/RIGHT: Data & Controls (7 cols) - 独立滚动 */}
        <div className="lg:col-span-7 flex flex-col gap-4 h-full overflow-y-auto overflow-x-hidden pr-2">
            
            {/* 1. Digital Controller Head 数字控制面板 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* 荷载 Load */}
                <div className="bg-black rounded-lg border border-slate-700 p-3 relative overflow-hidden">
                    <div className="text-[10px] font-mono text-slate-500 mb-1">荷载 LOAD (kN)</div>
                    <div className="text-2xl font-mono font-bold text-red-500 tracking-tighter">
                        {currentLoad.toFixed(2)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-600 mt-1">
                        峰值 Peak: {peakLoad.toFixed(2)}
                    </div>
                </div>

                {/* 应力 Stress */}
                <div className="bg-black rounded-lg border border-slate-700 p-3">
                    <div className="text-[10px] font-mono text-slate-500 mb-1">应力 STRESS (MPa)</div>
                    <div className="text-2xl font-mono font-bold text-orange-500 tracking-tighter">
                        {currentStress.toFixed(3)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-600 mt-1">
                        峰值 Peak: {peakStress.toFixed(2)}
                    </div>
                </div>

                {/* 应变/位移 Strain/Displacement */}
                <div className="bg-black rounded-lg border border-slate-700 p-3">
                    <div className="text-[10px] font-mono text-slate-500 mb-1">
                        {controlMode === 'program' ? '位移 DISP (mm)' : '应变 STRAIN (‰)'}
                    </div>
                    <div className="text-2xl font-mono font-bold text-blue-500 tracking-tighter">
                        {controlMode === 'program' ? currentDisplacement.toFixed(3) : (currentStrain * 1000).toFixed(3)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-600 mt-1">
                        {controlMode === 'program' 
                            ? `目标: ${targetDisplacement.toFixed(2)} mm` 
                            : `峰值应变 ε₀: ${concreteProps ? (concreteProps.epsilon0 * 1000).toFixed(2) : '--'}`}
                    </div>
                </div>

                {/* 阶段指示 Phase / 循环状态 */}
                <div className={`rounded-lg border p-3 ${
                    controlMode === 'program' && status === TestStatus.RUNNING 
                    ? 'bg-purple-950 border-purple-700' :
                    failureWarning.level === 'none' ? 'bg-black border-slate-700' :
                    failureWarning.level === 'low' ? 'bg-yellow-950 border-yellow-800' :
                    failureWarning.level === 'medium' ? 'bg-orange-950 border-orange-700' :
                    'bg-red-950 border-red-700 animate-pulse'
                }`}>
                    <div className="text-[10px] font-mono text-slate-500 mb-1">
                        {controlMode === 'program' && status === TestStatus.RUNNING ? '循环 CYCLE' : '阶段 PHASE'}
                    </div>
                    {controlMode === 'program' && status === TestStatus.RUNNING ? (
                        <>
                            <div className="text-lg font-mono font-bold uppercase tracking-tighter text-purple-400">
                                {currentCycle + 1}/{dispTargets.length}
                            </div>
                            <div className={`text-[10px] font-mono mt-1 ${
                                cyclePhase === 'loading' ? 'text-red-400' :
                                cyclePhase === 'unloading' ? 'text-green-400' :
                                cyclePhase === 'final' ? 'text-red-500 animate-pulse' :
                                'text-yellow-400'
                            }`}>
                                {cyclePhase === 'loading' ? `↑ ${currentDisplacement.toFixed(2)}/${targetDisplacement}mm` :
                                 cyclePhase === 'holding_upper' ? `⏸ ${holdTimer.toFixed(1)}s` :
                                 cyclePhase === 'unloading' ? `↓ ${currentDisplacement.toFixed(2)}mm` :
                                 cyclePhase === 'holding_lower' ? `⏸ ${holdTimer.toFixed(1)}s` :
                                 '↑↑ 破坏'}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={`text-lg font-mono font-bold uppercase tracking-tighter ${
                                currentPhase === 'seating' ? 'text-slate-400' :
                                currentPhase === 'elastic' ? 'text-green-500' :
                                currentPhase === 'plastic' ? 'text-yellow-500' :
                                currentPhase === 'peak' ? 'text-orange-500' :
                                currentPhase === 'softening' ? 'text-red-500' :
                                'text-red-600'
                            }`}>
                                {currentPhase === 'seating' ? '座浆' :
                                 currentPhase === 'elastic' ? '弹性' :
                                 currentPhase === 'plastic' ? '塑性' :
                                 currentPhase === 'peak' ? '峰值' :
                                 currentPhase === 'softening' ? '软化' : '破坏'}
                            </div>
                            {failureWarning.message && (
                                <div className="text-[10px] font-mono text-yellow-400 mt-1 flex items-center gap-1">
                                    <AlertTriangle size={10} />
                                    {failureWarning.message}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* 材料属性显示 Material Properties */}
            {concreteProps && (
                <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-3 grid grid-cols-5 gap-3 text-[10px] font-mono">
                    <div>
                        <span className="text-slate-500">材料 Material</span>
                        <div className="text-slate-300">{concreteProps.name || materialInfo.name}</div>
                    </div>
                    <div>
                        <span className="text-slate-500">实际强度 Actual f_c</span>
                        <div className="text-slate-300">{concreteProps.fc.toFixed(2)} MPa</div>
                    </div>
                    <div>
                        <span className="text-slate-500">弹性模量 E</span>
                        <div className="text-slate-300">{(concreteProps.E / 1000).toFixed(1)} GPa</div>
                    </div>
                    <div>
                        <span className="text-slate-500">峰值应变 ε₀</span>
                        <div className="text-slate-300">{(concreteProps.epsilon0 * 1000).toFixed(3)} ‰</div>
                    </div>
                    <div>
                        <span className="text-slate-500">极限应变 εᵤ</span>
                        <div className="text-slate-300">{(concreteProps.epsilonU * 1000).toFixed(3)} ‰</div>
                    </div>
                </div>
            )}

            {/* 弹性模量试验状态和结果 */}
            {testType === TestType.ELASTIC_MODULUS && (
                <div className="bg-purple-900/20 rounded-lg border border-purple-800/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-bold text-purple-400">弹性模量试验 Elastic Modulus Test</div>
                        <div className="text-[10px] text-slate-500">GB/T 50081-2019</div>
                    </div>
                    
                    {/* 试验阶段指示 */}
                    <div className="grid grid-cols-7 gap-1 mb-3">
                        {['preload1', 'unload1', 'hold1', 'load2', 'hold2', 'load3', 'complete'].map((phase, idx) => (
                            <div 
                                key={phase}
                                className={`text-center py-1 rounded text-[9px] ${
                                    modulusPhase === phase 
                                        ? 'bg-purple-600 text-white' 
                                        : idx < ['preload1', 'unload1', 'hold1', 'load2', 'hold2', 'load3', 'complete'].indexOf(modulusPhase)
                                            ? 'bg-purple-900/50 text-purple-300'
                                            : 'bg-slate-800 text-slate-500'
                                }`}
                            >
                                {phase === 'preload1' ? '预加载' :
                                 phase === 'unload1' ? '卸载' :
                                 phase === 'hold1' ? '保载' :
                                 phase === 'load2' ? '加载' :
                                 phase === 'hold2' ? '保载' :
                                 phase === 'load3' ? '破坏' : '完成'}
                            </div>
                        ))}
                    </div>
                    
                    {/* 循环次数 */}
                    {status === TestStatus.RUNNING && (
                        <div className="text-xs text-slate-400 mb-2">
                            循环次数: <span className="text-purple-400 font-bold">{modulusCycleCount}/2</span>
                            {modulusPhase === 'hold1' || modulusPhase === 'hold2' ? (
                                <span className="ml-2 text-yellow-400">保载中 {holdTimer.toFixed(1)}s</span>
                            ) : null}
                        </div>
                    )}
                    
                    {/* 弹性模量结果 */}
                    {modulusResults && (
                        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-purple-800/30">
                            <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                                <div className="text-[10px] text-slate-500">割线模量 E_c</div>
                                <div className="text-lg font-bold text-purple-400">{modulusResults.E_secant.toFixed(2)}</div>
                                <div className="text-[10px] text-slate-500">GPa</div>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                                <div className="text-[10px] text-slate-500">切线模量 E_t</div>
                                <div className="text-lg font-bold text-blue-400">{modulusResults.E_tangent.toFixed(2)}</div>
                                <div className="text-[10px] text-slate-500">GPa</div>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                                <div className="text-[10px] text-slate-500">初始模量 E_0</div>
                                <div className="text-lg font-bold text-green-400">{modulusResults.E_initial.toFixed(2)}</div>
                                <div className="text-[10px] text-slate-500">GPa</div>
                            </div>
                            <div className="col-span-3 text-[10px] text-slate-500 mt-1">
                                应力范围: {modulusResults.stress_a.toFixed(2)} ~ {modulusResults.stress_b.toFixed(2)} MPa | 
                                应变范围: {(modulusResults.strain_a * 1000).toFixed(4)} ~ {(modulusResults.strain_b * 1000).toFixed(4)} ‰
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 2. Real-time Graph */}
            <div className="h-[300px] shrink-0">
                <DataChart 
                    data={dataPoints} 
                    maxStress={targetStrength} 
                    testTypeLabel={testType === TestType.COMPRESSION ? "AXIAL STRESS (C39)" : testType === TestType.TENSION ? "SPLITTING TENSILE (C496)" : "ELASTIC MODULUS (GB/T 50081)"}
                    controlMode={controlMode}
                    specimenHeight={getSpecimenHeight()}
                />
            </div>

            {/* 3. Control Deck 控制面板 */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                
                {/* 左侧面板：试验配置 */}
                <div className="bg-[#161b26] p-5 rounded-xl border border-slate-800">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
                        <Settings size={14} className="text-blue-400"/>
                        试验配置 TEST CONFIG
                    </h3>
                    
                    {/* 材料类型 */}
                    <div className="mb-4">
                        <div className="text-[10px] font-mono text-slate-500 uppercase mb-2">材料类型 Material Type</div>
                        <select
                            value={materialType}
                            onChange={(e) => {
                                const newType = e.target.value as MaterialType;
                                setMaterialType(newType);
                                const info = MATERIAL_INFO[newType];
                                setTargetStrength(info.defaultStrength);
                            }}
                            disabled={status !== TestStatus.IDLE}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                        >
                            {Object.entries(MATERIAL_INFO).map(([key, info]) => (
                                <option key={key} value={key}>{info.name} ({info.strengthRange[0]}-{info.strengthRange[1]} {info.unit})</option>
                            ))}
                        </select>
                    </div>

                    {/* 试块尺寸 */}
                    <div className="mb-4">
                        <div className="text-[10px] font-mono text-slate-500 uppercase mb-2">试块尺寸 Specimen Size</div>
                        <select
                            value={specimenSizeIndex}
                            onChange={(e) => setSpecimenSizeIndex(Number(e.target.value))}
                            disabled={status !== TestStatus.IDLE}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                        >
                            {SPECIMEN_SIZES.map((size, index) => (
                                <option key={index} value={index}>{size.name} ({size.standard})</option>
                            ))}
                        </select>
                    </div>

                    {/* 本构模型选择器 */}
                    <div className="mb-4">
                        <ConstitutiveModelSelector
                            materialType={materialType}
                            selectedModel={constitutiveModel}
                            customParams={customConstitutiveParams}
                            useCustomParams={useCustomParams}
                            onModelChange={setConstitutiveModel}
                            onParamsChange={setCustomConstitutiveParams}
                            onUseCustomParamsChange={setUseCustomParams}
                            targetStrength={targetStrength}
                        />
                    </div>

                    {/* 试验类型 */}
                    <div className="mb-4">
                        <div className="text-[10px] font-mono text-slate-500 uppercase mb-2">试验类型 Test Type</div>
                        <div className="grid grid-cols-3 gap-2">
                            <button 
                                onClick={() => toggleTestType(TestType.COMPRESSION)}
                                disabled={status !== TestStatus.IDLE}
                                className={`py-2.5 px-2 text-xs font-bold rounded-lg transition-all ${
                                    testType === TestType.COMPRESSION 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' 
                                    : 'bg-slate-800/50 text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                <div className="text-base mb-0.5">📦</div>
                                抗压
                            </button>
                            <button 
                                onClick={() => toggleTestType(TestType.TENSION)}
                                disabled={status !== TestStatus.IDLE}
                                className={`py-2.5 px-2 text-xs font-bold rounded-lg transition-all ${
                                    testType === TestType.TENSION 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' 
                                    : 'bg-slate-800/50 text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                <div className="text-base mb-0.5">🔄</div>
                                劈裂
                            </button>
                            <button 
                                onClick={() => toggleTestType(TestType.ELASTIC_MODULUS)}
                                disabled={status !== TestStatus.IDLE}
                                className={`py-2.5 px-2 text-xs font-bold rounded-lg transition-all ${
                                    testType === TestType.ELASTIC_MODULUS 
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30' 
                                    : 'bg-slate-800/50 text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                <div className="text-base mb-0.5">📐</div>
                                弹模
                            </button>
                        </div>
                    </div>
                    
                    {/* 控制模式 */}
                    <div className="mb-5">
                        <div className="text-[10px] font-mono text-slate-500 uppercase mb-2">控制模式 Control Mode</div>
                        <div className="space-y-2">
                            <button 
                                onClick={() => setControlMode('force')}
                                disabled={status !== TestStatus.IDLE}
                                className={`w-full py-2.5 px-4 text-xs font-mono rounded-lg transition-all flex items-center gap-3 ${
                                    controlMode === 'force' 
                                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-900/30' 
                                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                力控制 Force Control
                                <span className="ml-auto text-[10px] opacity-60">kN/s</span>
                            </button>
                            <button 
                                onClick={() => setControlMode('displacement')}
                                disabled={status !== TestStatus.IDLE}
                                className={`w-full py-2.5 px-4 text-xs font-mono rounded-lg transition-all flex items-center gap-3 ${
                                    controlMode === 'displacement' 
                                    ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white shadow-lg shadow-cyan-900/30' 
                                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                                位移控制 Displacement Control
                                <span className="ml-auto text-[10px] opacity-60">mm/min</span>
                            </button>
                            <button 
                                onClick={() => setControlMode('program')}
                                disabled={status !== TestStatus.IDLE}
                                className={`w-full py-2.5 px-4 text-xs font-mono rounded-lg transition-all flex items-center gap-3 ${
                                    controlMode === 'program' 
                                    ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-900/30' 
                                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                                程序控制 Program Control
                                <span className="ml-auto text-[10px] opacity-60">Custom</span>
                            </button>
                        </div>
                    </div>

                    {/* 试件信息 */}
                    <div className="bg-slate-900/50 rounded-lg p-3 text-[10px] font-mono text-slate-500">
                        <div className="flex justify-between mb-1">
                            <span>材料 Material</span>
                            <span className="text-slate-300">{materialInfo.name}</span>
                        </div>
                        <div className="flex justify-between mb-1">
                            <span>试件 Specimen</span>
                            <span className="text-slate-300">{specimenSize.name}</span>
                        </div>
                        <div className="flex justify-between mb-1">
                            <span>面积 Area</span>
                            <span className="text-slate-300">{specimenSize.area.toLocaleString()} mm²</span>
                        </div>
                        <div className="flex justify-between">
                            <span>标准 Standard</span>
                            <span className="text-slate-300">{specimenSize.standard}</span>
                        </div>
                    </div>
                </div>

                {/* 中间面板：加载参数 */}
                <div className="bg-[#161b26] p-5 rounded-xl border border-slate-800">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
                        <RefreshCw size={14} className="text-emerald-400"/>
                        加载参数 LOADING PARAMS
                    </h3>
                    
                    <div className="space-y-5">
                        {/* 强度计算模式切换 */}
                        {materialType === MaterialType.CONCRETE && (
                            <div className="flex items-center justify-between p-2 bg-slate-900/50 rounded">
                                <span className="text-xs text-slate-300">使用配合比计算强度</span>
                                <button
                                    onClick={() => setUseMixDesign(!useMixDesign)}
                                    disabled={status !== TestStatus.IDLE}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${
                                        useMixDesign ? 'bg-green-600' : 'bg-slate-600'
                                    } ${status !== TestStatus.IDLE ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div
                                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                            useMixDesign ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>
                        )}

                        {/* 配合比输入或直接强度输入 */}
                        {useMixDesign && materialType === MaterialType.CONCRETE ? (
                            <MixDesignInput
                                mixDesign={mixDesign}
                                onMixDesignChange={setMixDesign}
                                onStrengthCalculated={setTargetStrength}
                            />
                        ) : (
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-mono text-slate-400">强度等级 Strength</span>
                                    <span className="text-sm font-mono font-bold text-white bg-blue-600 px-3 py-1 rounded-lg">
                                        {targetStrength} {materialInfo.unit}
                                    </span>
                                </div>
                                <input 
                                    type="range" 
                                    min={materialInfo.strengthRange[0]} 
                                    max={materialInfo.strengthRange[1]} 
                                    step={materialType === MaterialType.STEEL ? 10 : materialType === MaterialType.ROCK ? 5 : 2.5}
                                    value={targetStrength}
                                    onChange={(e) => setTargetStrength(Number(e.target.value))}
                                    disabled={status !== TestStatus.IDLE}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                                    <span>{materialInfo.strengthRange[0]}</span>
                                    <span>{Math.round((materialInfo.strengthRange[0] + materialInfo.strengthRange[1]) / 2)}</span>
                                    <span>{materialInfo.strengthRange[1]}</span>
                                </div>
                            </div>
                        )}
                        
                        {/* 加载速率 */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-mono text-slate-400">
                                    {controlMode === 'force' ? '力速率 Force Rate' : '位移速率 Disp. Rate'}
                                </span>
                                <span className={`text-sm font-mono font-bold px-3 py-1 rounded-lg ${
                                    controlMode === 'force' 
                                    ? 'text-white bg-emerald-600'
                                    : 'text-white bg-cyan-600'
                                }`}>
                                    {controlMode === 'force' ? `${forceRate.toFixed(1)} kN/s` : `${displacementRate.toFixed(2)} mm/min`}
                                </span>
                            </div>
                            {controlMode === 'force' ? (
                                <input 
                                    type="range" 
                                    min="1" max="50" step="1"
                                    value={forceRate}
                                    onChange={(e) => setForceRate(Number(e.target.value))}
                                    disabled={status !== TestStatus.IDLE}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            ) : (
                                <input 
                                    type="range" 
                                    min="0.1" max="2.0" step="0.1"
                                    value={displacementRate}
                                    onChange={(e) => setDisplacementRate(Number(e.target.value))}
                                    disabled={status !== TestStatus.IDLE}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                            )}
                            {controlMode === 'force' && (
                                <div className="text-[10px] text-slate-500 mt-1">
                                    推荐: 5-20 kN/s（根据试件尺寸调整）
                                </div>
                            )}
                        </div>

                        {/* 预加载力 */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-mono text-slate-400">预加载力 Preload</span>
                                <span className="text-sm font-mono font-bold text-white bg-slate-700 px-3 py-1 rounded-lg">
                                    {preloadForce.toFixed(1)} kN
                                </span>
                            </div>
                            <input 
                                type="range" 
                                min="0.5" max="5.0" step="0.5"
                                value={preloadForce}
                                onChange={(e) => setPreloadForce(Number(e.target.value))}
                                disabled={status !== TestStatus.IDLE}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-500"
                            />
                        </div>

                        {/* 保载时间（非程序模式） */}
                        {controlMode !== 'program' && (
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-mono text-slate-400">保载时间 Hold Time</span>
                                    <span className="text-sm font-mono font-bold text-white bg-orange-600 px-3 py-1 rounded-lg">
                                        {holdTime} s
                                    </span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" max="60" step="5"
                                    value={holdTime}
                                    onChange={(e) => setHoldTime(Number(e.target.value))}
                                    disabled={status !== TestStatus.IDLE}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                />
                            </div>
                        )}

                        {/* 程序控制模式 - 循环加载参数 */}
                        {controlMode === 'program' && (
                            <>
                                <div className="col-span-2 border-t border-slate-700 pt-4 mt-2">
                                    <div className="text-xs font-mono text-purple-400 mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                        循环加载程序 Cyclic Loading Program
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* 循环次数 */}
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[11px] font-mono text-slate-500">循环次数</span>
                                                <span className="text-xs font-mono font-bold text-purple-400">{cycleCount}</span>
                                            </div>
                                            <input 
                                                type="range" min="1" max="10" step="1"
                                                value={cycleCount}
                                                onChange={(e) => setCycleCount(Number(e.target.value))}
                                                disabled={status !== TestStatus.IDLE}
                                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                            />
                                        </div>
                                        
                                        {/* 保载时间 */}
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[11px] font-mono text-slate-500">保载时间</span>
                                                <span className="text-xs font-mono font-bold text-purple-400">{cycleHoldTime}s</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="10" step="1"
                                                value={cycleHoldTime}
                                                onChange={(e) => setCycleHoldTime(Number(e.target.value))}
                                                disabled={status !== TestStatus.IDLE}
                                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                            />
                                        </div>
                                        
                                        {/* 加载速率 (位移控制) */}
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[11px] font-mono text-slate-500">加载速率</span>
                                                <span className="text-xs font-mono font-bold text-red-400">{loadingDispRate} mm/s</span>
                                            </div>
                                            <input 
                                                type="range" min="0.05" max="0.5" step="0.05"
                                                value={loadingDispRate}
                                                onChange={(e) => setLoadingDispRate(Number(e.target.value))}
                                                disabled={status !== TestStatus.IDLE}
                                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                                            />
                                        </div>
                                        
                                        {/* 卸载速率 (力控制) */}
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[11px] font-mono text-slate-500">卸载速率</span>
                                                <span className="text-xs font-mono font-bold text-green-400">{unloadingForceRate} kN/s</span>
                                            </div>
                                            <input 
                                                type="range" min="20" max="100" step="10"
                                                value={unloadingForceRate}
                                                onChange={(e) => setUnloadingForceRate(Number(e.target.value))}
                                                disabled={status !== TestStatus.IDLE}
                                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* 加载至破坏选项 */}
                                    <div className="mt-3 flex items-center justify-between bg-slate-900/50 rounded-lg p-2">
                                        <span className="text-[11px] font-mono text-slate-400">最后循环加载至破坏 Load to Failure</span>
                                        <button
                                            onClick={() => setFinalLoadToFailure(!finalLoadToFailure)}
                                            disabled={status !== TestStatus.IDLE}
                                            className={`w-10 h-5 rounded-full transition-all ${
                                                finalLoadToFailure ? 'bg-purple-600' : 'bg-slate-700'
                                            }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                                finalLoadToFailure ? 'translate-x-5' : 'translate-x-0.5'
                                            }`}></div>
                                        </button>
                                    </div>
                                    
                                    {/* 程序预览 */}
                                    <div className="mt-3 bg-slate-900/50 rounded-lg p-2 text-[10px] font-mono text-slate-500">
                                        <div className="text-slate-400 mb-1">位移目标序列 Displacement Targets:</div>
                                        <div className="text-slate-300 flex flex-wrap gap-1">
                                            {dispTargets.slice(0, 8).map((d, i) => (
                                                <span key={i} className={`px-1.5 py-0.5 rounded ${i < currentCycle ? 'bg-green-800 text-green-300' : i === currentCycle && status === TestStatus.RUNNING ? 'bg-purple-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                                    {d}mm
                                                </span>
                                            ))}
                                            {dispTargets.length > 8 && <span className="text-slate-500">...</span>}
                                        </div>
                                        <div className="mt-2 text-slate-400">
                                            加载: <span className="text-red-400">{loadingDispRate} mm/s</span> (位移控制) | 
                                            卸载: <span className="text-green-400">{unloadingForceRate} kN/s</span> (力控制)
                                        </div>
                                    </div>
                                    
                                    {/* 实时循环状态 */}
                                    {status === TestStatus.RUNNING && (
                                        <div className="mt-3 bg-purple-950/50 border border-purple-800/50 rounded-lg p-2 text-[10px] font-mono">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-purple-300">循环进度 Cycle Progress</span>
                                                <span className="text-purple-400 font-bold">{currentCycle + 1} / {dispTargets.length}</span>
                                            </div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-slate-500">当前位移:</span>
                                                <span className="text-cyan-400 font-bold">{currentDisplacement.toFixed(3)} mm</span>
                                            </div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-slate-500">目标位移:</span>
                                                <span className="text-orange-400 font-bold">{targetDisplacement.toFixed(2)} mm</span>
                                            </div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-slate-500">阶段:</span>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                                    cyclePhase === 'loading' ? 'bg-red-600 text-white' :
                                                    cyclePhase === 'holding_upper' ? 'bg-yellow-600 text-white' :
                                                    cyclePhase === 'unloading' ? 'bg-green-600 text-white' :
                                                    cyclePhase === 'holding_lower' ? 'bg-blue-600 text-white' :
                                                    'bg-red-700 text-white animate-pulse'
                                                }`}>
                                                    {cyclePhase === 'loading' ? '位移加载 ↑' :
                                                     cyclePhase === 'holding_upper' ? `保载 (${holdTimer.toFixed(1)}s)` :
                                                     cyclePhase === 'unloading' ? '力控卸载 ↓' :
                                                     cyclePhase === 'holding_lower' ? `保载 (${holdTimer.toFixed(1)}s)` :
                                                     '最终破坏 ↑↑'}
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-800 rounded-full h-1.5">
                                                <div 
                                                    className="h-1.5 rounded-full transition-all bg-gradient-to-r from-purple-600 to-purple-400"
                                                    style={{ width: `${((currentCycle + (cyclePhase === 'final' ? 1 : 0)) / (dispTargets.length + (finalLoadToFailure ? 1 : 0))) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* 右侧面板：液压控制 */}
                <div className="bg-[#161b26] p-5 rounded-xl border border-slate-800 flex flex-col">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
                        <AlertTriangle size={14} className="text-red-400"/>
                        液压控制 HYDRAULIC
                    </h3>
                    
                    {/* 状态显示区 */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                            <div className="text-[10px] text-slate-500 mb-1">控制模式 Mode</div>
                            <div className={`text-sm font-bold font-mono ${
                                controlMode === 'force' ? 'text-emerald-400' : 
                                controlMode === 'displacement' ? 'text-cyan-400' : 'text-purple-400'
                            }`}>
                                {controlMode === 'force' ? '力' : controlMode === 'displacement' ? '位移' : '程序'}
                            </div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                            <div className="text-[10px] text-slate-500 mb-1">系统状态 Status</div>
                            <div className={`text-sm font-bold font-mono ${
                                status === TestStatus.IDLE ? 'text-yellow-400' : 
                                status === TestStatus.RUNNING ? 'text-green-400' : 
                                status === TestStatus.FAILED ? 'text-red-400' : 'text-blue-400'
                            }`}>
                                {status === TestStatus.IDLE ? '待机' : 
                                 status === TestStatus.APPROACHING ? '接近' :
                                 status === TestStatus.RUNNING ? '运行' : '完成'}
                            </div>
                        </div>
                    </div>

                    {/* 控制按钮区 */}
                    <div className="flex-1 flex flex-col gap-3">
                        {/* 主控制按钮 */}
                        {status === TestStatus.IDLE || status === TestStatus.FAILED ? (
                            <button 
                                onClick={startTest}
                                className={`py-5 rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-3 transition-all ${
                                    safetyDoorOpen 
                                    ? 'bg-slate-800 text-slate-600 border border-dashed border-slate-700 cursor-not-allowed' 
                                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-900/30'
                                }`}
                            >
                                <Play size={20} fill="currentColor" />
                                <span>{status === TestStatus.FAILED ? "新试验 NEW TEST" : "启动试验 START TEST"}</span>
                            </button>
                        ) : (
                            <button 
                                onClick={() => setStatus(TestStatus.IDLE)}
                                className="py-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-lg shadow-lg shadow-red-900/30 font-bold text-sm uppercase flex items-center justify-center gap-3 animate-pulse"
                            >
                                <Square size={20} fill="currentColor" />
                                <span>紧急停止 E-STOP</span>
                            </button>
                        )}

                        {/* 复位按钮 */}
                        <button 
                            onClick={resetTest}
                            disabled={status === TestStatus.RUNNING || status === TestStatus.APPROACHING}
                            className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 font-mono text-xs uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            复位/清零 RESET / TARE
                        </button>

                        {/* 数据导出按钮 */}
                        <div className="relative">
                            <button 
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                disabled={dataPoints.length === 0}
                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 font-mono text-xs uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {exportCopied ? <Check size={14} className="text-green-400" /> : <Download size={14} />}
                                {exportCopied ? '已复制 COPIED' : '导出数据 EXPORT'}
                            </button>
                            
                            {/* 导出菜单 */}
                            {showExportMenu && (
                                <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl z-50">
                                    <button
                                        onClick={exportToCSV}
                                        className="w-full px-4 py-2.5 text-left text-xs font-mono text-slate-300 hover:bg-slate-800 flex items-center gap-2 transition-colors"
                                    >
                                        <Download size={12} />
                                        导出 CSV
                                    </button>
                                    <button
                                        onClick={exportToJSON}
                                        className="w-full px-4 py-2.5 text-left text-xs font-mono text-slate-300 hover:bg-slate-800 flex items-center gap-2 transition-colors border-t border-slate-800"
                                    >
                                        <Download size={12} />
                                        导出 JSON
                                    </button>
                                    <button
                                        onClick={copyToClipboard}
                                        className="w-full px-4 py-2.5 text-left text-xs font-mono text-slate-300 hover:bg-slate-800 flex items-center gap-2 transition-colors border-t border-slate-800"
                                    >
                                        <Copy size={12} />
                                        复制到剪贴板
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 安全提示 */}
                    <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-600 font-mono">
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${safetyDoorOpen ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
                            安全门 {safetyDoorOpen ? '已开启 OPEN' : '已关闭 CLOSED'}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* AI Report Module AI分析报告 */}
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs overflow-hidden flex flex-col min-h-[200px]">
                 <div className="flex items-center gap-2 text-slate-500 mb-3 border-b border-slate-900 pb-2">
                    <FileText size={14} />
                    <span>AI分析报告 ANALYSIS REPORT</span>
                    {isGeneratingReport && <span className="text-blue-500 animate-pulse">生成中 Processing...</span>}
                 </div>
                 
                 <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {aiReport ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <div dangerouslySetInnerHTML={{ __html: aiReport.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-200">$1</strong>') }} />
                        </div>
                    ) : (
                        <div className="text-slate-600 italic">
                             等待试验完成后生成破坏分析报告...
                             <br/>
                             Waiting for test completion to generate failure analysis...
                        </div>
                    )}
                 </div>
            </div>

        </div>

      </main>
    </div>
  );
};
