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
