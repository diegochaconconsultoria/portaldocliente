/**
 * Sistema de Monitoramento Contínuo de Segurança
 * Arquivo: app/services/continuous-monitoring.js
 * 
 * Monitora comportamentos suspeitos e métricas de segurança em tempo real
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Configurações de monitoramento
const MONITORING_CONFIG = {
    // Intervalos de verificação
    REAL_TIME_INTERVAL: 30000, // 30 segundos
    METRICS_INTERVAL: 300000, // 5 minutos
    HEALTH_CHECK_INTERVAL: 60000, // 1 minuto
    REPORT_INTERVAL: 3600000, // 1 hora
    
    // Thresholds de alerta
    THRESHOLDS: {
        ERROR_RATE: 5, // % de erros por minuto
        RESPONSE_TIME: 5000, // ms
        MEMORY_USAGE: 85, // % de uso de memória
        CPU_USAGE: 80, // % de uso de CPU
        FAILED_LOGINS: 10, // tentativas por minuto
        SUSPICIOUS_IPS: 5, // IPs suspeitos simultâneos
        DATABASE_CONNECTIONS: 80 // % de conexões DB
    },
    
    // Configurações de alertas
    ALERTS: {
        EMAIL_ENABLED: false, // Configurar conforme necessário
        WEBHOOK_ENABLED: false,
        LOG_LEVEL: 'warn',
        RETENTION_DAYS: 30
    }
};

// Stores para métricas em tempo real
const metricsStore = {
    requests: [],
    errors: [],
    logins: [],
    security_events: [],
    performance: [],
    system: []
};

/**
 * Classe principal de monitoramento
 */
class ContinuousMonitoring {
    constructor() {
        this.isRunning = false;
        this.intervals = {};
        this.alertHistory = new Map();
        this.systemMetrics = {
            startTime: Date.now(),
            totalRequests: 0,
            totalErrors: 0,
            totalLogins: 0,
            securityEvents: 0
        };
    }
    
    /**
     * Inicia o sistema de monitoramento
     */
    start() {
        if (this.isRunning) {
            console.warn('Sistema de monitoramento já está rodando');
            return;
        }
        
        console.log('🔍 Iniciando sistema de monitoramento contínuo...');
        
        this.isRunning = true;
        
        // Configurar intervalos de monitoramento
        this.intervals.realTime = setInterval(() => {
            this.performRealTimeAnalysis();
        }, MONITORING_CONFIG.REAL_TIME_INTERVAL);
        
        this.intervals.metrics = setInterval(() => {
            this.collectMetrics();
        }, MONITORING_CONFIG.METRICS_INTERVAL);
        
        this.intervals.healthCheck = setInterval(() => {
            this.performHealthCheck();
        }, MONITORING_CONFIG.HEALTH_CHECK_INTERVAL);
        
        this.intervals.report = setInterval(() => {
            this.generateSecurityReport();
        }, MONITORING_CONFIG.REPORT_INTERVAL);
        
        // Cleanup de dados antigos a cada hora
        this.intervals.cleanup = setInterval(() => {
            this.cleanupOldMetrics();
        }, 3600000);
        
        console.log('✅ Sistema de monitoramento iniciado com sucesso');
    }
    
    /**
     * Para o sistema de monitoramento
     */
    stop() {
        if (!this.isRunning) return;
        
        Object.values(this.intervals).forEach(interval => {
            clearInterval(interval);
        });
        
        this.isRunning = false;
        console.log('⏹️ Sistema de monitoramento parado');
    }
    
    /**
     * Registra uma requisição para monitoramento
     */
    logRequest(req, res, responseTime) {
        const timestamp = Date.now();
        const requestData = {
            timestamp,
            ip: req.ip || req.connection.remoteAddress,
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTime,
            userAgent: req.get('User-Agent') || 'unknown',
            userId: req.session?.usuario?.codigo || 'anonymous'
        };
        
        metricsStore.requests.push(requestData);
        this.systemMetrics.totalRequests++;
        
        // Registrar erros
        if (res.statusCode >= 400) {
            metricsStore.errors.push({
                ...requestData,
                errorType: this.classifyError(res.statusCode)
            });
            this.systemMetrics.totalErrors++;
        }
        
        // Limitar tamanho dos arrays
        this.limitArraySize(metricsStore.requests, 1000);
        this.limitArraySize(metricsStore.errors, 500);
    }
    
    /**
     * Registra evento de login
     */
    logLogin(ip, success, email, reason = null) {
        const loginData = {
            timestamp: Date.now(),
            ip,
            success,
            email: email ? this.hashEmail(email) : null, // Hash do email por privacidade
            reason
        };
        
        metricsStore.logins.push(loginData);
        this.systemMetrics.totalLogins++;
        
        this.limitArraySize(metricsStore.logins, 500);
    }
    
    /**
     * Registra evento de segurança
     */
    logSecurityEvent(type, ip, details = {}) {
        const securityEvent = {
            timestamp: Date.now(),
            type,
            ip,
            severity: this.classifySecurityEventSeverity(type),
            details,
            id: crypto.randomBytes(8).toString('hex')
        };
        
        metricsStore.security_events.push(securityEvent);
        this.systemMetrics.securityEvents++;
        
        // Alertar para eventos críticos
        if (securityEvent.severity === 'critical') {
            this.triggerAlert('CRITICAL_SECURITY_EVENT', securityEvent);
        }
        
        this.limitArraySize(metricsStore.security_events, 300);
        
        console.warn(`🚨 [SECURITY_EVENT] ${type} de ${ip}:`, details);
    }
    
    /**
     * Análise em tempo real
     */
    performRealTimeAnalysis() {
        const now = Date.now();
        const lastMinute = now - 60000;
        
        // Analisar requisições da última minuto
        const recentRequests = metricsStore.requests.filter(r => r.timestamp > lastMinute);
        const recentErrors = metricsStore.errors.filter(e => e.timestamp > lastMinute);
        const recentLogins = metricsStore.logins.filter(l => l.timestamp > lastMinute);
        
        // Calcular métricas
        const errorRate = recentRequests.length > 0 ? 
            (recentErrors.length / recentRequests.length) * 100 : 0;
        
        const avgResponseTime = recentRequests.length > 0 ?
            recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / recentRequests.length : 0;
        
        const failedLogins = recentLogins.filter(l => !l.success).length;
        
        // Detectar anomalias
        this.detectAnomalies({
            errorRate,
            avgResponseTime,
            failedLogins,
            requestCount: recentRequests.length,
            timestamp: now
        });
    }
    
    /**
     * Detecta anomalias nas métricas
     */
    detectAnomalies(metrics) {
        const alerts = [];
        
        // Taxa de erro alta
        if (metrics.errorRate > MONITORING_CONFIG.THRESHOLDS.ERROR_RATE) {
            alerts.push({
                type: 'HIGH_ERROR_RATE',
                value: metrics.errorRate,
                threshold: MONITORING_CONFIG.THRESHOLDS.ERROR_RATE,
                severity: 'high'
            });
        }
        
        // Tempo de resposta alto
        if (metrics.avgResponseTime > MONITORING_CONFIG.THRESHOLDS.RESPONSE_TIME) {
            alerts.push({
                type: 'HIGH_RESPONSE_TIME',
                value: metrics.avgResponseTime,
                threshold: MONITORING_CONFIG.THRESHOLDS.RESPONSE_TIME,
                severity: 'medium'
            });
        }
        
        // Muitas tentativas de login falhadas
        if (metrics.failedLogins > MONITORING_CONFIG.THRESHOLDS.FAILED_LOGINS) {
            alerts.push({
                type: 'HIGH_FAILED_LOGINS',
                value: metrics.failedLogins,
                threshold: MONITORING_CONFIG.THRESHOLDS.FAILED_LOGINS,
                severity: 'high'
            });
        }
        
        // Pico de requisições (possível DDoS)
        if (metrics.requestCount > 500) { // 500 req/min = ~8 req/s
            alerts.push({
                type: 'HIGH_REQUEST_VOLUME',
                value: metrics.requestCount,
                threshold: 500,
                severity: 'medium'
            });
        }
        
        // Processar alertas
        alerts.forEach(alert => {
            this.triggerAlert(alert.type, alert);
        });
    }
    
    /**
     * Coleta métricas do sistema
     */
    collectMetrics() {
        const systemMetrics = {
            timestamp: Date.now(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            uptime: process.uptime(),
            nodeVersion: process.version,
            pid: process.pid
        };
        
        metricsStore.performance.push(systemMetrics);
        this.limitArraySize(metricsStore.performance, 288); // 24h de dados (5min intervals)
        
        // Verificar thresholds do sistema
        const memoryUsagePercent = (systemMetrics.memory.heapUsed / systemMetrics.memory.heapTotal) * 100;
        
        if (memoryUsagePercent > MONITORING_CONFIG.THRESHOLDS.MEMORY_USAGE) {
            this.triggerAlert('HIGH_MEMORY_USAGE', {
                usage: memoryUsagePercent,
                threshold: MONITORING_CONFIG.THRESHOLDS.MEMORY_USAGE
            });
        }
    }
    
    /**
     * Verifica saúde do sistema
     */
    async performHealthCheck() {
        const healthData = {
            timestamp: Date.now(),
            status: 'healthy',
            checks: {
                database: await this.checkDatabase(),
                external_api: await this.checkExternalAPI(),
                file_system: await this.checkFileSystem(),
                memory: this.checkMemory(),
                response_time: this.checkResponseTime()
            }
        };
        
        // Determinar status geral
        const failedChecks = Object.values(healthData.checks).filter(check => !check.healthy);
        if (failedChecks.length > 0) {
            healthData.status = failedChecks.some(check => check.critical) ? 'critical' : 'degraded';
        }
        
        metricsStore.system.push(healthData);
        this.limitArraySize(metricsStore.system, 60); // 1h de dados
        
        if (healthData.status !== 'healthy') {
            this.triggerAlert('SYSTEM_HEALTH_DEGRADED', healthData);
        }
    }
    
    /**
     * Verifica conectividade com banco de dados
     */
    async checkDatabase() {
        try {
            // Implementar verificação específica do seu banco
            // Este é um exemplo genérico
            const start = Date.now();
            // await db.query('SELECT 1');
            const responseTime = Date.now() - start;
            
            return {
                healthy: true,
                responseTime,
                critical: false
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                critical: true
            };
        }
    }
    
    /**
     * Verifica API externa
     */
    async checkExternalAPI() {
        try {
            // Verificar APIs externas críticas
            return {
                healthy: true,
                critical: false
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                critical: false // API externa não é crítica
            };
        }
    }
    
    /**
     * Verifica sistema de arquivos
     */
    async checkFileSystem() {
        try {
            const testFile = path.join(__dirname, '../../temp/health-check.txt');
            await fs.writeFile(testFile, 'health-check');
            await fs.unlink(testFile);
            
            return {
                healthy: true,
                critical: false
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                critical: true
            };
        }
    }
    
    /**
     * Verifica uso de memória
     */
    checkMemory() {
        const memory = process.memoryUsage();
        const usagePercent = (memory.heapUsed / memory.heapTotal) * 100;
        
        return {
            healthy: usagePercent < MONITORING_CONFIG.THRESHOLDS.MEMORY_USAGE,
            usage: usagePercent,
            critical: usagePercent > 95
        };
    }
    
    /**
     * Verifica tempo de resposta médio
     */
    checkResponseTime() {
        const recentRequests = metricsStore.requests.filter(
            r => r.timestamp > Date.now() - 300000 // últimos 5 minutos
        );
        
        if (recentRequests.length === 0) {
            return { healthy: true, critical: false };
        }
        
        const avgResponseTime = recentRequests.reduce(
            (sum, r) => sum + r.responseTime, 0
        ) / recentRequests.length;
        
        return {
            healthy: avgResponseTime < MONITORING_CONFIG.THRESHOLDS.RESPONSE_TIME,
            avgResponseTime,
            critical: avgResponseTime > 10000 // 10s é crítico
        };
    }
    
    /**
     * Dispara um alerta
     */
    triggerAlert(type, data) {
        const alertId = `${type}-${Date.now()}`;
        const alert = {
            id: alertId,
            type,
            timestamp: Date.now(),
            data,
            acknowledged: false
        };
        
        // Evitar spam de alertas do mesmo tipo
        const lastAlert = this.alertHistory.get(type);
        if (lastAlert && (Date.now() - lastAlert.timestamp) < 300000) { // 5 minutos
            return;
        }
        
        this.alertHistory.set(type, alert);
        
        // Log do alerta
        console.warn(`🚨 [ALERT] ${type}:`, data);
        
        // Enviar notificações (email, webhook, etc.)
        this.sendNotifications(alert);
    }
    
    /**
     * Envia notificações
     */
    async sendNotifications(alert) {
        try {
            // Implementar envio de email se configurado
            if (MONITORING_CONFIG.ALERTS.EMAIL_ENABLED) {
                // await this.sendEmailAlert(alert);
            }
            
            // Implementar webhook se configurado
            if (MONITORING_CONFIG.ALERTS.WEBHOOK_ENABLED) {
                // await this.sendWebhookAlert(alert);
            }
            
            // Salvar alerta em arquivo
            await this.saveAlertToFile(alert);
            
        } catch (error) {
            console.error('Erro ao enviar notificação de alerta:', error);
        }
    }
    
    /**
     * Salva alerta em arquivo
     */
    async saveAlertToFile(alert) {
        try {
            const alertsDir = path.join(__dirname, '../../logs/alerts');
            await fs.mkdir(alertsDir, { recursive: true });
            
            const date = new Date().toISOString().split('T')[0];
            const alertsFile = path.join(alertsDir, `alerts-${date}.log`);
            
            const alertLine = JSON.stringify(alert) + '\n';
            await fs.appendFile(alertsFile, alertLine);
            
        } catch (error) {
            console.error('Erro ao salvar alerta em arquivo:', error);
        }
    }
    
    /**
     * Gera relatório de segurança
     */
    async generateSecurityReport() {
        const now = Date.now();
        const lastHour = now - 3600000;
        
        // Coletar dados da última hora
        const hourlyRequests = metricsStore.requests.filter(r => r.timestamp > lastHour);
        const hourlyErrors = metricsStore.errors.filter(e => e.timestamp > lastHour);
        const hourlyLogins = metricsStore.logins.filter(l => l.timestamp > lastHour);
        const hourlySecurityEvents = metricsStore.security_events.filter(e => e.timestamp > lastHour);
        
        const report = {
            period: { start: lastHour, end: now },
            summary: {
                totalRequests: hourlyRequests.length,
                totalErrors: hourlyErrors.length,
                errorRate: hourlyRequests.length > 0 ? (hourlyErrors.length / hourlyRequests.length) * 100 : 0,
                totalLogins: hourlyLogins.length,
                failedLogins: hourlyLogins.filter(l => !l.success).length,
                securityEvents: hourlySecurityEvents.length,
                uniqueIPs: new Set(hourlyRequests.map(r => r.ip)).size
            },
            topErrors: this.getTopErrors(hourlyErrors),
            suspiciousIPs: this.getSuspiciousIPs(hourlyRequests, hourlySecurityEvents),
            systemHealth: this.getSystemHealthSummary(),
            alerts: Array.from(this.alertHistory.values()).filter(a => a.timestamp > lastHour)
        };
        
        // Salvar relatório
        await this.saveReport(report);
        
        console.log('📊 [SECURITY_REPORT] Relatório de segurança gerado:', {
            requests: report.summary.totalRequests,
            errors: report.summary.totalErrors,
            security_events: report.summary.securityEvents,
            alerts: report.alerts.length
        });
    }
    
    /**
     * Funções auxiliares
     */
    classifyError(statusCode) {
        if (statusCode >= 500) return 'server_error';
        if (statusCode >= 400) return 'client_error';
        return 'unknown';
    }
    
    classifySecurityEventSeverity(type) {
        const severityMap = {
            'BRUTE_FORCE_ATTACK': 'critical',
            'SQL_INJECTION': 'critical',
            'XSS_ATTEMPT': 'high',
            'PATH_TRAVERSAL': 'high',
            'DDOS_ATTEMPT': 'critical',
            'SUSPICIOUS_LOGIN': 'medium',
            'RATE_LIMIT_EXCEEDED': 'low',
            'BOT_DETECTED': 'low',
            'COMMAND_INJECTION': 'critical'
        };
        
        return severityMap[type] || 'medium';
    }
    
    hashEmail(email) {
        return crypto.createHash('sha256').update(email).digest('hex').substring(0, 8);
    }
    
    limitArraySize(array, maxSize) {
        if (array.length > maxSize) {
            array.splice(0, array.length - maxSize);
        }
    }
    
    getTopErrors(errors) {
        const errorCounts = {};
        errors.forEach(error => {
            const key = `${error.statusCode}-${error.url}`;
            errorCounts[key] = (errorCounts[key] || 0) + 1;
        });
        
        return Object.entries(errorCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([key, count]) => ({ error: key, count }));
    }
    
    getSuspiciousIPs(requests, securityEvents) {
        const ipAnalysis = {};
        
        // Analisar requisições por IP
        requests.forEach(req => {
            if (!ipAnalysis[req.ip]) {
                ipAnalysis[req.ip] = {
                    requests: 0,
                    errors: 0,
                    securityEvents: 0,
                    suspiciousScore: 0
                };
            }
            
            ipAnalysis[req.ip].requests++;
            if (req.statusCode >= 400) {
                ipAnalysis[req.ip].errors++;
            }
        });
        
        // Adicionar eventos de segurança
        securityEvents.forEach(event => {
            if (ipAnalysis[event.ip]) {
                ipAnalysis[event.ip].securityEvents++;
                ipAnalysis[event.ip].suspiciousScore += 10;
            }
        });
        
        // Calcular score de suspeita
        Object.keys(ipAnalysis).forEach(ip => {
            const analysis = ipAnalysis[ip];
            
            // Muitas requisições
            if (analysis.requests > 100) analysis.suspiciousScore += 5;
            
            // Alta taxa de erro
            if (analysis.errors / analysis.requests > 0.5) analysis.suspiciousScore += 15;
            
            // Eventos de segurança
            analysis.suspiciousScore += analysis.securityEvents * 10;
        });
        
        // Retornar IPs mais suspeitos
        return Object.entries(ipAnalysis)
            .filter(([ip, analysis]) => analysis.suspiciousScore > 20)
            .sort(([,a], [,b]) => b.suspiciousScore - a.suspiciousScore)
            .slice(0, 10)
            .map(([ip, analysis]) => ({ ip, ...analysis }));
    }
    
    getSystemHealthSummary() {
        const latestHealth = metricsStore.system[metricsStore.system.length - 1];
        if (!latestHealth) return { status: 'unknown' };
        
        return {
            status: latestHealth.status,
            uptime: process.uptime(),
            memory: latestHealth.checks.memory,
            responseTime: latestHealth.checks.response_time
        };
    }
    
    async saveReport(report) {
        try {
            const reportsDir = path.join(__dirname, '../../logs/reports');
            await fs.mkdir(reportsDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportFile = path.join(reportsDir, `security-report-${timestamp}.json`);
            
            await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
            
        } catch (error) {
            console.error('Erro ao salvar relatório:', error);
        }
    }
    
    cleanupOldMetrics() {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 horas
        
        // Limpar métricas antigas
        Object.keys(metricsStore).forEach(key => {
            metricsStore[key] = metricsStore[key].filter(item => item.timestamp > cutoff);
        });
        
        // Limpar alertas antigos
        for (const [type, alert] of this.alertHistory.entries()) {
            if (alert.timestamp < cutoff) {
                this.alertHistory.delete(type);
            }
        }
        
        console.log('🧹 [MONITORING_CLEANUP] Métricas antigas removidas');
    }
    
    /**
     * Obtém estatísticas atuais
     */
    getStats() {
        const now = Date.now();
        const lastHour = now - 3600000;
        const last24Hours = now - (24 * 60 * 60 * 1000);
        
        // Métricas da última hora
        const hourlyRequests = metricsStore.requests.filter(r => r.timestamp > lastHour);
        const hourlyErrors = metricsStore.errors.filter(e => e.timestamp > lastHour);
        const hourlyLogins = metricsStore.logins.filter(l => l.timestamp > lastHour);
        
        // Métricas das últimas 24h
        const dailyRequests = metricsStore.requests.filter(r => r.timestamp > last24Hours);
        const dailyErrors = metricsStore.errors.filter(e => e.timestamp > last24Hours);
        
        return {
            system: {
                uptime: process.uptime(),
                totalRequests: this.systemMetrics.totalRequests,
                totalErrors: this.systemMetrics.totalErrors,
                totalLogins: this.systemMetrics.totalLogins,
                securityEvents: this.systemMetrics.securityEvents
            },
            hourly: {
                requests: hourlyRequests.length,
                errors: hourlyErrors.length,
                errorRate: hourlyRequests.length > 0 ? (hourlyErrors.length / hourlyRequests.length) * 100 : 0,
                logins: hourlyLogins.length,
                failedLogins: hourlyLogins.filter(l => !l.success).length,
                uniqueIPs: new Set(hourlyRequests.map(r => r.ip)).size
            },
            daily: {
                requests: dailyRequests.length,
                errors: dailyErrors.length,
                errorRate: dailyRequests.length > 0 ? (dailyErrors.length / dailyRequests.length) * 100 : 0,
                uniqueIPs: new Set(dailyRequests.map(r => r.ip)).size
            },
            alerts: {
                total: this.alertHistory.size,
                recent: Array.from(this.alertHistory.values()).filter(a => a.timestamp > lastHour).length
            },
            health: this.getSystemHealthSummary()
        };
    }
    
    /**
     * Obtém alertas ativos
     */
    getActiveAlerts() {
        const now = Date.now();
        const cutoff = now - (60 * 60 * 1000); // últimas 1 hora
        
        return Array.from(this.alertHistory.values())
            .filter(alert => alert.timestamp > cutoff && !alert.acknowledged)
            .sort((a, b) => b.timestamp - a.timestamp);
    }
    
    /**
     * Marca alerta como acknowledged
     */
    acknowledgeAlert(alertId) {
        for (const [type, alert] of this.alertHistory.entries()) {
            if (alert.id === alertId) {
                alert.acknowledged = true;
                console.log(`✅ [ALERT_ACK] Alerta ${alertId} foi acknowledged`);
                return true;
            }
        }
        return false;
    }
}

/**
 * Middleware para coleta automática de métricas
 */
const monitoringMiddleware = (monitor) => {
    return (req, res, next) => {
        const startTime = Date.now();
        
        // Interceptar fim da resposta para coletar métricas
        const originalEnd = res.end;
        res.end = function(...args) {
            const responseTime = Date.now() - startTime;
            
            // Registrar requisição no sistema de monitoramento
            monitor.logRequest(req, res, responseTime);
            
            return originalEnd.apply(this, args);
        };
        
        next();
    };
};

/**
 * Middleware para detecção de ataques
 */
const attackDetectionMiddleware = (monitor) => {
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const url = req.originalUrl.toLowerCase();
        const userAgent = (req.get('User-Agent') || '').toLowerCase();
        const body = JSON.stringify(req.body || {}).toLowerCase();
        const query = JSON.stringify(req.query).toLowerCase();
        
        // Detectar padrões de ataque
        const attacks = [];
        
        // SQL Injection
        const sqlPatterns = ['union select', 'drop table', 'insert into', '1=1', 'or 1=1', 'admin\'--'];
        if (sqlPatterns.some(pattern => url.includes(pattern) || query.includes(pattern) || body.includes(pattern))) {
            attacks.push('SQL_INJECTION');
        }
        
        // XSS
        const xssPatterns = ['<script', 'javascript:', 'onerror=', 'onload=', 'alert('];
        if (xssPatterns.some(pattern => url.includes(pattern) || query.includes(pattern) || body.includes(pattern))) {
            attacks.push('XSS_ATTEMPT');
        }
        
        // Path Traversal
        if (url.includes('../') || url.includes('..\\') || url.includes('/etc/passwd')) {
            attacks.push('PATH_TRAVERSAL');
        }
        
        // Bot Detection
        if (userAgent.includes('bot') || userAgent.includes('crawler') || userAgent.includes('spider')) {
            attacks.push('BOT_DETECTED');
        }
        
        // Registrar ataques detectados
        attacks.forEach(attack => {
            monitor.logSecurityEvent(attack, ip, {
                url: req.originalUrl,
                method: req.method,
                userAgent: req.get('User-Agent')
            });
        });
        
        // Bloquear ataques críticos
        const criticalAttacks = ['SQL_INJECTION', 'COMMAND_INJECTION'];
        if (attacks.some(attack => criticalAttacks.includes(attack))) {
            return res.status(403).json({
                error: 'Atividade maliciosa detectada',
                code: 'ATTACK_BLOCKED'
            });
        }
        
        next();
    };
};

/**
 * Função para criar uma instância do sistema de monitoramento
 */
function createMonitoringSystem() {
    const monitor = new ContinuousMonitoring();
    
    return {
        monitor,
        middleware: monitoringMiddleware(monitor),
        attackDetection: attackDetectionMiddleware(monitor),
        start: () => monitor.start(),
        stop: () => monitor.stop(),
        getStats: () => monitor.getStats(),
        getActiveAlerts: () => monitor.getActiveAlerts(),
        acknowledgeAlert: (id) => monitor.acknowledgeAlert(id)
    };
}

module.exports = {
    ContinuousMonitoring,
    createMonitoringSystem,
    monitoringMiddleware,
    attackDetectionMiddleware,
    MONITORING_CONFIG
};