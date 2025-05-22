/**
 * Arquivo: app/routes/waf-admin.js
 * Rotas administrativas para o WAF
 */

const express = require('express');
const router = express.Router();

// Importar WAF com tratamento de erro
let wafInstance, createWAFAdminRoutes, autenticacaoRequerida, getEnvironmentConfig, alertSystem;

try {
    const wafModule = require('../middlewares/waf');
    wafInstance = wafModule.wafInstance;
    createWAFAdminRoutes = wafModule.createWAFAdminRoutes;
} catch (error) {
    console.warn('⚠️ WAF não encontrado para rotas administrativas');
}

try {
    const authModule = require('../middlewares/auth');
    autenticacaoRequerida = authModule.autenticacaoRequerida;
} catch (error) {
    console.warn('⚠️ Auth middleware não encontrado');
    autenticacaoRequerida = (req, res, next) => next(); // Placeholder
}

try {
    const configModule = require('../../config/waf-rules');
    getEnvironmentConfig = configModule.getEnvironmentConfig;
} catch (error) {
    getEnvironmentConfig = () => ({ MODE: 'MONITOR' });
}

try {
    const integrationModule = require('../middlewares/waf-integration');
    alertSystem = integrationModule.alertSystem;
} catch (error) {
    alertSystem = { alertCounts: new Map() };
}

// Middleware de autenticação para rotas WAF
const wafAdminAuth = (req, res, next) => {
    // Por enquanto, apenas verificar se está autenticado
    // Em produção, adicionar verificação de permissões específicas
    next();
};

// Rota para dashboard WAF
router.get('/dashboard', autenticacaoRequerida, wafAdminAuth, (req, res) => {
    try {
        const stats = wafInstance && wafInstance.getStats ? wafInstance.getStats() : {
            enabled: false,
            mode: 'OFF',
            stats: { activeIPs: 0, totalRequests: 0, totalViolations: 0, blockedIPs: 0 }
        };
        
        const envConfig = getEnvironmentConfig();
        
        res.json({
            title: 'WAF Dashboard - Portal MVK',
            stats,
            config: envConfig,
            alerts: alertSystem.alertCounts ? Object.fromEntries(alertSystem.alertCounts) : {},
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Erro ao obter dados do WAF',
            message: error.message
        });
    }
});

// Rota para estatísticas básicas
router.get('/stats', autenticacaoRequerida, wafAdminAuth, (req, res) => {
    try {
        if (wafInstance && wafInstance.getStats) {
            res.json(wafInstance.getStats());
        } else {
            res.json({
                error: 'WAF não disponível',
                message: 'O sistema WAF não está ativo'
            });
        }
    } catch (error) {
        res.status(500).json({
            error: 'Erro ao obter estatísticas',
            message: error.message
        });
    }
});

// Rota para teste do WAF
router.get('/test', (req, res) => {
    res.json({
        message: 'Rotas administrativas WAF funcionando',
        timestamp: new Date().toISOString(),
        wafStatus: wafInstance ? 'AVAILABLE' : 'NOT_AVAILABLE'
    });
});

// Usar as rotas administrativas do WAF se disponíveis
if (wafInstance && createWAFAdminRoutes) {
    try {
        router.use('/', autenticacaoRequerida, wafAdminAuth, createWAFAdminRoutes(wafInstance));
    } catch (error) {
        console.warn('⚠️ Erro ao configurar rotas administrativas WAF:', error.message);
    }
}

module.exports = router;
