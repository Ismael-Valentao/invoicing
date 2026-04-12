const express = require('express');
const { requirePermission } = require("../middlewares/requirePermission");
const { requireAdmin } = require("../middlewares/requireAdmin");
const { requireSuperAdmin } = require("../middlewares/requireSuperAdmin");
const { authMiddleware2 } = require('../middlewares/authMiddleware');
const { ensureHasActiveModule } = require("../middlewares/validationMiddleware");
const { requireActiveSubscription } = require("../middlewares/checkPlanLimit");

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

router.get('/privacy', (req, res) => {
    res.render('privacy', { title: 'Política de Privacidade' });
});

router.get('/terms', (req, res) => {
    res.render('terms', { title: 'Termos e Condições' });
});

router.get('/setup-company', authMiddleware2, (req, res) => {
    res.render('setup-company', buildViewData(req, 'Configurar Empresa'));
});

router.get('/dashboard', authMiddleware2, ensureHasActiveModule, (req, res) => {
    // Redirect to setup wizard if company still has ALL placeholder data (never configured)
    const c = req.user.company;
    if (c && c.nuit === '000000000' && c.address === 'A definir' && c.contact === 'A definir') {
        return res.redirect('/setup-company');
    }

    if (req.user.company.modules.sales) {
        return res.redirect("/sales-dashboard");
    }

    res.render('dashboard', buildViewData(req, 'Dashboard'));
});

router.get('/profile', authMiddleware2, (req, res) => {
    res.render('profile', buildViewData(req, 'Meu Perfil'));
});

router.get('/activities', authMiddleware2, (req, res) => {
    res.render('activities', buildViewData(req, 'Actividades'));
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

router.get('/new-invoice', authMiddleware2, requirePermission('invoicing'), requireActiveSubscription, (req, res) => {
    res.render('new-invoice', buildViewData(req, 'Nova Factura'));
});

router.get('/quotations', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    res.render('quotations', buildViewData(req, 'Cotações'));
});

router.get('/new-quotation', authMiddleware2, requirePermission('invoicing'), requireActiveSubscription, (req, res) => {
    res.render('new-quotation', buildViewData(req, 'Nova Cotação'));
});

router.get('/vd', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    res.render('vd', buildViewData(req, 'VD'));
});

router.get('/receipts', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    res.render('receipt', buildViewData(req, 'Recibos'));
});

router.get('/new-vd', authMiddleware2, requirePermission('invoicing'), requireActiveSubscription, (req, res) => {
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

router.get('/new-sale', authMiddleware2, requirePermission('sales'), requireActiveSubscription, (req, res) => {
    res.render('new-sale', buildViewData(req, 'Nova Venda'));
});

// Movements
router.get('/stock-movements', authMiddleware2, requirePermission('stock'), (req, res) => {
    res.render('stock-movements', buildViewData(req, 'Movimentos de Stock'));
});

router.get('/demo', async (req, res) => {
    // Create or find demo account, auto-login, redirect to dashboard
    const jwt = require('jsonwebtoken');
    const User = require('../models/user');
    const SECRET = process.env.JWT_SECRET;
    const DEMO_EMAIL = 'demo@invoicing.bitiray.com';

    try {
        let user = await User.findOne({ email: DEMO_EMAIL }).populate('companyId');
        if (!user) {
            // Create demo account via quick register
            const { quickRegister } = require('../controllers/companyController');
            const mockReq = { body: { name: 'Conta Demo', email: DEMO_EMAIL, password: 'Demo12345!' } };
            const mockRes = { status: () => ({ json: () => {} }), json: () => {} };
            await quickRegister(mockReq, mockRes);
            user = await User.findOne({ email: DEMO_EMAIL }).populate('companyId');
        }
        if (!user) return res.redirect('/register');

        const token = jwt.sign(
            { id: user._id, name: user.name, email: user.email, permissions: user.permissions, role: user.role, company: user.companyId },
            SECRET, { expiresIn: '1h' }
        );
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 3600000
        });
        return res.redirect('/dashboard');
    } catch (e) {
        console.error('Demo login error:', e);
        return res.redirect('/register');
    }
});

router.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

router.get('/register', (req, res) => {
    res.render('register-simple', { title: 'Criar Conta' });
});

router.get('/register-full', (req, res) => {
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

// Subscrição
router.get('/subscription', authMiddleware2, (req, res) => {
    res.render('subscription', buildViewData(req, 'A minha Subscrição'));
});

router.get('/upgrade', authMiddleware2, (req, res) => {
    res.render('upgrade', buildViewData(req, 'Upgrade de Plano'));
});

// Setup do primeiro SUPERADMIN
router.get('/admin/setup', (req, res) => {
    res.render('admin/setup', { title: 'Configurar SUPERADMIN' });
});

// ─── Painel de Administração ─────────────────────────────────────────────────
router.get('/admin', authMiddleware2, requireSuperAdmin, (req, res) => {
    res.render('admin/dashboard', buildViewData(req, 'Admin — Dashboard'));
});

router.get('/admin/subscriptions', authMiddleware2, requireSuperAdmin, (req, res) => {
    res.render('admin/subscriptions', buildViewData(req, 'Admin — Subscrições'));
});

router.get('/admin/companies', authMiddleware2, requireSuperAdmin, (req, res) => {
    res.render('admin/companies', buildViewData(req, 'Admin — Empresas'));
});

router.get('/admin/users', authMiddleware2, requireSuperAdmin, (req, res) => {
    res.render('admin/users', buildViewData(req, 'Admin — Utilizadores'));
});

router.get('/admin/activities', authMiddleware2, requireSuperAdmin, (req, res) => {
    res.render('admin/activities', buildViewData(req, 'Admin — Actividades'));
});

router.get('/admin/plans', authMiddleware2, requireSuperAdmin, (req, res) => {
    res.render('admin/plans', buildViewData(req, 'Admin — Planos'));
});

router.get('/admin/insights', authMiddleware2, requireSuperAdmin, (req, res) => {
    res.render('admin/insights', buildViewData(req, 'Admin — Insights'));
});

router.get('/admin/system', authMiddleware2, requireSuperAdmin, (req, res) => {
    res.render('admin/system', buildViewData(req, 'Admin — Sistema'));
});

// Despesas
router.get('/expenses', authMiddleware2, requirePermission('dashboard'), (req, res) => {
    res.render('expenses', buildViewData(req, 'Despesas'));
});

// Fornecedores
router.get('/suppliers', authMiddleware2, requirePermission('suppliers'), (req, res) => {
    res.render('suppliers', buildViewData(req, 'Fornecedores'));
});

// POS (Venda rápida)
router.get('/pos', authMiddleware2, requirePermission('sales'), requireActiveSubscription, (req, res) => {
    res.render('pos', buildViewData(req, 'Venda Rápida'));
});

// Dívidas de clientes
router.get('/debts', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    res.render('debts', buildViewData(req, 'Dívidas de Clientes'));
});

// Actividades
router.get('/activities', authMiddleware2, (req, res) => {
    res.render('activities', buildViewData(req, 'Actividades'));
});

// Notas de crédito e débito
router.get('/notes', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    res.render('notes', buildViewData(req, 'Notas de Crédito & Débito'));
});

// Relatório de IVA
router.get('/iva-report', authMiddleware2, requirePermission('reports'), (req, res) => {
    res.render('iva-report', buildViewData(req, 'Relatório de IVA'));
});

// Análise de clientes
router.get('/client-analysis', authMiddleware2, requirePermission('customers'), (req, res) => {
    res.render('client-analysis', buildViewData(req, 'Análise de Clientes'));
});

// Lucro por produto
router.get('/product-profits', authMiddleware2, requirePermission('reports'), (req, res) => {
    res.render('product-profits', buildViewData(req, 'Lucro por Produto'));
});

router.get('/product-margins', authMiddleware2, requirePermission('reports'), (req, res) => {
    res.render('product-margins', buildViewData(req, 'Margem por Produto'));
});

// Página pública de novidades (sem auth) — layout do website
router.get('/whats-new', (req, res) => {
    res.render('whats-new-public', { title: 'Novidades' });
});

// Página de novidades dentro da app (com sidebar) — só autenticado
router.get('/app/whats-new', authMiddleware2, (req, res) => {
    res.render('whats-new', buildViewData(req, 'Novidades'));
});

// Facturas recorrentes
router.get('/recurring-invoices', authMiddleware2, requirePermission('invoicing'), (req, res) => {
    res.render('recurring-invoices', buildViewData(req, 'Facturas Recorrentes'));
});

// Portal público do cliente
router.get('/p/:token', async (req, res) => {
    const Invoice = require('../models/invoice');
    const invoice = await Invoice.findById(req.params.token).catch(() => null);
    if (!invoice) return res.status(404).render('404', { title: '404', user: null, requestedUrl: req.originalUrl });
    res.render('client-portal', { title: 'Documento', invoice });
});

// Logout
router.get('/logout', (req, res) => {
    res.redirect('/login');
});

module.exports = router;