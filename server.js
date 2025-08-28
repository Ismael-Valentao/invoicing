const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const invoiceRoutes = require('./src/routes/invoices');
const vdRoutes = require('./src/routes/vd');
const quotationRoutes = require('./src/routes/quotation')
const authRoutes = require('./src/routes/auth');
const pagesRoutes = require('./src/routes/pages');
const companyRoutes = require('./src/routes/companies');
const clientsRoutes = require('./src/routes/clients');
const productsRoutes = require('./src/routes/products');
const reciboRoutes = require('./src/routes/receipt');

const app = express();
const PORT = 3000;
const mongodbURI = process.env.NODE_ENV.toLowerCase() === 'production' ? process.env.MONGODB_URI : 'mongodb://localhost:27017/invoicesdb';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('./public/'))
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/vd', vdRoutes);
app.use('/api/recibos', reciboRoutes);
app.use('/api/quotations', quotationRoutes)
app.use('/api/company', companyRoutes);
app.use('/api/products', productsRoutes);
app.use('/', pagesRoutes);


mongoose.connect(mongodbURI)
.then(() => {
  console.log('Conectado ao MongoDB');
})
.catch(err => {
  console.error('Erro ao conectar ao MongoDB:', err);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
