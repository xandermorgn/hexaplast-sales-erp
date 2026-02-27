import express from 'express';
import { requireSession } from '../middleware/sessionMiddleware.js';
import {
  approveWorkOrder,
  createWorkOrder,
  createWorkOrderFromPerforma,
  deleteWorkOrder,
  getWorkOrderById,
  getWorkOrders,
  rejectWorkOrder,
  retryWorkOrderProductionPush,
  sendWorkOrderToProduction,
  updateWorkOrder,
} from '../controllers/workOrderControllerStable.js';

const router = express.Router();

router.use(requireSession);

router.post('/', createWorkOrder);
router.post('/from-performa/:performa_id', createWorkOrderFromPerforma);
router.get('/', getWorkOrders);
router.get('/:id', getWorkOrderById);
router.put('/:id', updateWorkOrder);
router.delete('/:id', deleteWorkOrder);
router.post('/:id/approve', approveWorkOrder);
router.post('/:id/reject', rejectWorkOrder);
router.post('/:id/retry-production-push', retryWorkOrderProductionPush);
router.post('/:id/send-to-production', sendWorkOrderToProduction);

export default router;
