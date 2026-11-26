import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const app = require('../server/index.js');

export default async function handler(req, res) {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  if (typeof app.ensureReady === 'function') {
    try {
      await app.ensureReady();
    } catch (err) {
      console.error('Database initialization error:', err);
      return res.status(503).json({
        error: 'Database unavailable',
        details: err?.message || 'Initialization failed',
      });
    }
  }
  return app(req, res);
}
