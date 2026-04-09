import express from 'express';
import multer from 'multer';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE_BYTES || 25 * 1024 * 1024),
    files: Number(process.env.MAX_FILE_COUNT || 80)
  }
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const port = Number(process.env.PORT || 8787);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

app.get('/health', (_req, res) => {
  setCorsHeaders(res);
  res.json({ ok: true });
});

app.post('/api/render', upload.array('files', 200), async (req, res) => {
  setCorsHeaders(res);

  const files = req.files ?? [];
  if (!Array.isArray(files) || files.length === 0) {
    res.status(400).json({ error: 'no files' });
    return;
  }

  if (!ffmpegPath) {
    res.status(500).json({ error: 'ffmpeg not available' });
    return;
  }

  const perImageSec = Math.max(1, Math.min(6, Number(req.body?.perImageSec ?? 2)));
  const resolution = String(req.body?.resolution ?? '720p');
  const width = resolution === '1080p' ? 1920 : 1280;
  const height = resolution === '1080p' ? 1080 : 720;
  const audioVolume = Math.max(0, Math.min(1, Number(req.body?.audioVolume ?? 0.12)));

  const workDir = await mkdtemp(path.join(tmpdir(), 'memoir-'));
  const outPath = path.join(workDir, 'out.mp4');
  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    await rm(workDir, { recursive: true, force: true });
  };

  res.on('close', () => {
    cleanup().catch(() => {});
  });

  try {
    const names = [];
    for (let i = 0; i < files.length; i += 1) {
      const f = files[i];
      const ext = (f.mimetype || '').includes('png') ? 'png' : (f.mimetype || '').includes('webp') ? 'webp' : 'jpg';
      const name = `img_${String(i).padStart(4, '0')}.${ext}`;
      const filePath = path.join(workDir, name);
      await writeFile(filePath, f.buffer);
      names.push(name);
    }

    const listPath = path.join(workDir, 'list.txt');
    const lines = [];
    for (let i = 0; i < names.length; i += 1) {
      const p = names[i];
      lines.push(`file '${p}'`);
      lines.push(`duration ${perImageSec}`);
    }
    lines.push(`file '${names[names.length - 1]}'`);
    await writeFile(listPath, lines.join('\n'), 'utf-8');

    const total = Math.max(1, names.length * perImageSec);
    const args = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-f', 'lavfi',
      '-i', `sine=frequency=220:duration=${total}:sample_rate=44100`,
      '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
      '-filter:a', `volume=${audioVolume}`,
      '-shortest',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outPath
    ];

    const proc = spawn(ffmpegPath, args, { cwd: workDir });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const code = await new Promise(resolve => proc.on('close', resolve));
    if (code !== 0) {
      res.status(500).json({ error: 'ffmpeg failed', details: stderr.slice(-4000) });
      await cleanup();
      return;
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="memoir.mp4"');
    await new Promise(resolve => {
      res.sendFile(outPath, () => resolve());
    });
    await cleanup();
  } catch {
    res.status(500).json({ error: 'server error' });
    await cleanup();
  }
});


app.options('/api/render', (_req, res) => {
  setCorsHeaders(res);
  res.status(204).end();
});

app.options('/health', (_req, res) => {
  setCorsHeaders(res);
  res.status(204).end();
});

try {
  await stat(distDir);
  app.use(express.static(distDir, { index: 'index.html' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      next();
      return;
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
} catch {
  // dist may not exist during local API-only development
}

app.listen(port, '0.0.0.0');
