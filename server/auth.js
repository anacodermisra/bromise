'use strict';
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { randomUUID } = require('crypto');
const db = require('./db');

const LEGACY_INSECURE_DEFAULT = 'bromise_secret_jwt_key_2026_change_in_prod';

function isProdEnv() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

function getJwtSecret() {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (isProdEnv()) {
    if (!secret || secret === LEGACY_INSECURE_DEFAULT || secret.length < 16) {
      throw new Error('Server misconfiguration: JWT_SECRET environment variable must be set to a strong secret (>= 16 chars) in production.');
    }
    return secret;
  }
  return secret || LEGACY_INSECURE_DEFAULT;
}

function getGoogleClientId() {
  return (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '')
    .trim()
    .replace(/['"]/g, '');
}

function nowISO() { return new Date().toISOString(); }
function uid() { return randomUUID(); }

/**
 * Verify Google ID Token from client & get or create user record in DB.
 * Ensures strict cryptographic signature verification in production and
 * links/updates Google accounts safely by verified sub/email.
 */
async function verifyGoogleTokenAndGetUser(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Invalid credential token.');
  }

  const isProd = isProdEnv();
  const googleClientId = getGoogleClientId();
  let googleId, email, name, picture;

  if (!isProd && idToken === 'mock-token-demo-user') {
    googleId = 'mock-demo-user-001';
    email = 'demo@bromise.local';
    name = 'BROMISE Demo User';
    picture = null;
  } else {
    if (!googleClientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured on the server.');
    }

    const googleClient = new OAuth2Client(googleClientId);
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      throw new Error('Google ID token payload is incomplete.');
    }
    if (payload.email_verified !== true) {
      throw new Error('Google account email is not verified.');
    }

    googleId = payload.sub;
    email = payload.email.toLowerCase();
    name = payload.name || email.split('@')[0];
    picture = payload.picture || null;
  }

  await db.ensureReady();

  const userRes = await db.execute({
    sql: 'SELECT * FROM users WHERE google_id = ?',
    args: [googleId],
  });
  let user = userRes.rows[0];

  // If not found by google_id, safely match existing verified account by email (case-insensitive)
  if (!user && email) {
    const emailRes = await db.execute({
      sql: 'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
      args: [email],
    });
    if (emailRes.rows[0]) {
      user = emailRes.rows[0];
    }
  }

  const now = nowISO();
  if (user) {
    // Keep google_id and profile metadata current on returning login
    await db.execute({
      sql: 'UPDATE users SET google_id = ?, email = ?, name = ?, picture = COALESCE(?, picture), updated_at = ? WHERE id = ?',
      args: [googleId, email, name, picture, now, user.id],
    });
    const refreshedRes = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [user.id],
    });
    user = refreshedRes.rows[0];
  } else {
    const userId = `usr-${uid()}`;
    await db.execute({
      sql: 'INSERT INTO users (id, google_id, email, name, picture, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [userId, googleId, email, name, picture, now, now],
    });
    const newUserRes = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [userId],
    });
    user = newUserRes.rows[0];
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, name: user.name },
    getJwtSecret(),
    { expiresIn: '30d' }
  );

  return { user, token };
}

/**
 * Express Middleware to require authentication on protected routes
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Invalid session token.' });
    }
    req.userId = decoded.userId;
    req.user = decoded;
    next();
  } catch (err) {
    if (err.message && err.message.startsWith('Server misconfiguration:')) {
      return res.status(500).json({ error: 'Authentication service is misconfigured on the server.' });
    }
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}

module.exports = {
  verifyGoogleTokenAndGetUser,
  requireAuth,
  getJwtSecret,
  getGoogleClientId,
};
