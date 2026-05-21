const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');
const { authenticate, authorizeAdmin, internalOnly } = require('../middlewares/auth.middleware');

router.post('/internal/credit', internalOnly, accountController.creditAccount);
router.post('/internal/debit', internalOnly, accountController.debitAccount);

router.post('/', authenticate, accountController.createAccount);
router.get('/my', authenticate, accountController.getMyAccounts);
router.get('/all', authenticate, authorizeAdmin, accountController.getAllAccounts);
router.get('/number/:accountNumber', authenticate, accountController.getByAccountNumber);
router.patch('/:id/status', authenticate, authorizeAdmin, accountController.updateAccountStatus);
router.get('/:id', authenticate, accountController.getAccountById);

module.exports = router;
