const express = require('express');
const { requirePermission } = require("../middlewares/requirePermission");
const { requireAdmin } = require("../middlewares/requireAdmin");
const { authMiddleware2 } = require('../middlewares/authMiddleware');
const { ensureHasActiveModule } = require("../middlewares/validationMiddleware");

const router = express.Router();

function buildViewData(req, title, extra = {}) {
    return {
        title,
        name: req.user?.name,
        companyName: req.user?.company?.name,
        modules: req.user?.company?.modules || {},
        currentUser: {
            _id: req.user?._id,
            name: req.user?.name,
            email: req.user?.email,
            contact: req.user?.contact,
            status: req.user?.status,
            role: req.user?.role || 'ADMIN',
            permissions: req.user?.permissions || {
                dashboard: true,
                sales: true,
                stock: true,
                invoicing: true,
                products: true,
                customers: true,
                suppliers: true,
                reports: true,
                settings: true,
                users: true
            }
        },
        ...extra
    };
}

// Rotas principais do sistema
router.get('/', (req, res) => {
    res.render("site", { title: 'Website' });
});

router.get('/about', (req, res) => {
    res.render('about', { title: 'Sobre' });
});

router.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contato' });
});

router.get('/dashboard', authMiddleware2, ensureHasActiveModule, (req, res) => {
    if (req.user.company.modules.sales) {
        return res.redirect("/sales-dashboard");
    }

    res.render('dashboard', buildViewData(req, 'Dashboard'));
});

router.get('/sales-dashboard', authMiddleware2, requirePermission('dashboard'), (req, res) => {
    res.render('sales-dashboard', buildViewData(req, 'Dashboard de Vendas'));
});

router.get('/invoices-dashboard', authMiddleware2, requirePermission('dashboard'), (req, res) => {
    res.render('invoices-dashboard', buildViewData(req, 'Dashboard de Faturas'));
});

router.get("/setup-modules", (req, res) => {
    return res.render("setup-modules", { title: "Configurar Módulos" });
});

router.get('/invoices', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    res.render('invoices', buildViewData(req, 'Facturas'));
});

router.get('/new-invoice', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    res.render('new-invoice', buildViewData(req, 'Nova Factura'));
});

router.get('/quotations', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    res.render('quotations', buildViewData(req, 'Cotações'));
});

router.get('/new-quotation', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    res.render('new-quotation', buildViewData(req, 'Nova Cotação'));
});

router.get('/vd', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    res.render('vd', buildViewData(req, 'VD'));
});

router.get('/receipts', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    res.render('receipt', buildViewData(req, 'Recibos'));
});

router.get('/new-vd', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    res.render('new-vd', buildViewData(req, 'Nova VD'));
});

router.get('/clients', authMiddleware2, requirePermission('customers'), (req, res) => {
    res.render('clients', buildViewData(req, 'Clientes'));
});

router.get('/products', authMiddleware2, requirePermission('products'), (req, res) => {
    res.render('products', buildViewData(req, 'Produtos'));
});

router.get('/reports', authMiddleware2, requirePermission('reports'), (req, res) => {
    res.render('reports', buildViewData(req, 'Relatórios'));
});

router.get('/invoices/:id', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    const invoiceId = req.params.id;
    res.render('invoice-detail', buildViewData(req, `Fatura ${invoiceId}`, { invoiceId }));
});

router.get('/invoices/:id/edit', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    const invoiceId = req.params.id;
    res.render('edit-invoice', buildViewData(req, `Editar Fatura ${invoiceId}`, { invoiceId }));
});

router.get('/invoices/:id/pdf', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    const invoiceId = req.params.id;
    res.render('invoice-pdf', buildViewData(req, `Fatura ${invoiceId}`, { invoiceId }));
});

// Sales
router.get('/sales', authMiddleware2, requirePermission('sales'), (req, res) => {
    res.render('sales', buildViewData(req, 'Vendas'));
});

router.get('/new-sale', authMiddleware2, requirePermission('sales'), (req, res) => {
    res.render('new-sale', buildViewData(req, 'Nova Venda'));
});

// Movements
router.get('/stock-movements', authMiddleware2, requirePermission('stock'), (req, res) => {
    res.render('stock-movements', buildViewData(req, 'Movimentos de Stock'));
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

router.get('/reset-password/:token', (req, res) => {
    const { token } = req.params;
    res.render('reset-password', { title: 'Redefinir senha', token });
});

router.get('/users', authMiddleware2, requireAdmin, (req, res) => {
    res.render('users', buildViewData(req, 'Utilizadores'));
});

router.get('/settings', authMiddleware2, requirePermission('settings'), (req, res) => {
    res.render('settings', buildViewData(req, 'Configurações'));
});

// Logout
router.get('/logout', (req, res) => {
    res.redirect('/login');
});

module.exports = router;