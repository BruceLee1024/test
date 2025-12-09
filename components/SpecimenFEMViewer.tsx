/**
 * 带 FEM 应力云图的 3D 试件可视化组件
 * 在虚拟实验室中实时显示应力分布
 */

import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { TestStatus } from '../types';
import { 
  Mesh3D, FEMResult3D, ElementResult3D,
  FEMSolver3D, generateCubeMesh3D, applyBottomFixed3D 
} from '../services/fem/fem3d';

// 云图类型
export type ContourType3D = 'vonMises' | 'sigmaY' | 'sigmaX' | 'sigmaZ' | 'displacement' | 'none';

// 颜色映射 - jet colormap
const JET_COLORS = [
  new THREE.Color(0x0000ff), // 蓝
  new THREE.Color(0x00ffff), // 青
  new THREE.Color(0x00ff00), // 绿
  new THREE.Color(0xffff00), // 黄
  new THREE.Color(0xff0000), // 红
];

/**
 * 根据值获取颜色
 */
function getContourColor(value: number, min: number, max: number): THREE.Color {
  if (max <= min) return JET_COLORS[0].clone();
  
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const n = JET_COLORS.length - 1;
  const i = Math.floor(t * n);
  const f = t * n - i;
  
  if (i >= n) return JET_COLORS[n].clone();
  
  const color = new THREE.Color();
  color.lerpColors(JET_COLORS[i], JET_COLORS[i + 1], f);
  return color;
}

/**
 * 获取单元云图值
 */
function getElementValue(elem: ElementResult3D, type: ContourType3D): number {
  switch (type) {
    case 'vonMises': return elem.vonMises;
    case 'sigmaY': return Math.abs(elem.sigmaY);
    case 'sigmaX': return Math.abs(elem.sigmaX);
    case 'sigmaZ': return Math.abs(elem.sigmaZ);
    default: return elem.vonMises;
  }
}

interface HexElementMeshProps {
  element: { id: number; nodes: number[] };
  nodes: { id: number; x: number; y: number; z: number }[];
  nodeResults?: { nodeId: number; ux: number; uy: number; uz: number }[];
  color: THREE.Color;
  deformScale: number;
  opacity?: number;
}

/**
 * 单个六面体单元网格
 */
const HexElementMesh: React.FC<HexElementMeshProps> = ({ 
  element, 
  nodes, 
  nodeResults,
  color, 
  deformScale,
  opacity = 1
}) => {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    
    // 获取节点坐标（考虑变形）
    const coords = element.nodes.map(nid => {
      const node = nodes.find(n => n.id === nid)!;
      const disp = nodeResults?.find(r => r.nodeId === nid);
      return {
        x: node.x + (disp?.ux || 0) * deformScale,
        y: node.y + (disp?.uy || 0) * deformScale,
        z: node.z + (disp?.uz || 0) * deformScale,
      };
    });
    
    // 六面体的6个面，每个面2个三角形
    const faces = [
      [0, 1, 2], [0, 2, 3], // 底面
      [4, 6, 5], [4, 7, 6], // 顶面
      [3, 2, 6], [3, 6, 7], // 前面
      [0, 5, 1], [0, 4, 5], // 后面
      [1, 5, 6], [1, 6, 2], // 右面
      [0, 3, 7], [0, 7, 4], // 左面
    ];
    
    const vertices: number[] = [];
    const normals: number[] = [];
    
    for (const face of faces) {
      const [i0, i1, i2] = face;
      const v0 = coords[i0];
      const v1 = coords[i1];
      const v2 = coords[i2];
      
      const ax = v1.x - v0.x, ay = v1.y - v0.y, az = v1.z - v0.z;
      const bx = v2.x - v0.x, by = v2.y - v0.y, bz = v2.z - v0.z;
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      
      vertices.push(v0.x, v0.y, v0.z);
      vertices.push(v1.x, v1.y, v1.z);
      vertices.push(v2.x, v2.y, v2.z);
      
      for (let i = 0; i < 3; i++) {
        normals.push(nx / len, ny / len, nz / len);
      }
    }
    
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    
    return geo;
  }, [element, nodes, nodeResults, deformScale]);
  
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial 
        color={color} 
        side={THREE.DoubleSide}
        metalness={0.1}
        roughness={0.7}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
};

interface FEMMeshRenderProps {
  mesh: Mesh3D;
  result: FEMResult3D | null;
  contourType: ContourType3D;
  deformScale: number;
  showWireframe: boolean;
}

/**
 * FEM 网格渲染组件
 */
const FEMMeshRender: React.FC<FEMMeshRenderProps> = ({ 
  mesh, 
  result, 
  contourType, 
  deformScale,
  showWireframe 
}) => {
  const { minValue, maxValue } = useMemo(() => {
    if (!result || contourType === 'none') return { minValue: 0, maxValue: 1 };
    const values = result.elements.map(e => getElementValue(e, contourType));
    return {
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
    };
  }, [result, contourType]);
  
  // 默认颜色（无云图时）
  const defaultColor = new THREE.Color(0.6, 0.6, 0.6);
  
  return (
    <group>
      {mesh.elements.map(element => {
        let color: THREE.Color;
        
        if (contourType === 'none' || !result) {
          color = defaultColor;
        } else {
          const elemResult = result.elements.find(e => e.elementId === element.id);
          const value = elemResult ? getElementValue(elemResult, contourType) : 0;
          color = getContourColor(value, minValue, maxValue);
        }
        
        return (
          <HexElementMesh
            key={element.id}
            element={element}
            nodes={mesh.nodes}
            nodeResults={result?.nodes}
            color={color}
            deformScale={deformScale}
          />
        );
      })}
      
      {/* 网格线 */}
      {showWireframe && (
        <group>
          {mesh.elements.map(element => {
            const coords = element.nodes.map(nid => {
              const node = mesh.nodes.find(n => n.id === nid)!;
              const disp = result?.nodes.find(r => r.nodeId === nid);
              return new THREE.Vector3(
                node.x + (disp?.ux || 0) * deformScale,
                node.y + (disp?.uy || 0) * deformScale,
                node.z + (disp?.uz || 0) * deformScale
              );
            });
            
            // 六面体的12条边
            const edges = [
              [0, 1], [1, 2], [2, 3], [3, 0], // 底面
              [4, 5], [5, 6], [6, 7], [7, 4], // 顶面
              [0, 4], [1, 5], [2, 6], [3, 7], // 竖边
            ];
            
            return edges.map((edge, i) => {
              const points = [coords[edge[0]], coords[edge[1]]];
              const geometry = new THREE.BufferGeometry().setFromPoints(points);
              const material = new THREE.LineBasicMaterial({ color: '#000000', opacity: 0.3, transparent: true });
              return (
                <primitive key={`${element.id}-${i}`} object={new THREE.Line(geometry, material)} />
              );
            });
          })}
        </group>
      )}
    </group>
  );
};

/**
 * 压板组件
 */
const Platen: React.FC<{ position: [number, number, number]; size: number }> = ({ position, size }) => (
  <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={[size * 1.3, 0.01, size * 1.3]} />
    <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.3} />
  </mesh>
);

/**
 * 载荷箭头
 */
const LoadArrow: React.FC<{ position: [number, number, number]; length: number }> = ({ position, length }) => (
  <group position={position}>
    <mesh rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.003, length, 8]} />
      <meshStandardMaterial color="#ff4444" />
    </mesh>
  </group>
);

/**
 * 边界条件符号
 */
const BoundarySymbol: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.004, 0.008, 3]} />
      <meshStandardMaterial color="#ff8800" />
    </mesh>
  </group>
);

interface SpecimenFEMViewerProps {
  width?: number;
  height?: number;
  depth?: number;
  stress: number;
  status: TestStatus;
  progress: number;
  E?: number;
  nu?: number;
  contourType?: ContourType3D;
  showWireframe?: boolean;
  showBoundary?: boolean;
  showLoads?: boolean;
  deformScale?: number;
  label?: string;
}

/**
 * 场景组件
 */
const Scene: React.FC<{
  mesh: Mesh3D | null;
  result: FEMResult3D | null;
  stress: number;
  status: TestStatus;
  contourType: ContourType3D;
  showWireframe: boolean;
  showBoundary: boolean;
  showLoads: boolean;
  deformScale: number;
  label?: string;
}> = ({
  mesh,
  result,
  stress,
  status,
  contourType,
  showWireframe,
  showBoundary,
  showLoads,
  deformScale,
  label,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  
  useFrame((_, delta) => {
    if (groupRef.current && autoRotate && status !== TestStatus.RUNNING) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });
  
  if (!mesh) return null;
  
  const meshHeight = Math.max(...mesh.nodes.map(n => n.y)) - Math.min(...mesh.nodes.map(n => n.y));
  const meshWidth = Math.max(...mesh.nodes.map(n => n.x)) - Math.min(...mesh.nodes.map(n => n.x));
  const maxY = Math.max(...mesh.nodes.map(n => n.y));
  const minY = Math.min(...mesh.nodes.map(n => n.y));
  
  // 顶部和底部节点
  const topNodes = mesh.nodes.filter(n => Math.abs(n.y - maxY) < 1e-6);
  const bottomNodes = mesh.nodes.filter(n => n.fixedY);
  
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[0.3, 0.3, 0.3]} intensity={0.8} castShadow />
      <directionalLight position={[-0.2, 0.2, -0.2]} intensity={0.3} />
      
      <group ref={groupRef}>
        {/* 上压板 */}
        <Platen 
          position={[0, maxY / 1000 + 0.008, 0]} 
          size={meshWidth / 1000} 
        />
        
        {/* FEM 网格 */}
        <group scale={[1/1000, 1/1000, 1/1000]}>
          <FEMMeshRender
            mesh={mesh}
            result={result}
            contourType={contourType}
            deformScale={deformScale}
            showWireframe={showWireframe}
          />
        </group>
        
        {/* 下压板 */}
        <Platen 
          position={[0, minY / 1000 - 0.008, 0]} 
          size={meshWidth / 1000} 
        />
        
        {/* 载荷箭头 */}
        {showLoads && Math.abs(stress) > 0.1 && (
          <group>
            {topNodes.filter((_, i) => i % 9 === 0).map(node => (
              <LoadArrow
                key={node.id}
                position={[node.x / 1000, maxY / 1000 + 0.02, node.z / 1000]}
                length={0.015}
              />
            ))}
          </group>
        )}
        
        {/* 边界条件 */}
        {showBoundary && (
          <group>
            {bottomNodes.filter((_, i) => i % 9 === 0).map(node => (
              <BoundarySymbol
                key={node.id}
                position={[node.x / 1000, minY / 1000 - 0.012, node.z / 1000]}
              />
            ))}
          </group>
        )}
        
        {/* 标签 */}
        {label && (
          <Text
            position={[0, minY / 1000 - 0.03, meshWidth / 2000 + 0.01]}
            fontSize={0.012}
            color="#64748b"
            anchorX="center"
          >
            {label}
          </Text>
        )}
      </group>
      
      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, minY / 1000 - 0.02, 0]} receiveShadow>
        <planeGeometry args={[0.5, 0.5]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      
      <OrbitControls 
        enablePan={false} 
        minDistance={0.15} 
        maxDistance={0.6}
        onStart={() => setAutoRotate(false)}
      />
    </>
  );
};

/**
 * 颜色条组件
 */
const ColorBar: React.FC<{ min: number; max: number; label: string; visible: boolean }> = ({ 
  min, max, label, visible 
}) => {
  if (!visible) return null;
  
  return (
    <div className="absolute left-3 top-3 bg-black/80 rounded-lg p-2 text-white font-mono text-[10px]">
      <div className="mb-1.5 text-slate-400 text-[9px]">{label}</div>
      <div className="flex">
        <div 
          className="w-3 h-24 rounded-sm"
          style={{
            background: 'linear-gradient(to top, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)'
          }}
        />
        <div className="ml-1.5 flex flex-col justify-between text-[8px]">
          <span>{max.toFixed(1)}</span>
          <span>{((max + min) / 2).toFixed(1)}</span>
          <span>{min.toFixed(1)}</span>
        </div>
      </div>
      <div className="mt-1 text-[8px] text-slate-500">MPa</div>
    </div>
  );
};

/**
 * 主组件 - 带 FEM 应力云图的 3D 试件查看器
 */
export const SpecimenFEMViewer: React.FC<SpecimenFEMViewerProps> = ({
  width = 150,
  height = 150,
  depth = 150,
  stress,
  status,
  progress,
  E = 30000,
  nu = 0.2,
  contourType = 'vonMises',
  showWireframe = true,
  showBoundary = true,
  showLoads = true,
  deformScale = 50,
  label,
}) => {
  const solverRef = useRef<FEMSolver3D | null>(null);
  const [mesh, setMesh] = useState<Mesh3D | null>(null);
  const [result, setResult] = useState<FEMResult3D | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  // 网格分辨率 (保持较低以确保实时性能)
  const nx = 4, ny = 4, nz = 4;
  
  // 初始化网格和求解器
  useEffect(() => {
    const newMesh = generateCubeMesh3D(width, height, depth, nx, ny, nz, E, nu);
    applyBottomFixed3D(newMesh);
    setMesh(newMesh);
    
    const solver = new FEMSolver3D(newMesh);
    solver.precompute();
    solverRef.current = solver;
    
    setIsReady(true);
    console.log(`FEM Viewer: 网格初始化完成 - ${newMesh.nodes.length} 节点, ${newMesh.elements.length} 单元`);
  }, [width, height, depth, E, nu]);
  
  // 当应力变化时求解
  useEffect(() => {
    if (!solverRef.current || !isReady) return;
    
    if (Math.abs(stress) < 0.1) {
      setResult(null);
      return;
    }
    
    // 使用负应力（压缩）
    const appliedStress = -Math.abs(stress);
    const newResult = solverRef.current.solve(appliedStress);
    setResult(newResult);
  }, [stress, isReady]);
  
  // 计算云图范围
  const { minValue, maxValue } = useMemo(() => {
    if (!result || contourType === 'none') return { minValue: 0, maxValue: 1 };
    const values = result.elements.map(e => getElementValue(e, contourType));
    return {
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
    };
  }, [result, contourType]);
  
  const contourLabels: Record<ContourType3D, string> = {
    vonMises: 'von Mises',
    sigmaY: 'σy 应力',
    sigmaX: 'σx 应力',
    sigmaZ: 'σz 应力',
    displacement: '位移',
    none: '',
  };
  
  if (!isReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <span className="text-slate-500 text-sm">初始化 FEM...</span>
      </div>
    );
  }
  
  return (
    <div className="relative w-full h-full bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg overflow-hidden">
      <Canvas
        shadows
        camera={{ position: [0.25, 0.2, 0.25], fov: 50 }}
        gl={{ antialias: true, powerPreference: 'default' }}
      >
        <Scene
          mesh={mesh}
          result={result}
          stress={stress}
          status={status}
          contourType={contourType}
          showWireframe={showWireframe}
          showBoundary={showBoundary}
          showLoads={showLoads}
          deformScale={deformScale}
          label={label}
        />
      </Canvas>
      
      {/* 颜色条 */}
      <ColorBar 
        min={minValue} 
        max={maxValue} 
        label={contourLabels[contourType]}
        visible={contourType !== 'none' && result !== null}
      />
      
      {/* 信息面板 */}
      <div className="absolute right-3 top-3 bg-black/80 rounded-lg p-2 text-[10px] font-mono text-white">
        <div className="text-slate-400 mb-1">FEM 3D</div>
        <div className="space-y-0.5">
          <div>σ: <span className="text-cyan-400">{stress.toFixed(1)}</span> MPa</div>
          {result && (
            <>
              <div>σ_vm: <span className="text-red-400">{result.maxVonMises.toFixed(1)}</span></div>
              <div>U: <span className="text-green-400">{(result.maxDisplacement * 1000).toFixed(2)}</span> μm</div>
            </>
          )}
        </div>
      </div>
      
      {/* FEM 标识 */}
      <div className="absolute bottom-3 right-3 px-2 py-1 bg-cyan-500/20 rounded text-[10px] text-cyan-400 font-mono">
        FEM 3D
      </div>
      
      {/* 操作提示 */}
      <div className="absolute bottom-3 left-3 text-[10px] text-slate-500">
        拖拽旋转 · 滚轮缩放
      </div>
    </div>
  );
};

export default SpecimenFEMViewer;
