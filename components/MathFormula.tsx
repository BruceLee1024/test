import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathFormulaProps {
  formula: string;
  displayMode?: boolean;
  className?: string;
}

export const MathFormula: React.FC<MathFormulaProps> = ({ 
  formula, 
  displayMode = false,
  className = ''
}) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(formula, containerRef.current, {
          displayMode,
          throwOnError: false,
          trust: true,
          strict: false,
        });
      } catch (e) {
        console.error('KaTeX render error:', e);
        if (containerRef.current) {
          containerRef.current.textContent = formula;
        }
      }
    }
  }, [formula, displayMode]);

  return <span ref={containerRef} className={className} />;
};

// 预定义的公式样式
export const FormulaBlock: React.FC<{ formula: string; className?: string }> = ({ 
  formula, 
  className = '' 
}) => (
  <div className={`bg-slate-900/70 rounded-lg px-4 py-3 overflow-x-auto ${className}`}>
    <MathFormula formula={formula} displayMode={true} />
  </div>
);

export const InlineFormula: React.FC<{ formula: string }> = ({ formula }) => (
  <MathFormula formula={formula} displayMode={false} />
);
