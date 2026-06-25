const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { auth, authCustomer, authStaff, authAdmin } = require('../middleware/auth');

router.post('/', auth(), authCustomer, orderController.createOrder);

router.get('/my', auth(), authCustomer, orderController.getMyOrders);

router.get('/phone/:phone', auth(), authStaff, orderController.getOrdersByPhone);

router.get('/:orderId', auth(), orderController.getOrderDetail);

router.patch('/:orderId/status', auth(), authStaff, orderController.updateOrderStatus);

router.get('/', auth(), authStaff, orderController.getAllOrders);

module.exports = router;
