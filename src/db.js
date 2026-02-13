import { openDB } from 'idb';

const DB_NAME = 'controle-vendas-db';
const DB_VERSION = 5;
const STORE_NAME = 'sales';

export async function initDB() {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Se o store não existe, criar
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('cliente', 'cliente', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('dataPrevista', 'dataPrevista', { unique: false });
        store.createIndex('dataEntregue', 'dataEntregue', { unique: false });
      }

      // Migração de dados antigos para v5
      if (oldVersion < 5) {
        const store = transaction.objectStore(STORE_NAME);
        store.openCursor().then(function migrate(cursor) {
          if (!cursor) return;
          
          const sale = cursor.value;
          
          // Adicionar campos que podem estar faltando
          const updatedSale = {
            ...sale,
            valorTabela: sale.valorTabela || sale.valorFinal || 0,
            desconto: sale.desconto || 0,
            pagamento: sale.pagamento || {
              sinal: 0,
              dataSinal: '',
              restante: 0,
              dataRestante: '',
              formaPagamento: 'dinheiro'
            },
            pendenciaMotivo: sale.pendenciaMotivo || '',
            entregaFuturaMotivo: sale.entregaFuturaMotivo || '',
            observacoes: sale.observacoes || ''
          };

          cursor.update(updatedSale);
          return cursor.continue().then(migrate);
        });
      }
    },
  });

  return db;
}

export async function getAllSales() {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export async function getSale(id) {
  const db = await initDB();
  return db.get(STORE_NAME, id);
}

export async function addSale(sale) {
  const db = await initDB();
  const saleData = {
    ...sale,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return db.add(STORE_NAME, saleData);
}

export async function updateSale(id, sale) {
  const db = await initDB();
  const saleData = {
    ...sale,
    id,
    updatedAt: new Date().toISOString()
  };
  return db.put(STORE_NAME, saleData);
}

export async function deleteSale(id) {
  const db = await initDB();
  return db.delete(STORE_NAME, id);
}

export async function getSalesByStatus(status) {
  const db = await initDB();
  return db.getAllFromIndex(STORE_NAME, 'status', status);
}

export async function getSalesByMonth(year, month) {
  const db = await initDB();
  const all = await db.getAll(STORE_NAME);
  const targetMonth = `${year}-${String(month).padStart(2, '0')}`;
  
  return all.filter(sale => {
    const saleMonth = sale.dataEntregue 
      ? sale.dataEntregue.substring(0, 7) 
      : sale.dataPrevista.substring(0, 7);
    return saleMonth === targetMonth;
  });
}
