import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, '../../data/notifications.json');
async function ensureFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try { await fs.access(DATA_FILE); } catch { await fs.writeFile(DATA_FILE, '[]', 'utf8'); }
}
async function readAll() {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}
async function writeAll(items) {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
}
export async function pushNotification(userId, title, message, meta = {}) {
  const items = await readAll();
  items.unshift({ id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, userId, title, message, meta, createdAt: new Date().toISOString(), readAt: null });
  await writeAll(items);
}
export async function getNotifications(userId) {
  const items = await readAll();
  return items.filter(x => x.userId === userId).slice(0, 50);
}
export async function markNotificationsRead(userId) {
  const items = await readAll();
  const now = new Date().toISOString();
  for (const item of items) if (item.userId === userId && !item.readAt) item.readAt = now;
  await writeAll(items);
}
