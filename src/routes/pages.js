const express = require('express');
const path = require('path');

const {authMiddleware2} = require('../middlewares/authMiddleware');
const router = express.Router();

// Rotas principais do sistema
router.get('/', (req, res) => {
    //res.render('index', { title: 'Home' });
    res.redirect('/dashboard');
});

router.get('/about', (req, res) => {
    res.render('about', { title: 'Sobre' });
});

router.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contato' });
});

router.get('/dashboard', authMiddleware2, (req, res) => {
    res.render('dashboard', { title: 'Dashboard', name: req.user.name, companyName:req.user.company.name });
});

router.get('/invoices', authMiddleware2, (req, res) => {
    res.render('invoices', { title: 'Facturas', name: req.user.name, companyName:req.user.company.name });
});

router.get('/new-invoice', authMiddleware2, (req, res) => {
    res.render('new-invoice', { title: 'Nova Factura', name: req.user.name, companyName:req.user.company.name });
});

router.get('/invoices/:id', authMiddleware2, (req, res) => {
    const invoiceId = req.params.id;
    res.render('invoice-detail', { title: `Fatura ${invoiceId}`, invoiceId, companyName:req.user.company.name });
});

router.get('/invoices/:id/edit', authMiddleware2, (req, res) => {
    const invoiceId = req.params.id;
    res.render('edit-invoice', { title: `Editar Fatura ${invoiceId}`, invoiceId });
});

router.get('/invoices/:id/pdf', authMiddleware2, (req, res) => {
    const invoiceId = req.params.id;
    res.render('invoice-pdf', { title: `Fatura ${invoiceId}`, invoiceId });
});

router.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});
router.get('/register', (req, res) => {
    res.render('register', { title: 'Registrar' });
});
router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { title: 'Esqueci minha senha' });
});
router.get('/reset-password', (req, res) => {
    res.render('reset-password', { title: 'Redefinir senha' });
});
router.get('/profile', authMiddleware2, (req, res) => {
    res.render('profile', { title: 'Perfil', name: req.user.name, companyName:req.user.company.name });
});
router.get('/settings', authMiddleware2, (req, res) => {
    res.render('settings', { title: 'Configurações', name: req.user.name, companyName:req.user.company.name });
});
router.get('/terms', (req, res) => {
    res.render('terms', { title: 'Termos de Serviço' });
});
router.get('/privacy', (req, res) => {
    res.render('privacy', { title: 'Política de Privacidade' });
});
router.get('/help', (req, res) => {
    res.render('help', { title: 'Ajuda' });
});


// Rota para a página de erro 404
/*router.get('*', (req, res) => {
    res.status(404).render('404', { title: 'Página não encontrada' });
});*/

// Rota para a página de erro 500
router.get('/500', (req, res) => {
    res.status(500).render('500', { title: 'Erro interno do servidor' });
});
// Rota para a página de manutenção
router.get('/maintenance', (req, res) => {
    res.render('maintenance', { title: 'Manutenção' });
});
// Rota para a página de acesso negado
router.get('/access-denied', (req, res) => {
    res.render('access-denied', { title: 'Acesso negado' });
});


// Rota para a página de logout
router.get('/logout', (req, res) => {
    // Lógica para fazer logout do usuário
    res.redirect('/login');
});

module.exports = router;
