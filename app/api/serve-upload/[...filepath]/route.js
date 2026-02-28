import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { initializeServerRuntime } from '../../../../server/next/bootstrap.js';

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export async function GET(request, { params }) {
  try {
    await initializeServerRuntime();

    const { filepath } = await params;
    const relativePath = Array.isArray(filepath) ? filepath.join('/') : filepath;

    // Prevent directory traversal
    if (relativePath.includes('..') || relativePath.includes('\\')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const uploadsRoot = path.join(process.cwd(), 'server', 'uploads');
    const filePath = path.join(uploadsRoot, relativePath);

    // Ensure the resolved path is within uploads directory
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(uploadsRoot))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!fs.existsSync(resolved)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const fileBuffer = fs.readFileSync(resolved);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Serve upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
