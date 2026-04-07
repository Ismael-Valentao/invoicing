const jwt = require('jsonwebtoken');
const User = require('../models/user');
const SystemSetting = require('../models/systemSetting');
require('dotenv').config();
const SECRET = process.env.JWT_SECRET;

async function validateUserState(decoded) {
  // Carrega user para verificar status / tokenVersion (faz pequeno cache simples por request)
  const fresh = await User.findById(decoded.id).select('status tokenVersion role').lean();
  if (!fresh) return { ok: false, code: 401, message: 'Utilizador inexistente' };
  if (fresh.status === 'blocked') return { ok: false, code: 403, message: 'Conta bloqueada.' };
  if ((decoded.tokenVersion || 0) !== (fresh.tokenVersion || 0)) {
    return { ok: false, code: 401, message: 'Sessão expirada. Faça login novamente.' };
  }
  return { ok: true, role: fresh.role };
}

async function checkMaintenance(role) {
  if (role === 'SUPERADMIN') return null; // SUPERADMIN nunca é bloqueado por manutenção
  try {
    const settings = await SystemSetting.getSingleton();
    if (settings.maintenanceMode) {
      return { code: 503, message: settings.maintenanceMessage || 'Sistema em manutenção.' };
    }
  } catch (_) { /* ignora */ }
  return null;
}

async function authMiddleware(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    const state = await validateUserState(decoded);
    if (!state.ok) return res.status(state.code).json({ error: state.message });

    const maint = await checkMaintenance(state.role);
    if (maint) return res.status(maint.code).json({ error: maint.message });

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

async function authMiddleware2(req, res, next) {
  const token = req.cookies.token;

  const returnTo = req.originalUrl && req.originalUrl !== '/' ? `?returnTo=${encodeURIComponent(req.originalUrl)}` : '';

  if (!token) {
    return res.redirect('/login' + returnTo);
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    const state = await validateUserState(decoded);
    if (!state.ok) {
      res.clearCookie('token');
      return res.redirect('/login' + returnTo);
    }
    const maint = await checkMaintenance(state.role);
    if (maint) {
      return res.status(maint.code).send(`<h1>Manutenção</h1><p>${maint.message}</p>`);
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.redirect('/login' + returnTo);
  }
}
module.exports = {authMiddleware, authMiddleware2};
