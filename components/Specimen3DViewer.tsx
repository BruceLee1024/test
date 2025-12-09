/**
 * 3D 试件可视化组件
 * 使用 Three.js / React Three Fiber 实现
 * 支持：立方体、圆柱体、棱柱体试件
 * 功能：旋转查看、裂缝扩展动画、破坏形态展示
 */

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, invalidate } from '@react-three/fiber';
import { OrbitControls, Text, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { SpecimenShape, TestStatus } from '../types';

interface Specimen3DViewerProps {
  shape: SpecimenShape;
  dimensions: {
    width?: number;
    height: number;
    depth?: number;
    diameter?: number;
  };
  progress: number; // 0-1 破坏进度
  status: TestStatus;
  stress: number; // 当前应力 MPa
  label?: string;
  showCracks?: boolean;
  onClose?: () => void;
}

// 裂缝数据结构
interface CrackData {
  id: number;
  startPoint: THREE.Vector3;
  endPoint: THREE.Vector3;
  width: number;
  progress: number; // 裂缝出现的进度阈值
}

// 生成确定性裂缝
function generateCracks(shape: SpecimenShape, dimensions: { width?: number; height: number; depth?: number; diameter?: number }, seed: number = 42): CrackData[] {
  const cracks: CrackData[] = [];
  const random = seededRandom(seed);
  
  const w = (dimensions.width || dimensions.diameter || 150) / 1000; // 转换为米
  const h = dimensions.height / 1000;
  const d = (dimensions.depth || dimensions.width || dimensions.diameter || 150) / 1000;
  
  // 根据形状生成不同的裂缝模式
  if (shape === SpecimenShape.CUBE || shape === SpecimenShape.PRISM) {
    // 立方体/棱柱体：角锥破坏模式
    const numCracks = 12;
    for (let i = 0; i < numCracks; i++) {
      const face = Math.floor(random() * 4); // 4个侧面
      const fromTop = random() > 0.5;
      const xOffset = (random() - 0.5) * w * 0.8;
      const zOffset = (random() - 0.5) * d * 0.8;
      
      let start: THREE.Vector3;
      let end: THREE.Vector3;
      
      if (face === 0) { // 前面
        start = new THREE.Vector3(xOffset, fromTop ? h/2 : -h/2, d/2);
        end = new THREE.Vector3(xOffset + (random() - 0.5) * w * 0.3, fromTop ? h/2 - h * 0.4 : -h/2 + h * 0.4, d/2 - d * 0.1);
      } else if (face === 1) { // 后面
        start = new THREE.Vector3(xOffset, fromTop ? h/2 : -h/2, -d/2);
        end = new THREE.Vector3(xOffset + (random() - 0.5) * w * 0.3, fromTop ? h/2 - h * 0.4 : -h/2 + h * 0.4, -d/2 + d * 0.1);
      } else if (face === 2) { // 左面
        start = new THREE.Vector3(-w/2, fromTop ? h/2 : -h/2, zOffset);
        end = new THREE.Vector3(-w/2 + w * 0.1, fromTop ? h/2 - h * 0.4 : -h/2 + h * 0.4, zOffset + (random() - 0.5) * d * 0.3);
      } else { // 右面
        start = new THREE.Vector3(w/2, fromTop ? h/2 : -h/2, zOffset);
        end = new THREE.Vector3(w/2 - w * 0.1, fromTop ? h/2 - h * 0.4 : -h/2 + h * 0.4, zOffset + (random() - 0.5) * d * 0.3);
      }
      
      cracks.push({
        id: i,
        startPoint: start,
        endPoint: end,
        width: 0.001 + random() * 0.002,
        progress: 0.5 + random() * 0.4, // 50%-90% 时出现
      });
    }
  } else {
    // 圆柱体：纵向劈裂模式
    const numCracks = 8;
    const radius = (dimensions.diameter || 150) / 2000;
    
    for (let i = 0; i < numCracks; i++) {
      const angle = (i / numCracks) * Math.PI * 2 + random() * 0.3;
      const fromTop = random() > 0.5;
      
      const start = new THREE.Vector3(
        Math.cos(angle) * radius,
        fromTop ? h/2 : -h/2,
        Math.sin(angle) * radius
      );
      
      const end = new THREE.Vector3(
        Math.cos(angle) * radius * 0.7,
        fromTop ? h/2 - h * 0.5 : -h/2 + h * 0.5,
        Math.sin(angle) * radius * 0.7
      );
      
      cracks.push({
        id: i,
        startPoint: start,
        endPoint: end,
        width: 0.001 + random() * 0.002,
        progress: 0.55 + random() * 0.35,
      });
    }
  }
  
  return cracks;
}

// 单条裂缝组件
function CrackLine({ crack, currentProgress }: { crack: CrackData; currentProgress: number }) {
  const lineRef = useRef<THREE.Line>(null);
  
  const geometry = useMemo(() => {
    const points = [crack.startPoint, crack.endPoint];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [crack]);
  
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: '#1a1a1a', linewidth: 2 }), []);
  
  useFrame(() => {
    if (lineRef.current) {
      const visible = currentProgress >= crack.progress;
      lineRef.current.visible = visible;
      if (visible) {
        const crackProgress = Math.min(1, (currentProgress - crack.progress) / 0.2);
        lineRef.current.scale.setScalar(crackProgress);
      }
    }
  });
  
  return <primitive ref={lineRef} object={new THREE.Line(geometry, material)} />;
}

// 裂缝线条组件
function CrackLines({ cracks, currentProgress }: { cracks: CrackData[]; currentProgress: number }) {
  return (
    <group>
      {cracks.map((crack) => (
        <CrackLine key={crack.id} crack={crack} currentProgress={currentProgress} />
      ))}
    </group>
  );
}

// 立方体试件
function CubeSpecimen({ 
  dimensions, 
  progress, 
  stress,
  cracks,
  showCracks 
}: { 
  dimensions: { width?: number; height: number; depth?: number };
  progress: number;
  stress: number;
  cracks: CrackData[];
  showCracks: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const w = (dimensions.width || 150) / 1000;
  const h = dimensions.height / 1000;
  const d = (dimensions.depth || dimensions.width || 150) / 1000;
  
  // 压缩变形
  const compression = progress * 0.05;
  const scaleY = 1 - compression;
  const scaleXZ = 1 + compression * 0.3; // 泊松效应
  
  // 颜色随应力变化
  const color = useMemo(() => {
    if (progress >= 0.99) return '#4a4a4a'; // 破坏后灰色
    const t = Math.min(progress / 0.8, 1);
    const r = 0.6 + t * 0.3;
    const g = 0.6 - t * 0.3;
    const b = 0.6 - t * 0.4;
    return new THREE.Color(r, g, b);
  }, [progress]);
  
  // 碎片效果
  const fragments = useMemo(() => {
    if (progress < 0.95) return [];
    const frags: { position: THREE.Vector3; rotation: THREE.Euler; scale: number }[] = [];
    const random = seededRandom(123);
    const numFrags = Math.floor((progress - 0.95) * 100);
    
    for (let i = 0; i < numFrags; i++) {
      frags.push({
        position: new THREE.Vector3(
          (random() - 0.5) * w * 1.5,
          -h/2 - random() * 0.02,
          (random() - 0.5) * d * 1.5
        ),
        rotation: new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI),
        scale: 0.005 + random() * 0.01,
      });
    }
    return frags;
  }, [progress, w, h, d]);
  
  return (
    <group>
      {/* 主体 */}
      <mesh ref={meshRef} scale={[scaleXZ, scaleY, scaleXZ]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial 
          color={color} 
          roughness={0.8} 
          metalness={0.1}
        />
      </mesh>
      
      {/* 边缘线 */}
      <lineSegments scale={[scaleXZ, scaleY, scaleXZ]}>
        <edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} />
        <lineBasicMaterial color="#333" />
      </lineSegments>
      
      {/* 裂缝 */}
      {showCracks && <CrackLines cracks={cracks} currentProgress={progress} />}
      
      {/* 碎片 */}
      {fragments.map((frag, i) => (
        <mesh key={i} position={frag.position} rotation={frag.rotation}>
          <boxGeometry args={[frag.scale, frag.scale * 0.5, frag.scale]} />
          <meshStandardMaterial color="#666" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// 圆柱体试件
function CylinderSpecimen({ 
  dimensions, 
  progress,
  stress,
  cracks,
  showCracks 
}: { 
  dimensions: { diameter?: number; height: number };
  progress: number;
  stress: number;
  cracks: CrackData[];
  showCracks: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const radius = (dimensions.diameter || 150) / 2000;
  const h = dimensions.height / 1000;
  
  const compression = progress * 0.05;
  const scaleY = 1 - compression;
  const scaleXZ = 1 + compression * 0.3;
  
  const color = useMemo(() => {
    if (progress >= 0.99) return '#4a4a4a';
    const t = Math.min(progress / 0.8, 1);
    const r = 0.6 + t * 0.3;
    const g = 0.6 - t * 0.3;
    const b = 0.6 - t * 0.4;
    return new THREE.Color(r, g, b);
  }, [progress]);
  
  return (
    <group>
      <mesh ref={meshRef} scale={[scaleXZ, scaleY, scaleXZ]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, h, 32]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} />
      </mesh>
      
      {/* 边缘 */}
      <lineSegments scale={[scaleXZ, scaleY, scaleXZ]}>
        <edgesGeometry args={[new THREE.CylinderGeometry(radius, radius, h, 32)]} />
        <lineBasicMaterial color="#333" />
      </lineSegments>
      
      {showCracks && <CrackLines cracks={cracks} currentProgress={progress} />}
    </group>
  );
}

// 压板组件
function Platen({ position, width, depth }: { position: [number, number, number]; width: number; depth: number }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[width * 1.2, 0.02, depth * 1.2]} />
      <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.3} />
    </mesh>
  );
}

// 场景组件
function Scene({ 
  shape, 
  dimensions, 
  progress, 
  status, 
  stress,
  label,
  showCracks = true 
}: Omit<Specimen3DViewerProps, 'onClose'>) {
  const groupRef = useRef<THREE.Group>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  
  const w = (dimensions.width || dimensions.diameter || 150) / 1000;
  const h = dimensions.height / 1000;
  const d = (dimensions.depth || dimensions.width || dimensions.diameter || 150) / 1000;
  
  // 生成裂缝
  const cracks = useMemo(() => generateCracks(shape, dimensions), [shape, dimensions]);
  
  // 自动旋转
  // 当 progress 或 status 变化时触发重新渲染
  useEffect(() => {
    invalidate();
  }, [progress, status, stress]);
  
  useFrame((state, delta) => {
    if (groupRef.current && autoRotate && status !== TestStatus.RUNNING) {
      groupRef.current.rotation.y += delta * 0.3;
      invalidate(); // 自动旋转时持续渲染
    }
  });
  
  // 压缩动画
  const upperPlatenY = h / 2 + 0.015 - progress * h * 0.05;
  
  return (
    <>
      {/* 环境光 */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-3, 3, -3]} intensity={0.3} />
      
      {/* 试件组 */}
      <group ref={groupRef}>
        {/* 上压板 */}
        <Platen position={[0, upperPlatenY, 0]} width={w} depth={d} />
        
        {/* 试件 */}
        {shape === SpecimenShape.CYLINDER ? (
          <CylinderSpecimen 
            dimensions={dimensions} 
            progress={progress} 
            stress={stress}
            cracks={cracks}
            showCracks={showCracks && progress > 0.5}
          />
        ) : (
          <CubeSpecimen 
            dimensions={dimensions} 
            progress={progress} 
            stress={stress}
            cracks={cracks}
            showCracks={showCracks && progress > 0.5}
          />
        )}
        
        {/* 下压板 */}
        <Platen position={[0, -h / 2 - 0.015, 0]} width={w} depth={d} />
        
        {/* 标签 */}
        {label && (
          <Text
            position={[0, -h / 2 - 0.06, w / 2 + 0.02]}
            fontSize={0.015}
            color="#64748b"
            anchorX="center"
            anchorY="middle"
          >
            {label}
          </Text>
        )}
      </group>
      
      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -h / 2 - 0.04, 0]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      
      {/* 控制器 */}
      <OrbitControls 
        enablePan={false} 
        minDistance={0.2} 
        maxDistance={1}
        onStart={() => setAutoRotate(false)}
      />
    </>
  );
}

// 信息面板
function InfoPanel({ stress, progress, status }: { stress: number; progress: number; status: TestStatus }) {
  const getStatusText = () => {
    switch (status) {
      case TestStatus.IDLE: return '待机';
      case TestStatus.APPROACHING: return '接近中';
      case TestStatus.RUNNING: return '加载中';
      case TestStatus.PAUSED: return '暂停';
      case TestStatus.FAILED: return '已破坏';
      default: return '';
    }
  };
  
  const getStatusColor = () => {
    switch (status) {
      case TestStatus.RUNNING: return 'text-yellow-400';
      case TestStatus.FAILED: return 'text-red-400';
      default: return 'text-slate-400';
    }
  };
  
  return (
    <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-sm rounded-lg p-3 text-xs font-mono border border-slate-700">
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">状态:</span>
          <span className={getStatusColor()}>{getStatusText()}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">应力:</span>
          <span className="text-cyan-400">{stress.toFixed(2)} MPa</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">破坏进度:</span>
          <span className={progress > 0.8 ? 'text-red-400' : 'text-slate-300'}>{(progress * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

// 主组件
export function Specimen3DViewer({
  shape,
  dimensions,
  progress,
  status,
  stress,
  label,
  showCracks = true,
  onClose,
}: Specimen3DViewerProps) {
  const [webglError, setWebglError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // 延迟挂载，避免快速切换导致的问题
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => {
      clearTimeout(timer);
      setMounted(false);
    };
  }, []);
  
  // 检测 WebGL 支持
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglError(true);
      }
    } catch {
      setWebglError(true);
    }
  }, []);
  
  if (webglError) {
    return (
      <div className="relative w-full h-full min-h-[300px] bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
        <div className="text-center text-slate-400">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-sm">WebGL 不可用</div>
          <div className="text-xs text-slate-500 mt-1">请使用支持 WebGL 的浏览器</div>
        </div>
      </div>
    );
  }
  
  // 等待挂载完成
  if (!mounted) {
    return (
      <div className="relative w-full h-full min-h-[300px] bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
        <div className="text-slate-500 text-sm">加载 3D 视图...</div>
      </div>
    );
  }
  
  return (
    <div className="relative w-full h-full min-h-[300px] bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg overflow-hidden">
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0.3, 0.2, 0.3], fov: 50 }}
        gl={{ 
          antialias: true,
          powerPreference: 'low-power',
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: true,
        }}
        frameloop="demand"
        onCreated={({ gl }) => {
          canvasRef.current = gl.domElement;
          // 处理上下文丢失
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('WebGL context lost');
          });
          gl.domElement.addEventListener('webglcontextrestored', () => {
            console.log('WebGL context restored');
          });
        }}
      >
        <Scene
          shape={shape}
          dimensions={dimensions}
          progress={progress}
          status={status}
          stress={stress}
          label={label}
          showCracks={showCracks}
        />
      </Canvas>
      
      {/* 信息面板 */}
      <InfoPanel stress={stress} progress={progress} status={status} />
      
      {/* 操作提示 */}
      <div className="absolute bottom-4 left-4 text-xs text-slate-500">
        拖拽旋转 · 滚轮缩放
      </div>
      
      {/* 关闭按钮 */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/80 hover:bg-slate-600 text-slate-300 transition-colors"
        >
          ✕
        </button>
      )}
      
      {/* 3D 标识 */}
      <div className="absolute top-4 right-14 px-2 py-1 bg-cyan-500/20 rounded text-xs text-cyan-400 font-mono">
        3D
      </div>
    </div>
  );
}

// 工具函数
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export default Specimen3DViewer;
