const axios = require('axios');

const ACCOUNT_SERVICE = process.env.ACCOUNT_SERVICE_URL || 'http://account-service:3002';
const TRANSACTION_SERVICE = process.env.TRANSACTION_SERVICE_URL || 'http://transaction-service:3003';

/**
 * Detect whether the user's message is asking about banking data.
 * Returns: 'balance' | 'transactions' | 'both' | null
 */
const detectIntent = (message) => {
  const lower = message.toLowerCase();

  const balanceKeywords    = ['balance', 'account', 'money', 'fund', 'saving', 'checking', 'how much', 'worth'];
  const transactionKeywords = ['transaction', 'transfer', 'history', 'payment', 'sent', 'received', 'deposit', 'withdraw', 'recent', 'last', 'spent'];

  const wantsBalance      = balanceKeywords.some(k => lower.includes(k));
  const wantsTransactions = transactionKeywords.some(k => lower.includes(k));

  if (wantsBalance && wantsTransactions) return 'both';
  if (wantsBalance) return 'balance';
  if (wantsTransactions) return 'transactions';
  return null;
};

/**
 * Mask an account number — show only last 4 digits.
 * e.g. "ACC-1234567890" → "ACC-****7890"
 */
const maskAccountNumber = (num) => {
  if (!num || num.length < 4) return '****';
  return num.slice(0, -4).replace(/[A-Z0-9]/g, '*') + num.slice(-4);
};

/**
 * Fetch the user's accounts from account-service using their JWT.
 * Returns a formatted plain-text summary safe to send to Bedrock.
 * Raw account numbers are masked. No full account IDs in the prompt.
 */
const fetchAccountSummary = async (jwt) => {
  try {
    const res = await axios.get(`${ACCOUNT_SERVICE}/api/accounts/my`, {
      headers: { Authorization: `Bearer ${jwt}` },
      timeout: 5000,
    });

    const accounts = res.data?.data || [];
    if (accounts.length === 0) return 'The user has no accounts on record.';

    const lines = accounts.map(acc => {
      const masked = maskAccountNumber(acc.account_number);
      const balance = parseFloat(acc.balance || 0).toFixed(2);
      return `- ${acc.account_type.charAt(0).toUpperCase() + acc.account_type.slice(1)} account (ending ${masked.slice(-4)}): $${balance} ${acc.currency} [${acc.status}]`;
    });

    const total = accounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0).toFixed(2);
    return `User's accounts:\n${lines.join('\n')}\nTotal across all accounts: $${total} USD`;
  } catch (err) {
    console.error(JSON.stringify({ event: 'banking_fetch_error', service: 'account', error: err.message }));
    return null; // Graceful degradation — AI will respond without live data
  }
};

/**
 * Fetch the user's recent transactions from transaction-service using their JWT.
 * Returns a formatted summary safe for Bedrock — no account IDs exposed.
 */
const fetchTransactionSummary = async (jwt) => {
  try {
    const res = await axios.get(`${TRANSACTION_SERVICE}/api/transactions/my`, {
      headers: { Authorization: `Bearer ${jwt}` },
      params: { limit: 10 },
      timeout: 5000,
    });

    const txs = res.data?.data || [];
    if (txs.length === 0) return 'The user has no recent transactions.';

    const lines = txs.slice(0, 10).map(tx => {
      const sign    = tx.type === 'deposit' ? '+' : '-';
      const amount  = parseFloat(tx.amount || 0).toFixed(2);
      const date    = new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const desc    = tx.description ? ` (${tx.description})` : '';
      return `- ${date}: ${tx.type} ${sign}$${amount}${desc} [${tx.status}]`;
    });

    return `Recent transactions (last 10):\n${lines.join('\n')}`;
  } catch (err) {
    console.error(JSON.stringify({ event: 'banking_fetch_error', service: 'transaction', error: err.message }));
    return null;
  }
};

/**
 * Main function: given a user message and their JWT,
 * fetch the relevant banking context and return a formatted string
 * ready to be injected into the Bedrock system prompt.
 *
 * SECURITY NOTE: This context string is constructed server-side.
 * The browser never receives raw financial data from this service.
 */
const buildBankingContext = async (message, jwt) => {
  const intent = detectIntent(message);
  if (!intent) return null; // No banking data needed for this message

  const parts = [];

  if (intent === 'balance' || intent === 'both') {
    const summary = await fetchAccountSummary(jwt);
    if (summary) parts.push(summary);
  }

  if (intent === 'transactions' || intent === 'both') {
    const summary = await fetchTransactionSummary(jwt);
    if (summary) parts.push(summary);
  }

  return parts.length > 0 ? parts.join('\n\n') : null;
};

module.exports = { buildBankingContext, detectIntent };
