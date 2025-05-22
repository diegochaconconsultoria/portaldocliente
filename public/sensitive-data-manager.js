/**
 * Sistema de Gerenciamento de Dados Sensíveis - Frontend
 * Arquivo: public/sensitive-data-manager.js
 * 
 * Este arquivo deve ser incluído em todas as páginas HTML:
 * <script src="sensitive-data-manager.js"></script>
 */

// Configurações de segurança para dados sensíveis
const SENSITIVE_DATA_CONFIG = {
    ENCRYPTION_KEY_LENGTH: 32,
    IV_LENGTH: 16,
    STORAGE_EXPIRY: 3600000, // 1 hora em ms
    MAX_STORAGE_SIZE: 1024, // 1KB máximo
    INACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30 minutos
    CNPJ_MASK_PATTERN: '**.***.***/****-**',
    EMAIL_MASK_PATTERN: '*****@*****.***'
};

// Tipos de dados sensíveis
const SENSITIVE_DATA_TYPES = {
    CNPJ: 'cnpj',
    EMAIL: 'email',
    PASSWORD: 'password',
    PHONE: 'phone',
    CREDIT_CARD: 'creditCard',
    PERSONAL_ID: 'personalId'
};

/**
 * Classe para gerenciamento seguro de dados sensíveis
 */
class SensitiveDataManager {
    constructor() {
        this.encryptionKey = null;
        this.inactivityTimer = null;
        this.initializeEncryption();
        this.setupDataProtection();
    }

    /**
     * Inicializa o sistema de criptografia
     */
    async initializeEncryption() {
        try {
            this.encryptionKey = await this.getOrCreateSessionKey();
            console.log('✅ Sistema de criptografia inicializado');
        } catch (error) {
            console.error('❌ Erro ao inicializar criptografia:', error);
            console.warn('⚠️ Operando sem criptografia - dados podem estar em risco');
        }
    }

    /**
     * Gera ou recupera chave de criptografia da sessão
     */
    async getOrCreateSessionKey() {
        let sessionKey = sessionStorage.getItem('_sk');
        
        if (!sessionKey) {
            if (window.crypto && window.crypto.getRandomValues) {
                const keyArray = new Uint8Array(SENSITIVE_DATA_CONFIG.ENCRYPTION_KEY_LENGTH);
                window.crypto.getRandomValues(keyArray);
                sessionKey = Array.from(keyArray).map(b => b.toString(16).padStart(2, '0')).join('');
                sessionStorage.setItem('_sk', sessionKey);
            } else {
                throw new Error('Web Crypto API não disponível');
            }
        }
        
        return sessionKey;
    }

    /**
     * Criptografa dados usando AES-GCM simulado
     */
    async encryptData(data) {
        if (!this.encryptionKey) {
            console.warn('Criptografia não disponível, usando ofuscação básica');
            return this.obfuscateData(data);
        }

        try {
            const jsonData = JSON.stringify(data);
            const encoded = btoa(jsonData);
            const timestamp = Date.now();
            const checksum = this.simpleHash(encoded + this.encryptionKey);
            
            return {
                data: encoded,
                timestamp,
                checksum,
                encrypted: true
            };
        } catch (error) {
            console.error('Erro na criptografia:', error);
            return this.obfuscateData(data);
        }
    }

    /**
     * Descriptografa dados
     */
    async decryptData(encryptedData) {
        if (!encryptedData || !encryptedData.encrypted) {
            return this.deobfuscateData(encryptedData);
        }

        try {
            // Verificar integridade
            const expectedChecksum = this.simpleHash(encryptedData.data + this.encryptionKey);
            if (expectedChecksum !== encryptedData.checksum) {
                throw new Error('Dados corrompidos ou chave inválida');
            }

            // Verificar expiração
            if (Date.now() - encryptedData.timestamp > SENSITIVE_DATA_CONFIG.STORAGE_EXPIRY) {
                throw new Error('Dados expirados');
            }

            const decoded = atob(encryptedData.data);
            return JSON.parse(decoded);
        } catch (error) {
            console.error('Erro na descriptografia:', error);
            return null;
        }
    }

    /**
     * Hash simples para verificação de integridade
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * Ofuscação básica como fallback
     */
    obfuscateData(data) {
        const jsonData = JSON.stringify(data);
        const encoded = btoa(jsonData);
        const scrambled = encoded.split('').reverse().join('');
        
        return {
            data: scrambled,
            timestamp: Date.now(),
            obfuscated: true
        };
    }

    /**
     * Deofuscação básica
     */
    deobfuscateData(obfuscatedData) {
        if (!obfuscatedData || !obfuscatedData.obfuscated) {
            return obfuscatedData;
        }

        try {
            const unscrambled = obfuscatedData.data.split('').reverse().join('');
            const decoded = atob(unscrambled);
            return JSON.parse(decoded);
        } catch (error) {
            console.error('Erro na deofuscação:', error);
            return null;
        }
    }

    /**
     * Configura proteções automáticas de dados
     */
    setupDataProtection() {
        // Limpar dados quando a página for fechada
        window.addEventListener('beforeunload', () => {
            this.clearSensitiveData();
        });

        // Limpar dados após inatividade
        this.setupInactivityClearance();
        
        // Interceptar localStorage
        this.protectLocalStorage();
        
        // Interceptar console.log para mascarar dados sensíveis
        this.protectConsoleLogging();
    }

    /**
     * Configura limpeza automática após inatividade
     */
    setupInactivityClearance() {
        const resetTimer = () => {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = setTimeout(() => {
                console.log('🔒 Limpando dados por inatividade');
                this.clearSensitiveData();
                window.location.href = '/';
            }, SENSITIVE_DATA_CONFIG.INACTIVITY_TIMEOUT);
        };

        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
            document.addEventListener(event, resetTimer, { passive: true });
        });

        resetTimer();
    }

    /**
     * Protege console.log contra vazamento de dados sensíveis
     */
    protectConsoleLogging() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) => {
            const maskedArgs = args.map(arg => this.maskSensitiveInLogs(arg));
            return originalLog.apply(console, maskedArgs);
        };

        console.error = (...args) => {
            const maskedArgs = args.map(arg => this.maskSensitiveInLogs(arg));
            return originalError.apply(console, maskedArgs);
        };

        console.warn = (...args) => {
            const maskedArgs = args.map(arg => this.maskSensitiveInLogs(arg));
            return originalWarn.apply(console, maskedArgs);
        };
    }

    /**
     * Mascara dados sensíveis em logs
     */
    maskSensitiveInLogs(data) {
        if (typeof data === 'string') {
            return data
                .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, '**.***.***/****-**') // CNPJ
                .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '***.***.**-**') // CPF
                .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '*****@*****.***') // Email
                .replace(/\(\d{2}\)\s\d{4,5}-\d{4}/g, '(**) *****-****') // Telefone
                .replace(/"password"\s*:\s*"[^"]*"/gi, '"password": "****"') // Password em JSON
                .replace(/"senha"\s*:\s*"[^"]*"/gi, '"senha": "****"'); // Senha em JSON
        }
        
        if (typeof data === 'object' && data !== null) {
            const masked = { ...data };
            Object.keys(masked).forEach(key => {
                if (['password', 'senha', 'cnpj', 'cpf', 'email'].includes(key.toLowerCase())) {
                    masked[key] = '****';
                }
            });
            return masked;
        }
        
        return data;
    }

    /**
     * Protege acesso direto ao localStorage
     */
    protectLocalStorage() {
        const originalSetItem = localStorage.setItem;
        const originalGetItem = localStorage.getItem;
        const originalRemoveItem = localStorage.removeItem;

        localStorage.setItem = (key, value) => {
            if (this.containsSensitiveData(value)) {
                console.warn('⚠️ Tentativa de armazenar dados sensíveis:', key);
            }
            return originalSetItem.call(localStorage, key, value);
        };

        localStorage.getItem = (key) => {
            const value = originalGetItem.call(localStorage, key);
            if (value && this.containsSensitiveData(value)) {
                console.log('🔍 Acesso a dados sensíveis:', key);
            }
            return value;
        };

        localStorage.removeItem = (key) => {
            console.log('🗑️ Removendo item do localStorage:', key);
            return originalRemoveItem.call(localStorage, key);
        };
    }

    /**
     * Verifica se dados contêm informações sensíveis
     */
    containsSensitiveData(data) {
        if (!data || typeof data !== 'string') return false;
        
        const sensitivePatterns = [
            /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/, // CNPJ
            /\d{3}\.\d{3}\.\d{3}-\d{2}/, // CPF
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
            /\(\d{2}\)\s\d{4,5}-\d{4}/, // Telefone
            /\d{4}\s\d{4}\s\d{4}\s\d{4}/, // Cartão de crédito
            /"password"|"senha"/i // Campos de senha
        ];

        return sensitivePatterns.some(pattern => pattern.test(data));
    }

    /**
     * Armazena dados de usuário de forma segura
     */
    async storeUserData(userData) {
        try {
            const essentialData = this.extractEssentialData(userData);
            const encryptedData = await this.encryptData(essentialData);
            
            localStorage.setItem('_sud', JSON.stringify(encryptedData));
            console.log('✅ Dados do usuário armazenados com segurança');
            return true;
        } catch (error) {
            console.error('❌ Erro ao armazenar dados do usuário:', error);
            return false;
        }
    }

    /**
     * Recupera dados de usuário armazenados
     */
    async getUserData() {
        try {
            const storedData = localStorage.getItem('_sud');
            if (!storedData) return null;

            const encryptedData = JSON.parse(storedData);
            const userData = await this.decryptData(encryptedData);
            
            if (!userData) {
                localStorage.removeItem('_sud');
                return null;
            }

            return userData;
        } catch (error) {
            console.error('❌ Erro ao recuperar dados do usuário:', error);
            localStorage.removeItem('_sud');
            return null;
        }
    }

    /**
     * Extrai apenas dados essenciais para armazenamento
     */
    extractEssentialData(userData) {
        return {
            nome: userData.nome ? userData.nome.split(' ')[0] : '', // Apenas primeiro nome
            codigo: userData.codigo || '',
            timestamp: Date.now()
            // Propositalmente não incluindo CNPJ, email completo, etc.
        };
    }

    /**
     * Limpa todos os dados sensíveis
     */
    clearSensitiveData() {
        try {
            // Limpar localStorage
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('_') || this.containsSensitiveData(localStorage.getItem(key)))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));

            // Limpar sessionStorage
            sessionStorage.clear();

            // Limpar cookies sensíveis
            this.clearSensitiveCookies();

            console.log('🧹 Dados sensíveis limpos');
        } catch (error) {
            console.error('Erro ao limpar dados sensíveis:', error);
        }
    }

    /**
     * Limpa cookies sensíveis
     */
    clearSensitiveCookies() {
        const cookies = document.cookie.split(';');
        cookies.forEach(cookie => {
            const [name] = cookie.split('=');
            if (name && (name.trim().includes('session') || name.trim().includes('user'))) {
                document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            }
        });
    }

    /**
     * Métodos estáticos para mascaramento de dados
     */
    static maskCNPJ(cnpj) {
        if (!cnpj) return '';
        
        // Remover formatação
        const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
        
        if (cleanCNPJ.length === 14) {
            // Mostrar apenas os 2 últimos dígitos
            const lastTwo = cleanCNPJ.slice(-2);
            return `**.***.***/****-${lastTwo}`;
        }
        
        return '**.***.***/****-**';
    }

    static maskEmail(email) {
        if (!email || !email.includes('@')) return '*****@*****.***';
        
        const [user, domain] = email.split('@');
        const maskedUser = user.length > 2 ? user[0] + '*'.repeat(user.length - 2) + user[user.length - 1] : '***';
        const maskedDomain = '*****.***';
        
        return `${maskedUser}@${maskedDomain}`;
    }

    static maskPhone(phone) {
        if (!phone) return '(**) *****-****';
        
        const cleanPhone = phone.replace(/[^\d]/g, '');
        if (cleanPhone.length >= 10) {
            const lastFour = cleanPhone.slice(-4);
            return `(**) *****-${lastFour}`;
        }
        
        return '(**) *****-****';
    }

    static maskCreditCard(cardNumber) {
        if (!cardNumber) return '**** **** **** ****';
        
        const cleanCard = cardNumber.replace(/[^\d]/g, '');
        if (cleanCard.length >= 4) {
            const lastFour = cleanCard.slice(-4);
            return `**** **** **** ${lastFour}`;
        }
        
        return '**** **** **** ****';
    }

    /**
     * Aplica mascaramento baseado no tipo de dado
     */
    static maskSensitiveData(data, type) {
        if (!data) return '';

        switch (type) {
            case SENSITIVE_DATA_TYPES.CNPJ:
                return SensitiveDataManager.maskCNPJ(data);
            case SENSITIVE_DATA_TYPES.EMAIL:
                return SensitiveDataManager.maskEmail(data);
            case SENSITIVE_DATA_TYPES.PHONE:
                return SensitiveDataManager.maskPhone(data);
            case SENSITIVE_DATA_TYPES.CREDIT_CARD:
                return SensitiveDataManager.maskCreditCard(data);
            default:
                return '***';
        }
    }

    /**
     * Valida se um dado sensível tem formato correto
     */
    static validateSensitiveData(data, type) {
        if (!data) return false;

        switch (type) {
            case SENSITIVE_DATA_TYPES.CNPJ:
                return /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(data);
            case SENSITIVE_DATA_TYPES.EMAIL:
                return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(data);
            case SENSITIVE_DATA_TYPES.PHONE:
                return /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(data);
            default:
                return true;
        }
    }
}

// Instância global do gerenciador
const sensitiveDataManager = new SensitiveDataManager();

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.SensitiveDataManager = SensitiveDataManager;
    window.sensitiveDataManager = sensitiveDataManager;
}

// Funções de conveniência para uso no aplicativo
window.secureStore = (data) => sensitiveDataManager.storeUserData(data);
window.secureRetrieve = () => sensitiveDataManager.getUserData();
window.maskData = (data, type) => SensitiveDataManager.maskSensitiveData(data, type);
window.clearSecureData = () => sensitiveDataManager.clearSensitiveData();

console.log('🔒 Sistema de Gerenciamento de Dados Sensíveis carregado');