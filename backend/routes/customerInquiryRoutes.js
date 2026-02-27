import express from 'express';
import { requireSession } from '../middleware/sessionMiddleware.js';
import {
  createInquiry,
  deleteInquiry,
  getInquiries,
  getInquiryById,
  updateInquiry,
} from '../controllers/customerInquiryController.js';

const router = express.Router();

router.use(requireSession);

router.post('/', createInquiry);
router.get('/', getInquiries);
router.get('/:id', getInquiryById);
router.put('/:id', updateInquiry);
router.delete('/:id', deleteInquiry);

export default router;
