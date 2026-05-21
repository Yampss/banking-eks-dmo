const express = require('express');
const router = express.Router();
const txController = require('../controllers/transaction.controller');
const { authenticate, authorizeAdmin } = require('../middlewares/auth.middleware');

router.post('/deposit', authenticate, txController.deposit);
router.post('/withdraw', authenticate, txController.withdraw);
router.post('/transfer', authenticate, txController.transfer);
router.get('/my', authenticate, txController.getMyTransactions);
router.get('/account/:accountId', authenticate, txController.getAccountTransactions);
router.get('/all', authenticate, authorizeAdmin, txController.getAllTransactions);
router.get('/:id', authenticate, txController.getTransactionById);

module.exports = router;
