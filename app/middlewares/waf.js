/**
 * Arquivo: app/middlewares/waf.js
 * Placeholder WAF - Substituir pelo WAF completo quando necessário
 */

console.log('⚠️ WAF Placeholder ativo - Para usar o WAF completo, substitua este arquivo');

// Configurações básicas
const WAF_CONFIG = {
    ENABLED: process.env.WAF_MODE !== 'OFF',
    MODE: process.env.WAF_MODE || 'MONITOR',
    LOG_LEVEL: process.env.WAF_LOG_LEVEL || 'INFO'
};

/**
 * Classe WAF simplificada
 */
class SimplifiedWAF {
    constructor() {
        this.blockedIPs = new Map();
        this.requestStats = new Map();
    }
    
    getClientIP(req) {
        return req.ip || req.connection.remoteAddress || '0.0.0.0';
    }
    
    middleware() {
        return (req, res, next) => {
            // WAF simplificado - apenas log básico
            const ip = this.getClientIP(req);
            
            this.logEvent('DEBUG', 'REQUEST_PROCESSED', {
                ip,
                method: req.method,
                url: req.originalUrl
            });
            
            next();
        };
    }
    
    logEvent(level, type, data) {
        if (this.shouldLog(level)) {
            console.log(`🛡️ [WAF-${level}] ${type}:`, JSON.stringify(data));
        }
    }
    
    shouldLog(level) {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        const configLevelIndex = levels.indexOf(WAF_CONFIG.LOG_LEVEL);
        const logLevelIndex = levels.indexOf(level);
        return logLevelIndex >= configLevelIndex;
    }
    
    recordViolation(ip, reason) {
        this.logEvent('WARN', 'VIOLATION_RECORDED', { ip, reason });
    }
    
    getStats() {
        return {
            enabled: WAF_CONFIG.ENABLED,
            mode: WAF_CONFIG.MODE,
            stats: {
                activeIPs: this.requestStats.size,
                totalRequests: 0,
                totalViolations: 0,
                blockedIPs: this.blockedIPs.size,
                whitelistedIPs: 0,
                blacklistedIPs: 0
            },
            config: WAF_CONFIG
        };
    }
    
    cleanup() {
        console.log('🧹 WAF cleanup executado');
    }
}

// Instância global
const wafInstance = new SimplifiedWAF();

// Middleware de reporting simplificado
const wafReportingMiddleware = (waf) => {
    return (req, res, next) => {
        next();
    };
};

// Função para criar rotas administrativas
const createWAFAdminRoutes = (waf) => {
    const router = require('express').Router();
    
    router.get('/simple-stats', (req, res) => {
        res.json({
            message: 'WAF Simplificado ativo',
            stats: waf.getStats()
        });
    });
    
    return router;
};

module.exports = {
    WebApplicationFirewall: SimplifiedWAF,
    wafInstance,
    wafReportingMiddleware,
    createWAFAdminRoutes,
    WAF_CONFIG
};
