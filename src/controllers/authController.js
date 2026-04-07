const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('../models/user');
const LoginAudit = require('../models/loginAudit');
const { log: logActivity } = require('./activityLogController');

function clientIp(req) {
  return (req.headers['x-forwarded-for']?.split(',')[0] || req.ip || req.connection?.remoteAddress || '').trim();
}

async function auditLogin({ user, email, req, success, reason }) {
  try {
    await LoginAudit.create({
      userId: user?._id || null,
      email: email || user?.email || '',
      companyId: user?.companyId?._id || user?.companyId || null,
      ip: clientIp(req),
      userAgent: req.get('user-agent') || '',
      success,
      reason: reason || (success ? 'ok' : 'unknown'),
    });
  } catch (_) { /* não bloqueia login */ }
}

const SECRET = process.env.JWT_SECRET;


exports.register = async (req, res) => {

  const { email, password, companyId } = req.body;

  const existingUser = await User.find({ email: email, companyId: companyId });
  if (existingUser.length > 0) {
    return res.status(400).json({ error: 'Usuário já existe' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const user = new User({ ...req.body, password: hashedPassword });
  await user.save();

  res.status(201).json({ message: 'Usuário registrado com sucesso' });
};


exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).populate('companyId');

  if (user?.status === "blocked") {
    await auditLogin({ user, email, req, success: false, reason: 'blocked' });
    return res.status(403).json({ success: false, message: "Conta bloqueada. Por favor, contacte o administrador." })
  }

  if (!user || !bcrypt.compareSync(password, user.password)) {
    await auditLogin({ user, email, req, success: false, reason: 'wrong_credentials' });
    return res.status(401).json({ success: false, message: 'E-mail ou password inválidos' });
  }

  if (!user.emailVerified) {
    await auditLogin({ user, email, req, success: false, reason: 'email_not_verified' });
    return res.status(403).json({
      message: 'Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada.',
      resendVerificationEmail:true
    });
  }

  // Actualiza last login
  user.lastLoginAt = new Date();
  user.lastLoginIp = clientIp(req);
  await user.save();
  await auditLogin({ user, email, req, success: true, reason: 'ok' });

  const token = jwt.sign({ id: user._id, name: user.name, email: user.email, permissions:user.permissions, role:user.role, company: user.companyId, tokenVersion: user.tokenVersion || 0 }, SECRET, { expiresIn: '1h' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 3600000
  });

  if (user.role === 'SUPERADMIN') {
    logActivity({
      companyId: null, userId: user._id, userName: user.name,
      action: 'login', entity: 'user', entityId: user._id,
      description: `SUPERADMIN ${user.name} fez login.`
    });
    return res.json({ success: true, message: 'Login bem-sucedido', redirect: '/admin' });
  }

  logActivity({
    companyId: user.companyId?._id, userId: user._id, userName: user.name,
    action: 'login', entity: 'user', entityId: user._id,
    description: `${user.name} fez login.`
  });

  const activatedModule = user.companyId?.modules?.invoicing ? "invoices" : user.companyId?.modules?.sales ? "sales" : null;

  res.json({ success: true, message: 'Login bem-sucedido', redirect: '/dashboard' });
};

exports.logout = (req, res) => {
  try {
    const token = req.cookies?.token;
    if (token) {
      const decoded = jwt.verify(token, SECRET);
      logActivity({
        companyId: decoded.company?._id || null, userId: decoded.id, userName: decoded.name,
        action: 'logout', entity: 'user', entityId: decoded.id,
        description: `${decoded.name} fez logout.`
      });
    }
  } catch (e) { /* token expirado ou inválido — ignora */ }
  res.clearCookie('token');
  res.json({ message: 'Logout realizado com sucesso' });
};

/**
 * Refresh token — renova o JWT com dados frescos da DB.
 * Usado após actualizar dados da empresa/utilizador.
 */
exports.refreshToken = async (req, res) => {
  try {
    const User = require('../models/user');
    const user = await User.findById(req.user.id).populate('companyId');
    if (!user) return res.status(401).json({ success: false, message: 'Utilizador não encontrado.' });

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, permissions: user.permissions, role: user.role, company: user.companyId, tokenVersion: user.tokenVersion || 0 },
      SECRET, { expiresIn: '1h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 3600000
    });

    res.json({ success: true, message: 'Token renovado.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
