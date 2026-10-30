import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { db, nowIso, tx } from '../db/index.js';
import { can } from '../middleware/auth.js';
import { findOr404, hydrate, insert, paginate, update } from '../lib/query.js';
import { f, parse, z } from '../lib/validate.js';
import { badRequest, notFound } from '../lib/errors.js';
import { record } from '../lib/audit.js';

const router = Router();
export const DOC_CATEGORIES = ['contract', 'invoice', 'quote', 'technical', 'manual', 'deliverable', 'receipt', 'other'];
const BLOCKED_EXT = /\.(exe|bat|cmd|com|msi|ps1|sh|scr|js|mjs|html?|svg|php|jar|vbs)$/i;

fs.mkdirSync(config.uploadsDir, { recursive: true });

export const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadsDir,
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.bin`),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (BLOCKED_EXT.test(file.originalname)) return cb(badRequest('Tipo de archivo no permitido por seguridad'));
    cb(null, true);
  },
});

const metaSchema = z.object({
  title: f.optText(200),
  description: f.optText(2000),
  category: f.oneOf(DOC_CATEGORIES).default('other'),
  client_id: f.optId(),
  project_id: f.optId(),
  tags: z.preprocess((v) => (typeof v === 'string' ? (v ? v.split(',').map((t) => t.trim()).filter(Boolean) : []) : v), f.tags()),
});

const hashFile = (file) =>
  new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });

/** Guarda un archivo subido como documento y devuelve su id (reutilizado por gastos). */
export async function storeUpload(req, file, meta) {
  const sha = await hashFile(file.path);
  return tx(() => {
    const id = insert('documents', {
      client_id: meta.client_id,
      project_id: meta.project_id,
      category: meta.category,
      title: meta.title || file.originalname,
      description: meta.description,
      tags: JSON.stringify(meta.tags ?? []),
      file_name: path.basename(file.originalname).slice(0, 200),
      mime_type: file.mimetype || 'application/octet-stream',
      size_bytes: file.size,
      storage_key: path.basename(file.path),
      sha256: sha,
      uploaded_by: req.user.id,
    });
    record(req, { action: 'document.uploaded', entityType: 'document', entityId: id, clientId: meta.client_id, label: meta.title || file.originalname, summary: `Documento subido: ${meta.title || file.originalname}` });
    return id;
  });
}

const SELECT = `SELECT d.*, c.name AS client_name, p.name AS project_name, u.name AS uploaded_by_name
  FROM documents d LEFT JOIN clients c ON c.id = d.client_id LEFT JOIN projects p ON p.id = d.project_id LEFT JOIN users u ON u.id = d.uploaded_by`;

router.get('/', can('documents.read'), (req, res) => {
  const where = ['x.deleted_at IS NULL'];
  const params = [];
  if (req.query.client_id) where.push('x.client_id = ?') && params.push(Number(req.query.client_id));
  if (req.query.project_id) where.push('x.project_id = ?') && params.push(Number(req.query.project_id));
  if (DOC_CATEGORIES.includes(req.query.category)) where.push('x.category = ?') && params.push(req.query.category);
  if (req.query.tag) where.push('EXISTS (SELECT 1 FROM json_each(x.tags) WHERE value = ?)') && params.push(String(req.query.tag));
  const result = paginate(req.query, {
    from: `(${SELECT}) x`,
    where,
    params,
    searchColumns: ['x.title', 'x.file_name', 'x.description', 'x.client_name', 'x.tags'],
    sortMap: { title: 'x.title COLLATE NOCASE', created_at: 'x.created_at', size: 'x.size_bytes', category: 'x.category', client: 'x.client_name' },
    defaultSort: ['created_at', 'desc'],
    tiebreak: 'x.id DESC',
  });
  result.items.forEach((r) => {
    hydrate(r);
    delete r.storage_key;
  });
  res.json(result);
});

router.get('/tags', can('documents.read'), (_req, res) => {
  res.json(db.all('SELECT DISTINCT j.value AS tag FROM documents d, json_each(d.tags) j WHERE d.deleted_at IS NULL ORDER BY 1').map((r) => r.tag));
});

router.post('/', can('documents.write'), upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Selecciona un archivo', { file: 'Obligatorio' });
  try {
    const meta = parse(metaSchema, req.body);
    const id = await storeUpload(req, req.file, meta);
    const doc = hydrate(db.get(`${SELECT} WHERE d.id = ?`, [id]));
    delete doc.storage_key;
    res.status(201).json(doc);
  } catch (err) {
    fs.rm(req.file.path, { force: true }, () => {});
    throw err;
  }
});

router.patch('/:id', can('documents.write'), (req, res) => {
  const doc = findOr404('documents', req.params.id, { where: 'AND deleted_at IS NULL', message: 'Documento no encontrado' });
  const data = parse(metaSchema.partial(), req.body);
  update('documents', doc.id, { ...data, tags: data.tags ? JSON.stringify(data.tags) : undefined });
  record(req, { action: 'document.updated', entityType: 'document', entityId: doc.id, clientId: doc.client_id, label: doc.title, summary: `Documento actualizado: ${doc.title}` });
  const out = hydrate(db.get(`${SELECT} WHERE d.id = ?`, [doc.id]));
  delete out.storage_key;
  res.json(out);
});

router.delete('/:id', can('documents.delete'), (req, res) => {
  const doc = findOr404('documents', req.params.id, { where: 'AND deleted_at IS NULL', message: 'Documento no encontrado' });
  tx(() => {
    db.run('UPDATE documents SET deleted_at = ?, updated_at = ? WHERE id = ?', [nowIso(), nowIso(), doc.id]);
    record(req, { action: 'document.deleted', entityType: 'document', entityId: doc.id, clientId: doc.client_id, label: doc.title, summary: `Documento eliminado: ${doc.title}` });
  });
  res.json({ ok: true });
});

/** Descarga autenticada: nunca hay enlaces públicos a los archivos. */
router.get('/:id/download', can('documents.read'), (req, res) => {
  const doc = findOr404('documents', req.params.id, { where: 'AND deleted_at IS NULL', message: 'Documento no encontrado' });
  const file = path.join(config.uploadsDir, path.basename(doc.storage_key));
  if (!fs.existsSync(file)) throw notFound('El archivo no está disponible en el almacenamiento');
  record(req, { action: 'document.downloaded', entityType: 'document', entityId: doc.id, clientId: doc.client_id, label: doc.title, summary: `Documento descargado: ${doc.title}` });
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.download(file, doc.file_name, { headers: { 'Content-Type': doc.mime_type } });
});

export default router;
