/**
 * Serviço de proxy para APIs externas
 * Centraliza toda comunicação com APIs externas com segurança e monitoramento
 */
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuração do proxy
const PROXY_CONFIG = {
    // Timeouts
    CONNECTION_TIMEOUT: parseInt(process.env.API_CONNECTION_TIMEOUT || '10000', 10), // 10 segundos
    RESPONSE_TIMEOUT: parseInt(process.env.API_RESPONSE_TIMEOUT || '30000', 10), // 30 segundos
    
    // Retry
    MAX_RETRIES: parseInt(process.env.API_MAX_RETRIES || '3', 10),
    RETRY_DELAY: parseInt(process.env.API_RETRY_DELAY || '1000', 10), // 1 segundo
    
    // Rate limiting
    MAX_REQUESTS_PER_MINUTE: parseInt(process.env.API_MAX_REQUESTS_PER_MINUTE || '60', 10),
    
    // Segurança
    VALIDATE_SSL: process.env.API_VALIDATE_SSL !== 'false', // Por padrão, validar SSL
    ALLOWED_HOSTS: (process.env.API_ALLOWED_HOSTS || '192.168.0.251').split(',')
};

// Cache para rate limiting por host
const requestCounts = new Map();

// Cache para respostas (opcional)
const responseCache = new Map();
const CACHE_TTL = parseInt(process.env.API_CACHE_TTL || '300000', 10); // 5 minutos

/**
 * Configurar agente HTTPS seguro
 */
function configurarHTTPSAgent() {
    const options = {
        timeout: PROXY_CONFIG.CONNECTION_TIMEOUT
    };
    
    // Configuração de certificados
    if (PROXY_CONFIG.VALIDATE_SSL) {
        // Tentar carregar certificados personalizados se existirem
        const certPath = path.join(__dirname, '../../certs/api-cert.pem');
        
        if (fs.existsSync(certPath)) {
            try {
                const cert = fs.readFileSync(certPath);
                options.ca = cert;
                console.log('Certificado personalizado carregado para APIs');
            } catch (error) {
                console.warn('Erro ao carregar certificado personalizado:', error.message);
            }
        }
        
        // Verificar certificados do servidor
        options.rejectUnauthorized = true;
    } else {
        console.warn('⚠️  ATENÇÃO: Validação SSL desabilitada para APIs - usar apenas em desenvolvimento');
        options.rejectUnauthorized = false;
    }
    
    return new https.Agent(options);
}

/**
 * Validar se o host é permitido
 * @param {string} url - URL a ser verificada
 * @returns {boolean} - Se o host é permitido
 */
function validarHost(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        return PROXY_CONFIG.ALLOWED_HOSTS.some(allowedHost => 
            hostname === allowedHost || hostname.endsWith(`.${allowedHost}`)
        );
    } catch (error) {
        console.error('URL inválida:', url);
        return false;
    }
}

/**
 * Verificar rate limit para um host
 * @param {string} host - Host a ser verificado
 * @returns {boolean} - Se está dentro do limite
 */
function verificarRateLimit(host) {
    const agora = Date.now();
    const chave = `${host}:${Math.floor(agora / 60000)}`; // Por minuto
    
    if (!requestCounts.has(chave)) {
        requestCounts.set(chave, 0);
    }
    
    const contadorAtual = requestCounts.get(chave);
    
    if (contadorAtual >= PROXY_CONFIG.MAX_REQUESTS_PER_MINUTE) {
        return false;
    }
    
    requestCounts.set(chave, contadorAtual + 1);
    
    // Limpar entradas antigas
    for (const [key, _] of requestCounts) {
        const keyTime = parseInt(key.split(':')[1]);
        if (agora - (keyTime * 60000) > 120000) { // 2 minutos
            requestCounts.delete(key);
        }
    }
    
    return true;
}

/**
 * Gerar chave para cache
 * @param {string} method - Método HTTP
 * @param {string} url - URL
 * @param {object} data - Dados da requisição
 * @returns {string} - Chave do cache
 */
function gerarChaveCache(method, url, data) {
    const hash = crypto.createHash('md5')
        .update(`${method}:${url}:${JSON.stringify(data || {})}`)
        .digest('hex');
    return hash;
}

/**
 * Verificar cache
 * @param {string} chave - Chave do cache
 * @returns {object|null} - Dados do cache ou null
 */
function verificarCache(chave) {
    const entrada = responseCache.get(chave);
    
    if (!entrada) return null;
    
    // Verificar se não expirou
    if (Date.now() - entrada.timestamp > CACHE_TTL) {
        responseCache.delete(chave);
        return null;
    }
    
    return entrada.data;
}

/**
 * Salvar no cache
 * @param {string} chave - Chave do cache
 * @param {object} data - Dados a serem salvos
 */
function salvarCache(chave, data) {
    // Limitar tamanho do cache
    if (responseCache.size > 100) {
        const primeiraChave = responseCache.keys().next().value;
        responseCache.delete(primeiraChave);
    }
    
    responseCache.set(chave, {
        data,
        timestamp: Date.now()
    });
}

/**
 * Validar dados de entrada
 * @param {object} requestData - Dados da requisição
 * @returns {object} - Dados validados e sanitizados
 */
function validarDadosEntrada(requestData) {
    if (!requestData || typeof requestData !== 'object') {
        return {};
    }
    
    const dadosLimpos = {};
    
    // Sanitizar campos conhecidos
    for (const [chave, valor] of Object.entries(requestData)) {
        if (typeof valor === 'string') {
            // Limitar tamanho e remover caracteres perigosos
            dadosLimpos[chave] = valor.substring(0, 500).replace(/[<>]/g, '');
        } else if (typeof valor === 'number') {
            dadosLimpos[chave] = valor;
        } else if (typeof valor === 'boolean') {
            dadosLimpos[chave] = valor;
        }
        // Ignorar outros tipos por segurança
    }
    
    return dadosLimpos;
}

/**
 * Validar resposta da API
 * @param {object} responseData - Dados da resposta
 * @returns {object} - Dados validados
 */
function validarResposta(responseData) {
    if (!responseData || typeof responseData !== 'object') {
        throw new Error('Resposta da API em formato inválido');
    }
    
    // Verificar se a resposta não é muito grande (proteção contra DoS)
    const responseSize = JSON.stringify(responseData).length;
    if (responseSize > 10 * 1024 * 1024) { // 10MB
        throw new Error('Resposta da API muito grande');
    }
    
    return responseData;
}

/**
 * Fazer requisição para API externa com retry automático
 * @param {object} config - Configuração da requisição
 * @returns {Promise<object>} - Resposta da API
 */
async function fazerRequisicao(config) {
    const {
        method = 'POST',
        url,
        data = {},
        auth,
        timeout = PROXY_CONFIG.RESPONSE_TIMEOUT,
        useCache = false,
        retries = PROXY_CONFIG.MAX_RETRIES
    } = config;
    
    // Validações de segurança
    if (!url) {
        throw new Error('URL é obrigatória');
    }
    
    if (!validarHost(url)) {
        throw new Error('Host não permitido para requisições');
    }
    
    if (!auth || !auth.username || !auth.password) {
        throw new Error('Credenciais de autenticação são obrigatórias');
    }
    
    // Verificar rate limit
    const urlObj = new URL(url);
    if (!verificarRateLimit(urlObj.hostname)) {
        throw new Error('Rate limit excedido para este host');
    }
    
    // Validar dados de entrada
    const dadosValidados = validarDadosEntrada(data);
    
    // Verificar cache (apenas para GET)
    let chaveCache = null;
    if (useCache && method.toUpperCase() === 'GET') {
        chaveCache = gerarChaveCache(method, url, dadosValidados);
        const dadosCache = verificarCache(chaveCache);
        
        if (dadosCache) {
            console.log('Dados obtidos do cache para:', url);
            return dadosCache;
        }
    }
    
    // Configurar agente HTTPS
    const httpsAgent = configurarHTTPSAgent();
    
    // Configuração da requisição
    const axiosConfig = {
        method,
        url,
        auth,
        httpsAgent,
        timeout,
        data: dadosValidados,
        validateStatus: (status) => status < 500, // Não tratar 4xx como erro do axios
        maxRedirects: 3 // Limitar redirecionamentos
    };
    
    let ultimoErro;
    
    // Tentar fazer a requisição com retry
    for (let tentativa = 0; tentativa <= retries; tentativa++) {
        try {
            console.log(`Tentativa ${tentativa + 1}/${retries + 1} para ${url}`);
            
            const inicioTempo = Date.now();
            const response = await axios(axiosConfig);
            const tempoResposta = Date.now() - inicioTempo;
            
            console.log(`Requisição para ${url} concluída em ${tempoResposta}ms (status: ${response.status})`);
            
            // Verificar se a resposta indica sucesso
            if (response.status >= 400) {
                throw new Error(`API retornou status ${response.status}: ${response.statusText}`);
            }
            
            // Validar resposta
            const dadosResposta = validarResposta(response.data);
            
            // Salvar no cache se apropriado
            if (chaveCache && method.toUpperCase() === 'GET') {
                salvarCache(chaveCache, dadosResposta);
            }
            
            return dadosResposta;
            
        } catch (error) {
            ultimoErro = error;
            
            console.error(`Erro na tentativa ${tentativa + 1} para ${url}:`, error.message);
            
            // Se não for a última tentativa, aguardar antes de tentar novamente
            if (tentativa < retries) {
                const delay = PROXY_CONFIG.RETRY_DELAY * Math.pow(2, tentativa); // Backoff exponencial
                console.log(`Aguardando ${delay}ms antes da próxima tentativa...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // Se chegou até aqui, todas as tentativas falharam
    throw new Error(`Falha em todas as ${retries + 1} tentativas. Último erro: ${ultimoErro.message}`);
}

/**
 * Método conveniente para requisições do tipo login
 * @param {string} email - Email do usuário
 * @param {string} password - Senha do usuário
 * @param {string} cnpj - CNPJ do usuário
 * @returns {Promise<object>} - Resposta da API de login
 */
async function fazerLogin(email, password, cnpj) {
    const url = `${process.env.API_URL || 'https://192.168.0.251:8409'}/rest/VKPCLILOGIN`;
    
    return fazerRequisicao({
        method: 'POST',
        url,
        data: {
            email,
            Pass: password,
            cgc: cnpj
        },
        auth: {
            username: process.env.API_USERNAME,
            password: process.env.API_PASSWORD
        }
    });
}

/**
 * Método conveniente para requisições de pedidos
 * @param {object} filtros - Filtros para busca de pedidos
 * @returns {Promise<object>} - Resposta da API de pedidos
 */
async function buscarPedidos(filtros) {
    const url = `${process.env.API_URL || 'https://192.168.0.251:8409'}/rest/VKPCLILPED`;
    
    return fazerRequisicao({
        method: 'POST',
        url,
        data: filtros,
        auth: {
            username: process.env.API_USERNAME,
            password: process.env.API_PASSWORD
        },
        useCache: true // Pedidos podem ser cacheados por um tempo
    });
}

/**
 * Método conveniente para requisições de detalhes de pedido
 * @param {string} numeroPedido - Número do pedido
 * @returns {Promise<object>} - Resposta da API de detalhes
 */
async function buscarDetalhesPedido(numeroPedido) {
    const url = `${process.env.API_URL || 'https://192.168.0.251:8409'}/rest/VKPCLIDPED`;
    
    return fazerRequisicao({
        method: 'POST',
        url,
        data: {
            pedido: numeroPedido
        },
        auth: {
            username: process.env.API_USERNAME,
            password: process.env.API_PASSWORD
        },
        useCache: true
    });
}

/**
 * Método conveniente para requisições de notas fiscais
 * @param {object} filtros - Filtros para busca de notas fiscais
 * @returns {Promise<object>} - Resposta da API de notas fiscais
 */
async function buscarNotasFiscais(filtros) {
    const url = `${process.env.API_URL || 'https://192.168.0.251:8409'}/rest/VKPCLILNF`;
    
    return fazerRequisicao({
        method: 'POST',
        url,
        data: filtros,
        auth: {
            username: process.env.API_USERNAME,
            password: process.env.API_PASSWORD
        },
        useCache: true
    });
}

/**
 * Método conveniente para download de nota fiscal
 * @param {string} chaveAcesso - Chave de acesso da nota fiscal
 * @returns {Promise<object>} - Resposta da API com PDF
 */
async function downloadNotaFiscal(chaveAcesso) {
    const url = `${process.env.API_URL || 'https://192.168.0.251:8409'}/rest/VKPCLIPNF`;
    
    return fazerRequisicao({
        method: 'POST',
        url,
        data: {
            chaveacesso: chaveAcesso
        },
        auth: {
            username: process.env.API_USERNAME,
            password: process.env.API_PASSWORD
        },
        timeout: 60000 // 1 minuto para download
    });
}

/**
 * Método conveniente para requisições financeiras
 * @param {object} filtros - Filtros para busca de posição financeira
 * @returns {Promise<object>} - Resposta da API financeira
 */
async function buscarPosicaoFinanceira(filtros) {
    const url = `${process.env.API_URL || 'https://192.168.0.251:8409'}/rest/VKPCLIDFIN`;
    
    return fazerRequisicao({
        method: 'POST',
        url,
        data: filtros,
        auth: {
            username: process.env.API_USERNAME,
            password: process.env.API_PASSWORD
        },
        useCache: true
    });
}

/**
 * Verificar saúde da API
 * @returns {Promise<object>} - Status de saúde
 */
async function verificarSaudeAPI() {
    try {
        const url = `${process.env.API_URL || 'https://192.168.0.251:8409'}/health`;
        
        const resultado = await fazerRequisicao({
            method: 'GET',
            url,
            auth: {
                username: process.env.API_USERNAME,
                password: process.env.API_PASSWORD
            },
            timeout: 5000,
            retries: 1
        });
        
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            detalhes: resultado
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            erro: error.message
        };
    }
}

module.exports = {
    fazerRequisicao,
    fazerLogin,
    buscarPedidos,
    buscarDetalhesPedido,
    buscarNotasFiscais,
    downloadNotaFiscal,
    buscarPosicaoFinanceira,
    verificarSaudeAPI,
    
    // Configurações exportadas para testes
    PROXY_CONFIG
};