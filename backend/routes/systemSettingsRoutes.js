import express from 'express';
import { requireSession, requireExactMasterAdminSession } from '../middleware/sessionMiddleware.js';
import {
  getDocumentDefaultSettings,
  updateDocumentDefaultSettings,
} from '../controllers/systemSettingsController.js';

const router = express.Router();

router.use(requireSession);

router.get('/document-defaults', getDocumentDefaultSettings);
router.put('/document-defaults', requireExactMasterAdminSession, updateDocumentDefaultSettings);

export default router;
