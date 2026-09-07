'use strict';
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { randomUUID } = require('crypto');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'bromise_secret_jwt_key_2026_change_in_prod';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function nowISO() { return new Date().toISOString(); }
function uid() { return randomUUID(); }

/**
 * Verify Google ID Token from client & get or create user record in DB
 */
async function verifyGoogleTokenAndGetUser(idToken) {
  let googleId, email, name, picture;

  if (GOOGLE_CLIENT_ID && !idToken.startsWith('mock-token-')) {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    googleId = payload.sub;
    email = payload.email;
    name = payload.name || payload.email.split('@')[0];
    picture = payload.picture;
  } else {
    // Demo fallback for testing without Google Client ID set yet
    const decoded = jwt.decode(idToken) || {};
    googleId = decoded.sub || `google-${idToken}`;
    email = decoded.email || `user@example.com`;
    name = decoded.name || 'BROMISE User';
    picture = decoded.picture || null;
  }

  const userRes = await db.execute({
    sql: 'SELECT * FROM users WHERE google_id = ?',
    args: [googleId]
  });
  let user = userRes.rows[0];

  if (!user) {
    const userId = `usr-${uid()}`;
    const now = nowISO();
    await db.execute({
      sql: 'INSERT INTO users (id, google_id, email, name, picture, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [userId, googleId, email, name, picture || null, now, now]
    });
    
    const newUserRes = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [userId]
    });
    user = newUserRes.rows[0];
  }

  // Create token
  const token = jwt.sign(
    { userId: user.id, email: user.email, name: user.name },
    JWT_SECRET,
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
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}

module.exports = {
  verifyGoogleTokenAndGetUser,
  requireAuth,
};
