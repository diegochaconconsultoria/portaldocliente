# Script para criar todos os arquivos WAF necessários
# Execute este script no diretório raiz do projeto

echo "🛡️ Criando todos os arquivos WAF necessários..."

# Criar diretórios se não existirem
mkdir -p app/middlewares
mkdir -p app/routes
mkdir -p config
mkdir -p logs/waf
mkdir -p scripts

echo "📁 Diretórios criados"

# 1. Criar config/waf-rules.js
cat > config/waf-rules.js << 'EOF'
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
EOF

echo "✅ config/waf-rules.js criado"

# 2. Criar app/middlewares/waf-integration.js
cat > app/middlewares/waf-integration.js << 'EOF'
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
EOF

echo "✅ app/middlewares/waf-integration.js criado"

# 3. Criar app/routes/waf-admin.js
cat > app/routes/waf-admin.js << 'EOF'
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
EOF

echo "✅ app/routes/waf-admin.js criado"

# 4. Criar um placeholder para o WAF principal
cat > app/middlewares/waf.js << 'EOF'
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
EOF

echo "✅ app/middlewares/waf.js (placeholder) criado"

# 5. Criar script de teste básico
cat > scripts/test-waf-simple.js << 'EOF'
/**
 * Script de teste básico para WAF
 */

const http = require('http');

async function testWAF() {
    console.log('🧪 Testando WAF básico...\n');
    
    const tests = [
        {
            name: 'Requisição Normal',
            path: '/',
            expected: 200
        },
        {
            name: 'Dashboard WAF',
            path: '/admin/waf/dashboard',
            expected: [200, 401] // Pode retornar 401 se não autenticado
        },
        {
            name: 'Stats WAF',
            path: '/admin/waf/stats',
            expected: [200, 401]
        }
    ];
    
    for (const test of tests) {
        try {
            console.log(`🔍 Testando: ${test.name}`);
            
            const result = await makeRequest(test.path);
            const expectedArray = Array.isArray(test.expected) ? test.expected : [test.expected];
            
            if (expectedArray.includes(result.statusCode)) {
                console.log(`   ✅ PASSOU - Status: ${result.statusCode}`);
            } else {
                console.log(`   ⚠️ INESPERADO - Status: ${result.statusCode} (esperado: ${test.expected})`);
            }
            
        } catch (error) {
            console.log(`   ❌ ERRO - ${error.message}`);
        }
        
        console.log('');
    }
    
    console.log('🏁 Testes básicos concluídos!');
}

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'GET'
        };
        
        const req = http.request(options, (res) => {
            resolve({
                statusCode: res.statusCode,
                headers: res.headers
            });
        });
        
        req.on('error', reject);
        req.setTimeout(5000, () => reject(new Error('Timeout')));
        req.end();
    });
}

if (require.main === module) {
    testWAF().catch(console.error);
}

module.exports = { testWAF };
EOF

echo "✅ scripts/test-waf-simple.js criado"

# 6. Criar arquivo .env exemplo
cat > .env.waf.example << 'EOF'
# Configurações WAF para o Portal MVK
# Copie estas variáveis para o seu arquivo .env principal

# === CONFIGURAÇÕES BÁSICAS ===
WAF_MODE=MONITOR
WAF_LOG_LEVEL=INFO
WAF_BLOCK_DURATION=3600
WAF_MAX_VIOLATIONS=5

# === CONFIGURAÇÕES DE REDE ===
WAF_WHITELIST_IPS=127.0.0.1,::1
WAF_BLACKLIST_IPS=
WAF_BLOCKED_COUNTRIES=
WAF_ALLOWED_COUNTRIES=BR,US

# === CONFIGURAÇÕES DE ALERTAS ===
WAF_WEBHOOK_URL=
WAF_ALERT_EMAIL=security@mvk.com.br
EOF

echo "✅ .env.waf.example criado"

echo ""
echo "🎉 Todos os arquivos WAF foram criados com sucesso!"
echo ""
echo "📋 Arquivos criados:"
echo "   ✅ config/waf-rules.js"
echo "   ✅ app/middlewares/waf-integration.js"
echo "   ✅ app/routes/waf-admin.js"
echo "   ✅ app/middlewares/waf.js (placeholder)"
echo "   ✅ scripts/test-waf-simple.js"
echo "   ✅ .env.waf.example"
echo ""
echo "📝 Próximos passos:"
echo "   1. Adicione as variáveis do .env.waf.example ao seu .env"
echo "   2. Teste com: node scripts/test-waf-simple.js"
echo "   3. O servidor deve iniciar sem erros agora"
echo "   4. Acesse http://localhost:3000/admin/waf/dashboard para testar"
echo ""
echo "⚠️ NOTA: Este é um WAF simplificado para começar."
echo "   Para proteção completa, substitua app/middlewares/waf.js"
echo "   pelo arquivo WAF completo fornecido anteriormente."
EOF

chmod +x create_waf_files.sh