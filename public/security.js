/**
 * security.js - Biblioteca de utilitários de segurança para o Portal do Cliente
 * Este arquivo centraliza todas as funções relacionadas à segurança do frontend
 */

// Níveis de log para eventos de segurança
const LOG_LEVELS = {
    INFO: 'INFO',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    SECURITY: 'SECURITY'
};

// Códigos de erro públicos
const ERROR_CODES = {
    AUTH_FAILED: 'AUTH001',
    SESSION_EXPIRED: 'AUTH002',
    VALIDATION_ERROR: 'VAL001',
    SERVER_ERROR: 'SRV001',
    NETWORK_ERROR: 'NET001',
    ACCESS_DENIED: 'AUTH003',
    INVALID_INPUT: 'VAL002',
    API_ERROR: 'API001'
};

// Mapeamento entre códigos internos e públicos
const ERROR_MAPPING = {
    'INVALID_CREDENTIALS': ERROR_CODES.AUTH_FAILED,
    'TOKEN_EXPIRED': ERROR_CODES.SESSION_EXPIRED,
    'PERMISSION_DENIED': ERROR_CODES.ACCESS_DENIED,
    'DB_CONNECTION_ERROR': ERROR_CODES.SERVER_ERROR,
    'API_TIMEOUT': ERROR_CODES.API_ERROR,
    'API_INVALID_RESPONSE': ERROR_CODES.API_ERROR,
    'NETWORK_DISCONNECT': ERROR_CODES.NETWORK_ERROR
};

/**
 * Sanitiza uma string para prevenir XSS
 * @param {string} text - Texto a ser sanitizado
 * @returns {string} Texto sanitizado
 */
function sanitizeHTML(text) {
    if (!text) return '';
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.innerHTML;
}

/**
 * Define o conteúdo de um elemento de forma segura
 * @param {HTMLElement} element - Elemento para definir conteúdo
 * @param {string} content - Conteúdo a ser definido
 * @param {boolean} useHTML - Se deve usar innerHTML (apenas para conteúdo confiável)
 */
function setElementContent(element, content, useHTML = false) {
    if (!element) return;
    
    if (useHTML) {
        // Use apenas para conteúdo confiável ou já sanitizado
        element.innerHTML = content;
    } else {
        // Método seguro - usar na maioria dos casos
        element.textContent = content;
    }
}

/**
 * Cria elementos DOM de forma segura
 * @param {string} tag - Tag HTML do elemento
 * @param {Object} attributes - Atributos do elemento
 * @param {string} content - Conteúdo do elemento
 * @returns {HTMLElement} Elemento criado
 */
function createSafeElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    // Definir atributos de forma segura
    Object.keys(attributes).forEach(attr => {
        // Evitar atributos perigosos
        if (attr.startsWith('on') || 
            (attr === 'href' && attributes[attr].startsWith('javascript:')) ||
            (attr === 'src' && attributes[attr].startsWith('javascript:'))) {
            console.warn(`Atributo potencialmente perigoso ignorado: ${attr}`);
            return;
        }
        element.setAttribute(attr, attributes[attr]);
    });
    
    // Definir conteúdo
    if (content) {
        element.textContent = content;
    }
    
    return element;
}

/**
 * Obtém token CSRF do servidor
 * @returns {Promise<string>} Token CSRF
 */
async function obterCSRFToken() {
    try {
        const response = await fetch('/api/csrf-token');
        if (!response.ok) throw new Error('Falha ao obter token CSRF');
        const data = await response.json();
        return data.token;
    } catch (error) {
        console.error('Erro ao obter token CSRF:', error);
        throw error;
    }
}

/**
 * Função para fazer requisições seguras com token CSRF
 * @param {string} url - URL para requisição
 * @param {Object} options - Opções do fetch
 * @returns {Promise<Response>} Resposta da requisição
 */
async function fetchSeguro(url, options = {}) {
    try {
        // Obter token CSRF
        const csrfToken = await obterCSRFToken();
        
        // Configurar headers com o token
        const headers = {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
            ...(options.headers || {})
        };
        
        // Fazer a requisição com o token
        return fetch(url, {
            ...options,
            headers
        });
    } catch (error) {
        console.error('Erro na requisição segura:', error);
        throw error;
    }
}

/**
 * Verifica se a sessão do usuário está ativa
 * @returns {Promise<Object|null>} Dados do usuário se a sessão for válida
 */
async function verificarSessao() {
    try {
        const response = await fetchSeguro('/api/verificar-sessao');
        if (!response.ok) {
            if (response.status === 401) {
                // Sessão inválida, redirecionar para login
                window.location.href = '/';
            }
            return null;
        }
        // Sessão válida, retornar dados do usuário
        return await response.json();
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        // Em caso de erro, redirecionar para login por segurança
        window.location.href = '/';
        return null;
    }
}

/**
 * Registra eventos de segurança
 * @param {string} level - Nível do log (INFO, WARNING, ERROR, SECURITY)
 * @param {string} message - Mensagem do log
 * @param {Object} data - Dados adicionais para o log
 */
async function securityLog(level, message, data = {}) {
    // Log local para debug
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`, data);
    
    // Enviar para o servidor para registro permanente
    try {
        await fetchSeguro('/api/security-log', {
            method: 'POST',
            body: JSON.stringify({
                level,
                message,
                timestamp,
                data: {
                    ...data,
                    // Adicionar informações do navegador
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    referrer: document.referrer
                }
            })
        });
    } catch (error) {
        // Se falhar o envio para o servidor, pelo menos garantimos o log local
        console.error('Falha ao registrar log de segurança:', error);
    }
}

/**
 * Registra evento de login
 * @param {boolean} sucesso - Se o login foi bem-sucedido
 * @param {string} email - Email do usuário
 */
function registrarEventoLogin(sucesso, email) {
    const level = sucesso ? LOG_LEVELS.INFO : LOG_LEVELS.SECURITY;
    const message = sucesso ? 'Login bem-sucedido' : 'Tentativa de login falhou';
    
    securityLog(level, message, {
        email,
        timestamp: new Date().toISOString()
    });
}

/**
 * Trata erros de forma segura, sem expor informações sensíveis
 * @param {Error} error - Erro original
 * @param {Object} userFriendlyMessages - Mapeamento de códigos de erro para mensagens amigáveis
 * @returns {Object} Informações de erro tratadas para exibição
 */
function handleError(error, userFriendlyMessages = {}) {
    // Log do erro original (apenas no servidor/console)
    console.error('Erro original:', error);
    
    // Determinar código de erro público
    let publicErrorCode;
    if (error.code && ERROR_MAPPING[error.code]) {
        publicErrorCode = ERROR_MAPPING[error.code];
    } else {
        publicErrorCode = ERROR_CODES.SERVER_ERROR;
    }
    
    // Mensagem amigável para o usuário
    const userMessage = userFriendlyMessages[publicErrorCode] || 
                        'Ocorreu um erro. Por favor, tente novamente mais tarde.';
    
    // Registrar erro
    securityLog(LOG_LEVELS.ERROR, 'Erro tratado', {
        errorCode: publicErrorCode,
        message: userMessage,
        originalError: error.message
    });
    
    // Retornar objeto de erro para exibição
    return {
        code: publicErrorCode,
        message: userMessage
    };
}

/**
 * Processa dados do usuário removendo informações sensíveis
 * @param {Object} dados - Dados completos do usuário
 * @returns {Object} Dados filtrados para uso no frontend
 */
function processarDadosUsuario(dados) {
    // Remover dados sensíveis desnecessários no frontend
    const dadosFiltrados = {
        nome: dados.nome,
        codigo: dados.codigo,
        email: dados.email
        // Não incluir CNPJ completo, senhas, etc.
    };
    
    // Para exibição parcial de dados sensíveis
    if (dados.cnpj) {
        // Mostrar apenas os últimos 4 dígitos
        dadosFiltrados.cnpjParcial = `***.***/****-${dados.cnpj.slice(-2)}`;
    }
    
    return dadosFiltrados;
}

/**
 * Valida token JWT simples (verificação básica de formato e expiração)
 * @param {string} token - Token JWT
 * @returns {boolean} Se o token é válido
 */
function validarJWT(token) {
    if (!token) return false;
    
    try {
        // Verifica formato básico (3 partes separadas por ponto)
        const partes = token.split('.');
        if (partes.length !== 3) return false;
        
        // Decodifica payload (segunda parte)
        const payload = JSON.parse(atob(partes[1]));
        
        // Verifica expiração
        if (payload.exp && payload.exp < Date.now() / 1000) {
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao validar JWT:', error);
        return false;
    }
}

// Exportar todas as funções e constantes
export {
    LOG_LEVELS,
    ERROR_CODES,
    sanitizeHTML,
    setElementContent,
    createSafeElement,
    obterCSRFToken,
    fetchSeguro,
    verificarSessao,
    securityLog,
    registrarEventoLogin,
    handleError,
    processarDadosUsuario,
    validarJWT
};