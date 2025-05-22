/**
 * Arquivo: config/waf-rules.js
 * Configurações e regras personalizadas do WAF
 */

const WAF_RULES = {
    // Regras específicas para o Portal MVK
    CUSTOM_PATTERNS: {
        // Proteção contra ataques ao portal específico
        PORTAL_SPECIFIC: [
            // Tentativas de acesso direto a arquivos sensíveis
            /\/(config|admin|backup|test|staging)\//gi,
            /\.(env|config|bak|old|tmp)(\?|$)/gi,
            
            // Tentativas de bypass de autenticação
            /\/api\/(login|auth).*['";<>]/gi,
            /session[_-]?(id|token|key)/gi,
            
            // Scanners de vulnerabilidades comuns
            /wp-admin|wordpress|joomla|drupal/gi,
            /phpmyadmin|adminer|phpinfo/gi,
            
            // Tentativas de descoberta de estrutura
            /\/(assets|static|public).*\.\./gi,
            /\/\.(git|svn|env|htaccess)/gi
        ],
        
        // Proteção CNPJ/CPF específica do Brasil
        BRAZIL_SPECIFIC: [
            // Tentativas de SQL injection com dados brasileiros
            /cnpj.*union|cpf.*select/gi,
            /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}.*['";<>]/gi, // CNPJ malformado
            /\d{3}\.?\d{3}\.?\d{3}-?\d{2}.*['";<>]/gi // CPF malformado
        ]
    },
    
    // Whitelist de endpoints que podem ter conteúdo dinâmico
    DYNAMIC_CONTENT_WHITELIST: [
        '/api/pedidos',
        '/api/notas-fiscais',
        '/api/financeiro',
        '/api/sac'
    ],
    
    // Regras de rate limiting por endpoint
    ENDPOINT_RATE_LIMITS: {
        '/api/login': { requests: 5, window: 300 }, // 5 tentativas por 5 minutos
        '/api/usuario': { requests: 60, window: 60 }, // 60 por minuto
        '/api/pedidos': { requests: 30, window: 60 }, // 30 por minuto
        '/api/financeiro': { requests: 20, window: 60 }, // 20 por minuto (dados sensíveis)
        '/api/notas-fiscais': { requests: 30, window: 60 },
        '/api/enviarSac': { requests: 3, window: 300 } // 3 por 5 minutos
    },
    
    // Configurações de geolocalização
    GEO_RESTRICTIONS: {
        ALLOWED_COUNTRIES: ['BR', 'US'], // Brasil e Estados Unidos
        BLOCKED_COUNTRIES: ['CN', 'RU', 'KP'], // China, Rússia, Coreia do Norte
        CHECK_ENABLED: false // Desabilitado por padrão
    },
    
    // User Agents suspeitos específicos
    SUSPICIOUS_USER_AGENTS: [
        /python|curl|wget|postman|insomnia/gi, // Clientes programáticos
        /bot|crawler|spider|scraper/gi, // Bots genéricos
        /nmap|sqlmap|nikto|dirb|gobuster/gi, // Ferramentas de segurança
        /masscan|zap|burp|acunetix/gi // Scanners de vulnerabilidade
    ],
    
    // IPs conhecidos como maliciosos (exemplo)
    KNOWN_BAD_IPS: [
        // Adicionar IPs específicos conforme necessário
        // '192.168.1.100',
        // '10.0.0.50'
    ],
    
    // Configurações de monitoramento
    MONITORING: {
        ALERT_THRESHOLDS: {
            REQUESTS_PER_MINUTE: 100,
            VIOLATIONS_PER_HOUR: 10,
            BLOCKED_IPS_TOTAL: 50,
            FAILED_LOGINS_PER_HOUR: 25
        },
        
        NOTIFICATION_EMAILS: [
            'security@mvk.com.br',
            'admin@mvk.com.br'
        ],
        
        WEBHOOK_URL: process.env.WAF_WEBHOOK_URL || null
    }
};

/**
 * Configurações ambiente-específicas
 */
const ENVIRONMENT_CONFIG = {
    development: {
        MODE: 'MONITOR', // Apenas monitorar em desenvolvimento
        LOG_LEVEL: 'DEBUG',
        BLOCK_DURATION: 300, // 5 minutos
        MAX_VIOLATIONS: 10, // Mais permissivo
        ENABLE_GEO_BLOCKING: false
    },
    
    staging: {
        MODE: 'MONITOR',
        LOG_LEVEL: 'INFO',
        BLOCK_DURATION: 1800, // 30 minutos
        MAX_VIOLATIONS: 7,
        ENABLE_GEO_BLOCKING: false
    },
    
    production: {
        MODE: 'BLOCK', // Bloquear em produção
        LOG_LEVEL: 'WARN',
        BLOCK_DURATION: 3600, // 1 hora
        MAX_VIOLATIONS: 5,
        ENABLE_GEO_BLOCKING: true
    }
};

/**
 * Obter configuração baseada no ambiente
 */
function getEnvironmentConfig() {
    const env = process.env.NODE_ENV || 'development';
    return ENVIRONMENT_CONFIG[env] || ENVIRONMENT_CONFIG.development;
}

module.exports = {
    WAF_RULES,
    ENVIRONMENT_CONFIG,
    getEnvironmentConfig
};

/**
 * Arquivo: app/middlewares/waf-integration.js
 * Integração do WAF com o sistema existente
 */

const { wafInstance, wafReportingMiddleware } = require('./waf');
const { WAF_RULES, getEnvironmentConfig } = require('../../config/waf-rules');
const { BackendDataProtection } = require('./data-protection');

/**
 * Middleware de integração do WAF com proteção de dados
 */
const wafDataProtectionMiddleware = (req, res, next) => {
    // Interceptar logs do WAF para aplicar proteção de dados
    const originalLogEvent = wafInstance.logEvent;
    
    wafInstance.logEvent = function(level, type, data) {
        // Aplicar mascaramento automático aos logs do WAF
        const maskedData = BackendDataProtection.maskSensitiveData(data);
        return originalLogEvent.call(this, level, type, maskedData);
    };
    
    next();
};

/**
 * Middleware personalizado para regras específicas do Portal MVK
 */
const mvkCustomRulesMiddleware = (req, res, next) => {
    const clientIP = wafInstance.getClientIP(req);
    const url = req.originalUrl.toLowerCase();
    const userAgent = req.get('User-Agent') || '';
    const method = req.method;
    
    // Verificar regras personalizadas
    for (const [ruleCategory, patterns] of Object.entries(WAF_RULES.CUSTOM_PATTERNS)) {
        for (const pattern of patterns) {
            const testString = `${url} ${userAgent} ${JSON.stringify(req.query)} ${JSON.stringify(req.body || {})}`;
            
            if (pattern.test(testString)) {
                wafInstance.logEvent('WARN', 'CUSTOM_RULE_VIOLATION', {
                    ip: clientIP,
                    rule: ruleCategory,
                    pattern: pattern.toString(),
                    url: req.originalUrl,
                    method,
                    userAgent
                });
                
                wafInstance.recordViolation(clientIP, `CUSTOM_RULE_${ruleCategory}`);
                
                return res.status(403).json({
                    error: 'Request blocked by security policy',
                    code: 'CUSTOM_RULE_VIOLATION',
                    requestId: require('crypto').randomBytes(8).toString('hex')
                });
            }
        }
    }
    
    // Verificar rate limits específicos por endpoint
    const endpointLimits = WAF_RULES.ENDPOINT_RATE_LIMITS;
    for (const [endpoint, limits] of Object.entries(endpointLimits)) {
        if (url.startsWith(endpoint)) {
            const allowed = wafInstance.checkEndpointRateLimit(clientIP, endpoint, limits);
            if (!allowed) {
                wafInstance.logEvent('WARN', 'ENDPOINT_RATE_LIMIT', {
                    ip: clientIP,
                    endpoint,
                    limits,
                    url: req.originalUrl
                });
                
                return res.status(429).json({
                    error: 'Rate limit exceeded for this endpoint',
                    code: 'ENDPOINT_RATE_LIMIT',
                    retryAfter: limits.window
                });
            }
        }
    }
    
    next();
};

/**
 * Middleware de monitoramento avançado
 */
const advancedMonitoringMiddleware = (req, res, next) => {
    const startTime = Date.now();
    const clientIP = wafInstance.getClientIP(req);
    
    // Interceptar final da resposta para métricas
    const originalEnd = res.end;
    res.end = function(...args) {
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode;
        
        // Registrar métricas detalhadas
        wafInstance.logEvent('DEBUG', 'REQUEST_METRICS', {
            ip: clientIP,
            method: req.method,
            url: req.originalUrl,
            statusCode,
            responseTime,
            userAgent: req.get('User-Agent'),
            contentLength: res.get('content-length') || 0
        });
        
        // Verificar thresholds de alerta
        if (responseTime > 10000) { // 10 segundos
            wafInstance.logEvent('WARN', 'SLOW_REQUEST', {
                ip: clientIP,
                url: req.originalUrl,
                responseTime
            });
        }
        
        if (statusCode >= 500) {
            wafInstance.logEvent('ERROR', 'SERVER_ERROR', {
                ip: clientIP,
                url: req.originalUrl,
                statusCode
            });
        }
        
        return originalEnd.apply(this, args);
    };
    
    next();
};

/**
 * Sistema de alertas em tempo real
 */
class WAFAlertSystem {
    constructor() {
        this.alertCounts = new Map();
        this.lastAlertTime = new Map();
        this.initializeMonitoring();
    }
    
    initializeMonitoring() {
        // Verificar thresholds a cada minuto
        setInterval(() => {
            this.checkAlertThresholds();
        }, 60000);
    }
    
    checkAlertThresholds() {
        const stats = wafInstance.getStats();
        const thresholds = WAF_RULES.MONITORING.ALERT_THRESHOLDS;
        
        // Verificar requisições por minuto
        if (stats.stats.totalRequests > thresholds.REQUESTS_PER_MINUTE) {
            this.sendAlert('HIGH_REQUEST_VOLUME', {
                current: stats.stats.totalRequests,
                threshold: thresholds.REQUESTS_PER_MINUTE
            });
        }
        
        // Verificar IPs bloqueados
        if (stats.stats.blockedIPs > thresholds.BLOCKED_IPS_TOTAL) {
            this.sendAlert('HIGH_BLOCKED_IPS', {
                current: stats.stats.blockedIPs,
                threshold: thresholds.BLOCKED_IPS_TOTAL
            });
        }
        
        // Verificar violações
        if (stats.stats.totalViolations > thresholds.VIOLATIONS_PER_HOUR) {
            this.sendAlert('HIGH_VIOLATIONS', {
                current: stats.stats.totalViolations,
                threshold: thresholds.VIOLATIONS_PER_HOUR
            });
        }
    }
    
    async sendAlert(alertType, data) {
        const now = Date.now();
        const lastAlert = this.lastAlertTime.get(alertType) || 0;
        
        // Evitar spam de alertas (mínimo 15 minutos entre alertas do mesmo tipo)
        if (now - lastAlert < 900000) {
            return;
        }
        
        this.lastAlertTime.set(alertType, now);
        
        const alert = {
            type: alertType,
            timestamp: new Date().toISOString(),
            data,
            severity: this.getAlertSeverity(alertType),
            source: 'WAF',
            environment: process.env.NODE_ENV || 'development'
        };
        
        wafInstance.logEvent('ERROR', 'SECURITY_ALERT', alert);
        
        // Enviar notificações
        await this.sendNotifications(alert);
    }
    
    getAlertSeverity(alertType) {
        const severityMap = {
            'HIGH_REQUEST_VOLUME': 'MEDIUM',
            'HIGH_BLOCKED_IPS': 'HIGH',
            'HIGH_VIOLATIONS': 'HIGH',
            'DDOS_DETECTED': 'CRITICAL',
            'MASS_ATTACK': 'CRITICAL'
        };
        
        return severityMap[alertType] || 'MEDIUM';
    }
    
    async sendNotifications(alert) {
        try {
            // Enviar webhook se configurado
            if (WAF_RULES.MONITORING.WEBHOOK_URL) {
                await this.sendWebhook(alert);
            }
            
            // Log para sistema de monitoramento externo
            console.log('🚨 [WAF_ALERT]', JSON.stringify(alert));
            
        } catch (error) {
            console.error('Erro ao enviar notificação de alerta WAF:', error);
        }
    }
    
    async sendWebhook(alert) {
        const fetch = require('node-fetch');
        
        try {
            await fetch(WAF_RULES.MONITORING.WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alert),
                timeout: 5000
            });
        } catch (error) {
            console.error('Erro ao enviar webhook WAF:', error);
        }
    }
}

// Inicializar sistema de alertas
const alertSystem = new WAFAlertSystem();

/**
 * Extensões para o WAF instance
 */
wafInstance.checkEndpointRateLimit = function(ip, endpoint, limits) {
    const key = `${ip}:${endpoint}`;
    const now = Date.now();
    const windowStart = now - (limits.window * 1000);
    
    let stats = this.requestStats.get(key);
    if (!stats) {
        stats = { requests: [], firstRequest: now };
        this.requestStats.set(key, stats);
    }
    
    // Remover requisições antigas
    stats.requests = stats.requests.filter(time => time > windowStart);
    
    // Verificar limite
    if (stats.requests.length >= limits.requests) {
        return false;
    }
    
    // Adicionar requisição atual
    stats.requests.push(now);
    return true;
};

module.exports = {
    wafDataProtectionMiddleware,
    mvkCustomRulesMiddleware,
    advancedMonitoringMiddleware,
    WAFAlertSystem,
    alertSystem
};

/**
 * Arquivo: app/routes/waf-admin.js
 * Rotas administrativas para o WAF
 */

const express = require('express');
const router = express.Router();
const { wafInstance, createWAFAdminRoutes } = require('../middlewares/waf');
const { autenticacaoRequerida } = require('../middlewares/auth');

// Middleware de autenticação para rotas WAF
const wafAdminAuth = (req, res, next) => {
    // Verificar se o usuário tem permissões de admin
    if (!req.session.usuario || req.session.usuario.codigo !== 'ADMIN') {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Apenas administradores podem acessar o painel WAF'
        });
    }
    next();
};

// Usar as rotas administrativas do WAF
router.use('/', autenticacaoRequerida, wafAdminAuth, createWAFAdminRoutes(wafInstance));

// Rota para dashboard WAF
router.get('/dashboard', (req, res) => {
    const stats = wafInstance.getStats();
    const envConfig = getEnvironmentConfig();
    
    res.json({
        title: 'WAF Dashboard - Portal MVK',
        stats,
        config: envConfig,
        alerts: alertSystem.alertCounts,
        timestamp: new Date().toISOString()
    });
});

// Rota para teste do WAF
router.get('/test', (req, res) => {
    res.json({
        message: 'WAF está funcionando corretamente',
        timestamp: new Date().toISOString(),
        clientIP: wafInstance.getClientIP(req),
        wafStatus: 'ACTIVE'
    });
});

module.exports = router;