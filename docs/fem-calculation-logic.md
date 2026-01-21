# 有限元计算逻辑详解

## 目录
1. [总体架构](#总体架构)
2. [单元类型](#单元类型)
3. [求解流程](#求解流程)
4. [本构模型](#本构模型)
5. [刚度矩阵组装](#刚度矩阵组装)
6. [应力应变计算](#应力应变计算)
7. [边界条件处理](#边界条件处理)

---

## 1. 总体架构

### 1.1 分析类型
- **平面应力 (Plane Stress)**：薄板结构，σz = 0
- **平面应变 (Plane Strain)**：长柱体结构，εz = 0

### 1.2 核心模块
```
services/fem/
├── types.ts          # 数据类型定义
├── mesh.ts           # 网格生成
├── solver.ts         # 有限元求解器
├── fem3d.ts          # 3D可视化
└── ...
```

### 1.3 数据结构

**节点 (Node)**
```typescript
interface Node {
  id: number;
  x: number;      // X坐标 (mm)
  y: number;      // Y坐标 (mm)
  fixedX?: boolean;  // X方向约束
  fixedY?: boolean;  // Y方向约束
}
```

**单元 (Element)**
```typescript
interface Element {
  id: number;
  nodes: [number, number, number, number]; // 4个节点ID (逆时针)
  materialId: number;
}
```

**材料 (Material)**
```typescript
interface Material {
  id: number;
  name: string;
  E: number;      // 弹性模量 (MPa)
  nu: number;     // 泊松比
  fc?: number;    // 抗压强度 (MPa)
  ft?: number;    // 抗拉强度 (MPa)
  epsilon0?: number;  // 峰值应变
  epsilonU?: number;  // 极限应变
  constitutive?: 'linear' | 'hognestad' | 'gb50010' | 'damage' | 'mander' | 'eurocode';
}
```

---

## 2. 单元类型

### 2.1 四节点等参四边形单元 (Q4)

**节点编号规则（逆时针）：**
```
4 ----------- 3
|             |
|      ●      |  ● = 单元中心
|             |
1 ----------- 2
```

**自然坐标系 (ξ, η)：**
- 范围：-1 ≤ ξ ≤ 1, -1 ≤ η ≤ 1
- 原点：单元中心

### 2.2 形函数 (Shape Functions)

**定义：**
```
N₁(ξ,η) = 0.25 × (1-ξ) × (1-η)
N₂(ξ,η) = 0.25 × (1+ξ) × (1-η)
N₃(ξ,η) = 0.25 × (1+ξ) × (1+η)
N₄(ξ,η) = 0.25 × (1-ξ) × (1+η)
```

**性质：**
- 在节点i处：Nᵢ = 1，其他节点 Nⱼ = 0
- 满足单位分解：∑Nᵢ = 1

**代码实现：**
```typescript
function shapeFunctions(xi: number, eta: number): number[] {
  return [
    0.25 * (1 - xi) * (1 - eta),  // N1
    0.25 * (1 + xi) * (1 - eta),  // N2
    0.25 * (1 + xi) * (1 + eta),  // N3
    0.25 * (1 - xi) * (1 + eta),  // N4
  ];
}
```

### 2.3 形函数导数

**对自然坐标的导数：**
```
∂N₁/∂ξ = -0.25(1-η)    ∂N₁/∂η = -0.25(1-ξ)
∂N₂/∂ξ =  0.25(1-η)    ∂N₂/∂η = -0.25(1+ξ)
∂N₃/∂ξ =  0.25(1+η)    ∂N₃/∂η =  0.25(1+ξ)
∂N₄/∂ξ = -0.25(1+η)    ∂N₄/∂η =  0.25(1-ξ)
```

---

## 3. 求解流程

### 3.1 主求解函数

```typescript
function solve(
  mesh: Mesh,
  nodalLoads: NodalLoad[],
  displacementBCs: DisplacementBC[],
  analysisType: 'plane_stress' | 'plane_strain',
  thickness: number
): FEMResult
```

### 3.2 求解步骤

**步骤1：组装全局刚度矩阵 K**
```
K = ∑ Kᵉ  (所有单元刚度矩阵的叠加)
```

**步骤2：组装载荷向量 F**
```
F = [F₁ₓ, F₁ᵧ, F₂ₓ, F₂ᵧ, ..., Fₙₓ, Fₙᵧ]ᵀ
```

**步骤3：应用边界条件**
- 位移边界条件（固定约束）
- 修改刚度矩阵和载荷向量

**步骤4：求解线性方程组**
```
K × U = F
U = K⁻¹ × F
```

**步骤5：计算节点位移**
```
U = [u₁, v₁, u₂, v₂, ..., uₙ, vₙ]ᵀ
```

**步骤6：计算单元应力应变**
- 应变：ε = B × uᵉ
- 应力：σ = D × ε（线性）或本构模型（非线性）

---

## 4. 本构模型

### 4.1 支持的本构模型

| 模型 | 类型 | 适用材料 | 特点 |
|------|------|---------|------|
| Linear | 线弹性 | 所有材料 | σ = E × ε |
| Hognestad | 非线性 | 混凝土 | 抛物线上升+线性下降 |
| GB 50010 | 非线性 | 混凝土 | 中国规范，三次多项式 |
| Damage | 非线性 | 混凝土 | 损伤力学模型 |
| Mander | 非线性 | 约束混凝土 | 考虑约束效应 |
| Eurocode | 非线性 | 混凝土 | 欧洲规范 |

### 4.2 Hognestad 抛物线本构

**公式：**
```
上升段 (ε ≤ ε₀):
  σ = fc × [2(ε/ε₀) - (ε/ε₀)²]

下降段 (ε > ε₀):
  σ = fc × max(0.2, 1 - 0.5(ε-ε₀)/ε₀)
```

**代码实现：**
```typescript
function hognestadStress(strain: number, fc: number, epsilon0: number): number {
  if (strain <= 0) return 0;
  if (strain <= epsilon0) {
    const ratio = strain / epsilon0;
    return fc * (2 * ratio - ratio * ratio);
  }
  return fc * Math.max(0.2, 1 - 0.5 * (strain - epsilon0) / epsilon0);
}
```

### 4.3 GB 50010-2010 中国规范本构

**公式：**
```
上升段 (x ≤ 1):
  σ = fc × [αₐ·x + (3-2αₐ)x² + (αₐ-2)x³]
  其中 x = ε/ε₀
  αₐ = 2.4 - 0.0125×fc

下降段 (x > 1):
  σ = fc / [αd·(x-1)² + x]
  αd = 0.157×fc^0.785 - 0.905
```

**代码实现：**
```typescript
function gb50010Stress(strain: number, fc: number, epsilon0: number): number {
  if (strain <= 0) return 0;
  
  const alphaA = Math.max(0.7, Math.min(2.4, 2.4 - 0.0125 * fc));
  const alphaD = Math.max(0.1, 0.157 * Math.pow(fc, 0.785) - 0.905);
  const x = strain / epsilon0;
  
  if (x <= 1) {
    return fc * (alphaA * x + (3 - 2 * alphaA) * x * x + (alphaA - 2) * x * x * x);
  } else {
    return fc / (alphaD * (x - 1) * (x - 1) + x);
  }
}
```

### 4.4 损伤本构模型

**公式：**
```
σ = (1 - d) × E × ε

损伤变量 d:
  上升段: d = 1 - σ_envelope / (E×ε)
  下降段: d = 1 - fc/(E×ε) × exp(-0.5×(ε-ε₀)/ε₀)
```

**特点：**
- 考虑刚度退化
- 损伤变量 0 ≤ d < 1
- 包络线使用 Hognestad 模型

### 4.5 Mander 约束混凝土本构

**公式：**
```
σ = fcc × xr / (r - 1 + x^r)

其中:
  x = ε/εcc
  r = Ec/(Ec - Esec)
  Esec = fcc/εcc
```

### 4.6 Eurocode 2 本构

**公式：**
```
σ = fcm × [kη - η²] / [1 + (k-2)η]

其中:
  η = ε/εc1
  k = 1.05 × Ecm × εc1 / fcm
```

---

## 5. 刚度矩阵组装

### 5.1 单元刚度矩阵

**公式：**
```
Kᵉ = ∫∫ Bᵀ × D × B × |J| dξ dη
```

**维度：**
- Kᵉ: 8×8 矩阵（4个节点，每节点2个自由度）

### 5.2 雅可比矩阵 (Jacobian Matrix)

**定义：**
```
J = [∂x/∂ξ   ∂y/∂ξ ]
    [∂x/∂η   ∂y/∂η ]

计算：
∂x/∂ξ = ∑ (∂Nᵢ/∂ξ) × xᵢ
∂y/∂ξ = ∑ (∂Nᵢ/∂ξ) × yᵢ
∂x/∂η = ∑ (∂Nᵢ/∂η) × xᵢ
∂y/∂η = ∑ (∂Nᵢ/∂η) × yᵢ
```

**雅可比行列式：**
```
|J| = ∂x/∂ξ × ∂y/∂η - ∂x/∂η × ∂y/∂ξ
```

**逆矩阵：**
```
J⁻¹ = 1/|J| × [ ∂y/∂η   -∂y/∂ξ]
              [-∂x/∂η    ∂x/∂ξ]
```

### 5.3 B 矩阵（应变-位移矩阵）

**定义：**
```
ε = B × uᵉ

其中 ε = [εₓ, εᵧ, γₓᵧ]ᵀ
     uᵉ = [u₁, v₁, u₂, v₂, u₃, v₃, u₄, v₄]ᵀ
```

**B 矩阵结构（3×8）：**
```
B = [∂N₁/∂x    0      ∂N₂/∂x    0      ∂N₃/∂x    0      ∂N₄/∂x    0    ]
    [   0    ∂N₁/∂y     0    ∂N₂/∂y     0    ∂N₃/∂y     0    ∂N₄/∂y]
    [∂N₁/∂y  ∂N₁/∂x  ∂N₂/∂y  ∂N₂/∂x  ∂N₃/∂y  ∂N₃/∂x  ∂N₄/∂y  ∂N₄/∂x]
```

**形函数对物理坐标的导数：**
```
[∂Nᵢ/∂x]   = J⁻¹ × [∂Nᵢ/∂ξ]
[∂Nᵢ/∂y]          [∂Nᵢ/∂η]
```

**代码实现：**
```typescript
function computeBMatrix(
  dNdXi: number[], 
  dNdEta: number[], 
  invJ: number[][]
): number[][] {
  const B: number[][] = Array(3).fill(null).map(() => Array(8).fill(0));
  
  for (let i = 0; i < 4; i++) {
    const dNdx = invJ[0][0] * dNdXi[i] + invJ[0][1] * dNdEta[i];
    const dNdy = invJ[1][0] * dNdXi[i] + invJ[1][1] * dNdEta[i];
    
    B[0][2*i]     = dNdx;  // εₓ = ∂u/∂x
    B[1][2*i + 1] = dNdy;  // εᵧ = ∂v/∂y
    B[2][2*i]     = dNdy;  // γₓᵧ = ∂u/∂y + ∂v/∂x
    B[2][2*i + 1] = dNdx;
  }
  
  return B;
}
```

### 5.4 D 矩阵（弹性矩阵）

**平面应力 (Plane Stress)：**
```
D = E/(1-ν²) × [1    ν    0        ]
                [ν    1    0        ]
                [0    0    (1-ν)/2  ]
```

**平面应变 (Plane Strain)：**
```
D = E/[(1+ν)(1-2ν)] × [(1-ν)    ν      0          ]
                       [  ν    (1-ν)    0          ]
                       [  0      0    (1-2ν)/2    ]
```

**非线性本构的切线模量：**
```
对于非线性材料，使用切线模量 Et 替代 E

Et = dσ/dε ≈ (σ(ε+Δε) - σ(ε)) / Δε
```

**代码实现：**
```typescript
function computeDMatrix(
  material: Material, 
  analysisType: AnalysisType,
  strain?: number
): number[][] {
  // 如果提供了应变，使用切线模量
  const E = strain !== undefined 
    ? computeTangentModulus(material, Math.abs(strain))
    : material.E;
  const nu = material.nu;
  
  if (analysisType === 'plane_stress') {
    const factor = E / (1 - nu * nu);
    return [
      [factor,        factor * nu,   0],
      [factor * nu,   factor,        0],
      [0,             0,             factor * (1 - nu) / 2],
    ];
  } else {
    // plane_strain
    const factor = E / ((1 + nu) * (1 - 2 * nu));
    return [
      [factor * (1 - nu),  factor * nu,        0],
      [factor * nu,        factor * (1 - nu),  0],
      [0,                  0,                  factor * (1 - 2 * nu) / 2],
    ];
  }
}
```

### 5.5 高斯积分

**2×2 高斯积分点：**
```
点1: (ξ₁, η₁) = (-1/√3, -1/√3), w₁ = 1
点2: (ξ₂, η₂) = ( 1/√3, -1/√3), w₂ = 1
点3: (ξ₃, η₃) = ( 1/√3,  1/√3), w₃ = 1
点4: (ξ₄, η₄) = (-1/√3,  1/√3), w₄ = 1
```

**积分公式：**
```
∫∫ f(ξ,η) dξ dη ≈ ∑ wᵢ × f(ξᵢ, ηᵢ)
```

**单元刚度矩阵计算：**
```typescript
for (const gp of GAUSS_POINTS) {
  const { xi, eta, w } = gp;
  const { dNdXi, dNdEta } = shapeFunctionDerivatives(xi, eta);
  const { invJ, detJ } = computeJacobian(dNdXi, dNdEta, nodeCoords);
  const B = computeBMatrix(dNdXi, dNdEta, invJ);
  const D = computeDMatrix(material, analysisType);
  
  // Kᵉ += Bᵀ × D × B × |J| × w × t
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      for (let k = 0; k < 3; k++) {
        for (let l = 0; l < 3; l++) {
          Ke[i][j] += B[k][i] * D[k][l] * B[l][j] * detJ * w * thickness;
        }
      }
    }
  }
}
```

---

## 6. 应力应变计算

### 6.1 应变计算

**公式：**
```
ε = B × uᵉ

[εₓ  ]   [B] × [u₁]
[εᵧ  ] =       [v₁]
[γₓᵧ ]         [u₂]
               [v₂]
               [u₃]
               [v₃]
               [u₄]
               [v₄]
```

**代码实现：**
```typescript
// 应变 ε = B × u
const strain = [0, 0, 0];
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 8; j++) {
    strain[i] += B[i][j] * ue[j];
  }
}

const epsilonX = strain[0];  // X方向正应变
const epsilonY = strain[1];  // Y方向正应变
const gammaXY = strain[2];   // 剪应变
```

### 6.2 应力计算

**线弹性材料：**
```
σ = D × ε

[σₓ  ]   [D] × [εₓ  ]
[σᵧ  ] =       [εᵧ  ]
[τₓᵧ ]         [γₓᵧ ]
```

**非线性材料（Hognestad等）：**
```
1. 提取压缩应变：εc = |εᵧ|
2. 计算应力幅值：σc = f(εc)  (使用本构模型)
3. 确定应力符号：σᵧ = -σc (压缩为负)
4. 计算切线模量：Et = dσ/dε
5. 计算横向应力：σₓ = Et/(1-ν²) × (εₓ + ν×εᵧ)
6. 计算剪应力：τₓᵧ = G × γₓᵧ, G = Et/(2(1+ν))
```

**代码实现：**
```typescript
if (material.constitutive === 'hognestad' && material.fc && material.epsilon0) {
  // 非线性本构
  const compressiveStrain = Math.abs(epsilonY);
  const stressMagnitude = computeConstitutiveStress(material, compressiveStrain);
  sigmaY = epsilonY < 0 ? -stressMagnitude : stressMagnitude;
  
  const Et = computeTangentModulus(material, compressiveStrain);
  const nu = material.nu;
  sigmaX = Et / (1 - nu * nu) * (epsilonX + nu * epsilonY);
  
  const G = Et / (2 * (1 + nu));
  tauXY = G * gammaXY;
} else {
  // 线弹性
  const D = computeDMatrix(material, analysisType);
  const stress = matrixMultiply(D, strain);
  sigmaX = stress[0];
  sigmaY = stress[1];
  tauXY = stress[2];
}
```

### 6.3 主应力计算

**公式：**
```
σ_avg = (σₓ + σᵧ) / 2
R = √[(σₓ - σᵧ)²/4 + τₓᵧ²]

σ₁ = σ_avg + R  (最大主应力)
σ₂ = σ_avg - R  (最小主应力)
```

**主应力方向：**
```
θ = 0.5 × arctan(2τₓᵧ / (σₓ - σᵧ))
```

### 6.4 von Mises 等效应力

**公式：**
```
σ_vm = √(σₓ² + σᵧ² - σₓσᵧ + 3τₓᵧ²)
```

**用途：**
- 屈服判据
- 强度评估
- 云图显示

**代码实现：**
```typescript
const vonMises = Math.sqrt(
  sigmaX * sigmaX + sigmaY * sigmaY - sigmaX * sigmaY + 3 * tauXY * tauXY
);
```

---

## 7. 边界条件处理

### 7.1 位移边界条件

**固定约束：**
```
节点 i 的 X 方向固定: uᵢ = 0
节点 i 的 Y 方向固定: vᵢ = 0
```

**实现方法（罚函数法）：**
```
对于固定自由度 i:
  Kᵢᵢ = Kᵢᵢ × 10¹⁵  (大数)
  Fᵢ = 0
```

**代码实现：**
```typescript
function applyBoundaryConditions(
  K: number[][],
  F: number[],
  mesh: Mesh,
  displacementBCs: DisplacementBC[]
) {
  const penalty = 1e15;
  
  for (const node of mesh.nodes) {
    if (node.fixedX) {
      const dof = node.id * 2;
      K[dof][dof] *= penalty;
      F[dof] = 0;
    }
    if (node.fixedY) {
      const dof = node.id * 2 + 1;
      K[dof][dof] *= penalty;
      F[dof] = 0;
    }
  }
}
```

### 7.2 力边界条件

**节点力：**
```
Fᵢₓ = 施加的X方向力 (N)
Fᵢᵧ = 施加的Y方向力 (N)
```

**均布压力转换为节点力：**
```
对于顶部边界施加压力 p (MPa):
  每个顶部节点的力 = p × 单元宽度 / 2
```

**代码实现：**
```typescript
// 顶部施加均布压力
const topNodes = getTopNodeIds(mesh);
const totalWidth = specimenWidth;
const forcePerNode = (appliedStress * totalWidth) / topNodes.length;

const nodalLoads: NodalLoad[] = topNodes.map(nodeId => ({
  nodeId,
  fy: forcePerNode, // N (负值=压缩)
}));
```

---

## 8. 线性方程组求解

### 8.1 方程组形式

```
K × U = F

其中:
  K: n×n 全局刚度矩阵 (n = 节点数 × 2)
  U: n×1 位移向量
  F: n×1 载荷向量
```

### 8.2 求解方法

**当前实现：高斯消元法（LU分解）**

**步骤：**
1. 前向消元：将 K 转换为上三角矩阵
2. 回代求解：从下往上求解 U

**代码实现：**
```typescript
function solveLinearSystem(K: number[][], F: number[]): number[] {
  const n = F.length;
  const U = new Array(n).fill(0);
  
  // 前向消元
  for (let k = 0; k < n - 1; k++) {
    for (let i = k + 1; i < n; i++) {
      const factor = K[i][k] / K[k][k];
      for (let j = k; j < n; j++) {
        K[i][j] -= factor * K[k][j];
      }
      F[i] -= factor * F[k];
    }
  }
  
  // 回代求解
  for (let i = n - 1; i >= 0; i--) {
    U[i] = F[i];
    for (let j = i + 1; j < n; j++) {
      U[i] -= K[i][j] * U[j];
    }
    U[i] /= K[i][i];
  }
  
  return U;
}
```

**优化方向：**
- 稀疏矩阵存储（CSR格式）
- 共轭梯度法（CG）
- 预条件处理

---

## 9. 结果后处理

### 9.1 节点结果

```typescript
interface NodeResult {
  nodeId: number;
  ux: number;      // X方向位移 (mm)
  uy: number;      // Y方向位移 (mm)
}
```

**位移幅值：**
```
|u| = √(uₓ² + uᵧ²)
```

### 9.2 单元结果

```typescript
interface ElementResult {
  elementId: number;
  sigmaX: number;    // X方向正应力 (MPa)
  sigmaY: number;    // Y方向正应力 (MPa)
  tauXY: number;     // 剪应力 (MPa)
  sigma1: number;    // 最大主应力 (MPa)
  sigma2: number;    // 最小主应力 (MPa)
  vonMises: number;  // von Mises等效应力 (MPa)
  epsilonX: number;  // X方向应变
  epsilonY: number;  // Y方向应变
  gammaXY: number;   // 剪应变
}
```

### 9.3 云图类型

支持的云图类型：
- **位移云图**：Ux, Uy, |U|
- **应力云图**：σₓ, σᵧ, τₓᵧ, σ₁, σ₂, von Mises
- **应变云图**：εₓ, εᵧ, γₓᵧ

---

## 10. 计算流程总结

```
┌─────────────────────────────────────────┐
│ 1. 网格生成                              │
│    - 生成节点坐标                         │
│    - 生成单元连接                         │
│    - 定义材料属性                         │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 2. 单元刚度矩阵计算                       │
│    - 高斯积分点循环                       │
│    - 计算形函数及导数                     │
│    - 计算雅可比矩阵                       │
│    - 计算B矩阵                           │
│    - 计算D矩阵（考虑本构）                │
│    - Kᵉ = ∫ BᵀDBdV                      │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 3. 全局刚度矩阵组装                       │
│    - K = ∑ Kᵉ                           │
│    - 稀疏矩阵存储                         │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 4. 载荷向量组装                          │
│    - 节点力                              │
│    - 压力转换为节点力                     │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 5. 边界条件处理                          │
│    - 位移约束（罚函数法）                 │
│    - 修改K和F                            │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 6. 求解线性方程组                        │
│    - KU = F                             │
│    - 高斯消元/LU分解                     │
│    - 得到位移U                           │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 7. 应力应变计算                          │
│    - ε = B × uᵉ                         │
│    - σ = D × ε (线性)                   │
│    - σ = f(ε) (非线性本构)               │
│    - 计算主应力、von Mises               │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ 8. 结果输出                              │
│    - 节点位移                            │
│    - 单元应力应变                         │
│    - 云图可视化                          │
└─────────────────────────────────────────┘
```

---

## 11. 理论基础

### 11.1 虚功原理

```
δW_internal = δW_external

∫∫∫ σᵀδε dV = ∫∫ tᵀδu dS + ∫∫∫ bᵀδu dV
```

### 11.2 有限元离散

```
u(x,y) = N(x,y) × uᵉ
ε = B × uᵉ
σ = D × ε
```

### 11.3 单元刚度矩阵推导

```
从虚功原理:
∫∫∫ δεᵀσ dV = ∫∫ δuᵀt dS

代入 ε = B×u, σ = D×ε:
∫∫∫ δuᵀBᵀDB×u dV = ∫∫ δuᵀt dS

得到:
Kᵉ × uᵉ = fᵉ

其中:
Kᵉ = ∫∫∫ BᵀDB dV
```

---

## 12. 参考文献

1. **Zienkiewicz, O.C. & Taylor, R.L.** (2000). *The Finite Element Method* (5th Edition). Butterworth-Heinemann.

2. **Cook, R.D., Malkus, D.S., Plesha, M.E., & Witt, R.J.** (2001). *Concepts and Applications of Finite Element Analysis* (4th Edition). John Wiley & Sons.

3. **Hughes, T.J.R.** (2000). *The Finite Element Method: Linear Static and Dynamic Finite Element Analysis*. Dover Publications.

4. **Bathe, K.J.** (2014). *Finite Element Procedures* (2nd Edition). Prentice Hall.

5. **GB 50010-2010** - 混凝土结构设计规范

6. **Hognestad, E.** (1951). "A Study of Combined Bending and Axial Load in Reinforced Concrete Members". University of Illinois Engineering Experiment Station, Bulletin No. 399.

---

**文档版本：** 1.0  
**编制日期：** 2026年1月  
**适用范围：** Engineering Virtual Lab - FEM模块
