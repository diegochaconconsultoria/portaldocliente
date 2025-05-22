/**
 * Sistema de Rate Limiting Avançado e Inteligente
 * Arquivo: app/middlewares/advanced-rate-limiting.js
 * 
 * Implementa rate limiting adaptativo com detecção de padrões suspeitos
 */

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Configurações de rate limiting
const RATE_LIMIT_CONFIG = {
    // Configurações gerais
    TRUST_PROXY: true,
    SKIP_SUCCESSFUL_REQUESTS: false,
    SKIP_FAILED_REQUESTS: false,
    
    // Configurações por categoria
    GLOBAL: {
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 1000, // 1000 requisições por IP
        message: 'Muitas requisições deste IP. Tente novamente mais tarde.',
        standardHeaders: true,
        legacyHeaders: false
    },
    
    LOGIN: {
        windowMs: 60 * 60 * 1000, // 1 hora
        max: 10, // 10 tentativas por hora
        skipSuccessfulRequests: true, // Não contar logins bem-sucedidos
        message: {
            error: 'Muitas tentativas de login. Tente novamente em 1 hora.',
            code: 'LOGIN_RATE_LIMIT'
        }
    },
    
    API: {
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 300, // 300 requisições de API por IP
        message: {
            error: 'Limite de requisições de API excedido.',
            code: 'API_RATE_LIMIT'
        }
    },
    
    SENSITIVE: {
        windowMs: 60 * 60 * 1000, // 1 hora
        max: 20, // 20 requisições para endpoints sensíveis
        message: {
            error: 'Limite para operações sensíveis excedido.',
            code: 'SENSITIVE_RATE_LIMIT'
        }
    },
    
    DOWNLOAD: {
        windowMs: 60 * 60 * 1000, // 1 hora
        max: 100, // 100 downloads por hora
        message: {
            error: 'Limite de downloads excedido.',
            code: 'DOWNLOAD_RATE_LIMIT'
        }
    }
};

// Store para tracking avançado de IPs suspeitos
const suspiciousActivityStore = new Map();
const ipReputationStore = new Map();

/**
 * Classe para gerenciar rate limiting avançado
 */
class AdvancedRateLimit {
    
    /**
     * Detecta padrões suspeitos de comportamento
     */
    static detectSuspiciousPattern(ip, req) {
        const now = Date.now();
        const activity = suspiciousActivityStore.get(ip) || {
            requests: [],
            failedLogins: 0,
            errors: 0,
            lastReset: now
        };
        
        // Reset periódico (a cada hora)
        if (now - activity.lastReset > 60 * 60 * 1000) {
            activity.requests = [];
            activity.failedLogins = 0;
            activity.errors = 0;
            activity.lastReset = now;
        }
        
        // Adicionar requisição atual
        activity.requests.push({
            timestamp: now,
            url: req.originalUrl,
            method: req.method,
            userAgent: req.get('User-Agent')
        });
        
        // Manter apenas últimas 100 requisições
        if (activity.requests.length > 100) {
            activity.requests = activity.requests.slice(-100);
        }
        
        // Analisar padrões suspeitos
        const suspiciousScore = this.calculateSuspiciousScore(activity, req);
        
        suspiciousActivityStore.set(ip, activity);
        
        return {
            score: suspiciousScore,
            activity
        };
    }
    
    /**
     * Calcula score de suspeita (0-100)
     */
    static calculateSuspiciousScore(activity, req) {
        let score = 0;
        const now = Date.now();
        const last5Minutes = activity.requests.filter(r => now - r.timestamp < 5 * 60 * 1000);
        
        // Muitas requisições em pouco tempo
        if (last5Minutes.length > 100) score += 30;
        else if (last5Minutes.length > 50) score += 15;
        
        // Muitos logins falhados
        if (activity.failedLogins > 5) score += 25;
        
        // Muitos erros
        if (activity.errors > 10) score += 20;
        
        // Padrões de URL suspeitos
        const urlPatterns = activity.requests.map(r => r.url);
        const uniqueUrls = new Set(urlPatterns);
        if (uniqueUrls.size === 1 && last5Minutes.length > 20) {
            score += 15; // Muitas requisições para mesma URL
        }
        
        // User Agent suspeito
        const userAgent = req.get('User-Agent') || '';
        if (!userAgent || userAgent.includes('bot') || userAgent.includes('crawler')) {
            score += 10;
        }
        
        // Horário suspeito (madrugada no Brasil)
        const hour = new Date().getHours();
        if (hour >= 2 && hour <= 5) score += 5;
        
        return Math.min(score, 100);
    }
    
    /**
     * Obtém reputação do IP
     */
    static getIPReputation(ip) {
        return ipReputationStore.get(ip) || {
            score: 50, // Neutro
            lastUpdate: Date.now(),
            violations: 0,
            whitelisted: false,
            blacklisted: false
        };
    }
    
    /**
     * Atualiza reputação do IP
     */
    static updateIPReputation(ip, change, reason) {
        const reputation = this.getIPReputation(ip);
        reputation.score = Math.max(0, Math.min(100, reputation.score + change));
        reputation.lastUpdate = Date.now();
        
        if (change < 0) {
            reputation.violations++;
        }
        
        console.log(`📊 [IP_REPUTATION] ${ip}: ${reputation.score} (${reason})`);
        
        ipReputationStore.set(ip, reputation);
        
        // Auto-blacklist para IPs muito ruins
        if (reputation.score <= 10 && reputation.violations >= 5) {
            reputation.blacklisted = true;
            console.warn(`🚫 [AUTO_BLACKLIST] IP ${ip} foi automaticamente bloqueado`);
        }
        
        return reputation;
    }
    
    /**
     * Middleware para detectar e bloquear IPs suspeitos
     */
    static suspiciousActivityMiddleware(req, res, next) {
        const ip = req.ip || req.connection.remoteAddress;
        const reputation = AdvancedRateLimit.getIPReputation(ip);
        
        // Verificar blacklist
        if (reputation.blacklisted) {
            console.warn(`🚫 [BLACKLISTED] Bloqueando IP blacklistado: ${ip}`);
            return res.status(403).json({
                error: 'Acesso negado',
                code: 'IP_BLACKLISTED'
            });
        }
        
        // Detectar padrões suspeitos
        const suspiciousAnalysis = AdvancedRateLimit.detectSuspiciousPattern(ip, req);
        
        // Aplicar penalidades baseadas no score
        if (suspiciousAnalysis.score >= 80) {
            AdvancedRateLimit.updateIPReputation(ip, -20, 'Comportamento altamente suspeito');
            console.warn(`🚨 [SUSPICIOUS_HIGH] IP ${ip} - Score: ${suspiciousAnalysis.score}`);
            
            return res.status(429).json({
                error: 'Comportamento suspeito detectado. Acesso temporariamente restrito.',
                code: 'SUSPICIOUS_ACTIVITY',
                retryAfter: 3600 // 1 hora
            });
        } else if (suspiciousAnalysis.score >= 60) {
            AdvancedRateLimit.updateIPReputation(ip, -10, 'Comportamento suspeito');
            console.warn(`⚠️ [SUSPICIOUS_MEDIUM] IP ${ip} - Score: ${suspiciousAnalysis.score}`);
            
            // Aplicar slow down
            req.suspiciousScore = suspiciousAnalysis.score;
        } else if (suspiciousAnalysis.score <= 20) {
            // Melhorar reputação de IPs bem comportados
            AdvancedRateLimit.updateIPReputation(ip, +1, 'Comportamento normal');
        }
        
        next();
    }
}

/**
 * Rate limiter global com lógica adaptativa
 */
const globalRateLimit = rateLimit({
    ...RATE_LIMIT_CONFIG.GLOBAL,
    keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress;
    },
    skip: (req) => {
        const ip = req.ip || req.connection.remoteAddress;
        const reputation = AdvancedRateLimit.getIPReputation(ip);
        
        // Pular rate limiting para IPs com boa reputação
        return reputation.whitelisted || reputation.score >= 80;
    },
    handler: (req, res) => {
        const ip = req.ip || req.connection.remoteAddress;
        AdvancedRateLimit.updateIPReputation(ip, -5, 'Rate limit global excedido');
        
        res.status(429).json(RATE_LIMIT_CONFIG.GLOBAL.message);
    }
});

/**
 * Rate limiter específico para login
 */
const loginRateLimit = rateLimit({
    ...RATE_LIMIT_CONFIG.LOGIN,
    keyGenerator: (req) => {
        // Combinar IP + email para rate limiting mais específico
        const ip = req.ip || req.connection.remoteAddress;
        const email = req.body?.email || 'unknown';
        return `${ip}:${email}`;
    },
    skip: (req, res) => {
        // Não pular para endpoints de login
        return false;
    },
    handler: (req, res) => {
        const ip = req.ip || req.connection.remoteAddress;
        AdvancedRateLimit.updateIPReputation(ip, -15, 'Muitas tentativas de login');
        
        // Marcar atividade suspeita
        const activity = suspiciousActivityStore.get(ip) || { failedLogins: 0 };
        activity.failedLogins++;
        suspiciousActivityStore.set(ip, activity);
        
        res.status(429).json(RATE_LIMIT_CONFIG.LOGIN.message);
    }
});

/**
 * Rate limiter para APIs
 */
const apiRateLimit = rateLimit({
    ...RATE_LIMIT_CONFIG.API,
    keyGenerator: (req) => {
        const ip = req.ip || req.connection.remoteAddress;
        const userId = req.session?.usuario?.codigo || 'anonymous';
        return `${ip}:${userId}`;
    },
    skip: (req) => {
        // Aplicar rate limiting mais leniente para usuários autenticados
        if (req.session?.usuario) {
            const reputation = AdvancedRateLimit.getIPReputation(req.ip);
            return reputation.score >= 70; // IPs com boa reputação
        }
        return false;
    },
    handler: (req, res) => {
        const ip = req.ip || req.connection.remoteAddress;
        AdvancedRateLimit.updateIPReputation(ip, -10, 'Rate limit API excedido');
        
        res.status(429).json(RATE_LIMIT_CONFIG.API.message);
    }
});

/**
 * Rate limiter para endpoints sensíveis
 */
const sensitiveRateLimit = rateLimit({
    ...RATE_LIMIT_CONFIG.SENSITIVE,
    keyGenerator: (req) => {
        const ip = req.ip || req.connection.remoteAddress;
        const userId = req.session?.usuario?.codigo || 'anonymous';
        return `${ip}:${userId}`;
    },
    handler: (req, res) => {
        const ip = req.ip || req.connection.remoteAddress;
        AdvancedRateLimit.updateIPReputation(ip, -20, 'Rate limit para endpoints sensíveis excedido');
        
        console.warn(`🔒 [SENSITIVE_RATE_LIMIT] IP ${ip} tentou acessar endpoint sensível: ${req.originalUrl}`);
        
        res.status(429).json(RATE_LIMIT_CONFIG.SENSITIVE.message);
    }
});

/**
 * Rate limiter para downloads
 */
const downloadRateLimit = rateLimit({
    ...RATE_LIMIT_CONFIG.DOWNLOAD,
    keyGenerator: (req) => {
        const ip = req.ip || req.connection.remoteAddress;
        const userId = req.session?.usuario?.codigo || 'anonymous';
        return `${ip}:${userId}`;
    },
    handler: (req, res) => {
        const ip = req.ip || req.connection.remoteAddress;
        AdvancedRateLimit.updateIPReputation(ip, -5, 'Rate limit de downloads excedido');
        
        res.status(429).json(RATE_LIMIT_CONFIG.DOWNLOAD.message);
    }
});

/**
 * Slow down middleware para requisições suspeitas
 */
const suspiciousSlowDown = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutos
    delayAfter: 10, // começar delay após 10 requisições
    delayMs: (req) => {
        // Delay baseado no score de suspeita
        const suspiciousScore = req.suspiciousScore || 0;
        const baseDelay = 100;
        const multiplier = Math.floor(suspiciousScore / 20);
        return baseDelay * (1 + multiplier);
    },
    maxDelayMs: 5000, // Máximo de 5 segundos de delay
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress;
    }
});

/**
 * Middleware para logging de rate limiting
 */
const rateLimitLogger = (req, res, next) => {
    // Interceptar respostas 429 para logging
    const originalJson = res.json;
    
    res.json = function(data) {
        if (res.statusCode === 429) {
            const ip = req.ip || req.connection.remoteAddress;
            const userAgent = req.get('User-Agent') || 'unknown';
            const userId = req.session?.usuario?.codigo || 'anonymous';
            
            console.warn('⏱️ [RATE_LIMIT_HIT]', {
                timestamp: new Date().toISOString(),
                ip,
                userId,
                url: req.originalUrl,
                method: req.method,
                userAgent: userAgent.substring(0, 100), // Limitar tamanho
                rateLimitType: data.code || 'UNKNOWN'
            });
        }
        
        return originalJson.call(this, data);
    };
    
    next();
};

/**
 * Middleware para adicionar headers informativos de rate limit
 */
const rateLimitHeaders = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const reputation = AdvancedRateLimit.getIPReputation(ip);
    
    // Adicionar headers informativos
    res.setHeader('X-RateLimit-Reputation', Math.floor(reputation.score));
    res.setHeader('X-RateLimit-Violations', reputation.violations);
    
    if (reputation.whitelisted) {
        res.setHeader('X-RateLimit-Status', 'whitelisted');
    } else if (reputation.blacklisted) {
        res.setHeader('X-RateLimit-Status', 'blacklisted');
    } else if (reputation.score >= 80) {
        res.setHeader('X-RateLimit-Status', 'trusted');
    } else if (reputation.score <= 30) {
        res.setHeader('X-RateLimit-Status', 'suspicious');
    } else {
        res.setHeader('X-RateLimit-Status', 'normal');
    }
    
    next();
};

/**
 * Sistema de whitelist/blacklist manual
 */
class IPManagement {
    
    /**
     * Adiciona IP à whitelist
     */
    static whitelist(ip, reason = 'Manual whitelist') {
        const reputation = AdvancedRateLimit.getIPReputation(ip);
        reputation.whitelisted = true;
        reputation.blacklisted = false;
        reputation.score = 100;
        reputation.violations = 0;
        
        ipReputationStore.set(ip, reputation);
        
        console.log(`✅ [WHITELIST] IP ${ip} adicionado à whitelist: ${reason}`);
    }
    
    /**
     * Adiciona IP à blacklist
     */
    static blacklist(ip, reason = 'Manual blacklist') {
        const reputation = AdvancedRateLimit.getIPReputation(ip);
        reputation.blacklisted = true;
        reputation.whitelisted = false;
        reputation.score = 0;
        
        ipReputationStore.set(ip, reputation);
        
        console.warn(`🚫 [BLACKLIST] IP ${ip} adicionado à blacklist: ${reason}`);
    }
    
    /**
     * Remove IP da whitelist/blacklist
     */
    static reset(ip, reason = 'Manual reset') {
        const reputation = AdvancedRateLimit.getIPReputation(ip);
        reputation.whitelisted = false;
        reputation.blacklisted = false;
        reputation.score = 50; // Resetar para neutro
        reputation.violations = 0;
        
        ipReputationStore.set(ip, reputation);
        
        console.log(`🔄 [RESET] IP ${ip} resetado: ${reason}`);
    }
    
    /**
     * Lista IPs com reputação específica
     */
    static getIPsByStatus(status) {
        const result = [];
        
        for (const [ip, reputation] of ipReputationStore.entries()) {
            switch (status) {
                case 'whitelisted':
                    if (reputation.whitelisted) result.push({ ip, reputation });
                    break;
                case 'blacklisted':
                    if (reputation.blacklisted) result.push({ ip, reputation });
                    break;
                case 'suspicious':
                    if (reputation.score <= 30 && !reputation.blacklisted) result.push({ ip, reputation });
                    break;
                case 'trusted':
                    if (reputation.score >= 80 && !reputation.whitelisted) result.push({ ip, reputation });
                    break;
            }
        }
        
        return result;
    }
}

/**
 * Middleware de análise de comportamento em tempo real
 */
const behaviorAnalysisMiddleware = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    // Analisar padrões de requisição
    const analysis = AdvancedRateLimit.detectSuspiciousPattern(ip, req);
    
    // Detectar ataques específicos
    const attacks = detectSpecificAttacks(req);
    
    if (attacks.length > 0) {
        console.warn(`🚨 [ATTACK_DETECTED] IP ${ip}:`, attacks);
        AdvancedRateLimit.updateIPReputation(ip, -30, `Ataque detectado: ${attacks.join(', ')}`);
        
        return res.status(403).json({
            error: 'Atividade maliciosa detectada',
            code: 'ATTACK_DETECTED'
        });
    }
    
    next();
};

/**
 * Detecta tipos específicos de ataques
 */
function detectSpecificAttacks(req) {
    const attacks = [];
    const url = req.originalUrl.toLowerCase();
    const userAgent = (req.get('User-Agent') || '').toLowerCase();
    const query = JSON.stringify(req.query).toLowerCase();
    const body = JSON.stringify(req.body || {}).toLowerCase();
    
    // SQL Injection
    const sqlPatterns = ['union select', 'drop table', 'insert into', '1=1', 'or 1=1', 'admin\'--'];
    if (sqlPatterns.some(pattern => url.includes(pattern) || query.includes(pattern) || body.includes(pattern))) {
        attacks.push('SQL_INJECTION');
    }
    
    // XSS
    const xssPatterns = ['<script', 'javascript:', 'onerror=', 'onload=', 'alert('];
    if (xssPatterns.some(pattern => url.includes(pattern) || query.includes(pattern) || body.includes(pattern))) {
        attacks.push('XSS_ATTEMPT');
    }
    
    // Path Traversal
    const pathTraversalPatterns = ['../', '..\\.', '/etc/passwd', '/windows/system32'];
    if (pathTraversalPatterns.some(pattern => url.includes(pattern))) {
        attacks.push('PATH_TRAVERSAL');
    }
    
    // Bot detection
    const botPatterns = ['bot', 'crawler', 'spider', 'scraper', 'scan'];
    if (botPatterns.some(pattern => userAgent.includes(pattern))) {
        attacks.push('BOT_DETECTED');
    }
    
    // Command Injection
    const cmdPatterns = ['&&', '||', ';cat ', ';ls ', 'wget ', 'curl '];
    if (cmdPatterns.some(pattern => query.includes(pattern) || body.includes(pattern))) {
        attacks.push('COMMAND_INJECTION');
    }
    
    return attacks;
}

/**
 * Limpeza periódica de dados antigos
 */
function cleanupOldData() {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    // Limpar atividade suspeita antiga (mais de 24h)
    for (const [ip, activity] of suspiciousActivityStore.entries()) {
        if (now - activity.lastReset > oneDay) {
            suspiciousActivityStore.delete(ip);
        }
    }
    
    // Limpar reputação antiga para IPs neutros (mais de 7 dias)
    const sevenDays = 7 * oneDay;
    for (const [ip, reputation] of ipReputationStore.entries()) {
        if (now - reputation.lastUpdate > sevenDays && 
            !reputation.whitelisted && 
            !reputation.blacklisted && 
            reputation.score >= 40 && reputation.score <= 60) {
            ipReputationStore.delete(ip);
        }
    }
    
    console.log(`🧹 [CLEANUP] Limpeza de dados antigos executada. IPs ativos: ${ipReputationStore.size}`);
}

// Executar limpeza a cada 6 horas
setInterval(cleanupOldData, 6 * 60 * 60 * 1000);

/**
 * Função para obter estatísticas de rate limiting
 */
function getRateLimitStats() {
    const stats = {
        totalIPs: ipReputationStore.size,
        whitelisted: 0,
        blacklisted: 0,
        suspicious: 0,
        trusted: 0,
        neutral: 0,
        reputationDistribution: {},
        activeMonitoring: suspiciousActivityStore.size
    };
    
    for (const [ip, reputation] of ipReputationStore.entries()) {
        if (reputation.whitelisted) stats.whitelisted++;
        else if (reputation.blacklisted) stats.blacklisted++;
        else if (reputation.score <= 30) stats.suspicious++;
        else if (reputation.score >= 80) stats.trusted++;
        else stats.neutral++;
        
        // Distribuição por faixas de score
        const scoreRange = Math.floor(reputation.score / 10) * 10;
        stats.reputationDistribution[scoreRange] = (stats.reputationDistribution[scoreRange] || 0) + 1;
    }
    
    return stats;
}

module.exports = {
    // Middlewares principais
    globalRateLimit,
    loginRateLimit,
    apiRateLimit,
    sensitiveRateLimit,
    downloadRateLimit,
    suspiciousSlowDown,
    
    // Middlewares de análise
    AdvancedRateLimit,
    rateLimitLogger,
    rateLimitHeaders,
    behaviorAnalysisMiddleware,
    
    // Gerenciamento manual
    IPManagement,
    
    // Utilidades
    getRateLimitStats,
    cleanupOldData,
    
    // Configurações
    RATE_LIMIT_CONFIG
};