import express from 'express';
import { requireSession, requireServerAdminSession } from '../middleware/sessionMiddleware.js';
import { createMasterAdmin, listUsers, setUserRole } from '../controllers/settingsController.js';

const router = express.Router();

router.use(requireSession);

router.get('/master-admins', requireServerAdminSession, listUsers);
router.post('/master-admin', requireServerAdminSession, createMasterAdmin);
router.put('/role', setUserRole);

export default router;
