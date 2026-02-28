import express from 'express';
import { requireSession } from '../middleware/sessionMiddleware.js';
import {
  createPerforma,
  createPerformaFromQuotation,
  deletePerforma,
  getPerformaById,
  getPerformas,
  updatePerforma,
} from '../controllers/performaControllerStable.js';

const router = express.Router();

router.use(requireSession);

router.post('/', createPerforma);
router.post('/from-quotation/:quotation_id', createPerformaFromQuotation);
router.get('/', getPerformas);
router.get('/:id', getPerformaById);
router.put('/:id', updatePerforma);
router.delete('/:id', deletePerforma);

export default router;
