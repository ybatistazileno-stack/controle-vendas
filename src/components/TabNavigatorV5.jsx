import React from 'react';

const TabBtn = ({ active, onClick, label, count }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'flex-1 py-2.5 px-4 rounded-full text-sm font-bold transition-all duration-200',
      active
        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 border-2 border-blue-600'
        : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-sm',
    ].join(' ')}
  >
    <div className="flex items-center justify-center gap-2">
      <span>{label}</span>
      <span
        className={
          active
            ? 'bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold'
            : 'bg-slate-100 px-2 py-0.5 rounded-full text-xs text-slate-500'
        }
      >
        {count}
      </span>
    </div>
  </button>
);

export const TabNavigatorV5 = ({ activeTab, onChange, counts }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex gap-2">
      <TabBtn
        active={activeTab === 'vendas'}
        onClick={() => onChange('vendas')}
        label="Vendas"
        count={counts?.vendas ?? 0}
      />
      <TabBtn
        active={activeTab === 'pendencias'}
        onClick={() => onChange('pendencias')}
        label="Pendências"
        count={counts?.pendencias ?? 0}
      />
      <TabBtn
        active={activeTab === 'entregas'}
        onClick={() => onChange('entregas')}
        label="Entregas"
        count={counts?.entregas ?? 0}
      />
    </div>
  );
};
