import React from 'react';
import { Edit, Trash2, XCircle, PackageCheck } from 'lucide-react';

const formatBRL = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const daysDiff = (iso) => {
  const d = new Date(iso + 'T00:00:00').getTime();
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((d - today.getTime()) / (1000 * 60 * 60 * 24));
};

export const EntregasTabV5 = ({ vendas, onMarcarEntregue, onEdit, onCancel, onDelete }) => {
  return (
    <div className="space-y-4">
      {(!vendas || vendas.length === 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center text-slate-500 font-medium">
          Nenhuma entrega futura
        </div>
      )}

      {vendas?.map((v) => {
        const label = v.tipoEntrega === 'Agendada' && v.dataEntrega ? `📅 ${new Date(v.dataEntrega + 'T00:00:00').toLocaleDateString('pt-BR')}` : '🏭 Produção / Futura';
        const d = (v.tipoEntrega === 'Agendada' && v.dataEntrega) ? daysDiff(v.dataEntrega) : null;
        const urgencyBox = d !== null
          ? (d < 0 ? 'bg-red-50 border-red-200 text-red-800' : d <= 7 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800')
          : 'bg-blue-50 border-blue-200 text-blue-800';

        return (
          <div key={v.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 text-lg truncate">{v.cliente}</div>
                <div className="text-sm text-slate-500 whitespace-pre-line line-clamp-2 mt-0.5">{v.produtos || '—'}</div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-xs font-bold px-3 py-1 rounded-full border bg-blue-100 text-blue-700 border-blue-200">
                  Entrega
                </span>
                <div className="text-right mt-2">
                  <div className="text-xs text-slate-500">Total</div>
                  <div className="font-semibold text-slate-800">{formatBRL(v.valor)}</div>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{new Date(v.data + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
              </div>
            </div>

            <div className={`mt-4 rounded-xl border p-4 text-sm font-semibold ${urgencyBox}`}>
              <div className="flex justify-between items-center">
                <span>{label}</span>
                {d !== null && <span className="text-xs font-bold">{d < 0 ? `Atrasada ${Math.abs(d)}d` : `${d}d`}</span>}
              </div>
              {v.motivoEntrega && <div className="text-xs font-medium opacity-90 mt-2">Motivo: {v.motivoEntrega}</div>}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => onMarcarEntregue?.(v)}
                className="flex-1 min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
              >
                <PackageCheck size={18} /> Marcar entregue
              </button>
              <button
                onClick={() => onEdit?.(v)}
                className="p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
                title="Editar"
              >
                <Edit size={18} />
              </button>
              <button
                onClick={() => onCancel?.(v)}
                className="p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-all"
                title="Cancelar"
              >
                <XCircle size={18} />
              </button>
              <button
                onClick={() => onDelete?.(v.id)}
                className="p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-red-600 hover:bg-red-50 hover:border-red-200 transition-all"
                title="Apagar"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
