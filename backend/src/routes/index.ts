import { Router } from 'express';
import { ApiResponse } from '@bank-statement-ocr/shared';
import { authRouter } from './auth';
import { processRouter } from './process';
import { adminRouter } from './admin';

export const router = Router();

router.get('/', (_req, res) => {
  const response: ApiResponse<{ version: string }> = {
    success: true,
    data: { version: '1.0.0' },
    message: 'Bank Statement OCR API',
  };
  res.json(response);
});

router.use('/auth',    authRouter);
router.use('/process', processRouter);
router.use('/admin',   adminRouter);
