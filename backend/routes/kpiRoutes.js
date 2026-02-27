import express from 'express';
import { requireSession, requireMasterAdminSession } from '../middleware/sessionMiddleware.js';
import { getKpiOverview } from '../controllers/kpiController.js';

const router = express.Router();

router.use(requireSession);
router.use(requireMasterAdminSession);

router.get('/overview', getKpiOverview);

export default router;
