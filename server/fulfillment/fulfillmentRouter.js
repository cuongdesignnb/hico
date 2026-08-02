import express from 'express';
import { projectOrderForDashboard } from '../orders/orderValidation.js';
import { sendCheckoutError } from '../checkout/checkoutError.js';

export const createFulfillmentRouter = ({ orderRepository } = {}) => {
  const router = express.Router();
  router.get('/user/orders', async (req, res) => {
    try {
      const orders = await orderRepository.list();
      return res.json(orders.map(projectOrderForDashboard));
    } catch (error) {
      return sendCheckoutError(res, error);
    }
  });
  return router;
};
