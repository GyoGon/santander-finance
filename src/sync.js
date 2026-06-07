// Main sync orchestrator: fetches data from Santander Chile via Floid API
// Requires in .env: FLOID_API_KEY, SANTANDER_RUT, SANTANDER_CLAVE
// Run: node -r dotenv/config src/sync.js

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db/schema');
const { upsertTransaction } = require('./db/transactions');
const { upsertLoan } = require('./db/loan');
const { getProducts, getCardTransactions } = require('./santander/client');

const DB_PATH = path.join(__dirname, '../../data/santander.db');

function getEnvOrThrow(key) {
  const val = process.env[key];
  if (!val) throw new Error(`${key} not set. Add it to your .env file.`);
  return val;
}

async function sync() {
  const rut = getEnvOrThrow('SANTANDER_RUT');
  const clave = getEnvOrThrow('SANTANDER_CLAVE');

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  initDb(db);

  console.log('Fetching Santander products via Floid...');
  let products;
  try {
    products = await getProducts(rut, clave);
    console.log('  Products received.');
  } catch (err) {
    console.error('  Failed to fetch products:', err.message);
    console.error('  NOTE: Endpoint paths may need adjustment. Check your Floid API docs.');
    db.close();
    throw err;
  }

  // Persist loan data if present
  // Floid response shape may vary — adjust field names to match actual API response
  const loanProduct = (products.data || products.products || []).find(
    p => (p.type || p.tipo || '').toLowerCase().includes('crédito') ||
         (p.type || p.tipo || '').toLowerCase().includes('credito') ||
         (p.type || p.tipo || '').toLowerCase().includes('loan')
  );
  if (loanProduct) {
    upsertLoan(db, {
      balance: loanProduct.balance || loanProduct.saldo || 0,
      monthly_payment: loanProduct.monthlyPayment || loanProduct.cuota || 0,
      remaining_installments: loanProduct.remainingInstallments || loanProduct.cuotasRestantes || 0,
      due_date: loanProduct.dueDate || loanProduct.vencimiento || new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    });
    console.log('  Loan data saved.');
  }

  console.log('Fetching credit card transactions via Floid...');
  let cardData;
  try {
    cardData = await getCardTransactions(rut, clave);
    console.log('  Card transactions received.');
  } catch (err) {
    console.error('  Failed to fetch card transactions:', err.message);
    db.close();
    throw err;
  }

  // Normalize and store transactions
  // Floid response shape may vary — adjust field names to match actual API response
  const transactions = cardData.data || cardData.transactions || cardData.movimientos || [];
  let count = 0;
  for (const tx of transactions) {
    const amount = parseFloat(tx.amount || tx.monto || tx.importe || 0);
    const description = tx.description || tx.descripcion || tx.glosa || tx.comercio || 'Sin descripción';
    const date = tx.date || tx.fecha || new Date().toISOString().split('T')[0];
    const id = tx.id || tx.transactionId || `floid-${date}-${Math.abs(amount)}-${count}`;

    upsertTransaction(db, {
      id: String(id),
      bank_id: 'santander-cl',
      date: String(date).substring(0, 10),
      amount,
      description: String(description).substring(0, 255),
      type: amount < 0 ? 'debit' : 'credit',
      account_type: 'card',
      synced_at: new Date().toISOString(),
    });
    count++;
  }
  console.log(`  ${count} transactions saved.`);

  db.prepare("INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('last_sync', ?)").run(new Date().toISOString());
  db.close();
  console.log('Sync complete.');
}

module.exports = { sync };

if (require.main === module) {
  require('dotenv').config();
  sync().catch(err => { console.error(err.message); process.exit(1); });
}
