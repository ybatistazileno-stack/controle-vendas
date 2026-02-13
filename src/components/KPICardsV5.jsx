import React from 'react';
import { TrendingUp, Wallet, Tag, Target } from 'lucide-react';

const formatBRL = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const KPICardsV5 = ({ metricas, goalInput, onChangeGoal }) => {
  const vendido = metricas?.vendidoMes ?? 0;
  const pendencias = metricas?.pendenciasValor ?? 0;
  const comissao = metricas?.comissaoMes ?? 0;
  const descontos = metricas?.descontosMes ?? 0;
  const qtd = metricas?.contagemMes ?? 0;

  const meta = Number(String(goalInput || '').replace(/[^0-9]/g, '')) || 0;
  const falta = meta > 0 ? Math.max(0, meta - vendido) : 0;
  const percent = meta > 0 ? Math.min(100, (vendido / meta) * 100) : 0;

  const cardBase = 'bg-white rounded-2xl border border-slate-200 shadow-sm p-6';
  const labelClass = 'text-xs uppercase tracking-wider text-slate-500 font-semibold';
  const valueClass = 'text-2xl font-bold text-slate-900 mt-1';
  const iconCircle = 'w-10 h-10 rounded-full flex items-center justify-center';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vendido */}
        <div className={cardBase}>
          <div className={`${iconCircle} bg-emerald-100 text-emerald-600`}>
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className={labelClass}>Vendido no mês</p>
          <p className={valueClass}>{formatBRL(vendido)}</p>
          <p className="text-xs text-slate-500 mt-1">{qtd} venda(s)</p>
        </div>

        {/* Meta */}
        <div className={cardBase}>
          <div className={`${iconCircle} bg-blue-100 text-blue-600`}>
            <Target className="w-5 h-5" />
          </div>
          <p className={labelClass}>Falta para meta</p>
          <p className={valueClass}>{formatBRL(falta)}</p>
          <div className="mt-4">
            <label className="text-xs text-slate-500 font-medium">Editar meta</label>
            <input
              className="mt-1 w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              inputMode="numeric"
              value={goalInput ?? ''}
              onChange={(e) => onChangeGoal?.(e.target.value)}
              placeholder="10000"
            />
            <div className="mt-2">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-1">{Math.round(percent)}% concluído</p>
            </div>
          </div>
        </div>

        {/* Comissão - destaque */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl border border-indigo-500/20 shadow-md shadow-indigo-900/10 p-6 text-white">
          <div className={`${iconCircle} bg-white/20 text-white`}>
            <Wallet className="w-5 h-5" />
          </div>
          <p className="text-xs uppercase tracking-wider text-white/80 font-semibold mt-2">Comissão do mês</p>
          <p className="text-2xl font-bold text-white mt-1">{formatBRL(comissao)}</p>
          <p className="text-xs text-white/70 mt-2">
            {metricas?.comissoesPorPerc
              ? Object.entries(metricas.comissoesPorPerc)
                  .filter(([, v]) => (v || 0) > 0)
                  .map(([k, v]) => `${k}: ${formatBRL(v)}`)
                  .join(' • ')
              : '—'}
          </p>
        </div>

        {/* Descontos / Pendências */}
        <div className={cardBase}>
          <div className={`${iconCircle} bg-amber-100 text-amber-600`}>
            <Tag className="w-5 h-5" />
          </div>
          <p className={labelClass}>Total em descontos</p>
          <p className={valueClass}>{formatBRL(descontos)}</p>
          <p className="text-xs text-slate-500 mt-2">Valor em pendências</p>
          <p className="text-sm font-semibold text-slate-800">{formatBRL(pendencias)}</p>
        </div>
      </div>
  );
};
