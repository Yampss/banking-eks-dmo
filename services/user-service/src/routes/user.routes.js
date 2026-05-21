const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate, authorizeAdmin } = require('../middlewares/auth.middleware');

router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/verify-token', userController.verifyToken);

router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);

router.get('/', authenticate, authorizeAdmin, userController.getAllUsers);
router.get('/:id', authenticate, userController.getUserById);

module.exports = router;
