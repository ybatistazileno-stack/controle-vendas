import React, { useEffect, useMemo, useState } from 'react';
import { addVenda, getVendas, deleteVenda, updateVenda, addVendasBatch } from './db';
import { verificarMigracao } from './utils/migration-v5';
import { useSalesMetricsV5 } from './hooks/useSalesMetricsV5';
import { KPICardsV5 } from './components/KPICardsV5';
import { TabNavigatorV5 } from './components/TabNavigatorV5';
import { PendenciasTabV5 } from './components/PendenciasTabV5';
import { EntregasTabV5 } from './components/EntregasTabV5';
import { FormViewV5 } from './components/FormViewV5';
import { Trash2, Edit, Plus, List, BarChart, Filter, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

// --- UTILITÁRIOS ---
const formatBRL = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const toMoney = (val) => {
  if (val === null || val === undefined) return NaN;
  if (String(val).trim() === '') return NaN;
  const n = Number(val);
  return Number.isFinite(n) ? n : NaN;
};


// Data local (evita bugs de fuso horário causados por toISOString/UTC)
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

const formatLocalISODate = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

// ICS sanitize (RFC5545 basic escaping)
const sanitizeIcsText = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .trim();
};

const normalizarPagamentoDetalhe = (str) => {
  const s = String(str || '').toLowerCase();
  if (s.includes('pix') && s.includes('qr')) return 'Pix • QR Code';
  if (s.includes('pix') && s.includes('cnpj')) return 'Pix • CNPJ';
  if (s.includes('deb')) return 'Débito';
  if (s.includes('din')) return 'Dinheiro';
  if (s.includes('boleto')) return 'Boleto';
  if (s.includes('link')) return 'Link de pagamento';
  if (s.includes('transfer')) return 'Transferência';
  const m = s.match(/(\d+)\s*x/);
  if (s.includes('cred') || s.includes('créd') || s.includes('cart')) {
    const parcelas = m ? Math.min(12, Math.max(1, Number(m[1]))) : 1;
    return `Crédito (${parcelas}x)`;
  }
  return 'Pix • QR Code';
};

const descontoOptions = ['Sem desconto', 'Preço de tabela', 'Acima da tabela', '10%', '15%'];
const pagamentoOptions = [
  'Pix • QR Code', 'Pix • CNPJ', 'Débito', 'Dinheiro', 'Boleto', 'Link de pagamento', 'Transferência',
  'Crédito (1x)', 'Crédito (2x)', 'Crédito (3x)', 'Crédito (4x)', 'Crédito (5x)', 'Crédito (6x)',
  'Crédito (7x)', 'Crédito (8x)', 'Crédito (9x)', 'Crédito (10x)', 'Crédito (11x)', 'Crédito (12x)',
];

const motivoPendenciaOptions = [
  { value: 'aguardando_cartao', label: '💳 Aguardando cartão virar' },
  { value: 'pagamento_cliente', label: '👤 Aguardando pagamento do cliente' },
  { value: 'parcelado', label: '📅 Pagamento parcelado' },
  { value: 'aprovacao', label: '✅ Aguardando aprovação' },
  { value: 'outro', label: '🔹 Outro' },
];

export default function App() {
  const [view, setView] = useState('dashboard'); // dashboard | add | reports
  const [vendas, setVendas] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('vendas'); // vendas | pendencias | entregas
  const [activeMonth, setActiveMonth] = useState(() => localStorage.getItem('active_month') || getLocalMonthKey());

  const [formData, setFormData] = useState({
    data: getLocalToday(),
    cliente: '',
    produtos: '',

    valor: '',
    percentual: '5',

    // v5 fields — valores e desconto (não confundir com pendência)
    valorTabela: '',
    descontoAplicado: 'Sem desconto',
    descontoValorReais: '', // opcional: desconto em R$ (sobrescreve %)

    // pagamento: único ou dividido
    modoPagamento: 'unico', // 'unico' | 'dividido'
    valorEntrada: '', // no modo único = "valor pago agora" (vazio = total)
    pagamentoDetalhe: 'Pix • QR Code', // forma no modo único
    paymentParts: [{ method: 'Pix • QR Code', amount: '' }], // modo dividido: [{ method, amount }]

    // pendência (só aparece se restante > 0)
    motivoPendencia: 'aguardando_cartao',
    textoMotivo: '',
    previsaoPagamento: '',

    // delivery
    tipoEntrega: 'Imediata',
    dataEntrega: '',
    motivoEntrega: '',

    // lifecycle
    status: 'Ativa',
    motivoCancelamento: '',
    dataCancelamento: null,

    criadoEm: null,
    atualizadoEm: null,
    pagoEm: null,
  });

  // Meta mensal (persistida por mês no localStorage)
  const goalKey = (month) => `cv_goal_${month}`;
  // Guardamos como string para permitir digitação livre (ex.: apagar, digitar devagar),
  // e persistimos como número ao salvar.
  const [monthlyGoalInput, setMonthlyGoalInput] = useState(() => {
    try {
      const saved = localStorage.getItem(goalKey(localStorage.getItem('active_month') || getLocalMonthKey()));
      return saved !== null ? String(saved) : '10000';
    } catch {
      return '10000';
    }
  });

  const monthlyGoal = Number(String(monthlyGoalInput).replace(/[^0-9]/g, '')) || 0;

  // Quando mudar o mês ativo, carregar a meta daquele mês (ou manter padrão)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(goalKey(activeMonth));
      setMonthlyGoalInput(saved !== null ? String(saved) : '10000');
    } catch {
      setMonthlyGoalInput('10000');
    }
  }, [activeMonth]);

  // Persistir meta do mês atual sempre que o usuário editar
  useEffect(() => {
    try {
      const onlyDigits = String(monthlyGoalInput || '').replace(/[^0-9]/g, '');
      // Se vazio, não sobrescreve imediatamente com 0; permite o usuário digitar.
      if (onlyDigits === '') return;
      localStorage.setItem(goalKey(activeMonth), onlyDigits);
    } catch {
      // ignore
    }
  }, [monthlyGoalInput, activeMonth]);

  const [filtros, setFiltros] = useState({
    cliente: '',
    dataIni: '',
    dataFim: '',
    percentual: '',
  });

  // Init: migration + load
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        await verificarMigracao();
      } catch (e) {
        console.warn('Migração falhou (seguindo):', e);
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

  const limparForm = () => {
    setFormData((prev) => ({
      ...prev,
      data: getLocalToday(),
      cliente: '',
      produtos: '',
      valor: '',
      percentual: '5',

      valorTabela: '',
      descontoAplicado: 'Sem desconto',
      descontoValorReais: '',

      modoPagamento: 'unico',
      valorEntrada: '',
      pagamentoDetalhe: 'Pix • QR Code',
      paymentParts: [{ method: 'Pix • QR Code', amount: '' }],

      motivoPendencia: 'aguardando_cartao',
      textoMotivo: '',
      previsaoPagamento: '',

      tipoEntrega: 'Imediata',
      dataEntrega: '',
      motivoEntrega: '',

      status: 'Ativa',
      motivoCancelamento: '',
      dataCancelamento: null,

      criadoEm: null,
      atualizadoEm: null,
      pagoEm: null,
    }));
  };

  const handleTipoEntregaChange = (novoTipo) => {
    setFormData((prev) => ({
      ...prev,
      tipoEntrega: novoTipo,
      dataEntrega: novoTipo === 'Agendada' ? prev.dataEntrega : '',
      motivoEntrega: novoTipo === 'Futura' ? prev.motivoEntrega : '',
    }));
  };

  const metricas = useSalesMetricsV5(vendas, activeMonth);

  const separarVendas = useMemo(() => {
    // IMPORTANT: Abas de Pendências e Entregas NÃO podem depender do mês ativo.
    // - Pendências: mostram todas as dívidas em aberto (restante > 0), mesmo de meses anteriores.
    // - Entregas: mostram todas as entregas não concluídas (Futura/Agendada), inclusive atrasadas.
    const vendasAtivas = vendas.filter((v) => v && v.status !== 'Cancelada');

    // Aba "Vendas": filtra pelo mês da DATA DA VENDA (mês ativo)
    const monthKey = (iso) => String(iso || '').slice(0, 7);
    const vendasDoMes = vendasAtivas.filter((v) => monthKey(v.data) === activeMonth);

    // Entrega só é considerada concluída quando o usuário marca como entregue
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

    const matchCliente = (v) => filtros.cliente
      ? String(v.cliente || '').toLowerCase().includes(filtros.cliente.toLowerCase())
      : true;

    const matchPerc = (v) => filtros.percentual
      ? String(v.percentual ?? '') === String(filtros.percentual)
      : true;

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

  // --- SAVE (blindado) ---
  const handleSave = async (e) => {
    e.preventDefault();

    const valorNum = toMoney(formData.valor);
    if (Number.isNaN(valorNum) || valorNum <= 0) {
      alert('Erro: Valor da venda inválido.');
      return;
    }

    if (!formData.cliente.trim()) {
      alert('Erro: Nome do cliente é obrigatório.');
      return;
    }

    // valorTabela é referência (não entra nos cálculos)
    let valorTabela = toMoney(formData.valorTabela);
    if (!Number.isFinite(valorTabela) || valorTabela <= 0) valorTabela = valorNum;

    // Desconto: % (10%/15%) ou valor em R$
    let descontoValor = 0;
    const descReais = toMoney(formData.descontoValorReais);
    if (Number.isFinite(descReais) && descReais > 0) {
      descontoValor = Math.min(descReais, valorNum);
    } else if (formData.descontoAplicado === '10%') {
      descontoValor = round2(valorNum * 0.1);
    } else if (formData.descontoAplicado === '15%') {
      descontoValor = round2(valorNum * 0.15);
    }
    const totalAReceber = round2(Math.max(0, valorNum - descontoValor));

    // Total pago (único ou dividido)
    let totalPago = 0;
    let paymentPartsToSave = [];

    if (formData.modoPagamento === 'unico') {
      const isValorPagoVazio = formData.valorEntrada === null || formData.valorEntrada === undefined || String(formData.valorEntrada).trim() === '';
      totalPago = isValorPagoVazio ? totalAReceber : toMoney(formData.valorEntrada);
      if (Number.isNaN(totalPago) || totalPago < 0) totalPago = totalAReceber;
      if (totalPago > totalAReceber) totalPago = totalAReceber;
      paymentPartsToSave = [{ method: normalizarPagamentoDetalhe(formData.pagamentoDetalhe), amount: totalPago }];
    } else {
      for (const p of formData.paymentParts || []) {
        const a = toMoney(p.amount);
        if (Number.isFinite(a) && a > 0) {
          totalPago += a;
          paymentPartsToSave.push({ method: normalizarPagamentoDetalhe(p.method), amount: a });
        }
      }
      totalPago = round2(totalPago);
      if (totalPago > totalAReceber) {
        alert(`Total pago (${formatBRL(totalPago)}) não pode ser maior que o total a receber (${formatBRL(totalAReceber)}). Ajuste os valores.`);
        return;
      }
    }

    const restante = round2(totalAReceber - totalPago);
    const entradaNum = totalPago; // compatibilidade: valorEntrada = total pago

    // Entrega
    if (formData.tipoEntrega === 'Agendada') {
      if (!isIsoDate(formData.dataEntrega)) {
        alert('Erro: Para entrega Agendada, selecione uma data válida.');
        return;
      }
    }

    // Comissão
    const percNum = Number(formData.percentual);
    if (!Number.isFinite(percNum) || percNum < 0 || percNum > 100) {
      alert('Erro: Percentual de comissão inválido.');
      return;
    }
    const comissao = round2(valorNum * (percNum / 100));

    // statusPagamento
    let statusPagamento = 'Pago';
    if (restante > 0) statusPagamento = 'Pendente';
    if (restante === valorNum) statusPagamento = 'Totalmente Pendente';

    // pagoEm coerente
    let pagoEm = formData.pagoEm;
    if (restante > 0) pagoEm = null;
    else if (restante === 0 && !pagoEm) pagoEm = new Date().toISOString();

    // Pêndencia extra
    let motivoPendencia = null;
    let textoMotivo = '';
    let previsaoPagamento = '';
    if (restante > 0) {
      motivoPendencia = formData.motivoPendencia || 'aguardando_cartao';
      textoMotivo = motivoPendencia === 'outro' ? String(formData.textoMotivo || '').trim() : '';
      previsaoPagamento = isIsoDate(formData.previsaoPagamento) ? formData.previsaoPagamento : '';
    }

    // Entrega futura motivo
    let motivoEntrega = '';
    if (formData.tipoEntrega === 'Futura') {
      motivoEntrega = String(formData.motivoEntrega || '').trim();
    }

    const pagamentoDetalhe = paymentPartsToSave.length === 1
      ? paymentPartsToSave[0].method
      : 'Misto';

    const vendaObj = {
      data: formData.data,
      cliente: formData.cliente.trim(),
      produtos: formData.produtos,

      valor: valorNum,
      valorEntrada: entradaNum,
      restante,
      percentual: percNum,
      comissao,
      statusPagamento,

      valorTabela,
      descontoAplicado: formData.descontoAplicado || 'Sem desconto',
      pagamentoDetalhe,
      paymentParts: paymentPartsToSave,

      motivoPendencia,
      textoMotivo,
      previsaoPagamento,

      tipoEntrega: formData.tipoEntrega,
      dataEntrega: formData.tipoEntrega === 'Agendada' ? formData.dataEntrega : '',
      motivoEntrega,

      status: 'Ativa',
      motivoCancelamento: '',
      dataCancelamento: null,

      criadoEm: formData.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      pagoEm,
    };

    try {
      if (editingId) {
        vendaObj.id = editingId;
        await updateVenda(vendaObj);
      } else {
        await addVenda(vendaObj);
      }

      limparForm();
      setEditingId(null);
      await carregarVendas();
      setView('dashboard');
      setActiveTab('vendas');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar. Tente novamente.');
    }
  };

  const handleEdit = (venda) => {
    const parts = venda.paymentParts && Array.isArray(venda.paymentParts) && venda.paymentParts.length > 0
      ? venda.paymentParts.map((p) => ({ method: p.method || 'Pix • QR Code', amount: String(p.amount ?? '') }))
      : [{ method: venda.pagamentoDetalhe || 'Pix • QR Code', amount: String(venda.valorEntrada ?? venda.valor ?? '') }];
    const modoPagamento = parts.length > 1 ? 'dividido' : 'unico';

    setFormData({
      ...formData,
      ...venda,
      valor: String(venda.valor ?? ''),
      valorTabela: String(venda.valorTabela ?? ''),
      percentual: String(venda.percentual ?? '5'),
      descontoAplicado: venda.descontoAplicado || 'Sem desconto',
      descontoValorReais: '',
      modoPagamento,
      valorEntrada: modoPagamento === 'unico' ? String(venda.valorEntrada === 0 ? '0' : (venda.valorEntrada ?? '')) : '',
      pagamentoDetalhe: venda.pagamentoDetalhe || 'Pix • QR Code',
      paymentParts: parts,
      previsaoPagamento: venda.previsaoPagamento || '',
      textoMotivo: venda.textoMotivo || '',
      motivoPendencia: venda.motivoPendencia || 'aguardando_cartao',
      tipoEntrega: venda.tipoEntrega || 'Imediata',
      dataEntrega: venda.dataEntrega || '',
      motivoEntrega: venda.motivoEntrega || '',
      criadoEm: venda.criadoEm || null,
      pagoEm: venda.pagoEm || null,
    });
    setEditingId(venda.id);
    setView('add');
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta venda? Isso é irreversível.')) return;
    await deleteVenda(id);
    await carregarVendas();
  };

  const handleCancelarVenda = async (venda) => {
    const motivo = prompt('Motivo do cancelamento:');
    if (!motivo) return;

    if (!confirm(`Confirmar cancelamento?\n\nCliente: ${venda.cliente}\nValor: ${formatBRL(venda.valor)}\nMotivo: ${motivo}`)) return;

    const vendaCancelada = {
      ...venda,
      status: 'Cancelada',
      motivoCancelamento: motivo,
      dataCancelamento: getLocalToday(),
      atualizadoEm: new Date().toISOString(),
    };

    await updateVenda(vendaCancelada);
    await carregarVendas();
  };

  const handleReceberRestante = async (venda) => {
    if (!confirm(`Receber restante de ${venda.cliente}?\nRestante: ${formatBRL(venda.restante)}`)) return;

    const atualizada = {
      ...venda,
      valorEntrada: venda.valor,
      restante: 0,
      statusPagamento: 'Pago',
      motivoPendencia: null,
      textoMotivo: '',
      previsaoPagamento: '',
      pagoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    await updateVenda(atualizada);
    await carregarVendas();
  };

  const handleMarcarEntregue = async (venda) => {
    if (!confirm(`Marcar entregue para ${venda.cliente}?`)) return;

    const hoje = getLocalToday();
    const atualizada = {
      ...venda,
      tipoEntrega: 'Imediata',
      dataEntrega: '',
      motivoEntrega: '',
      atualizadoEm: new Date().toISOString(),
      // mantém histórico de dataEntrega no futuro? não: preferi limpar para consistência
      // se quiser manter, crie campo dataEntregaReal
    };

    // Se estava agendada e já passou, ok; se era futura, agora virou entregue.
    // Mantemos a venda como "final" apenas se também estiver paga (restante 0).

    await updateVenda(atualizada);
    await carregarVendas();
  };

  // --- Backup / Restore ---
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
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!confirm('Isso adicionará as vendas do arquivo ao banco atual.\nDeseja continuar?')) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const dadosBackup = JSON.parse(event.target.result);
        if (!Array.isArray(dadosBackup)) throw new Error('Formato inválido');

        let importadas = 0;
        let ignoradas = 0;
        let buffer = [];
        const CHUNK_SIZE = 50;
        let duplicadas = 0;
        const existingStrictSignatures = new Set(vendas.map(v => `${v.data}|${String(v.cliente || '').trim()}|${v.valor}|${v.criadoEm || ''}`));
        const existingLooseSignatures = new Set(vendas.map(v => `${v.data}|${String(v.cliente || '').trim()}|${v.valor}`));

        const flushBuffer = async () => {
          if (buffer.length === 0) return;
          try {
            await addVendasBatch(buffer);
            importadas += buffer.length;
          } catch (batchErr) {
            console.warn('Lote falhou, tentando um por um...', batchErr);
            for (const v of buffer) {
              try { await addVenda(v); importadas++; }
              catch { ignoradas++; }
            }
          }
          buffer = [];
          await new Promise((r) => setTimeout(r, 0));
        };

        // Normalização mínima (whitelist + coerência)
        for (const item of dadosBackup) {
          const data = isIsoDate(item.data) ? item.data : null;
          const cliente = typeof item.cliente === 'string' ? item.cliente.trim() : '';
          const valor = Number(item.valor);
          if (!data || !cliente || !Number.isFinite(valor) || valor <= 0) { ignoradas++; continue; }

          let valorEntrada = Number(item.valorEntrada);
          if (!Number.isFinite(valorEntrada) || valorEntrada < 0) valorEntrada = valor;
          if (valorEntrada > valor) valorEntrada = valor;

          const restante = round2(valor - valorEntrada);

          let percentual = Number(item.percentual);
          if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) percentual = 5;
          const comissao = round2(valor * (percentual / 100));

          let statusPagamento = 'Pago';
          if (restante > 0) statusPagamento = 'Pendente';
          if (restante === valor) statusPagamento = 'Totalmente Pendente';

          let pagoEm = item.pagoEm || null;
          if (restante > 0) pagoEm = null;

          const tipoEntrega = ['Imediata','Agendada','Futura'].includes(item.tipoEntrega) ? item.tipoEntrega : 'Imediata';
          let dataEntrega = '';
          if (tipoEntrega === 'Agendada' && isIsoDate(item.dataEntrega)) dataEntrega = item.dataEntrega;

          // v5 fields
          let valorTabela = Number(item.valorTabela);
          if (!Number.isFinite(valorTabela) || valorTabela <= 0) valorTabela = valor;

          const descontoAplicado = descontoOptions.includes(item.descontoAplicado) ? item.descontoAplicado : 'Sem desconto';
          const pagamentoDetalhe = normalizarPagamentoDetalhe(item.pagamentoDetalhe || item.pagamento);

          const motivoPendencia = restante > 0 ? String(item.motivoPendencia || 'aguardando_cartao') : null;
          const textoMotivo = restante > 0 ? String(item.textoMotivo || '').trim() : '';
          const previsaoPagamento = restante > 0 && isIsoDate(item.previsaoPagamento) ? item.previsaoPagamento : '';

          const motivoEntrega = tipoEntrega === 'Futura' ? String(item.motivoEntrega || '').trim() : '';

          const vendaNormalizada = {
            data,
            cliente,
            produtos: String(item.produtos || ''),
            pagamentoDetalhe,

            valor,
            valorEntrada,
            restante,

            percentual,
            comissao,
            statusPagamento,

            valorTabela,
            descontoAplicado,

            paymentParts: Array.isArray(item.paymentParts) && item.paymentParts.length > 0
              ? item.paymentParts.map((p) => ({ method: p.method || pagamentoDetalhe, amount: Number(p.amount) || 0 }))
              : [{ method: pagamentoDetalhe, amount: valorEntrada }],

            motivoPendencia,
            textoMotivo,
            previsaoPagamento,

            tipoEntrega,
            dataEntrega,
            motivoEntrega,

            status: 'Ativa',
            motivoCancelamento: '',
            dataCancelamento: null,

            criadoEm: item.criadoEm || new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
            pagoEm,
          };

          const baseKey = `${vendaNormalizada.data}|${vendaNormalizada.cliente}|${vendaNormalizada.valor}`;
          const strictKey = `${baseKey}|${vendaNormalizada.criadoEm || ''}`;

          // Deduplicação legacy-proof:
          // - Se o item tiver criadoEm -> match estrito
          // - Se NÃO tiver criadoEm (backups antigos) -> match solto (data|cliente|valor)
          if (vendaNormalizada.criadoEm) {
            if (existingStrictSignatures.has(strictKey)) { duplicadas++; continue; }
          } else {
            if (existingLooseSignatures.has(baseKey)) { duplicadas++; continue; }
          }

          existingStrictSignatures.add(strictKey);
          existingLooseSignatures.add(baseKey);

          buffer.push(vendaNormalizada);
          if (buffer.length >= CHUNK_SIZE) await flushBuffer();
        }

        await flushBuffer();
        alert(`Restore concluído!\n✅ ${importadas} importadas\n♻️ ${duplicadas} duplicadas evitadas\n⚠️ ${ignoradas} ignoradas`);
        await carregarVendas();
      } catch (err) {
        console.error(err);
        alert('Erro ao processar backup. Verifique se o arquivo é um JSON válido.');
      }
    };
    reader.readAsText(file);
  };

  // --- ICS ---
  const downloadIcs = (venda) => {
    if (!venda.dataEntrega || !isIsoDate(venda.dataEntrega)) return;

    let url = null;
    let link = null;

    try {
      const dtStart = venda.dataEntrega.replace(/-/g, '');
      const dateObj = new Date(venda.dataEntrega + 'T00:00:00');
      dateObj.setDate(dateObj.getDate() + 1);
      const dtEnd = formatLocalISODate(dateObj).replace(/-/g, '');

      const summary = sanitizeIcsText(`Entrega: ${venda.cliente}`);
      const description = sanitizeIcsText(`Produtos: ${venda.produtos} • Total: ${formatBRL(venda.valor)} • Restante: ${formatBRL(venda.restante)}`);

      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:${dtStart}
DTEND;VALUE=DATE:${dtEnd}
SUMMARY:${summary}
DESCRIPTION:${description}
END:VEVENT
END:VCALENDAR`;

      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      url = URL.createObjectURL(blob);

      link = document.createElement('a');
      link.href = url;

      const clienteSanitizado = (venda.cliente || 'cliente').trim().replace(/\s+/g, '_').toLowerCase();
      link.setAttribute('download', `entrega_${clienteSanitizado}_${venda.dataEntrega}.ics`);

      document.body.appendChild(link);
      link.click();
    } catch (error) {
      console.error('Erro ao gerar ICS:', error);
      alert('Não foi possível gerar o arquivo de agenda.');
    } finally {
      if (link && document.body.contains(link)) document.body.removeChild(link);
      if (url) URL.revokeObjectURL(url);
    }
  };

  // Month navigation (comparação com meses anteriores)
  const monthToInt = (m) => {
    const [y, mo] = m.split('-').map(Number);
    return y * 12 + (mo - 1);
  };
  const intToMonth = (n) => {
    const y = Math.floor(n / 12);
    const mo = (n % 12) + 1;
    return `${String(y).padStart(4,'0')}-${String(mo).padStart(2,'0')}`;
  };
  const handlePrevMonth = () => setActiveMonth(intToMonth(monthToInt(activeMonth) - 1));
  const handleNextMonth = () => setActiveMonth(intToMonth(monthToInt(activeMonth) + 1));

  // --- UI (Form/List/Reports) ---
  // FormView foi extraído para componente separado (evita perder foco ao digitar)

  const statusPillClass = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('pago')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s.includes('pendente') || s.includes('totalmente')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (s.includes('parcial')) return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const VendaCard = ({ v }) => {
    const statusLabel = v.tipoEntrega === 'Agendada' && v.dataEntrega ? 'Agendada' : (v.statusPagamento || '—');
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
        <div className="flex justify-between items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-900 text-lg truncate">{v.cliente}</div>
            <div className="text-sm text-slate-500 whitespace-pre-line line-clamp-2 mt-0.5">{v.produtos || '—'}</div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusPillClass(statusLabel)}`}>
              {statusLabel}
            </span>
            <span className="text-xs text-slate-500 mt-2">{new Date(v.data + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Total</div>
            <div className="text-right font-semibold text-slate-900 mt-0.5">{formatBRL(v.valor)}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Comissão ({v.percentual}%)</div>
            <div className="text-right font-semibold text-emerald-700 mt-0.5">{formatBRL(v.comissao)}</div>
          </div>
        </div>

        <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Pagamento</span>
            <span className="font-semibold text-slate-700">{v.pagamentoDetalhe}</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Desconto</span>
            <span className="font-semibold text-slate-700">{v.descontoAplicado}</span>
          </div>
        </div>

        {v.tipoEntrega === 'Agendada' && v.dataEntrega && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm flex justify-between items-center">
            <span className="font-semibold text-amber-800">Entrega: {new Date(v.dataEntrega + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
            <button type="button" onClick={() => downloadIcs(v)} className="text-blue-600 font-bold flex items-center gap-1.5 hover:bg-blue-50 rounded-lg px-2 py-1 transition-colors">
              <Calendar size={16} /> ICS
            </button>
          </div>
        )}

        <div className="flex justify-end items-center pt-3 border-t border-slate-100 gap-2">
          <button onClick={() => handleEdit(v)} className="p-2.5 rounded-xl text-blue-600 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition-all" title="Editar">
            <Edit size={18} />
          </button>
          <button onClick={() => handleDelete(v.id)} className="p-2.5 rounded-xl text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all" title="Excluir">
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    );
  };

  const monthLabel = (() => {
    const [y, m] = activeMonth.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  })();

  const DashboardView = () => (
    <div className="pb-28 pt-6">
      {/* Navegação do mês */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-800 capitalize">{monthLabel}</h2>
        <div className="flex items-center gap-1 bg-white rounded-full border border-slate-200 shadow-sm p-1">
          <button type="button" onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors" aria-label="Mês anterior">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button type="button" onClick={handleNextMonth} className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors" aria-label="Próximo mês">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="mb-6">
        <KPICardsV5 metricas={metricas} goalInput={monthlyGoalInput} onChangeGoal={setMonthlyGoalInput} />
      </div>

      {/* Barra de filtros premium */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Pesquisar cliente..."
              className="flex-1 min-w-[180px] p-3 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50/50"
              value={filtros.cliente}
              onChange={(e) => setFiltros((prev) => ({ ...prev, cliente: e.target.value }))}
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-3 rounded-xl border font-bold transition-all flex items-center gap-2 ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >
              <Filter size={18} /> Filtros
            </button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">De</label>
                <input type="date" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm" value={filtros.dataIni} onChange={(e) => setFiltros((prev) => ({ ...prev, dataIni: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Até</label>
                <input type="date" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm" value={filtros.dataFim} onChange={(e) => setFiltros((prev) => ({ ...prev, dataFim: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">% comissão</label>
                <select className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white" value={filtros.percentual} onChange={(e) => setFiltros((prev) => ({ ...prev, percentual: e.target.value }))}>
                  <option value="">Todas</option>
                  {[6, 5, 4, 3].map((n) => <option key={n} value={n}>{n}%</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={() => setFiltros({ cliente: '', dataIni: '', dataFim: '', percentual: '' })}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all text-sm"
                >
                  Limpar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo em 2 colunas: lista + sidebar Próximas Entregas */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <TabNavigatorV5
            activeTab={activeTab}
            onChange={setActiveTab}
            counts={{
              vendas: separarVendas.vendasOk.length,
              pendencias: separarVendas.pendencias.length,
              entregas: separarVendas.entregas.length,
            }}
          />

          {activeTab === 'vendas' && (
            <div className="space-y-4">
              {vendasFiltradas.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center text-slate-500 font-medium">Nenhuma venda finalizada neste mês.</div>
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

        {/* Sidebar Próximas Entregas */}
        <div className="lg:order-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-24">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Próximas Entregas</h3>
            </div>
            <div className="p-4 max-h-[420px] overflow-y-auto space-y-3">
              {separarVendas.entregas.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Nenhuma entrega agendada.</p>
              ) : (
                separarVendas.entregas.slice(0, 15).map((v) => {
                  const dataEnt = v.tipoEntrega === 'Agendada' && v.dataEntrega ? new Date(v.dataEntrega + 'T00:00:00').toLocaleDateString('pt-BR') : 'Futura';
                  return (
                    <div key={v.id} className="flex justify-between items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate text-sm">{v.cliente}</div>
                        <div className="text-xs text-slate-500">{dataEnt}</div>
                      </div>
                      <div className="text-right text-sm font-semibold text-slate-700 shrink-0">{formatBRL(v.valor)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ReportsView = () => (
    <div className="py-6 pb-28">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Backup & Dados</h2>
        <p className="text-sm text-slate-500 mt-1">Exporte ou importe suas vendas com segurança.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <button
          onClick={handleBackup}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold shadow-md shadow-indigo-900/20 transition-all hover:shadow-lg active:scale-[0.99]"
        >
          ☁️ Fazer Backup
        </button>

        <label className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 py-4 rounded-2xl flex justify-center items-center gap-2 cursor-pointer font-bold transition-all">
          📥 Restaurar Backup
          <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
        </label>

        <p className="text-xs text-center text-slate-500 pt-2">Versão Premium · Offline-first</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 text-white shadow-lg shadow-slate-900/5">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-5 flex items-center justify-between">
          <div className="font-extrabold text-xl tracking-tight">Controle de Vendas</div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-sm font-medium text-white/90">Admin</div>
            <span className="text-xs bg-white/15 backdrop-blur px-3 py-1.5 rounded-full font-semibold border border-white/20">Premium</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-6">
        {view === 'dashboard' && DashboardView()}
        {view === 'add' && (
          <FormViewV5
            editingId={editingId}
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSave}
            onCancel={() => {
              setEditingId(null);
              limparForm();
              setView('dashboard');
            }}
            onTipoEntregaChange={handleTipoEntregaChange}
            descontoOptions={descontoOptions}
            pagamentoOptions={pagamentoOptions}
            motivoPendenciaOptions={motivoPendenciaOptions}
            formatBRL={formatBRL}
            toMoney={toMoney}
          />
        )}
        {view === 'reports' && ReportsView()}
      </main>

      {view !== 'add' && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
          <div className="max-w-7xl mx-auto px-4 lg:px-6 flex justify-around items-center py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button
              onClick={() => { setView('dashboard'); setActiveTab('vendas'); }}
              className={`p-4 rounded-2xl transition-all ${view === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
              aria-label="Dashboard"
            >
              <BarChart size={26} strokeWidth={2} />
            </button>
            <button
              onClick={() => { limparForm(); setEditingId(null); setView('add'); }}
              className="bg-blue-600 text-white p-4 rounded-2xl -mt-10 shadow-lg shadow-blue-600/30 hover:shadow-xl hover:bg-blue-700 active:scale-95 transition-all border-4 border-white"
              aria-label="Nova venda"
            >
              <Plus size={28} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setView('reports')}
              className={`p-4 rounded-2xl transition-all ${view === 'reports' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
              aria-label="Backup"
            >
              <List size={26} strokeWidth={2} />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
