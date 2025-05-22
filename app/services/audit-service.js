/**
 * Serviço de auditoria para registro de atividades
 */
const fs = require('fs').promises;
const path = require('path');

// Diretório para logs de auditoria
const LOG_DIR = path.join(__dirname, '../../logs');
const AUDIT_LOG = path.join(LOG_DIR, 'audit.log');

// Tipos de eventos
const EVENT_TYPES = {
    LOGIN: 'LOGIN',
    LOGIN_FAILED: 'LOGIN_FAILED',
    LOGOUT: 'LOGOUT',
    PASSWORD_CHANGE: 'PASSWORD_CHANGE',
    PROFILE_UPDATE: 'PROFILE_UPDATE',
    DATA_ACCESS: 'DATA_ACCESS'
};

/**
 * Garantir que o diretório de logs existe
 */
async function ensureLogDir() {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
    } catch (err) {
        console.error('Erro ao criar diretório de logs:', err);
    }
}

/**
 * Registrar evento de auditoria
 * @param {string} type - Tipo do evento
 * @param {object} details - Detalhes do evento
 * @param {object} user - Informações do usuário
 * @param {string} ip - Endereço IP
 */
async function logEvent(type, details, user, ip) {
    try {
        await ensureLogDir();
        
        const timestamp = new Date().toISOString();
        
        // Preparar dados do usuário - remover informações sensíveis
        const userData = user ? {
            id: user.codigo || user.id,
            email: user.email,
            nome: user.nome || user.name
        } : { id: 'anonymous' };
        
        // Criar entrada de log
        const logEntry = {
            timestamp,
            type,
            user: userData,
            ip: ip || 'unknown',
            details
        };
        
        // Converter para string e adicionar quebra de linha
        const logString = JSON.stringify(logEntry) + '\n';
        
        // Adicionar ao arquivo de log
        await fs.appendFile(AUDIT_LOG, logString, 'utf8');
        
        return true;
    } catch (error) {
        console.error('Erro ao registrar evento de auditoria:', error);
        return false;
    }
}

/**
 * Registrar login bem-sucedido
 * @param {object} user - Usuário logado
 * @param {string} ip - Endereço IP
 * @param {object} extras - Informações adicionais
 */
async function logLogin(user, ip, extras = {}) {
    return logEvent(EVENT_TYPES.LOGIN, extras, user, ip);
}

/**
 * Registrar tentativa de login falha
 * @param {object} credentials - Credenciais usadas (apenas email, evitar dados sensíveis)
 * @param {string} ip - Endereço IP
 * @param {string} reason - Motivo da falha
 */
async function logLoginFailed(credentials, ip, reason) {
    // Apenas incluir identificadores seguros
    const safeCredentials = {
        email: credentials.email || 'unknown'
    };
    
    return logEvent(EVENT_TYPES.LOGIN_FAILED, { reason, credentials: safeCredentials }, null, ip);
}

/**
 * Registrar logout
 * @param {object} user - Usuário que fez logout
 * @param {string} ip - Endereço IP
 */
async function logLogout(user, ip) {
    return logEvent(EVENT_TYPES.LOGOUT, {}, user, ip);
}

/**
 * Registrar alteração de senha
 * @param {object} user - Usuário que alterou a senha
 * @param {string} ip - Endereço IP
 * @param {boolean} success - Se a alteração foi bem-sucedida
 */
async function logPasswordChange(user, ip, success) {
    return logEvent(EVENT_TYPES.PASSWORD_CHANGE, { success }, user, ip);
}

/**
 * Registrar acesso a dados sensíveis
 * @param {object} user - Usuário
 * @param {string} ip - Endereço IP
 * @param {string} resource - Recurso acessado
 * @param {string} action - Ação realizada
 */
async function logDataAccess(user, ip, resource, action) {
    return logEvent(EVENT_TYPES.DATA_ACCESS, { resource, action }, user, ip);
}

module.exports = {
    EVENT_TYPES,
    logLogin,
    logLoginFailed,
    logLogout,
    logPasswordChange,
    logDataAccess
};