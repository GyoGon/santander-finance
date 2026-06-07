let summary = null;
let currentTxId = null;

function fmt(n) {
  if (n == null) return '—';
  return '$' + Math.abs(n).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

async function loadSummary() {
  const res = await fetch('/api/summary');
  summary = await res.json();
  render();
}

function render() {
  if (!summary) return;
  const { transactions, splits, debtors, loan, spending, projection, commitment, lastSync } = summary;

  document.getElementById('last-sync').textContent = lastSync
    ? 'Sync: ' + new Date(lastSync).toLocaleString('es-CL')
    : 'Sin sincronizar';

  document.getElementById('card-total').textContent = fmt(spending.totalCard);
  document.getElementById('card-own').textContent = fmt(spending.cardOwnOnly);
  document.getElementById('card-debtors-owe').textContent = fmt(spending.totalDebtorsOwe);

  if (loan) {
    document.getElementById('loan-balance').textContent = fmt(loan.balance);
    document.getElementById('loan-payment').textContent = fmt(loan.monthly_payment);
    document.getElementById('loan-remaining').textContent = loan.remaining_installments;
    document.getElementById('loan-payoff').textContent = projection?.payoffDate || '—';
    const daysUntilDue = Math.ceil((new Date(loan.due_date) - new Date()) / 86400000);
    const dueEl = document.getElementById('loan-due');
    if (daysUntilDue <= 5) {
      dueEl.textContent = '⚠️ Vencimiento en ' + daysUntilDue + ' días: ' + loan.due_date;
      dueEl.classList.remove('hidden');
    }
  }

  document.getElementById('cmt-card').textContent = fmt(spending.cardOwnOnly);
  document.getElementById('cmt-loan').textContent = loan ? fmt(loan.monthly_payment) : '—';
  document.getElementById('cmt-total').textContent = fmt(commitment);

  const debtorsList = document.getElementById('debtors-list');
  debtorsList.innerHTML = debtors.length === 0
    ? '<p style="color:#888;font-size:14px;padding:8px 0">Nadie te debe nada 🎉</p>'
    : debtors.map(d =>
        '<div class="debtor-card"><span><strong>' + d.name + '</strong></span>' +
        '<span class="debtor-amount">' + fmt(d.total_owed) + '</span></div>'
      ).join('');

  const splitMap = {};
  for (const s of splits) {
    if (!splitMap[s.transaction_id]) splitMap[s.transaction_id] = [];
    splitMap[s.transaction_id].push(s);
  }

  const txList = document.getElementById('tx-list');
  if (transactions.length === 0) {
    txList.innerHTML = '<p style="color:#888;font-size:14px;padding:16px 0;text-align:center">Sin transacciones. Haz clic en Sincronizar para traer datos de Santander.</p>';
    return;
  }

  // Build table safely using DOM (not innerHTML) for user-data cells
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Fecha</th><th>Descripción</th><th>Monto</th><th>Estado</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  for (const tx of transactions) {
    const txSplits = splitMap[tx.id] || [];
    const tr = document.createElement('tr');

    const tdDate = document.createElement('td');
    tdDate.textContent = tx.date;

    const tdDesc = document.createElement('td');
    tdDesc.textContent = tx.description; // safe: textContent

    const tdAmt = document.createElement('td');
    tdAmt.textContent = fmt(tx.amount);
    tdAmt.style.color = tx.amount < 0 ? '#d32f2f' : '#388e3c';

    const tdStatus = document.createElement('td');
    if (txSplits.length > 0) {
      const badge = document.createElement('span');
      badge.className = 'badge-split';
      badge.textContent = '✓ ' + txSplits.map(s => s.debtor_name + ' ' + s.percentage + '%').join(', ');
      tdStatus.appendChild(badge);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn-split';
      btn.textContent = '⚡ Dividir';
      btn.dataset.txid = tx.id; // safe: dataset instead of onclick
      btn.addEventListener('click', () => openSplitModal(tx.id));
      tdStatus.appendChild(btn);
    }

    tr.appendChild(tdDate);
    tr.appendChild(tdDesc);
    tr.appendChild(tdAmt);
    tr.appendChild(tdStatus);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  txList.innerHTML = '';
  txList.appendChild(table);
}

function openSplitModal(txId) {
  currentTxId = txId;
  const tx = summary.transactions.find(t => t.id === txId);
  document.getElementById('modal-tx-desc').textContent = tx.description + ' — ' + fmt(tx.amount);
  document.getElementById('split-rows').innerHTML = '';
  addDebtorRow();
  document.getElementById('split-modal').classList.remove('hidden');
}

function addDebtorRow() {
  const row = document.createElement('div');
  row.className = 'split-row';
  row.innerHTML = '<input type="text" placeholder="Nombre" class="debtor-name"><input type="number" placeholder="%" class="debtor-pct" min="1" max="100" step="1">';
  document.getElementById('split-rows').appendChild(row);
}

document.getElementById('add-debtor-btn').addEventListener('click', addDebtorRow);
document.getElementById('cancel-split-btn').addEventListener('click', () => document.getElementById('split-modal').classList.add('hidden'));

document.getElementById('save-split-btn').addEventListener('click', async () => {
  const rows = document.querySelectorAll('.split-row');
  const debtors = [];
  for (const row of rows) {
    const name = row.querySelector('.debtor-name').value.trim();
    const pct = parseFloat(row.querySelector('.debtor-pct').value);
    if (name && !isNaN(pct) && pct > 0) debtors.push({ name, percentage: pct });
  }
  if (debtors.length === 0) return alert('Ingresa al menos una persona y porcentaje.');
  const res = await fetch('/api/split', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionId: currentTxId, debtors }),
  });
  if (!res.ok) { const err = await res.json(); return alert('Error: ' + err.error); }
  document.getElementById('split-modal').classList.add('hidden');
  await loadSummary();
});

document.getElementById('btn-sync').addEventListener('click', async () => {
  const btn = document.getElementById('btn-sync');
  btn.textContent = '⏳ Sincronizando...';
  btn.disabled = true;
  try {
    const res = await fetch('/api/sync', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      alert('Error al sincronizar: ' + (err.error || 'Error desconocido'));
    }
  } catch (e) {
    alert('No se pudo conectar con el servidor.');
  }
  await loadSummary();
  btn.textContent = '🔄 Sincronizar';
  btn.disabled = false;
});

loadSummary();
