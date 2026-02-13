import { getVendas, putVendasBatch } from '../db';

const LS_SCHEMA_KEY = 'vendas_schema_version';
const CURRENT_VERSION = 6; // Incrementado para refletir as mudanças premium

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

const toFiniteNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const normalizarVenda = (item) => {
  const data = isIsoDate(item.data) ? item.data : null;
  const cliente = typeof item.cliente === 'string' ? item.cliente.trim() : '';
  const valor = toFiniteNumber(item.valor);

  if (!data || !cliente || !Number.isFinite(valor) || valor <= 0) return null;

  let valorEntrada = toFiniteNumber(item.valorEntrada);
  if (!Number.isFinite(valorEntrada) || valorEntrada < 0) valorEntrada = valor;
  if (valorEntrada > valor) valorEntrada = valor;

  const restante = round2(valor - valorEntrada);
  let percentual = toFiniteNumber(item.percentual);
  if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) percentual = 5;
  const comissao = round2(valor * (percentual / 100));

  // Novos campos v5 Premium
  const pendingObservation = item.pendingObservation || item.textoMotivo || "";
  const deliveryDeadlineDays = item.deliveryDeadlineDays || "";
  const deliveryReason = item.deliveryReason || item.motivoEntrega || "";
  const paidAmount = item.paidAmount !== undefined ? toFiniteNumber(item.paidAmount) : valorEntrada;

  return {
    ...item,
    id: item.id,
    data,
    cliente,
    produtos: String(item.produtos || ''),
    valor,
    valorEntrada,
    restante,
    percentual,
    comissao,
    statusPagamento: restante > 0 ? (restante === valor ? 'Totalmente Pendente' : 'Pendente') : 'Pago',
    
    // Campos Premium
    pendingObservation,
    deliveryDeadlineDays,
    deliveryReason,
    paidAmount,
    
    status: item.status === 'Cancelada' ? 'Cancelada' : 'Ativa',
    criadoEm: item.criadoEm || new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
};

export const verificarMigracao = async () => {
  const current = Number(localStorage.getItem(LS_SCHEMA_KEY) || '0');
  if (current >= CURRENT_VERSION) return;

  const vendas = await getVendas();
  const normalizadas = [];
  
  for (const v of vendas) {
    try {
      const nv = normalizarVenda(v);
      if (nv) normalizadas.push(nv);
    } catch (e) {
      console.error("Erro ao normalizar venda ID:", v.id, e);
    }
  }

  await putVendasBatch(normalizadas);
  localStorage.setItem(LS_SCHEMA_KEY, String(CURRENT_VERSION));
  console.info(`✅ Migração v${CURRENT_VERSION} aplicada. Registros: ${normalizadas.length}`);
};
