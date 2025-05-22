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
    API_ERROR: 'API001',
    CSRF_ERROR: 'SEC001'
};

// Mapeamento entre códigos internos e públicos
const ERROR_MAPPING = {
    'INVALID_CREDENTIALS': ERROR_CODES.AUTH_FAILED,
    'TOKEN_EXPIRED': ERROR_CODES.SESSION_EXPIRED,
    'PERMISSION_DENIED': ERROR_CODES.ACCESS_DENIED,
    'DB_CONNECTION_ERROR': ERROR_CODES.SERVER_ERROR,
    'API_TIMEOUT': ERROR_CODES.API_ERROR,
    'API_INVALID_RESPONSE': ERROR_CODES.API_ERROR,
    'NETWORK_DISCONNECT': ERROR_CODES.NETWORK_ERROR,
    'CSRF_ERROR': ERROR_CODES.CSRF_ERROR
};

// Armazenar token CSRF atual
let currentCSRFToken = null;

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
        currentCSRFToken = data.token;
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
        // Obter token CSRF se não tiver um válido
        if (!currentCSRFToken) {
            await obterCSRFToken();
        }
        
        // Configurar headers com o token
        const headers = {
            'Content-Type': 'application/json',
            'X-CSRF-Token': currentCSRFToken,
            ...(options.headers || {})
        };
        
        // Fazer a requisição com o token
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        // Se receber erro CSRF, tentar renovar o token uma vez
        if (response.status === 403) {
            const errorData = await response.json();
            if (errorData.code === 'CSRF_ERROR') {
                console.warn('Token CSRF expirado, renovando...');
                await obterCSRFToken();
                
                // Tentar novamente com o novo token
                const newHeaders = {
                    ...headers,
                    'X-CSRF-Token': currentCSRFToken
                };
                
                return fetch(url, {
                    ...options,
                    headers: newHeaders
                });
            }
        }
        
        return response;
    } catch (error) {
        console.error('Erro na requisição segura:', error);
        throw error;
    }
}

/**
 * Wrapper seguro para requisições de API com retry e timeout
 * @param {string} url - URL da API
 * @param {object} options - Opções da requisição
 * @returns {Promise<object>} - Resposta da API
 */
async function apiRequest(url, options = {}) {
    const defaultOptions = {
        timeout: 30000, // 30 segundos
        retries: 2,
        retryDelay: 1000 // 1 segundo
    };
    
    const config = { ...defaultOptions, ...options };
    
    for (let tentativa = 0; tentativa <= config.retries; tentativa++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.timeout);
            
            const response = await fetchSeguro(url, {
                ...config,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`API retornou status ${response.status}`);
            }
            
            const data = await response.json();
            
            // Log de sucesso
            await securityLog(LOG_LEVELS.INFO, 'Requisição API bem-sucedida', {
                url,
                attempt: tentativa + 1,
                status: response.status
            });
            
            return data;
            
        } catch (error) {
            const isLastAttempt = tentativa === config.retries;
            
            console.warn(`Tentativa ${tentativa + 1} falhou para ${url}:`, error.message);
            
            if (isLastAttempt) {
                // Log de erro final
                await securityLog(LOG_LEVELS.ERROR, 'Requisição API falhou após todas as tentativas', {
                    url,
                    totalAttempts: tentativa + 1,
                    error: error.message
                });
                
                throw error;
            }
            
            // Aguardar antes da próxima tentativa
            await new Promise(resolve => setTimeout(resolve, config.retryDelay * (tentativa + 1)));
        }
    }
}

/**
 * Verifica se a sessão do usuário está ativa
 * @returns {Promise<Object|null>} Dados do usuário se a sessão for válida
 */
async function verificarSessao() {
    try {
        const response = await fetchSeguro('/api/usuario');
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
    };
    
    // Para exibição parcial de dados sensíveis
    if (dados.cnpj) {
        dadosFiltrados.cnpjParcial = dados.cnpj; // Já vem mascarado do servidor
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

/**
 * Validar entrada do usuário para prevenir XSS e injeção
 * @param {string} input - Entrada do usuário
 * @returns {string} - Entrada sanitizada
 */
function validarEntrada(input) {
    if (!input || typeof input !== 'string') return '';
    
    // Remover tags HTML perigosas
    let sanitized = input.replace(/<script[^>]*>.*?<\/script>/gi, '');
    sanitized = sanitized.replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    
    return sanitized.trim();
}

/**
 * Verificar se uma URL é segura
 * @param {string} url - URL a ser verificada
 * @returns {boolean} - Se a URL é segura
 */
function urlSegura(url) {
    if (!url) return false;
    
    try {
        const urlObj = new URL(url);
        // Apenas permitir protocolos seguros
        return ['http:', 'https:'].includes(urlObj.protocol);
    } catch (error) {
        return false;
    }
}

/**
 * Detectar e prevenir ataques de clickjacking
 */
function prevenirClickjacking() {
    // Verificar se a página está sendo carregada em um iframe
    if (window.top !== window.self) {
        // A página está em um iframe, redirecionar para o top
        window.top.location = window.self.location;
    }
}

/**
 * Monitorar atividade suspeita
 */
function monitorarAtividadeSuspeita() {
    let tentativasLogin = 0;
    let ultimaTentativa = 0;
    
    return {
        registrarTentativaLogin: function(sucesso) {
            const agora = Date.now();
            
            if (!sucesso) {
                tentativasLogin++;
                ultimaTentativa = agora;
                
                // Se muitas tentativas em pouco tempo
                if (tentativasLogin > 3 && (agora - ultimaTentativa) < 300000) { // 5 minutos
                    securityLog(LOG_LEVELS.SECURITY, 'Possível ataque de força bruta detectado', {
                        tentativas: tentativasLogin,
                        janelaTempo: '5 minutos'
                    });
                }
            } else {
                // Reset ao fazer login com sucesso
                tentativasLogin = 0;
            }
        }
    };
}

// Inicializar monitoramento
const monitor = monitorarAtividadeSuspeita();

// Inicializar proteções quando a página carregar
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Prevenir clickjacking
        prevenirClickjacking();
        
        // Inicializar token CSRF
        await obterCSRFToken();
        console.log('Token CSRF inicializado');
        
        // Configurar monitoramento de formulários de login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', function(event) {
                // Monitorar tentativa de login
                setTimeout(() => {
                    // Verificar se houve redirecionamento (login bem-sucedido)
                    const loginSucesso = window.location.pathname !== '/';
                    monitor.registrarTentativaLogin(loginSucesso);
                    registrarEventoLogin(loginSucesso, '');
                }, 1000);
            });
        }
        
        // Configurar validação automática de entradas
        const inputs = document.querySelectorAll('input[type="text"], textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', function() {
                this.value = validarEntrada(this.value);
            });
        });
        
    } catch (error) {
        console.error('Falha ao inicializar recursos de segurança:', error);
    }
});

// Exportar todas as funções e constantes
if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = {
        LOG_LEVELS,
        ERROR_CODES,
        sanitizeHTML,
        setElementContent,
        createSafeElement,
        obterCSRFToken,
        fetchSeguro,
        apiRequest,
        verificarSessao,
        securityLog,
        registrarEventoLogin,
        handleError,
        processarDadosUsuario,
        validarJWT,
        validarEntrada,
        urlSegura,
        prevenirClickjacking
    };
} else {
    // Browser
    window.Security = {
        LOG_LEVELS,
        ERROR_CODES,
        sanitizeHTML,
        setElementContent,
        createSafeElement,
        obterCSRFToken,
        fetchSeguro,
        apiRequest,
        verificarSessao,
        securityLog,
        registrarEventoLogin,
        handleError,
        processarDadosUsuario,
        validarJWT,
        validarEntrada,
        urlSegura,
        prevenirClickjacking
    };
}