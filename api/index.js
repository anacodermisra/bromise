import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const app = require('../server/index.js');

export default function handler(req, res) {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
}
