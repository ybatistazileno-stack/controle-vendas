import React from 'react';
import { Edit, Trash2, XCircle, DollarSign } from 'lucide-react';

const formatBRL = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const motivoLabel = (m) => {
  switch (m) {
    case 'aguardando_cartao': return '💳 Aguardando cartão virar';
    case 'pagamento_cliente': return '👤 Aguardando cliente';
    case 'parcelado': return '📅 Pagamento parcelado';
    case 'aprovacao': return '✅ Aguardando aprovação';
    case 'outro': return '🔹 Outro';
    default: return '⏳ Pendência';
  }
};

export const PendenciasTabV5 = ({ vendas, onReceberRestante, onEdit, onCancel, onDelete }) => {
  return (
    <div className="space-y-4">
      {(!vendas || vendas.length === 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center text-slate-500 font-medium">
          Nenhuma pendência 🎉
        </div>
      )}

      {vendas?.map((v) => {
        const pct = (Number.isFinite(v.valor) && v.valor > 0 && Number.isFinite(v.valorEntrada)) ? Math.min(100, Math.max(0, (v.valorEntrada / v.valor) * 100)) : 0;
        return (
          <div key={v.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 text-lg truncate">{v.cliente}</div>
                <div className="text-sm text-slate-500 whitespace-pre-line line-clamp-2 mt-0.5">{v.produtos || '—'}</div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-xs font-bold px-3 py-1 rounded-full border bg-amber-100 text-amber-700 border-amber-200">
                  Pendente
                </span>
                <div className="text-right mt-2">
                  <div className="text-xs text-slate-500">Restante</div>
                  <div className="font-semibold text-amber-600">{formatBRL(v.restante)}</div>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{new Date(v.data + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
              </div>
            </div>

            <div className="mt-4 bg-amber-50/80 border border-amber-100 rounded-xl p-4">
              <div className="flex justify-between text-sm font-semibold text-slate-700">
                <span>Entrada: {formatBRL(v.valorEntrada)}</span>
                <span>Total: {formatBRL(v.valor)}</span>
              </div>
              <div className="mt-2 w-full bg-amber-200/60 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 text-xs text-slate-600">
                {motivoLabel(v.motivoPendencia)}{v.textoMotivo ? ` • ${v.textoMotivo}` : ''}
                {v.previsaoPagamento ? ` • Prev.: ${new Date(v.previsaoPagamento + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => onReceberRestante?.(v)}
                className="flex-1 min-w-[100px] bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
              >
                <DollarSign size={18} /> Receber
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
