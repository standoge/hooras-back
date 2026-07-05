import { mkdirSync } from 'fs';
import multer from 'multer';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UPLOADS_DIR } from './localStorage';

mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uuidv4()}-${safeName}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

export function storageRefFromFile(filename: string, subfolder = 'files'): string {
  return join(subfolder, filename).replace(/\\/g, '/');
}
