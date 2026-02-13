import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { addVenda, getVendas, deleteVenda, updateVenda, addVendasBatch } from './db';
import { verificarMigracao } from './utils/migration-v5';
import { useSalesMetricsV5 } from './hooks/useSalesMetricsV5';
import { KPICardsV5 } from './components/KPICardsV5';
import { TabNavigatorV5 } from './components/TabNavigatorV5';
import { PendenciasTabV5 } from './components/PendenciasTabV5';
import { EntregasTabV5 } from './components/EntregasTabV5';
import { Toast } from './components/Toast';
import { ConfirmModal } from './components/ConfirmModal';
import { Trash2, Edit, Plus, List, BarChart, Filter, Save, X, Loader2 } from 'lucide-react';

// --- UTILITÁRIOS ---
const formatBRL = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const toMoney = (val) => {
  if (val === null || val === undefined) return NaN;
  if (String(val).trim() === '') return NaN;
  const n = Number(val);
  return Number.isFinite(n) ? n : NaN;
};

const getLocalToday = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalMonthKey = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

const descontoOptions = ['Sem desconto', 'Preço de tabela', 'Acima da tabela', '10%', '15%'];
const pagamentoOptions = ['Pix • QR Code', 'Pix • CNPJ', 'Crédito (1x)', 'Crédito (2x)', 'Crédito (3x)', 'Crédito (4x)', 'Crédito (5x)', 'Crédito (6x)', 'Crédito (7x)', 'Crédito (8x)', 'Crédito (9x)', 'Crédito (10x)', 'Crédito (11x)', 'Crédito (12x)', 'Débito', 'Dinheiro'];

const motivoPendenciaOptions = [
  { value: 'aguardando_cartao', label: '💳 Aguardando cartão virar' },
  { value: 'pagamento_cliente', label: '👤 Aguardando pagamento do cliente' },
  { value: 'parcelado', label: '📅 Pagamento parcelado' },
  { value: 'aprovacao', label: '✅ Aguardando aprovação' },
  { value: 'outro', label: '🔹 Outro' },
];

// --- COMPONENTE DE FORMULÁRIO (EXTRAÍDO PARA EVITAR PERDA DE FOCO) ---
const FormView = ({ formData, setFormData, onSave, onCancel, isSaving, editingId }) => {
  const valorSeguro = Number(formData.valor) || 0;
  const entradaValor = toMoney(formData.valorEntrada);
  const entradaSegura = Number.isNaN(entradaValor) ? valorSeguro : entradaValor;
  const faltaPagar = Math.max(0, valorSeguro - entradaSegura);
  const comissaoEstimada = valorSeguro * (Number(formData.percentual) / 100);

  const handleTipoEntregaChange = (novoTipo) => {
    setFormData((prev) => ({
      ...prev,
      tipoEntrega: novoTipo,
      dataEntrega: novoTipo === 'Agendada' ? prev.dataEntrega : '',
      motivoEntrega: novoTipo === 'Futura' ? prev.motivoEntrega : '',
      deliveryDeadlineDays: novoTipo === 'Futura' ? prev.deliveryDeadlineDays : '',
    }));
  };

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded-2xl shadow-sm border mt-4 pb-48">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-extrabold text-gray-900">{editingId ? 'Editar Venda' : 'Nova Venda'}</h2>
        <button type="button" onClick={onCancel} className="p-2 bg-gray-100 rounded-full text-gray-500">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={onSave} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Data</label>
            <input type="date" className="w-full p-4 border-2 border-gray-100 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold" value={formData.data} onChange={(e) => setFormData((prev) => ({ ...prev, data: e.target.value }))} required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cliente</label>
            <input type="text" className="w-full p-4 border-2 border-gray-100 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold" placeholder="Nome" value={formData.cliente} onChange={(e) => setFormData((prev) => ({ ...prev, cliente: e.target.value }))} required />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Produtos / Descrição</label>
          <textarea className="w-full p-4 border-2 border-gray-100 rounded-2xl focus:border-blue-500 outline-none transition-all font-medium" rows="2" placeholder="O que foi vendido?" value={formData.produtos} onChange={(e) => setFormData((prev) => ({ ...prev, produtos: e.target.value }))} />
        </div>

        <div className="bg-gray-50 rounded-3xl p-5 space-y-5 border border-gray-100">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Valor Vendido</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">R$</span>
                <input type="number" step="0.01" className="w-full p-4 pl-10 border-2 border-white rounded-2xl focus:border-blue-500 outline-none transition-all font-black text-xl text-blue-600" value={formData.valor} onChange={(e) => setFormData((prev) => ({ ...prev, valor: e.target.value }))} placeholder="0,00" required />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Entrada</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">R$</span>
                <input type="number" step="0.01" className="w-full p-4 pl-10 border-2 border-white rounded-2xl focus:border-blue-500 outline-none transition-all font-bold" value={formData.valorEntrada} onChange={(e) => setFormData((prev) => ({ ...prev, valorEntrada: e.target.value }))} placeholder="Total" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Valor Tabela</label>
              <input type="number" step="0.01" className="w-full p-4 border-2 border-white rounded-2xl focus:border-blue-500 outline-none transition-all font-bold" value={formData.valorTabela} onChange={(e) => setFormData((prev) => ({ ...prev, valorTabela: e.target.value }))} placeholder="Ref." />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Desconto</label>
              <select className="w-full p-4 border-2 border-white rounded-2xl focus:border-blue-500 outline-none transition-all font-bold bg-white" value={formData.descontoAplicado} onChange={(e) => setFormData((prev) => ({ ...prev, descontoAplicado: e.target.value }))}>
                {descontoOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {faltaPagar > 0 ? (
            <div className="bg-orange-100/50 border border-orange-200 text-orange-700 p-4 rounded-2xl flex justify-between items-center">
              <span className="text-xs font-black uppercase">Falta Pagar</span>
              <span className="text-lg font-black">{formatBRL(faltaPagar)}</span>
            </div>
          ) : (
            <div className="bg-green-100/50 border border-green-200 text-green-700 p-4 rounded-2xl flex justify-between items-center">
              <span className="text-xs font-black uppercase">Status</span>
              <span className="text-sm font-black">Totalmente Pago ✅</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Comissão</label>
          <div className="grid grid-cols-4 gap-2">
            {[3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, percentual: String(n) }))}
                className={`py-3 rounded-2xl font-black transition-all border-2 ${Number(formData.percentual) === n ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-105' : 'bg-white border-gray-100 text-gray-400 hover:border-blue-200'}`}
              >
                {n}%
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Forma de Pagamento</label>
          <select className="w-full p-4 border-2 border-gray-100 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold bg-white" value={formData.pagamentoDetalhe} onChange={(e) => setFormData((prev) => ({ ...prev, pagamentoDetalhe: e.target.value }))}>
            {pagamentoOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {faltaPagar > 0 && (
          <div className="bg-orange-50/50 border-2 border-orange-100 rounded-3xl p-5 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-orange-600 uppercase tracking-wider">Motivo da Pendência</label>
              <select className="w-full p-4 border-2 border-white rounded-2xl focus:border-orange-300 outline-none transition-all font-bold bg-white" value={formData.motivoPendencia} onChange={(e) => setFormData((prev) => ({ ...prev, motivoPendencia: e.target.value }))}>
                {motivoPendenciaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-orange-600 uppercase tracking-wider">Observação Obrigatória</label>
              <input type="text" className="w-full p-4 border-2 border-white rounded-2xl focus:border-orange-300 outline-none transition-all font-bold" placeholder="Ex: Cliente paga dia 10" value={formData.pendingObservation} onChange={(e) => setFormData((prev) => ({ ...prev, pendingObservation: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-orange-600 uppercase tracking-wider">Previsão de Pagamento</label>
              <input type="date" className="w-full p-4 border-2 border-white rounded-2xl focus:border-orange-300 outline-none transition-all font-bold" value={formData.previsaoPagamento} onChange={(e) => setFormData((prev) => ({ ...prev, previsaoPagamento: e.target.value }))} />
            </div>
          </div>
        )}

        <div className="bg-blue-50/50 border-2 border-blue-100 rounded-3xl p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">Tipo de Entrega</label>
            <select className="w-full p-4 border-2 border-white rounded-2xl focus:border-blue-300 outline-none transition-all font-bold bg-white" value={formData.tipoEntrega} onChange={(e) => handleTipoEntregaChange(e.target.value)}>
              <option value="Imediata">📦 Imediata</option>
              <option value="Agendada">📅 Agendada</option>
              <option value="Futura">🏭 Futura (Produção)</option>
            </select>
          </div>

          {formData.tipoEntrega === 'Agendada' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">Data da Entrega</label>
              <input type="date" className="w-full p-4 border-2 border-white rounded-2xl focus:border-blue-300 outline-none transition-all font-bold" value={formData.dataEntrega} onChange={(e) => setFormData((prev) => ({ ...prev, dataEntrega: e.target.value }))} required />
            </div>
          )}

          {formData.tipoEntrega === 'Futura' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">Prazo de Entrega (Dias)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 20, 30, 35].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, deliveryDeadlineDays: String(d) }))}
                      className={`py-3 rounded-xl font-black transition-all border-2 ${Number(formData.deliveryDeadlineDays) === d ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-white text-gray-400'}`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">Motivo / Detalhes</label>
                <input type="text" className="w-full p-4 border-2 border-white rounded-2xl focus:border-blue-300 outline-none transition-all font-bold" value={formData.deliveryReason} onChange={(e) => setFormData((prev) => ({ ...prev, deliveryReason: e.target.value }))} placeholder="Ex: Aguardando obra" />
              </div>
            </div>
          )}
        </div>

        <div className="bg-green-50 border-2 border-green-100 rounded-3xl p-6 flex justify-between items-center">
          <div className="space-y-1">
            <span className="text-xs font-bold text-green-600 uppercase tracking-wider">Comissão Prevista</span>
            <div className="text-3xl font-black text-green-700">{formatBRL(comissaoEstimada)}</div>
          </div>
        </div>

        {/* ACTION BAR FIXA PREMIUM (MOBILE) - z-index alto para ficar acima do teclado virtual */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[200] max-w-xl mx-auto flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-[52px] rounded-2xl font-black text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <X size={20} /> Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-[2.5] h-[52px] rounded-2xl font-black text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:scale-100"
          >
            {isSaving ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <>
                <Save size={20} /> {editingId ? 'Atualizar Venda' : 'Confirmar Venda'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [view, setView] = useState('dashboard');
  const [vendas, setVendas] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('vendas');
  const [activeMonth, setActiveMonth] = useState(() => localStorage.getItem('active_month') || getLocalMonthKey());
  const [isSaving, setIsSaving] = useState(false);

  // Toast & Modal States
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'danger' });

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

  const [formData, setFormData] = useState({
    data: getLocalToday(),
    cliente: '',
    produtos: '',
    valor: '',
    valorEntrada: '',
    percentual: '5',
    valorTabela: '',
    descontoAplicado: 'Sem desconto',
    pagamentoDetalhe: 'Pix • QR Code',
    motivoPendencia: 'aguardando_cartao',
    textoMotivo: '',
    previsaoPagamento: '',
    pendingObservation: '',
    tipoEntrega: 'Imediata',
    dataEntrega: '',
    motivoEntrega: '',
    deliveryDeadlineDays: '',
    deliveryReason: '',
    status: 'Ativa',
    motivoCancelamento: '',
    dataCancelamento: null,
    criadoEm: null,
    atualizadoEm: null,
    pagoEm: null,
  });

  const goalKey = (month) => `cv_goal_${month}`;
  const [monthlyGoal, setMonthlyGoal] = useState(() => {
    try {
      const saved = localStorage.getItem(goalKey(getLocalMonthKey()));
      const n = Number(saved);
      return saved !== null && saved !== '' ? String(Number.isFinite(n) ? n : 10000) : '10000';
    } catch {
      return '10000';
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(goalKey(activeMonth));
      const n = Number(saved);
      setMonthlyGoal(saved !== null && saved !== '' ? String(Number.isFinite(n) ? n : 10000) : '10000');
    } catch {
      setMonthlyGoal('10000');
    }
  }, [activeMonth]);

  const handleGoalChange = useCallback((value) => {
    setMonthlyGoal(value);
    const num = parseFloat(String(value).replace(',', '.'));
    if (value === '' || value === null || value === undefined) {
      localStorage.setItem(goalKey(activeMonth), '0');
    } else if (!Number.isNaN(num)) {
      localStorage.setItem(goalKey(activeMonth), String(num));
    }
  }, [activeMonth]);

  const [filtros, setFiltros] = useState({
    cliente: '',
    dataIni: '',
    dataFim: '',
    percentual: '',
  });

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        await verificarMigracao();
      } catch (e) {
        console.warn('Migração falhou:', e);
      }
      const dados = await getVendas();
      if (!isMounted) return;
      dados.sort((a, b) => {
        const dateA = new Date(a.data + 'T00:00:00');
        const dateB = new Date(b.data + 'T00:00:00');
        return dateB - dateA || (b.id || 0) - (a.id || 0);
      });
      setVendas(dados);
    };
    init();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    localStorage.setItem('active_month', activeMonth);
  }, [activeMonth]);

  const carregarVendas = async () => {
    const dados = await getVendas();
    dados.sort((a, b) => {
      const dateA = new Date(a.data + 'T00:00:00');
      const dateB = new Date(b.data + 'T00:00:00');
      return dateB - dateA || (b.id || 0) - (a.id || 0);
    });
    setVendas(dados);
  };

  const limparForm = useCallback(() => {
    setFormData({
      data: getLocalToday(),
      cliente: '',
      produtos: '',
      valor: '',
      valorEntrada: '',
      percentual: '5',
      valorTabela: '',
      descontoAplicado: 'Sem desconto',
      pagamentoDetalhe: 'Pix • QR Code',
      motivoPendencia: 'aguardando_cartao',
      textoMotivo: '',
      previsaoPagamento: '',
      pendingObservation: '',
      tipoEntrega: 'Imediata',
      dataEntrega: '',
      motivoEntrega: '',
      deliveryDeadlineDays: '',
      deliveryReason: '',
      status: 'Ativa',
      motivoCancelamento: '',
      dataCancelamento: null,
      criadoEm: null,
      atualizadoEm: null,
      pagoEm: null,
    });
  }, []);

  const metricas = useSalesMetricsV5(vendas, activeMonth);

  const separarVendas = useMemo(() => {
    const vendasAtivas = vendas.filter((v) => v && v.status !== 'Cancelada');
    const monthKey = (iso) => String(iso || '').slice(0, 7);
    const vendasDoMes = vendasAtivas.filter((v) => monthKey(v.data) === activeMonth);
    const entregue = (v) => v.tipoEntrega === 'Imediata';
    const pendencias = vendasAtivas.filter((v) => (Number(v.restante) || 0) > 0);
    const entregas = vendasAtivas.filter((v) => {
      if (v.tipoEntrega === 'Futura') return true;
      if (v.tipoEntrega === 'Agendada' && isIsoDate(v.dataEntrega)) return true;
      return false;
    });
    const vendasOk = vendasDoMes.filter((v) => {
      const quitado = (Number(v.restante) || 0) === 0;
      return quitado && entregue(v);
    });
    return { vendasOk, pendencias, entregas };
  }, [vendas, activeMonth]);

  const vendasFiltradas = useMemo(() => {
    const { vendasOk, pendencias, entregas } = separarVendas;
    const all = activeTab === 'vendas' ? vendasOk : activeTab === 'pendencias' ? pendencias : entregas;
    const matchCliente = (v) => filtros.cliente ? String(v.cliente || '').toLowerCase().includes(filtros.cliente.toLowerCase()) : true;
    const matchPerc = (v) => filtros.percentual ? String(v.percentual ?? '') === String(filtros.percentual) : true;
    const matchData = (v) => {
      if (filtros.dataIni && isIsoDate(v.data) && isIsoDate(filtros.dataIni)) {
        if (new Date(v.data + 'T00:00:00') < new Date(filtros.dataIni + 'T00:00:00')) return false;
      }
      if (filtros.dataFim && isIsoDate(v.data) && isIsoDate(filtros.dataFim)) {
        if (new Date(v.data + 'T00:00:00') > new Date(filtros.dataFim + 'T00:00:00')) return false;
      }
      return true;
    };
    return all.filter((v) => matchCliente(v) && matchPerc(v) && matchData(v));
  }, [separarVendas, activeTab, filtros]);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    const valorNum = toMoney(formData.valor);
    if (Number.isNaN(valorNum) || valorNum <= 0) {
      showToast('Erro: Valor da venda inválido.', 'error');
      return;
    }
    if (!formData.cliente.trim()) {
      showToast('Erro: Nome do cliente é obrigatório.', 'error');
      return;
    }

    const entradaNum = toMoney(formData.valorEntrada);
    const entradaSegura = Number.isNaN(entradaNum) ? valorNum : entradaNum;
    const restante = round2(valorNum - entradaSegura);

    if (restante > 0 && !formData.pendingObservation?.trim()) {
      showToast('Erro: Observação é obrigatória para pendências.', 'error');
      return;
    }

    setIsSaving(true);
    const perc = Number(formData.percentual) || 5;
    const comissao = round2(valorNum * (perc / 100));

    const novaVenda = {
      ...formData,
      valor: valorNum,
      valorEntrada: entradaSegura,
      restante,
      percentual: perc,
      comissao,
      statusPagamento: restante > 0 ? (restante === valorNum ? 'Totalmente Pendente' : 'Pendente') : 'Pago',
      pagoEm: restante === 0 ? (formData.pagoEm || new Date().toISOString()) : null,
      criadoEm: formData.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    try {
      if (editingId) {
        await updateVenda({ ...novaVenda, id: editingId });
        showToast('Venda atualizada com sucesso!');
      } else {
        await addVenda(novaVenda);
        showToast('Venda salva com sucesso!');
      }
      limparForm();
      setEditingId(null);
      setView('dashboard');
      await carregarVendas();
    } catch (err) {
      showToast('Erro ao salvar venda.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = useCallback((v) => {
    setFormData({ ...v });
    setEditingId(v.id);
    setView('add');
  }, []);

  const handleDelete = useCallback((id) => {
    setModal({
      isOpen: true,
      title: 'Apagar Venda',
      message: 'Tem certeza que deseja apagar esta venda permanentemente?',
      type: 'danger',
      onConfirm: async () => {
        await deleteVenda(id);
        await carregarVendas();
        setModal((prev) => ({ ...prev, isOpen: false }));
        showToast('Venda removida.');
      }
    });
  }, [showToast]);

  const handleReceberRestante = useCallback((v) => {
    setModal({
      isOpen: true,
      title: 'Receber Pendência',
      message: `Confirmar recebimento de ${formatBRL(v.restante)} de ${v.cliente}?`,
      type: 'success',
      onConfirm: async () => {
        const atualizada = {
          ...v,
          valorEntrada: v.valor,
          restante: 0,
          statusPagamento: 'Pago',
          pagoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        };
        await updateVenda(atualizada);
        await carregarVendas();
        setModal((prev) => ({ ...prev, isOpen: false }));
        showToast('Pagamento recebido!');
      }
    });
  }, [showToast]);

  const handleMarcarEntregue = useCallback(async (v) => {
    const atualizada = {
      ...v,
      tipoEntrega: 'Imediata',
      dataEntrega: '',
      atualizadoEm: new Date().toISOString(),
    };
    await updateVenda(atualizada);
    await carregarVendas();
    showToast('Entrega concluída!');
  }, [showToast]);

  const handleCancelarVenda = useCallback((v) => {
    setModal({
      isOpen: true,
      title: 'Cancelar Venda',
      message: 'Deseja realmente cancelar esta venda?',
      type: 'danger',
      onConfirm: async () => {
        const atualizada = {
          ...v,
          status: 'Cancelada',
          dataCancelamento: getLocalToday(),
          atualizadoEm: new Date().toISOString(),
        };
        await updateVenda(atualizada);
        await carregarVendas();
        setModal((prev) => ({ ...prev, isOpen: false }));
        showToast('Venda cancelada.', 'warning');
      }
    });
  }, [showToast]);

  const handleBackup = () => {
    const dadosStr = JSON.stringify(vendas);
    const blob = new Blob([dadosStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BACKUP_VENDAS_${getLocalToday()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup gerado!');
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    
    setModal({
      isOpen: true,
      title: 'Restaurar Backup',
      message: 'Isso adicionará as vendas do arquivo ao banco atual. Continuar?',
      type: 'primary',
      onConfirm: async () => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const dadosBackup = JSON.parse(event.target.result);
            if (!Array.isArray(dadosBackup)) throw new Error('Formato inválido');
            await addVendasBatch(dadosBackup);
            showToast('Backup restaurado!');
            await carregarVendas();
          } catch (err) {
            showToast('Erro ao restaurar backup.', 'error');
          }
        };
        reader.readAsText(file);
        setModal((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handlePrevMonth = () => {
    const [y, m] = activeMonth.split('-').map(Number);
    const d = new Date(y, m - 2);
    setActiveMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const handleNextMonth = () => {
    const [y, m] = activeMonth.split('-').map(Number);
    const d = new Date(y, m);
    setActiveMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const VendaCard = ({ v }) => {
    return (
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-4 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div className="min-w-0">
            <div className="font-black text-gray-900 text-xl truncate">{v.cliente}</div>
            <div className="text-sm text-gray-500 font-medium mt-1">{v.produtos || 'Sem descrição'}</div>
          </div>
          <div className="text-[10px] font-black bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full uppercase tracking-widest">
            {new Date(v.data + 'T00:00:00').toLocaleDateString('pt-BR')}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</div>
            <div className="font-black text-gray-900">{formatBRL(v.valor)}</div>
          </div>
          <div className="bg-green-50 rounded-2xl p-3 border border-green-100">
            <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Comissão ({v.percentual}%)</div>
            <div className="font-black text-green-700">{formatBRL(v.comissao)}</div>
          </div>
        </div>

        <div className="bg-blue-50/50 rounded-2xl p-3 border border-blue-100 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="font-bold text-blue-600">Pagamento</span>
            <span className="font-black text-blue-900">{v.pagamentoDetalhe}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold text-blue-600">Desconto</span>
            <span className="font-black text-blue-900">{v.descontoAplicado}</span>
          </div>
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-gray-50">
          <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${v.statusPagamento === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            {v.statusPagamento}
          </div>
          <div className="flex gap-4">
            <button onClick={() => handleEdit(v)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-xl transition-colors"><Edit size={20} /></button>
            <button onClick={() => handleDelete(v.id)} className="text-red-400 hover:bg-red-50 p-2 rounded-xl transition-colors"><Trash2 size={20} /></button>
          </div>
        </div>
      </div>
    );
  };

  const DashboardView = () => (
    <div className="pb-32">
      <KPICardsV5 metricas={metricas} goal={monthlyGoal} onChangeGoal={handleGoalChange} onPrevMonth={handlePrevMonth} onNextMonth={handleNextMonth} />

      <div className="px-4 mt-4">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar cliente..."
              className="w-full p-4 pl-12 border-2 border-gray-100 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold shadow-sm"
              value={filtros.cliente}
              onChange={(e) => setFiltros({ ...filtros, cliente: e.target.value })}
            />
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`p-4 border-2 rounded-2xl transition-all shadow-sm ${showFilters ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-100 text-gray-400'}`}>
            <BarChart size={20} />
          </button>
        </div>

        {showFilters && (
          <div className="bg-white p-5 rounded-3xl shadow-xl border border-gray-100 grid grid-cols-2 gap-4 text-sm mb-4 animate-in slide-in-from-top-2 duration-200">
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">De</label>
                <input type="date" className="w-full border-2 border-gray-50 rounded-xl p-3 font-bold" value={filtros.dataIni} onChange={(e) => setFiltros({ ...filtros, dataIni: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Até</label>
                <input type="date" className="w-full border-2 border-gray-50 rounded-xl p-3 font-bold" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase">% Comissão</label>
              <select className="border-2 border-gray-50 rounded-xl p-3 w-full font-bold bg-white" value={filtros.percentual} onChange={(e) => setFiltros({ ...filtros, percentual: e.target.value })}>
                <option value="">Todas</option>
                {[6, 5, 4, 3].map((n) => <option key={n} value={n}>{n}%</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => setFiltros({ cliente: '', dataIni: '', dataFim: '', percentual: '' })} className="w-full py-3 text-blue-600 font-black uppercase text-[10px] tracking-widest hover:bg-blue-50 rounded-xl transition-colors">
                Limpar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      <TabNavigatorV5
        activeTab={activeTab}
        onChange={setActiveTab}
        counts={{
          vendas: separarVendas.vendasOk.length,
          pendencias: separarVendas.pendencias.length,
          entregas: separarVendas.entregas.length,
        }}
      />

      <div className="mt-2">
        {activeTab === 'vendas' && (
          <div className="p-4 space-y-4">
            {vendasFiltradas.length === 0 && (
              <div className="bg-white border-2 border-dashed border-gray-100 rounded-3xl p-12 text-center">
                <div className="text-gray-300 mb-2 flex justify-center"><BarChart size={48} /></div>
                <p className="text-gray-400 font-bold">Nenhuma venda finalizada.</p>
              </div>
            )}
            {vendasFiltradas.map((v) => <VendaCard key={v.id} v={v} />)}
          </div>
        )}

        {activeTab === 'pendencias' && (
          <PendenciasTabV5
            vendas={vendasFiltradas}
            onReceberRestante={handleReceberRestante}
            onEdit={handleEdit}
            onCancel={handleCancelarVenda}
            onDelete={handleDelete}
          />
        )}

        {activeTab === 'entregas' && (
          <EntregasTabV5
            vendas={vendasFiltradas}
            onMarcarEntregue={handleMarcarEntregue}
            onEdit={handleEdit}
            onCancel={handleCancelarVenda}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );

  const ReportsView = () => (
    <div className="p-6 pb-32 max-w-xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-black text-gray-900">Configurações</h2>
        <p className="text-gray-500 font-medium">Gerencie seus dados e backups com segurança.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-xl shadow-gray-100 space-y-6">
        <div className="space-y-4">
          <button onClick={handleBackup} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black shadow-lg shadow-blue-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3">
            ☁️ Exportar Backup JSON
          </button>

          <label className="w-full bg-white border-2 border-gray-100 hover:border-blue-200 text-gray-700 py-5 rounded-2xl flex justify-center items-center cursor-pointer font-black transition-all gap-3">
            📥 Importar Backup
            <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
          </label>
        </div>

        <div className="pt-6 border-t border-gray-50 flex flex-col items-center gap-2">
          <div className="px-4 py-1.5 bg-gray-100 rounded-full text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
            Versão Premium v5.3
          </div>
          <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">Offline-First Storage</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-900 pb-safe font-sans selection:bg-blue-100">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <ConfirmModal {...modal} onCancel={() => setModal((prev) => ({ ...prev, isOpen: false }))} />

      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 p-5 sticky top-0 z-30 flex justify-between items-center max-w-xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <BarChart size={18} className="text-white" />
          </div>
          <span className="font-black text-xl tracking-tight text-gray-900">Controle<span className="text-blue-600">Vendas</span></span>
        </div>
        <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
          Premium
        </div>
      </header>

      <main className="max-w-xl mx-auto">
        {view === 'dashboard' && <DashboardView />}
        {view === 'add' && (
          <FormView 
            formData={formData} 
            setFormData={setFormData} 
            onSave={handleSave} 
            onCancel={() => { setEditingId(null); limparForm(); setView('dashboard'); }}
            isSaving={isSaving}
            editingId={editingId}
          />
        )}
        {view === 'reports' && <ReportsView />}
      </main>

      {/* NAVEGAÇÃO INFERIOR - OCULTA NO CADASTRO */}
      {view !== 'add' && (
        <nav className="fixed bottom-0 w-full bg-white/90 backdrop-blur-lg border-t border-gray-100 flex justify-around p-4 z-40 max-w-xl left-0 right-0 mx-auto pb-8 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
          <button onClick={() => { setView('dashboard'); setActiveTab('vendas'); }} className={`p-3 rounded-2xl transition-all ${view === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-300 hover:text-gray-400'}`}>
            <BarChart size={28} strokeWidth={2.5} />
          </button>

          <button onClick={() => { limparForm(); setEditingId(null); setView('add'); }} className="bg-blue-600 text-white p-4 rounded-[1.5rem] -mt-12 shadow-2xl shadow-blue-300 active:scale-90 transition-all border-4 border-white">
            <Plus size={32} strokeWidth={3} />
          </button>

          <button onClick={() => setView('reports')} className={`p-3 rounded-2xl transition-all ${view === 'reports' ? 'bg-blue-50 text-blue-600' : 'text-gray-300 hover:text-gray-400'}`}>
            <List size={28} strokeWidth={2.5} />
          </button>
        </nav>
      )}
    </div>
  );
}
