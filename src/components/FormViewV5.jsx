import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';

// Form separado do App para evitar remontagem a cada digitação (bug de perder foco)
// e para permitir uma barra de ações fixa premium (botão confirmar nunca escondido).

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function FormViewV5({
  editingId,
  formData,
  setFormData,
  onSubmit,
  onCancel,
  onTipoEntregaChange,
  descontoOptions,
  pagamentoOptions,
  motivoPendenciaOptions,
  formatBRL,
  toMoney,
}) {
  const valorSeguro = Number(formData.valor) || 0;

  // Desconto: % ou R$
  const descontoValor = useMemo(() => {
    const descReais = toMoney(formData.descontoValorReais);
    if (Number.isFinite(descReais) && descReais > 0) return Math.min(descReais, valorSeguro);
    if (formData.descontoAplicado === '10%') return round2(valorSeguro * 0.1);
    if (formData.descontoAplicado === '15%') return round2(valorSeguro * 0.15);
    return 0;
  }, [valorSeguro, formData.descontoAplicado, formData.descontoValorReais, toMoney]);

  const totalAReceber = round2(Math.max(0, valorSeguro - descontoValor));

  const totalPago = useMemo(() => {
    if (formData.modoPagamento === 'unico') {
      const v = toMoney(formData.valorEntrada);
      if (formData.valorEntrada === null || formData.valorEntrada === undefined || String(formData.valorEntrada).trim() === '') return totalAReceber;
      return Number.isNaN(v) || v < 0 ? totalAReceber : Math.min(v, totalAReceber);
    }
    let sum = 0;
    for (const p of formData.paymentParts || []) {
      const a = toMoney(p.amount);
      if (Number.isFinite(a) && a > 0) sum += a;
    }
    return round2(sum);
  }, [formData.modoPagamento, formData.valorEntrada, formData.paymentParts, totalAReceber, toMoney]);

  const faltaPagar = round2(Math.max(0, totalAReceber - totalPago));
  const totalPagoExcede = formData.modoPagamento === 'dividido' && totalPago > totalAReceber;

  const comissaoEstimada = useMemo(() => {
    const p = Number(formData.percentual) || 0;
    return valorSeguro * (p / 100);
  }, [valorSeguro, formData.percentual]);

  const update = (patch) => setFormData((prev) => ({ ...prev, ...patch }));

  const setPaymentPart = (index, field, value) => {
    setFormData((prev) => {
      const parts = [...(prev.paymentParts || [{ method: 'Pix • QR Code', amount: '' })];
      if (!parts[index]) return prev;
      parts[index] = { ...parts[index], [field]: value };
      return { ...prev, paymentParts: parts };
    });
  };

  const addPaymentPart = () => {
    setFormData((prev) => ({
      ...prev,
      paymentParts: [...(prev.paymentParts || []), { method: 'Pix • QR Code', amount: '' }],
    }));
  };

  const removePaymentPart = (index) => {
    setFormData((prev) => {
      const parts = (prev.paymentParts || []).filter((_, i) => i !== index);
      if (parts.length === 0) parts.push({ method: 'Pix • QR Code', amount: '' });
      return { ...prev, paymentParts: parts };
    });
  };

  return (
    <div className="py-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 sm:p-6 border-b bg-gradient-to-b from-slate-50 to-white">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {editingId ? 'Editar Venda' : 'Nova Venda'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">Preencha os dados com segurança. O botão confirmar fica sempre visível.</p>
          </div>

          {/* Conteúdo do formulário: padding bottom grande para não ficar atrás da action bar fixa */}
          <form id="saleForm" onSubmit={onSubmit} className="p-5 sm:p-6 space-y-5 pb-48">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700">Data</label>
                <input
                  type="date"
                  className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  value={formData.data}
                  onChange={(e) => update({ data: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Cliente</label>
                <input
                  type="text"
                  className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Nome do cliente"
                  value={formData.cliente}
                  onChange={(e) => update({ cliente: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">Produtos / Descrição</label>
              <textarea
                className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                rows={3}
                placeholder="Ex: Colchão Queen + box..."
                value={formData.produtos}
                onChange={(e) => update({ produtos: e.target.value })}
              />
            </div>

            {/* A) Valores: valor vendido, tabela, desconto, total a receber */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Valores</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700">Valor vendido (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={formData.valor}
                    onChange={(e) => update({ valor: e.target.value })}
                    placeholder="0,00"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Valor de tabela (ref.)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={formData.valorTabela}
                    onChange={(e) => update({ valorTabela: e.target.value })}
                    placeholder="Referência"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700">Desconto aplicado</label>
                  <select
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={formData.descontoAplicado}
                    onChange={(e) => update({ descontoAplicado: e.target.value })}
                  >
                    {descontoOptions.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Desconto em R$ (opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={formData.descontoValorReais}
                    onChange={(e) => update({ descontoValorReais: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total a receber</span>
                <span className="text-xl font-bold text-slate-900">{formatBRL(totalAReceber)}</span>
              </div>
            </div>

            {/* B) Pagamento: Único ou Dividido */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Pagamento</h3>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => update({ modoPagamento: 'unico' })}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition ${formData.modoPagamento === 'unico' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  Único
                </button>
                <button
                  type="button"
                  onClick={() => update({ modoPagamento: 'dividido' })}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition ${formData.modoPagamento === 'dividido' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  Dividido
                </button>
              </div>

              {formData.modoPagamento === 'unico' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Forma de pagamento</label>
                    <select
                      className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      value={formData.pagamentoDetalhe}
                      onChange={(e) => update({ pagamentoDetalhe: e.target.value })}
                    >
                      {pagamentoOptions.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Valor pago agora</label>
                    <input
                      type="number"
                      step="0.01"
                      className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      value={formData.valorEntrada}
                      onChange={(e) => update({ valorEntrada: e.target.value })}
                      placeholder={totalAReceber ? `Padrão: ${formatBRL(totalAReceber)}` : 'Total'}
                    />
                    <p className="text-xs text-slate-500 mt-1">Vazio = pago total. Menor que o total gera pendência.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {(formData.paymentParts || []).map((part, index) => (
                    <div key={index} className="flex flex-wrap items-end gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex-1 min-w-[120px]">
                        <label className="text-xs font-bold text-slate-600">Forma</label>
                        <select
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
                          value={part.method}
                          onChange={(e) => setPaymentPart(index, 'method', e.target.value)}
                        >
                          {pagamentoOptions.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[100px]">
                        <label className="text-xs font-bold text-slate-600">Valor (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
                          value={part.amount}
                          onChange={(e) => setPaymentPart(index, 'amount', e.target.value)}
                          placeholder="0,00"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removePaymentPart(index)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200"
                        title="Remover"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addPaymentPart}
                    className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-600 font-bold text-sm hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 transition flex items-center justify-center gap-2"
                  >
                    <Plus size={18} /> Adicionar forma de pagamento
                  </button>
                  <div className="flex justify-between text-sm pt-2">
                    <span className="font-semibold text-slate-600">Total pago:</span>
                    <span className="font-bold text-slate-900">{formatBRL(totalPago)}</span>
                  </div>
                  {totalPagoExcede && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-sm font-bold">
                      Total pago não pode exceder o total a receber. Ajuste os valores.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* C) Pendência: só se restante > 0 */}
            {faltaPagar > 0 && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800">Pendência</h3>
                  <span className="px-4 py-2 rounded-full bg-amber-200/80 text-amber-900 font-bold text-lg">
                    {formatBRL(faltaPagar)}
                  </span>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Motivo da pendência</label>
                  <select
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                    value={formData.motivoPendencia}
                    onChange={(e) => update({ motivoPendencia: e.target.value })}
                  >
                    {motivoPendenciaOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {formData.motivoPendencia === 'outro' && (
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                    placeholder="Descreva o motivo..."
                    value={formData.textoMotivo}
                    onChange={(e) => update({ textoMotivo: e.target.value })}
                  />
                )}
                <div>
                  <label className="text-xs font-bold text-slate-700">Previsão de pagamento</label>
                  <input
                    type="date"
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                    value={formData.previsaoPagamento}
                    onChange={(e) => update({ previsaoPagamento: e.target.value })}
                  />
                </div>
              </div>
            )}

            {faltaPagar <= 0 && totalAReceber > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-sm font-bold flex items-center justify-between">
                <span>Totalmente pago</span>
                <span>✅</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700">Comissão</label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {[3, 4, 5, 6].map((n) => {
                    const selected = String(formData.percentual) === String(n);
                    return (
                      <button
                        type="button"
                        key={n}
                        onClick={() => update({ percentual: String(n) })}
                        className={
                          "h-11 rounded-xl border text-sm font-extrabold transition " +
                          (selected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50')
                        }
                      >
                        {n}%
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Entrega</label>
                <select
                  className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  value={formData.tipoEntrega}
                  onChange={(e) => onTipoEntregaChange(e.target.value)}
                >
                  <option value="Imediata">📦 Imediata</option>
                  <option value="Agendada">📅 Agendada</option>
                  <option value="Futura">🏭 Futura (produção)</option>
                </select>
              </div>

              {formData.tipoEntrega === 'Agendada' && (
                <div>
                  <label className="text-xs font-bold text-slate-700">Data da entrega</label>
                  <input
                    type="date"
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={formData.dataEntrega}
                    onChange={(e) => update({ dataEntrega: e.target.value })}
                    required
                  />
                </div>
              )}

              {formData.tipoEntrega === 'Futura' && (
                <div>
                  <label className="text-xs font-bold text-slate-700">Motivo (produção / espera)</label>
                  <input
                    type="text"
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={formData.motivoEntrega}
                    onChange={(e) => update({ motivoEntrega: e.target.value })}
                    placeholder="Ex: Produção na fábrica / Cliente aguardando obra"
                  />
                </div>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex justify-between items-center">
              <div>
                <div className="text-xs text-slate-500">Comissão prevista</div>
                <div className="text-2xl font-extrabold text-emerald-700">{formatBRL(comissaoEstimada)}</div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Action Bar fixa premium */}
      <div className="fixed left-0 right-0 bottom-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white/95 backdrop-blur border border-slate-200 shadow-2xl rounded-2xl mb-4 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="sm:w-48 h-12 rounded-xl border border-slate-200 bg-white font-extrabold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="saleForm"
                className="flex-1 h-12 rounded-xl bg-blue-600 text-white font-extrabold text-base shadow-lg hover:bg-blue-700 active:scale-[0.99] transition"
              >
                {editingId ? 'Salvar alterações' : 'Confirmar venda'}
              </button>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex justify-between">
              <span>Total a receber: <span className="font-semibold text-slate-700">{formatBRL(totalAReceber)}</span></span>
              <span>Restante: <span className="font-semibold text-slate-700">{formatBRL(faltaPagar)}</span></span>
            </div>
          </div>
        </div>
        <div className="h-[env(safe-area-inset-bottom)] bg-transparent" />
      </div>
    </div>
  );
}
