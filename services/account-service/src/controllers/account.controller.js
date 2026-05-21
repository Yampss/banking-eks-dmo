const Account = require('../models/account.model');

const createAccount = async (req, res) => {
  try {
    const { account_type, currency } = req.body;
    const user_id = req.user.id;

    const account = await Account.create({ user_id, account_type, currency });
    return res.status(201).json({ success: true, data: account });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getMyAccounts = async (req, res) => {
  try {
    const accounts = await Account.findByUserId(req.user.id);
    return res.status(200).json({ success: true, data: accounts });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getAccountById = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    if (account.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.status(200).json({ success: true, data: account });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getByAccountNumber = async (req, res) => {
  try {
    const account = await Account.findByAccountNumber(req.params.accountNumber);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    return res.status(200).json({ success: true, data: account });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateAccountStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['active', 'suspended', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const account = await Account.updateStatus(req.params.id, status);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    return res.status(200).json({ success: true, data: account });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getAllAccounts = async (req, res) => {
  try {
    const accounts = await Account.getAll();
    return res.status(200).json({ success: true, data: accounts });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const creditAccount = async (req, res) => {
  try {
    const { account_id, amount } = req.body;
    if (amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    const account = await Account.updateBalance(account_id, amount);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found or inactive' });
    return res.status(200).json({ success: true, data: account });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const debitAccount = async (req, res) => {
  try {
    const { account_id, amount } = req.body;
    const account = await Account.findById(account_id);

    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    if (account.balance < amount) return res.status(400).json({ success: false, message: 'Insufficient funds' });

    const updated = await Account.updateBalance(account_id, -amount);
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  createAccount,
  getMyAccounts,
  getAccountById,
  getByAccountNumber,
  updateAccountStatus,
  getAllAccounts,
  creditAccount,
  debitAccount,
};
