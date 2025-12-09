/**
 * 3D FEM 应力云图可视化组件
 * 使用 Three.js / React Three Fiber
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { 
  Mesh3D, FEMResult3D, ElementResult3D,
  FEMSolver3D, generateCubeMesh3D, applyBottomFixed3D 
} from '../services/fem/fem3d';

// 云图类型
export type ContourType3D = 'vonMises' | 'sigmaY' | 'sigmaX' | 'sigmaZ' | 'displacement';

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

interface HexElementProps {
  element: {
    id: number;
    nodes: number[];
  };
  nodes: { id: number; x: number; y: number; z: number }[];
  nodeResults?: { nodeId: number; ux: number; uy: number; uz: number }[];
  color: THREE.Color;
  deformScale: number;
  wireframe?: boolean;
}

/**
 * 单个六面体单元
 */
const HexElement: React.FC<HexElementProps> = ({ 
  element, 
  nodes, 
  nodeResults,
  color, 
  deformScale,
  wireframe = false
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
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
    // 节点顺序: 0-3 底面, 4-7 顶面
    const faces = [
      // 底面 (y=min)
      [0, 1, 2], [0, 2, 3],
      // 顶面 (y=max)
      [4, 6, 5], [4, 7, 6],
      // 前面 (z=max)
      [3, 2, 6], [3, 6, 7],
      // 后面 (z=min)
      [0, 5, 1], [0, 4, 5],
      // 右面 (x=max)
      [1, 5, 6], [1, 6, 2],
      // 左面 (x=min)
      [0, 3, 7], [0, 7, 4],
    ];
    
    const vertices: number[] = [];
    const normals: number[] = [];
    
    for (const face of faces) {
      const [i0, i1, i2] = face;
      const v0 = coords[i0];
      const v1 = coords[i1];
      const v2 = coords[i2];
      
      // 计算法向量
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
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial 
        color={color} 
        wireframe={wireframe}
        side={THREE.DoubleSide}
        metalness={0.1}
        roughness={0.8}
      />
    </mesh>
  );
};

interface FEMMeshProps {
  mesh: Mesh3D;
  result: FEMResult3D | null;
  contourType: ContourType3D;
  deformScale: number;
  showWireframe: boolean;
}

/**
 * FEM 网格渲染
 */
const FEMMesh: React.FC<FEMMeshProps> = ({ 
  mesh, 
  result, 
  contourType, 
  deformScale,
  showWireframe 
}) => {
  // 计算云图值范围
  const { minValue, maxValue } = useMemo(() => {
    if (!result) return { minValue: 0, maxValue: 1 };
    
    const values = result.elements.map(e => getElementValue(e, contourType));
    return {
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
    };
  }, [result, contourType]);
  
  return (
    <group>
      {mesh.elements.map(element => {
        const elemResult = result?.elements.find(e => e.elementId === element.id);
        const value = elemResult ? getElementValue(elemResult, contourType) : 0;
        const color = getContourColor(value, minValue, maxValue);
        
        return (
          <HexElement
            key={element.id}
            element={element}
            nodes={mesh.nodes}
            nodeResults={result?.nodes}
            color={color}
            deformScale={deformScale}
            wireframe={showWireframe}
          />
        );
      })}
      
      {/* 网格线 */}
      {showWireframe && (
        <group>
          {mesh.elements.map(element => (
            <HexElement
              key={`wire-${element.id}`}
              element={element}
              nodes={mesh.nodes}
              nodeResults={result?.nodes}
              color={new THREE.Color(0x000000)}
              deformScale={deformScale}
              wireframe={true}
            />
          ))}
        </group>
      )}
    </group>
  );
};

/**
 * 边界条件可视化 - 底部固定
 */
const BoundaryConditions: React.FC<{ mesh: Mesh3D }> = ({ mesh }) => {
  const fixedNodes = mesh.nodes.filter(n => n.fixedY);
  
  return (
    <group>
      {fixedNodes.map(node => (
        <group key={node.id} position={[node.x, node.y - 2, node.z]}>
          {/* 三角形约束符号 */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[3, 5, 3]} />
            <meshStandardMaterial color="#ff8800" />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/**
 * 载荷箭头
 */
const LoadArrows: React.FC<{ mesh: Mesh3D; stress: number }> = ({ mesh, stress }) => {
  const maxY = Math.max(...mesh.nodes.map(n => n.y));
  const topNodes = mesh.nodes.filter(n => Math.abs(n.y - maxY) < 1e-6);
  
  // 只显示部分箭头
  const displayNodes = topNodes.filter((_, i) => i % 4 === 0);
  
  const arrowLength = Math.min(30, Math.abs(stress) * 2);
  
  return (
    <group>
      {displayNodes.map(node => (
        <group key={node.id} position={[node.x, node.y + arrowLength / 2 + 5, node.z]}>
          <mesh rotation={[stress < 0 ? Math.PI : 0, 0, 0]}>
            <coneGeometry args={[3, arrowLength, 8]} />
            <meshStandardMaterial color="#ff4444" />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/**
 * 颜色条
 */
const ColorBar: React.FC<{ min: number; max: number; label: string }> = ({ min, max, label }) => {
  return (
    <div className="absolute left-4 top-4 bg-black/70 rounded-lg p-3 text-white font-mono text-xs">
      <div className="mb-2 text-slate-400">{label}</div>
      <div className="flex">
        <div 
          className="w-4 h-32 rounded"
          style={{
            background: 'linear-gradient(to top, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)'
          }}
        />
        <div className="ml-2 flex flex-col justify-between text-[10px]">
          <span>{max.toExponential(2)}</span>
          <span>{((max + min) / 2).toExponential(2)}</span>
          <span>{min.toExponential(2)}</span>
        </div>
      </div>
    </div>
  );
};

interface FEMViewer3DProps {
  width?: number;
  height?: number;
  depth?: number;
  nx?: number;
  ny?: number;
  nz?: number;
  E?: number;
  nu?: number;
  appliedStress: number;
  contourType?: ContourType3D;
  showWireframe?: boolean;
  showBoundary?: boolean;
  showLoads?: boolean;
  deformScale?: number;
  autoRotate?: boolean;
}

export const FEMViewer3D: React.FC<FEMViewer3DProps> = ({
  width = 150,
  height = 150,
  depth = 150,
  nx = 5,
  ny = 5,
  nz = 5,
  E = 30000,
  nu = 0.2,
  appliedStress,
  contourType = 'vonMises',
  showWireframe = true,
  showBoundary = true,
  showLoads = true,
  deformScale = 100,
  autoRotate = false,
}) => {
  const solverRef = useRef<FEMSolver3D | null>(null);
  const [result, setResult] = React.useState<FEMResult3D | null>(null);
  const [mesh, setMesh] = React.useState<Mesh3D | null>(null);
  
  // 初始化网格和求解器
  useEffect(() => {
    const newMesh = generateCubeMesh3D(width, height, depth, nx, ny, nz, E, nu);
    applyBottomFixed3D(newMesh);
    setMesh(newMesh);
    
    const solver = new FEMSolver3D(newMesh);
    solver.precompute();
    solverRef.current = solver;
    
    console.log(`FEM 3D: 网格生成完成 - ${newMesh.nodes.length} 节点, ${newMesh.elements.length} 单元`);
  }, [width, height, depth, nx, ny, nz, E, nu]);
  
  // 当应力变化时求解
  useEffect(() => {
    if (!solverRef.current || Math.abs(appliedStress) < 0.01) {
      setResult(null);
      return;
    }
    
    const startTime = performance.now();
    const newResult = solverRef.current.solve(appliedStress);
    const elapsed = performance.now() - startTime;
    
    console.log(`FEM 3D: 求解完成 - ${elapsed.toFixed(1)}ms, max σ_vm = ${newResult.maxVonMises.toFixed(2)} MPa`);
    setResult(newResult);
  }, [appliedStress]);
  
  // 计算云图值范围
  const { minValue, maxValue } = useMemo(() => {
    if (!result) return { minValue: 0, maxValue: 1 };
    const values = result.elements.map(e => getElementValue(e, contourType));
    return {
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
    };
  }, [result, contourType]);
  
  const contourLabels: Record<ContourType3D, string> = {
    vonMises: 'von Mises (MPa)',
    sigmaY: 'σy (MPa)',
    sigmaX: 'σx (MPa)',
    sigmaZ: 'σz (MPa)',
    displacement: 'U (mm)',
  };
  
  if (!mesh) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <span className="text-slate-500">初始化网格...</span>
      </div>
    );
  }
  
  return (
    <div className="relative w-full h-full">
      <Canvas>
        <PerspectiveCamera makeDefault position={[200, 200, 200]} fov={50} />
        <OrbitControls 
          autoRotate={autoRotate} 
          autoRotateSpeed={1}
          enableDamping
          dampingFactor={0.05}
        />
        
        <ambientLight intensity={0.4} />
        <directionalLight position={[100, 100, 100]} intensity={0.8} />
        <directionalLight position={[-100, 100, -100]} intensity={0.4} />
        
        {/* FEM 网格 */}
        <FEMMesh
          mesh={mesh}
          result={result}
          contourType={contourType}
          deformScale={deformScale}
          showWireframe={showWireframe}
        />
        
        {/* 边界条件 */}
        {showBoundary && <BoundaryConditions mesh={mesh} />}
        
        {/* 载荷箭头 */}
        {showLoads && Math.abs(appliedStress) > 0.1 && (
          <LoadArrows mesh={mesh} stress={appliedStress} />
        )}
        
        {/* 坐标轴 */}
        <axesHelper args={[100]} />
        
        {/* 地面网格 */}
        <gridHelper args={[300, 30, '#334155', '#1e293b']} position={[0, -5, 0]} />
      </Canvas>
      
      {/* 颜色条 */}
      <ColorBar 
        min={minValue} 
        max={maxValue} 
        label={contourLabels[contourType]}
      />
      
      {/* 信息面板 */}
      <div className="absolute right-4 top-4 bg-black/70 rounded-lg p-3 text-white font-mono text-xs">
        <div className="text-slate-400 mb-2">FEM 3D Analysis</div>
        <div className="space-y-1">
          <div>节点: {mesh.nodes.length}</div>
          <div>单元: {mesh.elements.length}</div>
          <div>应力: {appliedStress.toFixed(1)} MPa</div>
          {result && (
            <>
              <div className="text-cyan-400">max U: {(result.maxDisplacement * 1000).toFixed(3)} μm</div>
              <div className="text-red-400">max σ_vm: {result.maxVonMises.toFixed(2)} MPa</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FEMViewer3D;
