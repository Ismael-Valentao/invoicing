const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const usersPath = path.join(__dirname, '../data/users.json');
const SECRET = process.env.JWT_SECRET;

function loadUsers() {
  if (!fs.existsSync(usersPath)) fs.writeFileSync(usersPath, '[]');
  return JSON.parse(fs.readFileSync(usersPath));
}

function saveUsers(data) {
  fs.writeFileSync(usersPath, JSON.stringify(data, null, 2));
}

exports.register = (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();

  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Usuário já existe' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = { id: Date.now().toString(), email, password: hashedPassword };
  users.push(newUser);
  saveUsers(users);

  res.status(201).json({ message: 'Usuário registrado com sucesso' });
};

exports.login = (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.email === email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({success: false, error: 'Credenciais inválidas' });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '1h' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: false, // true se estiver usando HTTPS
    maxAge: 3600000 // 1 hora
  });

  res.json({ success: true, message: 'Login bem-sucedido' });
};

exports.logout = (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout realizado com sucesso' });
};
