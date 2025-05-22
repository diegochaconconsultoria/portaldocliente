/**
 * Middleware de Proteção de Dados Sensíveis para o Backend
 * Arquivo: app/middlewares/data-protection.js
 */

const crypto = require('crypto');

// Configurações de proteção de dados
const DATA_PROTECTION_CONFIG = {
    // Campos considerados sensíveis
    SENSITIVE_FIELDS: [
        'password', 'senha', 'cnpj', 'cpf', 'email', 'telefone', 
        'cartao', 'conta', 'agencia', 'pix', 'chave', 'token'
    ],
    
    // Padrões regex para detectar dados sensíveis
    SENSITIVE_PATTERNS: [
        /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/, // CNPJ
        /\d{3}\.\d{3}\.\d{3}-\d{2}/, // CPF
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
        /\(\d{2}\)\s\d{4,5}-\d{4}/, // Telefone
        /\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/, // Cartão de crédito
        /"password"\s*:\s*"[^"]*"/gi, // Password em JSON
        /"senha"\s*:\s*"[^"]*"/gi // Senha em JSON
    ],
    
    // Configurações de log
    LOG_SENSITIVE_ACCESS: true,
    MASK_LOGS: true,
    
    // Configurações de resposta
    MASK_RESPONSE_DATA: true,
    MINIMIZE_RESPONSE_DATA: true
};

/**
 * Classe para proteção de dados sensíveis no backend
 */
class BackendDataProtection {
    
    /**
     * Mascara dados sensíveis em objetos
     */
    static maskSensitiveData(obj, maskChar = '*') {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }
        
        const masked = Array.isArray(obj) ? [] : {};
        
        for (const [key, value] of Object.entries(obj)) {
            const keyLower = key.toLowerCase();
            
            // Verificar se o campo é sensível
            if (DATA_PROTECTION_CONFIG.SENSITIVE_FIELDS.some(field => keyLower.includes(field))) {
                if (keyLower.includes('cnpj')) {
                    masked[key] = this.maskCNPJ(value);
                } else if (keyLower.includes('email')) {
                    masked[key] = this.maskEmail(value);
                } else if (keyLower.includes('telefone') || keyLower.includes('phone')) {
                    masked[key] = this.maskPhone(value);
                } else if (keyLower.includes('password') || keyLower.includes('senha')) {
                    masked[key] = '****';
                } else {
                    masked[key] = '***';
                }
            } else if (typeof value === 'object' && value !== null) {
                // Recursivamente mascarar objetos aninhados
                masked[key] = this.maskSensitiveData(value, maskChar);
            } else if (typeof value === 'string') {
                // Verificar padrões sensíveis em strings
                masked[key] = this.maskSensitivePatterns(value);
            } else {
                masked[key] = value;
            }
        }
        
        return masked;
    }
    
    /**
     * Mascara padrões sensíveis em strings
     */
    static maskSensitivePatterns(str) {
        if (!str || typeof str !== 'string') return str;
        
        let maskedStr = str;
        
        // CNPJ
        maskedStr = maskedStr.replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, '**.***.***/****-**');
        
        // CPF
        maskedStr = maskedStr.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '***.***.**-**');
        
        // Email
        maskedStr = maskedStr.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '*****@*****.***');
        
        // Telefone
        maskedStr = maskedStr.replace(/\(\d{2}\)\s\d{4,5}-\d{4}/g, '(**) *****-****');
        
        // Cartão de crédito
        maskedStr = maskedStr.replace(/\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/g, '**** **** **** ****');
        
        // Senhas em JSON
        maskedStr = maskedStr.replace(/"password"\s*:\s*"[^"]*"/gi, '"password": "****"');
        maskedStr = maskedStr.replace(/"senha"\s*:\s*"[^"]*"/gi, '"senha": "****"');
        
        return maskedStr;
    }
    
    /**
     * Máscara específica para CNPJ
     */
    static maskCNPJ(cnpj) {
        if (!cnpj) return '';
        
        const cleanCNPJ = cnpj.toString().replace(/[^\d]/g, '');
        
        if (cleanCNPJ.length === 14) {
            const lastTwo = cleanCNPJ.slice(-2);
            return `**.***.***/****-${lastTwo}`;
        }
        
        return '**.***.***/****-**';
    }
    
    /**
     * Máscara específica para email
     */
    static maskEmail(email) {
        if (!email || !email.includes('@')) return '*****@*****.***';
        
        const [user, domain] = email.split('@');
        const maskedUser = user.length > 2 ? 
            user[0] + '*'.repeat(Math.max(user.length - 2, 1)) + user[user.length - 1] : 
            '***';
        
        return `${maskedUser}@*****.***`;
    }
    
    /**
     * Máscara específica para telefone
     */
    static maskPhone(phone) {
        if (!phone) return '(**) *****-****';
        
        const cleanPhone = phone.toString().replace(/[^\d]/g, '');
        if (cleanPhone.length >= 4) {
            const lastFour = cleanPhone.slice(-4);
            return `(**) *****-${lastFour}`;
        }
        
        return '(**) *****-****';
    }
    
    /**
     * Remove dados sensíveis desnecessários das respostas
     */
    static minimizeResponseData(data) {
        if (!data || typeof data !== 'object') return data;
        
        const minimized = { ...data };
        
        // Remover campos sensíveis completamente se não forem essenciais
        const fieldsToRemove = [
            'password', 'senha', 'hash', 'salt', 'token_interno',
            'chave_interna', 'api_key', 'secret'
        ];
        
        fieldsToRemove.forEach(field => {
            if (minimized[field]) {
                delete minimized[field];
            }
        });
        
        // Para dados de usuário, manter apenas o essencial
        if (minimized.usuario) {
            const usuario = minimized.usuario;
            minimized.usuario = {
                nome: usuario.nome,
                codigo: usuario.codigo,
                email: this.maskEmail(usuario.email),
                cnpj: this.maskCNPJ(usuario.cnpj)
                // Não incluir dados internos, senhas, etc.
            };
        }
        
        return minimized;
    }
    
    /**
     * Detecta se uma requisição contém dados sensíveis
     */
    static containsSensitiveData(data) {
        if (!data) return false;
        
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
        
        return DATA_PROTECTION_CONFIG.SENSITIVE_PATTERNS.some(pattern => 
            pattern.test(dataStr)
        );
    }
    
    /**
     * Registra acesso a dados sensíveis
     */
    static logSensitiveAccess(req, dataType, action = 'access') {
        if (!DATA_PROTECTION_CONFIG.LOG_SENSITIVE_ACCESS) return;
        
        const logData = {
            timestamp: new Date().toISOString(),
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            url: req.originalUrl,
            method: req.method,
            dataType,
            action,
            userId: req.session?.usuario?.codigo || 'anonymous'
        };
        
        console.log('🔍 [SENSITIVE_DATA_ACCESS]', JSON.stringify(logData));
    }
}

/**
 * Middleware para interceptar e proteger dados nas requisições
 */
const dataProtectionMiddleware = (req, res, next) => {
    // Interceptar o método res.json para mascarar dados sensíveis
    const originalJson = res.json;
    
    res.json = function(data) {
        let protectedData = data;
        
        try {
            // Verificar se a resposta contém dados sensíveis
            if (BackendDataProtection.containsSensitiveData(data)) {
                BackendDataProtection.logSensitiveAccess(req, 'response', 'send');
                
                if (DATA_PROTECTION_CONFIG.MASK_RESPONSE_DATA) {
                    protectedData = BackendDataProtection.maskSensitiveData(data);
                }
                
                if (DATA_PROTECTION_CONFIG.MINIMIZE_RESPONSE_DATA) {
                    protectedData = BackendDataProtection.minimizeResponseData(protectedData);
                }
            }
        } catch (error) {
            console.error('Erro ao proteger dados da resposta:', error);
            // Em caso de erro, continuar com os dados originais
            protectedData = data;
        }
        
        return originalJson.call(this, protectedData);
    };
    
    // Registrar acesso a dados sensíveis nas requisições
    if (req.body && BackendDataProtection.containsSensitiveData(req.body)) {
        BackendDataProtection.logSensitiveAccess(req, 'request_body', 'receive');
    }
    
    if (req.query && BackendDataProtection.containsSensitiveData(req.query)) {
        BackendDataProtection.logSensitiveAccess(req, 'query_params', 'receive');
    }
    
    next();
};

/**
 * Middleware específico para proteção de logs
 */
const logProtectionMiddleware = (req, res, next) => {
    if (!DATA_PROTECTION_CONFIG.MASK_LOGS) {
        return next();
    }
    
    // Interceptar console.log para mascarar dados sensíveis
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    console.log = (...args) => {
        const maskedArgs = args.map(arg => {
            if (typeof arg === 'string') {
                return BackendDataProtection.maskSensitivePatterns(arg);
            } else if (typeof arg === 'object') {
                return BackendDataProtection.maskSensitiveData(arg);
            }
            return arg;
        });
        return originalConsoleLog.apply(console, maskedArgs);
    };
    
    console.error = (...args) => {
        const maskedArgs = args.map(arg => {
            if (typeof arg === 'string') {
                return BackendDataProtection.maskSensitivePatterns(arg);
            } else if (typeof arg === 'object') {
                return BackendDataProtection.maskSensitiveData(arg);
            }
            return arg;
        });
        return originalConsoleError.apply(console, maskedArgs);
    };
    
    console.warn = (...args) => {
        const maskedArgs = args.map(arg => {
            if (typeof arg === 'string') {
                return BackendDataProtection.maskSensitivePatterns(arg);
            } else if (typeof arg === 'object') {
                return BackendDataProtection.maskSensitiveData(arg);
            }
            return arg;
        });
        return originalConsoleWarn.apply(console, maskedArgs);
    };
    
    next();
};

/**
 * Middleware para limpeza automática de dados sensíveis em sessões
 */
const sessionDataCleanupMiddleware = (req, res, next) => {
    if (req.session && req.session.usuario) {
        // Verificar se a sessão tem dados desnecessariamente expostos
        const usuario = req.session.usuario;
        
        // Manter apenas dados essenciais na sessão
        req.session.usuario = {
            codigo: usuario.codigo,
            nome: usuario.nome,
            email: BackendDataProtection.maskEmail(usuario.email),
            cnpj: BackendDataProtection.maskCNPJ(usuario.cnpj),
            ultimoAcesso: usuario.ultimoAcesso || Date.now()
        };
    }
    
    next();
};

/**
 * Utilitário para criptografia de dados sensíveis no servidor
 */
class ServerDataEncryption {
    constructor(secretKey) {
        this.algorithm = 'aes-256-gcm';
        this.secretKey = secretKey || process.env.DATA_ENCRYPTION_KEY || this.generateKey();
    }
    
    generateKey() {
        return crypto.randomBytes(32);
    }
    
    encrypt(text) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher(this.algorithm, this.secretKey);
            cipher.setAAD(Buffer.from('sensitive-data', 'utf8'));
            
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return {
                encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex')
            };
        } catch (error) {
            console.error('Erro na criptografia:', error);
            return null;
        }
    }
    
    decrypt(encryptedData) {
        try {
            const decipher = crypto.createDecipher(this.algorithm, this.secretKey);
            decipher.setAAD(Buffer.from('sensitive-data', 'utf8'));
            decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Erro na descriptografia:', error);
            return null;
        }
    }
}

module.exports = {
    BackendDataProtection,
    dataProtectionMiddleware,
    logProtectionMiddleware,
    sessionDataCleanupMiddleware,
    ServerDataEncryption,
    DATA_PROTECTION_CONFIG
};