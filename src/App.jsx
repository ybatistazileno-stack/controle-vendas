import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, Filter, DollarSign, TrendingUp, Clock, Package } from 'lucide-react';
import { initDB, getAllSales, addSale, updateSale, deleteSale } from './db';

// ---------- Helpers de formatação (pt-BR) ----------
// Mantém digitação livre (string) e só converte para número no submit.
const parseBRL = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s0 = String(v).trim();
  if (!s0) return 0;

  // remove moeda e espaços
  let s = s0
    .replace(/R\$\s?/gi, '')
    .replace(/\s/g, '')
    .replace(/[^0-9,.-]/g, '');

  // Se tem vírgula, ela é decimal. Remove pontos de milhar.
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const formatBRLInput = (v) => {
  if (v === null || v === undefined) return '';
  const n = parseBRL(v);
  // Se o usuário está apagando tudo, mantém vazio
  const s0 = String(v).trim();
  if (!s0) return '';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

const formatBRL = (n) => {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const toMoneyInput = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v === 0 ? '' : formatBRL(v);
  return String(v);
};

function App() {
  const [sales, setSales] = useState([]);
  const [activeTab, setActiveTab] = useState('vendas');
  const [activeMonth, setActiveMonth] = useState(() => {
    const saved = localStorage.getItem('active_month');
    if (saved) return saved;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingSale, setEditingSale] = useState(null);
  
  // Formulário - CORREÇÃO: Todas as variáveis estão declaradas
  const [formData, setFormData] = useState({
    cliente: '',
    produto: '',
    valorTabela: '',
    desconto: '',
    valorFinal: '',
    comissao: '',
    dataPrevista: '',
    dataEntregue: '',
    pagamento: {
      sinal: '',
      dataSinal: '',
      restante: '',
      dataRestante: '',
      formaPagamento: 'dinheiro'
    },
    status: 'concluida',
    pendenciaMotivo: '',
    entregaFuturaMotivo: '',
    observacoes: ''
  });

  useEffect(() => {
    initDB().then(() => loadSales());
  }, []);

  useEffect(() => {
    localStorage.setItem('active_month', activeMonth);
  }, [activeMonth]);

  const loadSales = async () => {
    const data = await getAllSales();
    setSales(data);
  };

  const handleMonthChange = (direction) => {
    const [year, month] = activeMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + direction);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setActiveMonth(newMonth);
  };

  const calculateKPIs = () => {
    const monthSales = sales.filter(s => {
      const saleMonth = s.dataEntregue ? s.dataEntregue.substring(0, 7) : s.dataPrevista.substring(0, 7);
      return saleMonth === activeMonth;
    });

    const vendido = monthSales
      .filter(s => s.status === 'concluida')
      .reduce((sum, s) => sum + (parseFloat(s.valorFinal) || 0), 0);

    const comissao = monthSales
      .filter(s => s.status === 'concluida')
      .reduce((sum, s) => sum + (parseFloat(s.comissao) || 0), 0);

    const recebido = monthSales
      .filter(s => s.status === 'concluida')
      .reduce((sum, s) => {
        const sinal = parseFloat(s.pagamento?.sinal) || 0;
        const restante = parseFloat(s.pagamento?.restante) || 0;
        const dataRestante = s.pagamento?.dataRestante;
        if (dataRestante && dataRestante.substring(0, 7) <= activeMonth) {
          return sum + sinal + restante;
        }
        return sum + sinal;
      }, 0);

    const pendencias = monthSales
      .filter(s => s.status === 'pendencia')
      .reduce((sum, s) => sum + (parseFloat(s.valorFinal) || 0), 0);

    const descontos = monthSales
      .reduce((sum, s) => sum + (parseFloat(s.desconto) || 0), 0);

    return { vendido, comissao, recebido, pendencias, descontos };
  };

  const kpis = calculateKPIs();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Converte valores monetários com tolerância a vírgula/ponto
    const valorTabelaNum = parseBRL(formData.valorTabela);
    const descontoPercent = Number(formData.descontoPercent) || 0;
    const descontoNum = valorTabelaNum * (descontoPercent / 100);
    const valorFinalNum = Math.max(valorTabelaNum - descontoNum, 0);

    // Pagamento: sinal (pago agora) e restante calculado automaticamente
    const sinalNum = parseBRL(formData.pagamento?.sinal);
    const restanteNum = Math.max(valorFinalNum - sinalNum, 0);

    const saleData = {
      ...formData,
      valorTabela: valorTabelaNum,
      descontoPercent,
      desconto: descontoNum,
      valorFinal: valorFinalNum,
      comissao: Number(formData.comissao) || 0,
      pagamento: {
        ...formData.pagamento,
        sinal: sinalNum,
        restante: restanteNum,
        parcelas: Number(formData.pagamento?.parcelas) || 1,
      }
    };

    if (editingSale) {
      await updateSale(editingSale.id, saleData);
    } else {
      await addSale(saleData);
    }

    await loadSales();
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      cliente: '',
      // Produto pode ter múltiplas linhas (um item por linha)
      produto: '',
      // Mantemos como string para digitação suave; convertemos no submit
      valorTabela: '',
      // Desconto agora é controlado por porcentagem (0/10/15/20)
      descontoPercent: 0,
      desconto: '',
      valorFinal: '',
      // Comissão: opções 3/4/5/6
      comissao: '6',
      dataPrevista: '',
      dataEntregue: '',
      pagamento: {
        sinal: '',
        dataSinal: '',
        restante: '',
        dataRestante: '',
        formaPagamento: 'dinheiro',
        parcelas: 1
      },
      status: 'concluida',
      pendenciaMotivo: '',
      entregaFuturaMotivo: '',
      observacoes: ''
    });
    setEditingSale(null);
  };

  const handleEdit = (sale) => {
    setEditingSale(sale);
    // Normaliza para não quebrar vendas antigas
    setFormData({
      ...sale,
      produto: sale?.produto ?? '',
      valorTabela: sale?.valorTabela ?? '',
      descontoPercent: Number.isFinite(sale?.descontoPercent) ? sale.descontoPercent : 0,
      desconto: sale?.desconto ?? '',
      valorFinal: sale?.valorFinal ?? '',
      comissao: sale?.comissao ?? '6',
      pagamento: {
        sinal: sale?.pagamento?.sinal ?? '',
        dataSinal: sale?.pagamento?.dataSinal ?? '',
        restante: sale?.pagamento?.restante ?? '',
        dataRestante: sale?.pagamento?.dataRestante ?? '',
        formaPagamento: sale?.pagamento?.formaPagamento ?? 'dinheiro',
        parcelas: sale?.pagamento?.parcelas ?? 1
      }
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta venda?')) {
      await deleteSale(id);
      await loadSales();
    }
  };

  const getFilteredSales = () => {
    let filtered = sales;

    // Filtro por aba
    if (activeTab === 'vendas') {
      filtered = filtered.filter(s => s.status === 'concluida');
    } else if (activeTab === 'pendencias') {
      filtered = filtered.filter(s => s.status === 'pendencia');
    } else if (activeTab === 'entregas') {
      filtered = filtered.filter(s => s.status === 'entrega_futura');
    }

    // Filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.produto.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  // ---------- Derivados do formulário (para UI) ----------
  const valorTabelaNumUI = parseBRL(formData.valorTabela);
  const descontoPercentUI = Number(formData.descontoPercent) || 0;
  const descontoNumUI = valorTabelaNumUI * (descontoPercentUI / 100);
  const valorFinalNumUI = Math.max(valorTabelaNumUI - descontoNumUI, 0);
  const sinalNumUI = parseBRL(formData.pagamento?.sinal);
  const restanteNumUI = Math.max(valorFinalNumUI - sinalNumUI, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Controle de Vendas v5.0</h1>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={20} />
              Nova Venda
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPIs */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-700">Resumo do Mês</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleMonthChange(-1)}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="font-semibold text-slate-900 min-w-[120px] text-center">
                {new Date(activeMonth + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => handleMonthChange(1)}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="text-green-600" size={24} />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Vendido</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(kpis.vendido)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="text-blue-600" size={24} />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Comissão</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(kpis.comissao)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="text-purple-600" size={24} />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Recebido</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(kpis.recebido)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="text-orange-600" size={24} />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Pendências</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(kpis.pendencias)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Package className="text-red-600" size={24} />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Descontos</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(kpis.descontos)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-slate-200">
            <nav className="flex gap-4">
              {[
                { key: 'vendas', label: 'Vendas Finalizadas' },
                { key: 'pendencias', label: 'Pendências' },
                { key: 'entregas', label: 'Entregas Futuras' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por cliente ou produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Sales List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Produto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Comissão</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {getFilteredSales().map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {sale.cliente}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {sale.produto}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-semibold">
                      {formatCurrency(sale.valorFinal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {formatCurrency(sale.comissao)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {formatDate(sale.dataEntregue || sale.dataPrevista)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleEdit(sale)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(sale.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingSale ? 'Editar Venda' : 'Nova Venda'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome do cliente</label>
                    <input
                      type="text"
                      required
                      value={formData.cliente}
                      onChange={(e) => setFormData((prev) => ({ ...prev, cliente: e.target.value }))}
                      placeholder="Ex.: Ana Souza"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Produtos (1 item por linha)</label>
                    <textarea
                      required
                      rows={4}
                      value={formData.produto}
                      onChange={(e) => setFormData((prev) => ({ ...prev, produto: e.target.value }))}
                      placeholder={'Ex.:\nColchão Queen\nTravesseiro\nCapa protetora'}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                    <p className="mt-1 text-xs text-slate-500">Dica: escreva cada produto em uma linha para ficar organizado.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor de tabela (R$)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={formData.valorTabela}
                      onChange={(e) => setFormData((prev) => ({ ...prev, valorTabela: e.target.value }))}
                      onBlur={() => setFormData((prev) => ({ ...prev, valorTabela: formatBRLInput(prev.valorTabela) }))}
                      placeholder="0,00"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Desconto aplicado</label>
                    <select
                      value={formData.descontoPercent}
                      onChange={(e) => setFormData((prev) => ({ ...prev, descontoPercent: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={0}>Sem desconto</option>
                      <option value={10}>10%</option>
                      <option value={15}>15%</option>
                      <option value={20}>20%</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Desconto: <span className="font-semibold">{formatCurrency(descontoNumUI)}</span></p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor vendido (R$)</label>
                    <input
                      type="text"
                      readOnly
                      value={formatCurrency(valorFinalNumUI).replace('R$', '').trim()}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Comissão</label>
                    <div className="flex gap-2 flex-wrap">
                      {['3', '4', '5', '6'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, comissao: p }))}
                          className={`px-4 py-2 rounded-lg border text-sm font-semibold transition ${String(formData.comissao) === p
                            ? 'bg-blue-600 border-blue-600 text-white shadow'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Data Prevista</label>
                    <input
                      type="date"
                      required
                      value={formData.dataPrevista}
                      onChange={(e) => setFormData({ ...formData, dataPrevista: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Data Entregue</label>
                    <input
                      type="date"
                      value={formData.dataEntregue}
                      onChange={(e) => setFormData({ ...formData, dataEntregue: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="concluida">Concluída</option>
                      <option value="pendencia">Pendência</option>
                      <option value="entrega_futura">Entrega Futura</option>
                    </select>
                  </div>
                </div>

                {/* Pagamento */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Pagamento</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Sinal</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formData.pagamento.sinal}
                        onChange={(e) => setFormData((prev) => ({
                          ...prev,
                          pagamento: { ...prev.pagamento, sinal: e.target.value }
                        }))}
                        onBlur={() => setFormData((prev) => ({
                          ...prev,
                          pagamento: { ...prev.pagamento, sinal: formatBRLInput(prev.pagamento.sinal) }
                        }))}
                        placeholder="0,00"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Data do Sinal</label>
                      <input
                        type="date"
                        value={formData.pagamento.dataSinal}
                        onChange={(e) => setFormData({
                          ...formData,
                          pagamento: { ...formData.pagamento, dataSinal: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Falta para pagar</label>
                      <input
                        type="text"
                        readOnly
                        value={formatBRLInput(restanteNumUI)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900"
                      />
                      {restanteNumUI > 0 ? (
                        <p className="mt-1 text-xs text-amber-700">Pendência: <span className="font-semibold">{formatCurrency(restanteNumUI)}</span></p>
                      ) : (
                        <p className="mt-1 text-xs text-emerald-700">Totalmente pago</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Data do Restante</label>
                      <input
                        type="date"
                        value={formData.pagamento.dataRestante}
                        onChange={(e) => setFormData({
                          ...formData,
                          pagamento: { ...formData.pagamento, dataRestante: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Pagamento</label>
                      <select
                        value={formData.pagamento.formaPagamento}
                        onChange={(e) => setFormData((prev) => ({
                          ...prev,
                          pagamento: { ...prev.pagamento, formaPagamento: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="dinheiro">Dinheiro</option>
                        <option value="pix">PIX</option>
                        <option value="cartao">Cartão</option>
                        <option value="boleto">Boleto</option>
                        <option value="link">Link de pagamento</option>
                        <option value="transferencia">Transferência</option>
                      </select>
                    </div>

                    {formData.pagamento.formaPagamento === 'cartao' && (
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Parcelas</label>
                        <select
                          value={formData.pagamento.parcelas}
                          onChange={(e) => setFormData((prev) => ({
                            ...prev,
                            pagamento: { ...prev.pagamento, parcelas: e.target.value }
                          }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={String(n)}>{n}x</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {formData.status === 'pendencia' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Motivo da Pendência</label>
                    <textarea
                      value={formData.pendenciaMotivo}
                      onChange={(e) => setFormData({ ...formData, pendenciaMotivo: e.target.value })}
                      rows="3"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {formData.status === 'entrega_futura' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Motivo da Entrega Futura</label>
                    <textarea
                      value={formData.entregaFuturaMotivo}
                      onChange={(e) => setFormData({ ...formData, entregaFuturaMotivo: e.target.value })}
                      rows="3"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                  <textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                  >
                    {editingSale ? 'Atualizar' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
