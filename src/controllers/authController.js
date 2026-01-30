const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('../models/user');

const SECRET = process.env.JWT_SECRET;


exports.register = async (req, res) => {

  const { email, password, companyId } = req.body;

  const existingUser = await User.find({ email: email, companyId: companyId });
  if (existingUser.length > 0) {
    return res.status(400).json({ error: 'Usuário já existe' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const user = new User({...req.body, password: hashedPassword});
  await user.save();

  res.status(201).json({ message: 'Usuário registrado com sucesso' });
};


exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({email}).populate('companyId');

  if(user.status === "blocked"){
    return res.status(401).json({success: false, message: "Conta bloqueiada. Por favor, contacte o administrador!!!"})
  }

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({success: false, message: 'E-mail ou password inválidos' });
  }

  const token = jwt.sign({ id: user._id, name:user.name, email: user.email, company: user.companyId }, SECRET, { expiresIn: '1h' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: false,
    maxAge: 3600000
  });

  res.json({ success: true, message: 'Login bem-sucedido'});
};

exports.logout = (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout realizado com sucesso' });
};
