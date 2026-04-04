const jwt = require('jsonwebtoken');
require('dotenv').config();
const SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function authMiddleware2(req, res, next) {
  const token = req.cookies.token;

  const returnTo = req.originalUrl && req.originalUrl !== '/' ? `?returnTo=${encodeURIComponent(req.originalUrl)}` : '';

  if (!token) {
    return res.redirect('/login' + returnTo);
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.redirect('/login' + returnTo);
  }
}
module.exports = {authMiddleware, authMiddleware2};
