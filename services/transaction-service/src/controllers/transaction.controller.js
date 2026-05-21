const axios = require('axios');
const Transaction = require('../models/transaction.model');

const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || 'http://account-service:3002';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3005';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal_secret_key';

const internalHeaders = { 'x-internal-key': INTERNAL_API_KEY };

const deposit = async (req, res) => {
  try {
    const { account_id, amount, description } = req.body;
    const user_id = req.user.id;

    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    const creditRes = await axios.post(
      `${ACCOUNT_SERVICE_URL}/api/accounts/internal/credit`,
      { account_id, amount },
      { headers: internalHeaders }
    );

    const tx = await Transaction.create({
      user_id,
      to_account_id: account_id,
      type: 'deposit',
      amount,
      description: description || 'Deposit',
    });

    await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications/internal`, {
      user_id,
      type: 'transaction',
      title: 'Deposit Successful',
      message: `Your deposit of $${amount} was successful. Ref: ${tx.reference_id}`,
      metadata: { transaction_id: tx.id },
    }, { headers: internalHeaders }).catch(() => {});

    return res.status(201).json({ success: true, data: { transaction: tx, account: creditRes.data.data } });
  } catch (err) {
    const msg = err.response?.data?.message || 'Transaction failed';
    return res.status(err.response?.status || 500).json({ success: false, message: msg });
  }
};

const withdraw = async (req, res) => {
  try {
    const { account_id, amount, description } = req.body;
    const user_id = req.user.id;

    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    const debitRes = await axios.post(
      `${ACCOUNT_SERVICE_URL}/api/accounts/internal/debit`,
      { account_id, amount },
      { headers: internalHeaders }
    );

    const tx = await Transaction.create({
      user_id,
      from_account_id: account_id,
      type: 'withdrawal',
      amount,
      description: description || 'Withdrawal',
    });

    await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications/internal`, {
      user_id,
      type: 'transaction',
      title: 'Withdrawal Successful',
      message: `Your withdrawal of $${amount} was successful. Ref: ${tx.reference_id}`,
      metadata: { transaction_id: tx.id },
    }, { headers: internalHeaders }).catch(() => {});

    return res.status(201).json({ success: true, data: { transaction: tx, account: debitRes.data.data } });
  } catch (err) {
    const msg = err.response?.data?.message || 'Transaction failed';
    return res.status(err.response?.status || 500).json({ success: false, message: msg });
  }
};

const transfer = async (req, res) => {
  try {
    const { from_account_id, to_account_id, amount, description } = req.body;
    const user_id = req.user.id;

    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });
    if (from_account_id === to_account_id) return res.status(400).json({ success: false, message: 'Cannot transfer to same account' });

    await axios.post(
      `${ACCOUNT_SERVICE_URL}/api/accounts/internal/debit`,
      { account_id: from_account_id, amount },
      { headers: internalHeaders }
    );

    await axios.post(
      `${ACCOUNT_SERVICE_URL}/api/accounts/internal/credit`,
      { account_id: to_account_id, amount },
      { headers: internalHeaders }
    );

    const tx = await Transaction.create({
      user_id,
      from_account_id,
      to_account_id,
      type: 'transfer',
      amount,
      description: description || 'Transfer',
    });

    await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications/internal`, {
      user_id,
      type: 'transaction',
      title: 'Transfer Successful',
      message: `Transfer of $${amount} completed. Ref: ${tx.reference_id}`,
      metadata: { transaction_id: tx.id },
    }, { headers: internalHeaders }).catch(() => {});

    return res.status(201).json({ success: true, data: { transaction: tx } });
  } catch (err) {
    const msg = err.response?.data?.message || 'Transfer failed';
    return res.status(err.response?.status || 500).json({ success: false, message: msg });
  }
};

const getMyTransactions = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const transactions = await Transaction.findByUserId(req.user.id, parseInt(limit), parseInt(offset));
    return res.status(200).json({ success: true, data: transactions });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getAccountTransactions = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const transactions = await Transaction.findByAccountId(req.params.accountId, parseInt(limit), parseInt(offset));
    return res.status(200).json({ success: true, data: transactions });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getTransactionById = async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });
    return res.status(200).json({ success: true, data: tx });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getAllTransactions = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const transactions = await Transaction.getAll(parseInt(limit), parseInt(offset));
    return res.status(200).json({ success: true, data: transactions });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { deposit, withdraw, transfer, getMyTransactions, getAccountTransactions, getTransactionById, getAllTransactions };
