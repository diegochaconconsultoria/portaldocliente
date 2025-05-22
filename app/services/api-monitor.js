/**
 * Serviço de monitoramento para APIs externas
 */
const fs = require('fs').promises;
const path = require('path');
const apiProxy = require('./api-proxy');

// Diretório para logs de monitoramento
const MONITOR_LOG_DIR = path.join(__dirname, '../../logs/api-monitor');
const HEALTH_LOG = path.join(MONITOR_LOG_DIR, 'health.log');
const PERFORMANCE_LOG = path.join(MONITOR_LOG_DIR, 'performance.log');

// Configurações de monitoramento
const MONITOR_CONFIG = {
    CHECK_INTERVAL: parseInt(process.env.API_HEALTH_CHECK_INTERVAL || '300000', 10), // 5 minutos
    PERFORMANCE_THRESHOLD: parseInt(process.env.API_PERFORMANCE_THRESHOLD || '5000', 10), // 5 segundos
    ERROR_THRESHOLD: parseInt(process.env.API_ERROR_THRESHOLD || '5', 10), // 5 erros consecutivos
};

// Contadores de monitoramento
let stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    lastHealthCheck: null,
    consecutiveErrors: 0,
    uptimeStart: Date.now()
};

/**
 * Garantir que o diretório de logs existe
 */
async function ensureLogDir() {
    try {
        await fs.mkdir(MONITOR_LOG_DIR, { recursive: true });
    } catch (err) {
        console.error('Erro ao criar diretório de logs de monitoramento:', err);
    }
}

/**
 * Registrar evento de saúde da API
 * @param {object} healthData - Dados de saúde
 */
async function logHealth(healthData) {
    try {
        await ensureLogDir();
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            ...healthData
        };
        
        const logString = JSON.stringify(logEntry) + '\n';
        await fs.appendFile(HEALTH_LOG, logString, 'utf8');
    } catch (error) {
        console.error('Erro ao registrar log de saúde:', error);
    }
}

/**
 * Registrar evento de performance da API
 * @param {object} performanceData - Dados de performance
 */
async function logPerformance(performanceData) {
    try {
        await ensureLogDir();
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            ...performanceData
        };
        
        const logString = JSON.stringify(logEntry) + '\n';
        await fs.appendFile(PERFORMANCE_LOG, logString, 'utf8');
    } catch (error) {
        console.error('Erro ao registrar log de performance:', error);
    }
}

/**
 * Executar verificação de saúde da API
 */
async function executarVerificacaoSaude() {
    try {
        console.log('Executando verificação de saúde da API...');
        
        const inicioTempo = Date.now();
        const healthStatus = await apiProxy.verificarSaudeAPI();
        const tempoResposta = Date.now() - inicioTempo;
        
        // Atualizar estatísticas
        stats.totalRequests++;
        stats.lastHealthCheck = new Date().toISOString();
        
        if (healthStatus.status === 'healthy') {
            stats.successfulRequests++;
            stats.consecutiveErrors = 0;
            console.log(`✅ API saudável (${tempoResposta}ms)`);
        } else {
            stats.failedRequests++;
            stats.consecutiveErrors++;
            console.log(`❌ API com problemas (${tempoResposta}ms):`, healthStatus.erro);
        }
        
        // Atualizar tempo médio de resposta
        stats.averageResponseTime = Math.round(
            (stats.averageResponseTime + tempoResposta) / 2
        );
        
        // Registrar dados de saúde
        await logHealth({
            ...healthStatus,
            responseTime: tempoResposta,
            consecutiveErrors: stats.consecutiveErrors
        });
        
        // Verificar se precisa de alerta
        if (stats.consecutiveErrors >= MONITOR_CONFIG.ERROR_THRESHOLD) {
            await enviarAlerta('API_DOWN', {
                consecutiveErrors: stats.consecutiveErrors,
                lastError: healthStatus.erro
            });
        }
        
        if (tempoResposta > MONITOR_CONFIG.PERFORMANCE_THRESHOLD) {
            await enviarAlerta('SLOW_RESPONSE', {
                responseTime: tempoResposta,
                threshold: MONITOR_CONFIG.PERFORMANCE_THRESHOLD
            });
        }
        
        return healthStatus;
    } catch (error) {
        console.error('Erro na verificação de saúde:', error);
        
        stats.totalRequests++;
        stats.failedRequests++;
        stats.consecutiveErrors++;
        
        await logHealth({
            status: 'error',
            erro: error.message,
            consecutiveErrors: stats.consecutiveErrors
        });
        
        return {
            status: 'error',
            erro: error.message
        };
    }
}

/**
 * Registrar performance de uma requisição
 * @param {string} endpoint - Endpoint chamado
 * @param {number} responseTime - Tempo de resposta em ms
 * @param {boolean} success - Se a requisição foi bem-sucedida
 * @param {string} error - Mensagem de erro, se houver
 */
async function registrarPerformance(endpoint, responseTime, success, error = null) {
    const performanceData = {
        endpoint,
        responseTime,
        success,
        error,
        threshold: MONITOR_CONFIG.PERFORMANCE_THRESHOLD,
        slow: responseTime > MONITOR_CONFIG.PERFORMANCE_THRESHOLD
    };
    
    await logPerformance(performanceData);
    
    // Atualizar estatísticas globais
    stats.totalRequests++;
    if (success) {
        stats.successfulRequests++;
    } else {
        stats.failedRequests++;
    }
    
    // Recalcular tempo médio de resposta
    stats.averageResponseTime = Math.round(
        (stats.averageResponseTime + responseTime) / 2
    );
}

/**
 * Enviar alerta (pode ser email, webhook, etc.)
 * @param {string} tipo - Tipo do alerta
 * @param {object} dados - Dados do alerta
 */
async function enviarAlerta(tipo, dados) {
    try {
        console.log(`🚨 ALERTA [${tipo}]:`, dados);
        
        // Aqui você pode implementar envio de email, webhook, etc.
        // Por enquanto, apenas registramos no log
        
        await logHealth({
            alertType: tipo,
            alertData: dados,
            severity: 'HIGH'
        });
        
        // Exemplo de integração com webhook (descomente se necessário):
        /*
        if (process.env.WEBHOOK_URL) {
            await axios.post(process.env.WEBHOOK_URL, {
                text: `Alerta API: ${tipo}`,
                details: dados,
                timestamp: new Date().toISOString()
            });
        }
        */
    } catch (error) {
        console.error('Erro ao enviar alerta:', error);
    }
}

/**
 * Obter estatísticas de monitoramento
 * @returns {object} - Estatísticas atuais
 */
function obterEstatisticas() {
    const uptime = Date.now() - stats.uptimeStart;
    const uptimeMinutos = Math.floor(uptime / 60000);
    
    const successRate = stats.totalRequests > 0 
        ? Math.round((stats.successfulRequests / stats.totalRequests) * 100)
        : 0;
    
    return {
        ...stats,
        uptime: {
            milliseconds: uptime,
            minutes: uptimeMinutos,
            hours: Math.floor(uptimeMinutos / 60)
        },
        successRate: `${successRate}%`,
        errorRate: `${100 - successRate}%`
    };
}

/**
 * Iniciar monitoramento contínuo
 */
function iniciarMonitoramento() {
    console.log('🔍 Iniciando monitoramento de API...');
    
    // Executar primeira verificação imediatamente
    executarVerificacaoSaude();
    
    // Configurar verificações periódicas
    const intervalId = setInterval(() => {
        executarVerificacaoSaude();
    }, MONITOR_CONFIG.CHECK_INTERVAL);
    
    console.log(`⏱️  Verificações de saúde configuradas a cada ${MONITOR_CONFIG.CHECK_INTERVAL / 1000} segundos`);
    
    return intervalId;
}

/**
 * Parar monitoramento
 * @param {number} intervalId - ID do interval para parar
 */
function pararMonitoramento(intervalId) {
    if (intervalId) {
        clearInterval(intervalId);
        console.log('🛑 Monitoramento de API parado');
    }
}

/**
 * Gerar relatório de saúde
 * @returns {object} - Relatório completo
 */
async function gerarRelatorio() {
    try {
        const estatisticas = obterEstatisticas();
        const healthStatus = await apiProxy.verificarSaudeAPI();
        
        return {
            timestamp: new Date().toISOString(),
            apiHealth: healthStatus,
            statistics: estatisticas,
            monitoring: {
                checkInterval: MONITOR_CONFIG.CHECK_INTERVAL,
                performanceThreshold: MONITOR_CONFIG.PERFORMANCE_THRESHOLD,
                errorThreshold: MONITOR_CONFIG.ERROR_THRESHOLD
            }
        };
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        return {
            timestamp: new Date().toISOString(),
            error: error.message,
            statistics: obterEstatisticas()
        };
    }
}

module.exports = {
    executarVerificacaoSaude,
    registrarPerformance,
    enviarAlerta,
    obterEstatisticas,
    iniciarMonitoramento,
    pararMonitoramento,
    gerarRelatorio,
    MONITOR_CONFIG
};