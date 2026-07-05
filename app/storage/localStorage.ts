import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOADS_DIR = join(process.cwd(), 'uploads');

export async function saveLocalFile(
  buffer: Buffer,
  originalName: string,
  subfolder = 'files',
): Promise<{ storageRef: string; fileName: string }> {
  const dir = join(UPLOADS_DIR, subfolder);
  await mkdir(dir, { recursive: true });
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${uuidv4()}-${safeName}`;
  const storageRef = join(subfolder, fileName);
  await writeFile(join(UPLOADS_DIR, storageRef), buffer);
  return { storageRef, fileName: safeName };
}

export { UPLOADS_DIR };
