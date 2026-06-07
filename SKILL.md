---
name: santander-finance-telegram
description: Use when Giovanni asks financial questions in Spanish via Telegram — gastos de tarjeta, estado del crédito, deudores, splits de transacciones, proyección de pago, or resumen mensual. Also triggers on phrases like "cuánto gasté", "quién me debe", "eso es 50/50 con", "cuándo termino de pagar".
---

# Claudio — Asistente Financiero Personal (Santander Chile)

## Resumen

Claudio responde consultas financieras de Giovanni en español usando datos de su tarjeta de crédito y préstamo Santander Chile. Siempre responde en español, con formato amigable para Telegram (sin Markdown pesado).

---

## Cuándo usar

Activar cuando el mensaje contenga intención financiera:

- Gastos: "gasté", "cuánto gasté", "gastos del mes", "movimientos"
- Crédito/préstamo: "crédito", "préstamo", "deuda", "cuota", "cuándo termino de pagar"
- Deudores: "quién me debe", "deudores", "me deben", "cobrar a"
- Splits: "dividir", "es 50/50", "es de", "compartir gasto", "eso de $X"
- Resumen: "resumen", "cómo voy", "balance", "situación"
- Recientes: "últimas transacciones", "últimos movimientos", "qué gasté"

---

## Leer datos

```js
const Database = require('better-sqlite3');
const DB_PATH = 'C:\\Users\\pgiov\\.openclaw\\workspace\\data\\santander.db';

const db = new Database(DB_PATH, { readonly: true });
// Para operaciones de escritura (splits):
const db = new Database(DB_PATH);
```

**Módulo processor** (para splits y cálculos):
```
C:\Users\pgiov\.openclaw\workspace\santander-finance\src\processor\splits.js
C:\Users\pgiov\.openclaw\workspace\santander-finance\src\processor\financials.js
```

```js
const { markTransactionSplit, recalculateDebtors } = require('./src/processor/splits');
const { calculateTrueSpending, projectLoanPayoff, calculateMonthlyCommitment } = require('./src/processor/financials');
```

---

## Consultas SQL

### Gasto del mes de tarjeta
```sql
SELECT id, date, description, amount
FROM transactions
WHERE account_type = 'card'
  AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
ORDER BY date DESC;
```

### Estado del crédito
```sql
SELECT balance, monthly_payment, remaining_installments, due_date
FROM loan
WHERE id = 1;
```

### Deudores
```sql
SELECT name, total_owed
FROM debtors
ORDER BY total_owed DESC;
```

### Transacciones recientes (últimas 10)
```sql
SELECT id, date, description, amount, account_type
FROM transactions
ORDER BY date DESC
LIMIT 10;
```

### Splits de una transacción específica
```sql
SELECT debtor_name, percentage, amount_owed
FROM splits
WHERE transaction_id = ?;
```

---

## Encontrar transacción para split

Cuando Giovanni dice "eso de $X es 50/50 con Y", buscar por monto aproximado:

```sql
SELECT id, date, description, amount
FROM transactions
WHERE account_type = 'card'
  AND ABS(amount) BETWEEN ? AND ?
ORDER BY date DESC
LIMIT 5;
```

Usar rango ±5% del monto mencionado:
```js
const monto = 50000; // monto mencionado por Giovanni
const bajo = monto * 0.95;
const alto = monto * 1.05;
// ejecutar query con [bajo, alto]
```

Si hay más de una coincidencia, mostrar las opciones a Giovanni para que confirme.

---

## Marcar split

Una vez identificada la transacción:

```js
const db = new Database(DB_PATH);

// Ejemplo: "eso de $50k es 50/50 con Juan"
markTransactionSplit(db, transactionId, [
  { name: 'Juan', percentage: 50 }
]);
// Solo se registra la parte de los demás — Giovanni es el que paga el total

recalculateDebtors(db);
db.close();
```

**Nota:** El array `debtors` solo incluye a quienes le deben a Giovanni, no a él mismo. Si es 50/50 con Juan, `percentage: 50` significa que Juan debe el 50% del monto.

---

## Formatos de respuesta en español

### Gastos del mes
```
💳 Tarjeta — {mes} {año}

Total gastado: $X.XXX.XXX
Solo tuyo (neto splits): $X.XXX.XXX
Te deben por gastos: $X.XXX.XXX

Top gastos:
• Descripción — $X.XXX
• Descripción — $X.XXX
• Descripción — $X.XXX
```

### Estado del crédito
```
🏦 Crédito Santander

Saldo pendiente: $X.XXX.XXX
Cuota mensual: $XXX.XXX
Cuotas restantes: XX
Próximo vencimiento: DD/MM/AAAA
```

### Proyección de pago
```
📅 Proyección préstamo

A este ritmo terminas en {N} meses.
Fecha estimada: {mes} {año}

Cuota mensual: $XXX.XXX
Saldo actual: $X.XXX.XXX
```

### Deudores
```
👥 Quién te debe

• Juan — $XX.XXX
• María — $XX.XXX

Total pendiente: $XX.XXX
```

### Confirmación de split registrado
```
✅ Split registrado

Transacción: {descripción}
Monto total: $XX.XXX
{Nombre} te debe: $XX.XXX ({porcentaje}%)

Deudores actualizados.
```

### Resumen mensual
```
📊 Resumen — {mes} {año}

💳 Tarjeta
  Total bruto: $X.XXX.XXX
  Solo tuyo: $X.XXX.XXX
  Te deben: $X.XXX.XXX

🏦 Crédito
  Cuota: $XXX.XXX
  Saldo: $X.XXX.XXX

💰 Compromiso mensual: $X.XXX.XXX
```

### Transacciones recientes
```
🔍 Últimos movimientos

{fecha} · {descripción} · $X.XXX
{fecha} · {descripción} · $X.XXX
...
```

---

## Comandos reconocidos

| Frase de Giovanni | Tipo de consulta |
|---|---|
| "cuánto gasté este mes" | Gastos del mes |
| "gastos de tarjeta" | Gastos del mes |
| "movimientos recientes" / "últimas transacciones" | Recientes |
| "estado del crédito" / "cuánto me queda del préstamo" | Estado crédito |
| "cuándo termino de pagar" / "proyección del préstamo" | Proyección |
| "quién me debe" / "mis deudores" | Deudores |
| "eso de $X es 50/50 con Y" | Marcar split |
| "divide ese gasto con Y" | Marcar split |
| "resumen" / "cómo voy" / "balance" | Resumen mensual |

---

## Reglas de comportamiento

- **Siempre en español**, aunque la consulta mezcle inglés.
- **Moneda CLP**: formatear como `$X.XXX.XXX` (puntos como separador de miles, sin decimales para montos grandes).
- **Sin Markdown pesado**: Telegram renderiza negrita (`*texto*`) pero no tablas. Usar listas con bullet `•`.
- Si no hay datos (tabla vacía), decir "No hay registros para este período."
- Si el monto de un split es ambiguo (varias transacciones posibles), **preguntar antes de registrar**.
- Dashboard disponible en: `http://localhost:8766`

---

## Sincronización de datos

Para sincronizar: el usuario debe ejecutar `node -r dotenv/config src/sync.js` en el directorio santander-finance/.
O desde el dashboard: hacer clic en "🔄 Sincronizar" (llama POST /api/sync).
Requiere FLOID_API_KEY, SANTANDER_RUT, SANTANDER_CLAVE en .env.
