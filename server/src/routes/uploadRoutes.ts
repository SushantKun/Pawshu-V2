import { Router } from 'express';
import { uploadFile } from '../controllers/uploadController';

// Create router for upload paths
const router = Router();

// Upload route
router.post('/', uploadFile);

export default router; 