import express from 'express';
import { requireSession } from '../middleware/sessionMiddleware.js';
import {
  createQuotation,
  deleteQuotation,
  getQuotationById,
  getQuotations,
  updateQuotation,
} from '../controllers/quotationControllerStable.js';

const router = express.Router();

router.use(requireSession);

router.post('/', createQuotation);
router.get('/', getQuotations);
router.get('/:id', getQuotationById);
router.put('/:id', updateQuotation);
router.delete('/:id', deleteQuotation);

export default router;
