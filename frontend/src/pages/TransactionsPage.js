import React, { useState, useEffect } from 'react';
import { transactionAPI, accountAPI } from '../api';
import Sidebar from '../components/Sidebar';

const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('history');
  const [txForm, setTxForm] = useState({ account_id: '', amount: '', description: '' });
  const [transferForm, setTransferForm] = useState({ from_account_id: '', to_account_id: '', amount: '', description: '' });
  const [txLoading, setTxLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [txRes, accRes] = await Promise.all([
        transactionAPI.getMyTransactions({ limit: 50 }),
        accountAPI.getMyAccounts(),
      ]);
      setTransactions(txRes.data.data);
      setAccounts(accRes.data.data);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleTx = (type) => async (e) => {
    e.preventDefault();
    setTxLoading(true);
    setMessage(null);
    try {
      if (type === 'transfer') {
        await transactionAPI.transfer({ ...transferForm, amount: parseFloat(transferForm.amount) });
      } else if (type === 'deposit') {
        await transactionAPI.deposit({ account_id: parseInt(txForm.account_id), amount: parseFloat(txForm.amount), description: txForm.description });
      } else {
        await transactionAPI.withdraw({ account_id: parseInt(txForm.account_id), amount: parseFloat(txForm.amount), description: txForm.description });
      }
      setMessage({ type: 'success', text: `${type.charAt(0).toUpperCase() + type.slice(1)} successful!` });
      setTxForm({ account_id: '', amount: '', description: '' });
      setTransferForm({ from_account_id: '', to_account_id: '', amount: '', description: '' });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Transaction failed' });
    } finally {
      setTxLoading(false);
    }
  };

  const typeColor = { deposit: 'var(--accent-green)', withdrawal: 'var(--accent-red)', transfer: 'var(--accent-primary)' };
  const typeIcon = { deposit: '↓', withdrawal: '↑', transfer: '↔' };
  const typeBg = { deposit: 'rgba(16,185,129,0.15)', withdrawal: 'rgba(239,68,68,0.15)', transfer: 'rgba(99,102,241,0.15)' };

  return (
    <div style={styles.pageLayout}>
      <Sidebar active="transactions" />
      <div style={styles.content} className="fade-in">
        <h1 style={styles.pageTitle}>Transactions</h1>

        <div style={styles.tabs}>
          {['history', 'deposit', 'withdraw', 'transfer'].map((tab) => (
            <button
              key={tab}
              style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
              onClick={() => { setActiveTab(tab); setMessage(null); }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'history' && (
          <div>
            {loading ? (
              <div style={styles.center}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
            ) : transactions.length === 0 ? (
              <div className="card" style={styles.emptyState}>
                <div style={styles.emptyIcon}>📊</div>
                <p>No transactions yet</p>
              </div>
            ) : (
              <div style={styles.tableWrap} className="card">
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['Reference', 'Type', 'Amount', 'Description', 'Date', 'Status'].map((h) => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} style={styles.tr}>
                        <td style={styles.td}><code style={styles.refCode}>{tx.reference_id}</code></td>
                        <td style={styles.td}>
                          <div style={styles.typeCell}>
                            <div style={{ ...styles.txTypeIcon, background: typeBg[tx.type], color: typeColor[tx.type] }}>
                              {typeIcon[tx.type]}
                            </div>
                            {tx.type}
                          </div>
                        </td>
                        <td style={{ ...styles.td, color: tx.type === 'deposit' ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                          {tx.type === 'deposit' ? '+' : '-'}${parseFloat(tx.amount).toLocaleString()}
                        </td>
                        <td style={{ ...styles.td, color: 'var(--text-secondary)' }}>{tx.description || '-'}</td>
                        <td style={{ ...styles.td, color: 'var(--text-muted)' }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                        <td style={styles.td}><span className="badge badge-success">{tx.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {(activeTab === 'deposit' || activeTab === 'withdraw') && (
          <div style={styles.formWrap}>
            <div className="card" style={styles.formCard}>
              <div style={styles.formIcon}>{activeTab === 'deposit' ? '↓' : '↑'}</div>
              <h3 style={styles.formTitle}>{activeTab === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}</h3>

              {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

              <form onSubmit={handleTx(activeTab)} style={styles.form}>
                <div className="input-group">
                  <label>Select Account</label>
                  <select value={txForm.account_id} onChange={(e) => setTxForm({ ...txForm, account_id: e.target.value })} required>
                    <option value="">Choose account...</option>
                    {accounts.filter(a => a.status === 'active').map(a => (
                      <option key={a.id} value={a.id}>{a.account_type} - {a.account_number} (${parseFloat(a.balance).toLocaleString()})</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Amount (USD)</label>
                  <input type="number" min="0.01" step="0.01" placeholder="0.00" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} required />
                </div>
                <div className="input-group">
                  <label>Description (optional)</label>
                  <input type="text" placeholder="What's this for?" value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} />
                </div>
                <button className={`btn ${activeTab === 'deposit' ? 'btn-primary' : 'btn-danger'}`} style={{ width: '100%', padding: '14px' }} disabled={txLoading}>
                  {txLoading ? <span className="spinner" /> : activeTab === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'transfer' && (
          <div style={styles.formWrap}>
            <div className="card" style={styles.formCard}>
              <div style={{ ...styles.formIcon, background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)' }}>↔</div>
              <h3 style={styles.formTitle}>Transfer Funds</h3>

              {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

              <form onSubmit={handleTx('transfer')} style={styles.form}>
                <div className="input-group">
                  <label>From Account</label>
                  <select value={transferForm.from_account_id} onChange={(e) => setTransferForm({ ...transferForm, from_account_id: e.target.value })} required>
                    <option value="">Choose account...</option>
                    {accounts.filter(a => a.status === 'active').map(a => (
                      <option key={a.id} value={a.id}>{a.account_type} - {a.account_number} (${parseFloat(a.balance).toLocaleString()})</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>To Account ID</label>
                  <input type="number" placeholder="Destination account ID" value={transferForm.to_account_id} onChange={(e) => setTransferForm({ ...transferForm, to_account_id: e.target.value })} required />
                </div>
                <div className="input-group">
                  <label>Amount (USD)</label>
                  <input type="number" min="0.01" step="0.01" placeholder="0.00" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} required />
                </div>
                <div className="input-group">
                  <label>Description (optional)</label>
                  <input type="text" placeholder="Transfer note" value={transferForm.description} onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })} />
                </div>
                <button className="btn btn-primary" style={{ width: '100%', padding: '14px' }} disabled={txLoading}>
                  {txLoading ? <span className="spinner" /> : 'Transfer Funds'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  pageLayout: { display: 'flex', minHeight: '100vh' },
  content: { flex: 1, padding: '32px', overflowY: 'auto' },
  pageTitle: { fontSize: '26px', fontWeight: '700', marginBottom: '24px' },
  tabs: { display: 'flex', gap: '4px', background: 'var(--bg-card)', borderRadius: '12px', padding: '4px', marginBottom: '24px', width: 'fit-content', border: '1px solid var(--border-color)' },
  tab: { padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s' },
  tabActive: { background: 'var(--accent-primary)', color: 'white', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' },
  center: { display: 'flex', justifyContent: 'center', padding: '40px' },
  emptyState: { textAlign: 'center', padding: '48px', color: 'var(--text-muted)' },
  emptyIcon: { fontSize: '40px', marginBottom: '12px' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '14px 16px', fontSize: '14px' },
  refCode: { background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--accent-primary)' },
  typeCell: { display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'capitalize' },
  txTypeIcon: { width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' },
  formWrap: { display: 'flex', justifyContent: 'center' },
  formCard: { width: '100%', maxWidth: '480px', padding: '32px' },
  formIcon: { width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700', marginBottom: '16px' },
  formTitle: { fontSize: '20px', fontWeight: '700', marginBottom: '24px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
};

export default TransactionsPage;
