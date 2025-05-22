/**
 * Middleware de Cabeçalhos de Segurança HTTP
 * Arquivo: app/middlewares/security-headers.js
 * 
 * Implementa cabeçalhos de segurança avançados conforme melhores práticas
 */

const crypto = require('crypto');

// Configurações de segurança
const SECURITY_CONFIG = {
    // Content Security Policy
    CSP_ENABLED: true,
    CSP_REPORT_URI: '/api/csp-report',
    
    // HSTS (HTTP Strict Transport Security)
    HSTS_MAX_AGE: 31536000, // 1 ano em segundos
    HSTS_INCLUDE_SUBDOMAINS: true,
    HSTS_PRELOAD: true,
    
    // Referrer Policy
    REFERRER_POLICY: 'strict-origin-when-cross-origin',
    
    // Feature Policy / Permissions Policy
    PERMISSIONS_POLICY_ENABLED: true,
    
    // Security.txt
    SECURITY_TXT_ENABLED: true
};

/**
 * Classe para gerenciar cabeçalhos de segurança
 */
class SecurityHeaders {
    
    /**
     * Gera um nonce único para CSP
     */
    static generateNonce() {
        return crypto.randomBytes(16).toString('base64');
    }
    
    /**
     * Constrói a política CSP dinâmica
     */
    static buildCSP(req, nonce) {
        const isProduction = process.env.NODE_ENV === 'production';
        const domain = req.get('host') || 'localhost';
        
        // Base CSP para produção (mais restritiva)
        if (isProduction) {
            return {
                'default-src': ["'self'"],
                'script-src': [
                    "'self'",
                    `'nonce-${nonce}'`,
                    "'strict-dynamic'",
                    "https://cdn.jsdelivr.net",
                    "https://cdnjs.cloudflare.com"
                ],
                'style-src': [
                    "'self'",
                    "'unsafe-inline'", // Necessário para alguns frameworks CSS
                    "https://cdn.jsdelivr.net",
                    "https://cdnjs.cloudflare.com"
                ],
                'img-src': [
                    "'self'",
                    "data:",
                    "https:",
                    "blob:"
                ],
                'font-src': [
                    "'self'",
                    "https://cdn.jsdelivr.net",
                    "https://cdnjs.cloudflare.com"
                ],
                'connect-src': [
                    "'self'",
                    `https://${domain}`,
                    "https://192.168.0.251:8409" // API externa específica
                ],
                'media-src': ["'self'"],
                'object-src': ["'none'"],
                'child-src': ["'none'"],
                'frame-src': ["'none'"],
                'worker-src': ["'self'"],
                'manifest-src': ["'self'"],
                'base-uri': ["'self'"],
                'form-action': ["'self'"],
                'frame-ancestors': ["'none'"],
                'upgrade-insecure-requests': [],
                'block-all-mixed-content': []
            };
        } else {
            // CSP mais permissiva para desenvolvimento
            return {
                'default-src': ["'self'"],
                'script-src': [
                    "'self'",
                    "'unsafe-inline'",
                    "'unsafe-eval'",
                    "https://cdn.jsdelivr.net",
                    "https://cdnjs.cloudflare.com"
                ],
                'style-src': [
                    "'self'",
                    "'unsafe-inline'",
                    "https://cdn.jsdelivr.net",
                    "https://cdnjs.cloudflare.com"
                ],
                'img-src': ["'self'", "data:", "https:", "http:"],
                'connect-src': ["'self'", "https:", "http:", "ws:", "wss:"],
                'font-src': ["'self'", "https:", "data:"],
                'media-src': ["'self'"],
                'object-src': ["'none'"],
                'base-uri': ["'self'"],
                'form-action': ["'self'"]
            };
        }
    }
    
    /**
     * Converte objeto CSP para string
     */
    static cspToString(cspObject) {
        return Object.entries(cspObject)
            .map(([directive, values]) => {
                if (values.length === 0) {
                    return directive;
                }
                return `${directive} ${values.join(' ')}`;
            })
            .join('; ');
    }
    
    /**
     * Constrói a Permissions Policy
     */
    static buildPermissionsPolicy() {
        return [
            'camera=()',
            'microphone=()',
            'geolocation=()',
            'payment=()',
            'usb=()',
            'magnetometer=()',
            'accelerometer=()',
            'gyroscope=()',
            'bluetooth=()',
            'ambient-light-sensor=()',
            'autoplay=(self)',
            'encrypted-media=(self)',
            'fullscreen=(self)',
            'picture-in-picture=(self)'
        ].join(', ');
    }
    
    /**
     * Detecta se a requisição é para API
     */
    static isApiRequest(req) {
        return req.originalUrl.startsWith('/api/');
    }
    
    /**
     * Detecta se a requisição é para recursos estáticos
     */
    static isStaticResource(req) {
        const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf'];
        return staticExtensions.some(ext => req.originalUrl.endsWith(ext));
    }
}

/**
 * Middleware principal de cabeçalhos de segurança
 */
const securityHeadersMiddleware = (req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isApi = SecurityHeaders.isApiRequest(req);
    const isStatic = SecurityHeaders.isStaticResource(req);
    
    // Gerar nonce único para esta requisição
    const nonce = SecurityHeaders.generateNonce();
    req.nonce = nonce; // Disponibilizar para outros middlewares
    
    // === CABEÇALHOS BÁSICOS DE SEGURANÇA ===
    
    // Remover cabeçalhos que expõem informações do servidor
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    
    // X-Content-Type-Options: Previne MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // X-Frame-Options: Previne clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // X-XSS-Protection: Ativa proteção XSS do navegador
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer-Policy: Controla informações de referência
    res.setHeader('Referrer-Policy', SECURITY_CONFIG.REFERRER_POLICY);
    
    // X-DNS-Prefetch-Control: Controla DNS prefetching
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    
    // X-Download-Options: IE8+ baixar arquivos
    res.setHeader('X-Download-Options', 'noopen');
    
    // === CABEÇALHOS ESPECÍFICOS PARA PRODUÇÃO ===
    
    if (isProduction) {
        // HSTS: Força HTTPS
        if (SECURITY_CONFIG.HSTS_MAX_AGE > 0) {
            let hstsValue = `max-age=${SECURITY_CONFIG.HSTS_MAX_AGE}`;
            if (SECURITY_CONFIG.HSTS_INCLUDE_SUBDOMAINS) {
                hstsValue += '; includeSubDomains';
            }
            if (SECURITY_CONFIG.HSTS_PRELOAD) {
                hstsValue += '; preload';
            }
            res.setHeader('Strict-Transport-Security', hstsValue);
        }
        
        // Expect-CT: Certificate Transparency
        res.setHeader('Expect-CT', 'max-age=86400, enforce');
    }
    
    // === CONTENT SECURITY POLICY ===
    
    if (SECURITY_CONFIG.CSP_ENABLED && !isStatic) {
        const csp = SecurityHeaders.buildCSP(req, nonce);
        const cspString = SecurityHeaders.cspToString(csp);
        
        if (isProduction) {
            res.setHeader('Content-Security-Policy', cspString);
        } else {
            // Modo report-only em desenvolvimento
            res.setHeader('Content-Security-Policy-Report-Only', cspString);
        }
    }
    
    // === PERMISSIONS POLICY ===
    
    if (SECURITY_CONFIG.PERMISSIONS_POLICY_ENABLED && !isApi && !isStatic) {
        const permissionsPolicy = SecurityHeaders.buildPermissionsPolicy();
        res.setHeader('Permissions-Policy', permissionsPolicy);
    }
    
    // === CABEÇALHOS ESPECÍFICOS PARA API ===
    
    if (isApi) {
        // Cache-Control para APIs
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        
        // Prevenir caching de respostas de API
        res.setHeader('Vary', 'Origin, Accept-Encoding');
        
        // CORS específico (se necessário)
        if (process.env.CORS_ORIGIN) {
            res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
    }
    
    // === CABEÇALHOS ESPECÍFICOS PARA RECURSOS ESTÁTICOS ===
    
    if (isStatic) {
        // Cache longo para recursos estáticos em produção
        if (isProduction) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 ano
        } else {
            res.setHeader('Cache-Control', 'no-cache'); // Sem cache em desenvolvimento
        }
    }
    
    // === CABEÇALHOS CUSTOMIZADOS ===
    
    // Identificação de segurança (sem expor versões)
    res.setHeader('X-Security-Framework', 'MVK-Portal');
    res.setHeader('X-Content-Security', 'protected');
    
    // Rate limiting info (será preenchido pelo middleware de rate limiting)
    res.setHeader('X-RateLimit-Policy', 'standard');
    
    next();
};

/**
 * Middleware para tratar violações de CSP
 */
const cspReportMiddleware = (req, res, next) => {
    if (req.originalUrl === SECURITY_CONFIG.CSP_REPORT_URI && req.method === 'POST') {
        try {
            const violation = req.body;
            
            // Log da violação CSP
            console.warn('🚨 [CSP_VIOLATION]', {
                timestamp: new Date().toISOString(),
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                violation: {
                    documentUri: violation['document-uri'],
                    violatedDirective: violation['violated-directive'],
                    blockedUri: violation['blocked-uri'],
                    effectiveDirective: violation['effective-directive']
                }
            });
            
            // Resposta para o navegador
            res.status(204).end();
            return;
        } catch (error) {
            console.error('Erro ao processar relatório CSP:', error);
        }
    }
    
    next();
};

/**
 * Middleware para servir security.txt
 */
const securityTxtMiddleware = (req, res, next) => {
    if (req.originalUrl === '/.well-known/security.txt' || req.originalUrl === '/security.txt') {
        const securityTxt = `# Security Policy for MVK Portal
Contact: security@mvk.com.br
Expires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}
Encryption: https://mvk.com.br/.well-known/pgp-key.txt
Preferred-Languages: pt-BR, en
Policy: https://mvk.com.br/security-policy
Acknowledgments: https://mvk.com.br/security-acknowledgments

# Please report security vulnerabilities to security@mvk.com.br
# All reports will be acknowledged within 24 hours
`;
        
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(securityTxt);
        return;
    }
    
    next();
};

/**
 * Middleware para monitorar cabeçalhos de segurança
 */
const securityHeadersMonitorMiddleware = (req, res, next) => {
    // Interceptar res.end para verificar cabeçalhos após resposta
    const originalEnd = res.end;
    
    res.end = function(...args) {
        // Verificar se todos os cabeçalhos de segurança estão presentes
        const requiredHeaders = [
            'X-Content-Type-Options',
            'X-Frame-Options',
            'X-XSS-Protection',
            'Referrer-Policy'
        ];
        
        const missingHeaders = requiredHeaders.filter(header => 
            !res.getHeader(header)
        );
        
        if (missingHeaders.length > 0) {
            console.warn('⚠️ [SECURITY_HEADERS] Cabeçalhos ausentes:', {
                url: req.originalUrl,
                missing: missingHeaders,
                timestamp: new Date().toISOString()
            });
        }
        
        // Log de cabeçalhos de segurança aplicados (modo debug)
        if (process.env.DEBUG_SECURITY_HEADERS === 'true') {
            console.log('🔒 [SECURITY_HEADERS]', {
                url: req.originalUrl,
                headers: {
                    csp: !!res.getHeader('Content-Security-Policy'),
                    hsts: !!res.getHeader('Strict-Transport-Security'),
                    xfo: res.getHeader('X-Frame-Options'),
                    xcto: res.getHeader('X-Content-Type-Options')
                }
            });
        }
        
        return originalEnd.apply(this, args);
    };
    
    next();
};

module.exports = {
    SecurityHeaders,
    securityHeadersMiddleware,
    cspReportMiddleware,
    securityTxtMiddleware,
    securityHeadersMonitorMiddleware,
    SECURITY_CONFIG
};