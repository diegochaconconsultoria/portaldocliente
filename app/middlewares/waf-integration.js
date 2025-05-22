/**
 * Arquivo: app/middlewares/waf-integration.js
 * Integração do WAF com o sistema existente
 */

// Verificar se os módulos existem antes de importar
let wafInstance, wafReportingMiddleware, WAF_RULES, getEnvironmentConfig, BackendDataProtection;

try {
    const wafModule = require('./waf');
    wafInstance = wafModule.wafInstance;
    wafReportingMiddleware = wafModule.wafReportingMiddleware;
} catch (error) {
    console.warn('⚠️ WAF principal não encontrado, usando placeholder');
    wafInstance = {
        getClientIP: (req) => req.ip || '0.0.0.0',
        logEvent: () => {},
        recordViolation: () => {},
        checkEndpointRateLimit: () => true
    };
}

try {
    const rulesModule = require('../../config/waf-rules');
    WAF_RULES = rulesModule.WAF_RULES;
    getEnvironmentConfig = rulesModule.getEnvironmentConfig;
} catch (error) {
    console.warn('⚠️ WAF rules não encontradas, usando configuração padrão');
    WAF_RULES = { CUSTOM_PATTERNS: {}, ENDPOINT_RATE_LIMITS: {} };
    getEnvironmentConfig = () => ({ MODE: 'MONITOR' });
}

try {
    const dataProtection = require('./data-protection');
    BackendDataProtection = dataProtection.BackendDataProtection;
} catch (error) {
    console.warn('⚠️ Data protection não encontrado, usando placeholder');
    BackendDataProtection = {
        maskSensitiveData: (data) => data,
        logSensitiveAccess: () => {}
    };
}

/**
 * Middleware de integração do WAF com proteção de dados
 */
const wafDataProtectionMiddleware = (req, res, next) => {
    // Se WAF não estiver disponível, apenas prosseguir
    if (!wafInstance.logEvent) {
        return next();
    }
    
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
    // Se WAF não estiver disponível, apenas prosseguir
    if (!wafInstance.getClientIP) {
        return next();
    }
    
    const clientIP = wafInstance.getClientIP(req);
    const url = req.originalUrl.toLowerCase();
    const userAgent = req.get('User-Agent') || '';
    const method = req.method;
    
    // Verificar regras personalizadas se disponíveis
    if (WAF_RULES.CUSTOM_PATTERNS) {
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
    }
    
    // Verificar rate limits específicos por endpoint
    const endpointLimits = WAF_RULES.ENDPOINT_RATE_LIMITS || {};
    for (const [endpoint, limits] of Object.entries(endpointLimits)) {
        if (url.startsWith(endpoint)) {
            const allowed = wafInstance.checkEndpointRateLimit ? 
                wafInstance.checkEndpointRateLimit(clientIP, endpoint, limits) : true;
            
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
    const clientIP = wafInstance.getClientIP ? wafInstance.getClientIP(req) : req.ip;
    
    // Interceptar final da resposta para métricas
    const originalEnd = res.end;
    res.end = function(...args) {
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode;
        
        // Registrar métricas detalhadas
        if (wafInstance.logEvent) {
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
        if (!wafInstance.getStats) return;
        
        const stats = wafInstance.getStats();
        const thresholds = WAF_RULES.MONITORING ? WAF_RULES.MONITORING.ALERT_THRESHOLDS : {};
        
        // Verificar requisições por minuto
        if (stats.stats.totalRequests > (thresholds.REQUESTS_PER_MINUTE || 100)) {
            this.sendAlert('HIGH_REQUEST_VOLUME', {
                current: stats.stats.totalRequests,
                threshold: thresholds.REQUESTS_PER_MINUTE || 100
            });
        }
        
        // Verificar IPs bloqueados
        if (stats.stats.blockedIPs > (thresholds.BLOCKED_IPS_TOTAL || 50)) {
            this.sendAlert('HIGH_BLOCKED_IPS', {
                current: stats.stats.blockedIPs,
                threshold: thresholds.BLOCKED_IPS_TOTAL || 50
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
        
        if (wafInstance.logEvent) {
            wafInstance.logEvent('ERROR', 'SECURITY_ALERT', alert);
        }
        
        console.log('🚨 [WAF_ALERT]', JSON.stringify(alert));
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
}

// Inicializar sistema de alertas
const alertSystem = new WAFAlertSystem();

/**
 * Extensões para o WAF instance
 */
if (wafInstance && !wafInstance.checkEndpointRateLimit) {
    wafInstance.checkEndpointRateLimit = function(ip, endpoint, limits) {
        const key = `${ip}:${endpoint}`;
        const now = Date.now();
        const windowStart = now - (limits.window * 1000);
        
        if (!this.requestStats) {
            this.requestStats = new Map();
        }
        
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
}

module.exports = {
    wafDataProtectionMiddleware,
    mvkCustomRulesMiddleware,
    advancedMonitoringMiddleware,
    WAFAlertSystem,
    alertSystem
};
