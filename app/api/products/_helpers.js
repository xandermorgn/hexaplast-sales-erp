import fs from 'fs';
import path from 'path';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const PRODUCT_IMAGES_DIR = path.join(process.cwd(), 'server', 'uploads', 'product_images');

function ensureUploadDir() {
  if (!fs.existsSync(PRODUCT_IMAGES_DIR)) {
    fs.mkdirSync(PRODUCT_IMAGES_DIR, { recursive: true });
  }
}

function normalizeFormValue(value) {
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

export async function parseProductFormRequest(request, productType) {
  const formData = await request.formData();
  const body = {};

  for (const [key, value] of formData.entries()) {
    if (key === 'image') continue;
    body[key] = normalizeFormValue(value);
  }

  const image = formData.get('image');
  if (!image || typeof image === 'string' || !image.size) {
    return { body, file: null };
  }

  if (!ALLOWED_TYPES.has(image.type)) {
    const error = new Error('Invalid file type. Only JPG and PNG are allowed.');
    error.statusCode = 400;
    throw error;
  }

  if (image.size > MAX_FILE_SIZE) {
    const error = new Error('Product image must be less than 5MB');
    error.statusCode = 400;
    throw error;
  }

  ensureUploadDir();

  const extension = path.extname(image.name || '').toLowerCase() || '.jpg';
  const safeType = productType === 'spare' ? 'spare' : 'machine';
  const filename = `${safeType}_${Date.now()}_${Math.round(Math.random() * 1e9)}${extension}`;
  const filepath = path.join(PRODUCT_IMAGES_DIR, filename);
  const buffer = Buffer.from(await image.arrayBuffer());

  fs.writeFileSync(filepath, buffer);

  return {
    body,
    file: {
      filename,
      size: image.size,
      mimetype: image.type,
    },
  };
}
