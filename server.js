const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const invoiceRoutes = require('./src/routes/invoices');
const authRoutes = require('./src/routes/auth');
const pagesRoutes = require('./src/routes/pages');
const companyRoutes = require('./src/routes/companies');

const app = express();
const PORT = 3000;

// Configuração do EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('./public/'))
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/company', companyRoutes);
app.use('/', pagesRoutes);

// Conexão com o MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log('Conectado ao MongoDB');
})
.catch(err => {
  console.error('Erro ao conectar ao MongoDB:', err);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
