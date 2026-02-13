import React from 'react';
import { TrendingUp, Wallet, Tag, Target } from 'lucide-react';

const formatBRL = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const KPICardsV5 = ({ metricas, goal, onChangeGoal }) => {
  const vendido = metricas?.vendidoMes ?? 0;
  const pendencias = metricas?.pendenciasValor ?? 0;
  const comissao = metricas?.comissaoMes ?? 0;
  const descontos = metricas?.descontosMes ?? 0;
  const qtd = metricas?.contagemMes ?? 0;

  const meta = Number(goal) || 0;
  const falta = meta > 0 ? Math.max(0, meta - vendido) : 0;
  const percent = meta > 0 ? Math.min(100, (vendido / meta) * 100) : 0;
  const inputValue = goal !== undefined && goal !== null && goal !== '' ? String(goal) : '';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Vendido */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg bg-green-50">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-sm text-gray-500">Vendido no mês</p>
          <p className="text-2xl font-bold text-gray-900">{formatBRL(vendido)}</p>
          <p className="text-xs text-gray-500 mt-1">{qtd} venda(s)</p>
        </div>
      </div>

      {/* Meta */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg bg-blue-50">
            <Target className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-sm text-gray-500">Falta para meta</p>
          <p className="text-2xl font-bold text-gray-900">{formatBRL(falta)}</p>

          <div className="mt-3">
            <label className="text-xs text-gray-500">Editar meta</label>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              inputMode="numeric"
              type="text"
              value={inputValue}
              onChange={(e) => onChangeGoal?.(e.target.value)}
              placeholder="10000"
            />
            <div className="mt-2">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-2 bg-blue-600" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">{Math.round(percent)}% concluído</p>
            </div>
          </div>
        </div>
      </div>

      {/* Comissão */}
      <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl shadow-sm border border-purple-500/20 p-4 text-white">
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg bg-white/15">
            <Wallet className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-sm text-white/80">Comissão do mês</p>
          <p className="text-2xl font-bold">{formatBRL(comissao)}</p>
          <p className="text-xs text-white/70 mt-1">
            {metricas?.comissoesPorPerc
              ? Object.entries(metricas.comissoesPorPerc)
                  .filter(([, v]) => (v || 0) > 0)
                  .map(([k, v]) => `${k}: ${formatBRL(v)}`)
                  .join(' • ')
              : ''}
          </p>
        </div>
      </div>

      {/* Descontos / Pendências */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg bg-amber-50">
            <Tag className="w-5 h-5 text-amber-600" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-sm text-gray-500">Total em descontos</p>
          <p className="text-2xl font-bold text-gray-900">{formatBRL(descontos)}</p>
          <p className="text-xs text-gray-500 mt-2">Valor em pendências</p>
          <p className="text-sm font-semibold text-gray-800">{formatBRL(pendencias)}</p>
        </div>
      </div>
    </div>
  );
};
