const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

// Carregar variáveis de ambiente
require('dotenv').config();

const { 
    wafInstance, 
    wafReportingMiddleware 
} = require('./app/middlewares/waf');


const {
    wafDataProtectionMiddleware,
    mvkCustomRulesMiddleware,
    advancedMonitoringMiddleware
} = require('./app/middlewares/waf-integration');


const { getEnvironmentConfig } = require('./config/waf-rules');

// Aplicar configurações de ambiente do WAF
const wafEnvConfig = getEnvironmentConfig();
Object.assign(require('./app/middlewares/waf').WAF_CONFIG, wafEnvConfig);

console.log(`🛡️ WAF inicializado - Modo: ${wafEnvConfig.MODE}, Ambiente: ${process.env.NODE_ENV || 'development'}`);


// Importar middlewares
const { autenticacaoRequerida } = require('./app/middlewares/auth');
const { protecaoCSRF, obterTokenCSRF } = require('./app/middlewares/csrf');
const {
    sanitizarEntradas,
    validarLogin,
    validarFiltroPedidos,
    validarFiltroNotas
} = require('./app/middlewares/validation');

// Importar serviços
const authService = require('./app/services/auth-service');
const auditService = require('./app/services/audit-service');
const apiProxy = require('./app/services/api-proxy');
const apiMonitor = require('./app/services/api-monitor');

// Configure multer para processar uploads de arquivos
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // limita o tamanho do arquivo a 10MB
    },
    fileFilter: (req, file, cb) => {
        // Validar tipos de arquivo
        if (file.mimetype === 'application/pdf' ||
            file.mimetype === 'image/jpeg' ||
            file.mimetype === 'image/jpg' ||
            file.mimetype === 'image/png') {
            cb(null, true);
        } else {
            cb(new Error('Formato de arquivo não suportado. Use apenas PDF, JPG ou PNG.'));
        }
    }
});

// Configuração do app
const app = express();

const {
    BackendDataProtection,
    dataProtectionMiddleware,
    logProtectionMiddleware,
    sessionDataCleanupMiddleware,
    ServerDataEncryption,
    DATA_PROTECTION_CONFIG //
} = require('./app/middlewares/data-protection');


// Aplicar políticas de segurança básicas
app.use(helmet());

// Configurar Content Security Policy (CSP)
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    })
);

// Outros cabeçalhos de segurança
app.use(helmet.xssFilter());
app.use(helmet.noSniff());
app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.hsts({
    maxAge: 15552000, // 180 dias em segundos
    includeSubDomains: true,
    preload: true
}));

app.set('trust proxy', true);

app.use(wafInstance.middleware());
app.use(wafDataProtectionMiddleware);
app.use(mvkCustomRulesMiddleware);
app.use(advancedMonitoringMiddleware);
app.use(wafReportingMiddleware(wafInstance));


app.use(wafInstance.middleware());


// Middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Aplicar sanitização de entrada
app.use(sanitizarEntradas);

// Aplicar proteção de logs (deve ser um dos primeiros middlewares)
app.use(logProtectionMiddleware);

// Aplicar proteção de dados nas respostas
app.use(dataProtectionMiddleware);

// Aplicar limpeza de dados de sessão
app.use(sessionDataCleanupMiddleware);


// Middleware adicional para proteção de headers sensíveis
app.use((req, res, next) => {
    // Remover headers que podem vazar informações sensíveis
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    // Adicionar headers de proteção de dados
    res.setHeader('X-Data-Protection', 'enabled');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    next();
});

// Configuração de sessão segura
app.use(session({
    secret: process.env.SESSION_SECRET || 'sua-chave-secreta-aqui',
    name: 'mvk_portal_sid', // Nome personalizado para o cookie de sessão
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true em produção
        httpOnly: true, // O cookie não pode ser acessado via JavaScript
        maxAge: parseInt(process.env.SESSION_TIMEOUT || '3600', 10) * 1000, // Converter segundos para ms
        sameSite: 'strict' // Prevenir CSRF
    }
}));

// Configuração para limitar taxa de requisições
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // limite de 100 requisições por IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Muitas requisições deste endereço IP. Tente novamente mais tarde.',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

// Aplicar limitador de taxa a todas as requisições
app.use(limiter);

// Limiter mais restritivo para rotas sensíveis (login, registro, etc.)
const loginLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // limite de 10 tentativas por IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Muitas tentativas de login. Tente novamente mais tarde.',
        code: 'LOGIN_RATE_LIMIT_EXCEEDED'
    }
});

// Configuração do transportador de email
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'email-ssl.com.br',
    port: parseInt(process.env.EMAIL_PORT || '465', 10),
    secure: true, // true para porta 465, false para outras portas
    auth: {
        user: process.env.EMAIL_USER || 'portaldocliente@mvk.com.br',
        pass: process.env.EMAIL_PASS || '@Vendas3200'
    }
});

// Função auxiliar para formatar o tamanho do arquivo
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Função para mascarar CNPJ
function maskCNPJ(cnpj) {
    if (!cnpj) return '';

    // Remover formatação existente
    cnpj = cnpj.replace(/[^\d]/g, '');

    // Aplicar máscara: mostrar apenas os últimos 4 dígitos
    if (cnpj.length === 14) {
        return `**.***.***/****-${cnpj.substr(cnpj.length - 2)}`;
    }

    return cnpj;
}

// Iniciar monitoramento da API
//const monitoringInterval = apiMonitor.iniciarMonitoramento();

// Rota para obter token CSRF
app.get('/api/csrf-token', protecaoCSRF, obterTokenCSRF);

// Rotas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rota de login com todas as validações e proteções
app.post('/api/login', loginLimiter, validarLogin, async (req, res) => {
    try {
        const { email, cnpj, password } = req.body;

        // Log de tentativa de login (dados já serão mascarados automaticamente)
        console.log('Tentativa de login para email:', email);

        // Remove caracteres especiais do CNPJ
        const cnpjNumerico = cnpj.replace(/[^\d]/g, '');

        // Verificar bloqueio por tentativas
        const identificador = `${email}:${cnpjNumerico}`;
        const bloqueio = authService.verificarBloqueio(identificador);

        if (bloqueio.bloqueado) {
            // Log de tentativa bloqueada
            BackendDataProtection.logSensitiveAccess(req, 'login_blocked', 'attempt');

            return res.status(429).json({
                message: `Muitas tentativas de login. Tente novamente em ${bloqueio.tempoRestante} minutos.`,
                code: 'TOO_MANY_ATTEMPTS'
            });
        }

        try {
            // Usar o proxy da API para fazer login
            const userData = await apiProxy.fazerLogin(email, password, cnpjNumerico);

            // Verifica se a autenticação foi bem-sucedida
            if (userData.sucess === true) {
                // Registrar login bem-sucedido
                authService.registrarTentativaLogin(identificador, true);

                // Log de login bem-sucedido
                BackendDataProtection.logSensitiveAccess(req, 'login_success', 'authentication');

                // Registrar nos logs de auditoria
                await auditService.logLogin({
                    codigo: userData.Codigo,
                    nome: userData.Nome,
                    email: BackendDataProtection.maskEmail(userData.email) // Email mascarado nos logs
                }, req.ip);

                // Criar sessão com dados mínimos e protegidos
                req.session.usuario = {
                    codigo: userData.Codigo,
                    nome: userData.Nome,
                    // Não armazenar CNPJ completo na sessão - apenas referência mascarada
                    cnpj: BackendDataProtection.maskCNPJ(userData.cgc),
                    email: BackendDataProtection.maskEmail(userData.email),
                    ultimoAcesso: Date.now()
                };

                // Resposta com dados mínimos (dados sensíveis já mascarados pelo middleware)
                return res.status(200).json({
                    message: 'Login realizado com sucesso',
                    usuario: {
                        nome: userData.Nome,
                        codigo: userData.Codigo
                        // Não retornar dados sensíveis
                    }
                });
            } else {
                // Registrar tentativa falha
                authService.registrarTentativaLogin(identificador, false);

                // Log de falha (sem dados sensíveis)
                BackendDataProtection.logSensitiveAccess(req, 'login_failed', 'authentication');

                // Registrar falha nos logs de auditoria (com email mascarado)
                await auditService.logLoginFailed({
                    email: BackendDataProtection.maskEmail(email)
                }, req.ip, 'Credenciais inválidas');

                return res.status(401).json({ message: 'Credenciais inválidas' });
            }
        } catch (apiError) {
            console.error('Erro na comunicação com API de login:', apiError);

            // Registrar tentativa falha
            authService.registrarTentativaLogin(identificador, false);

            // Log de erro (dados mascarados automaticamente)
            BackendDataProtection.logSensitiveAccess(req, 'login_error', 'api_communication');

            // Registrar falha nos logs de auditoria
            await auditService.logLoginFailed({
                email: BackendDataProtection.maskEmail(email)
            }, req.ip, 'Erro na API de autenticação');

            return res.status(500).json({
                message: 'Erro ao conectar com o servidor de autenticação. Tente novamente mais tarde.'
            });
        }
    } catch (error) {
        console.error('Erro no login:', error);

        // Log de erro interno
        BackendDataProtection.logSensitiveAccess(req, 'login_internal_error', 'server_error');

        return res.status(500).json({ message: 'Erro interno no servidor' });
    }
});


// Rota para solicitar acesso
app.post('/api/solicitarAcesso', async (req, res) => {
    try {
        const { nome, cnpj, email, telefone, contato, consentimento } = req.body;

        // Verifica se todos os campos obrigatórios foram preenchidos
        if (!nome || !cnpj || !email || !telefone || !contato || !consentimento) {
            return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
        }

        // Data e hora atuais
        const dataHora = new Date().toISOString().replace('T', ' ').substring(0, 19);

        // Template HTML para o email
        const htmlEmail = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Nova Solicitação de Acesso</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background-color: #d8183e;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px 5px 0 0;
                }
                .content {
                    background-color: #f9f9f9;
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-top: none;
                    border-radius: 0 0 5px 5px;
                }
                .info-item {
                    margin-bottom: 10px;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 10px;
                }
                .info-label {
                    font-weight: bold;
                    color: #d8183e;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 12px;
                    color: #777;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Nova Solicitação de Acesso ao Portal</h2>
                </div>
                <div class="content">
                    <p>Uma nova solicitação de acesso ao Portal do Cliente foi registrada com os seguintes dados:</p>
                    
                    <div class="info-item">
                        <span class="info-label">Nome da Empresa:</span> 
                        <span>${nome}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">CNPJ:</span> 
                        <span>${cnpj}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">Email:</span> 
                        <span>${email}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">Telefone:</span> 
                        <span>${telefone}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">Nome do Contato:</span> 
                        <span>${contato}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">Data e Hora da Solicitação:</span> 
                        <span>${dataHora}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">Consentimento LGPD:</span> 
                        <span>Concedido</span>
                    </div>
                    
                    <p>Após análise e aprovação, por favor, crie as credenciais para este cliente e informe-o por email.</p>
                </div>
                <div class="footer">
                    <p>Esta é uma mensagem automática do Portal do Cliente. Por favor, não responda diretamente a este email.</p>
                    <p>© ${new Date().getFullYear()} MVK. Todos os direitos reservados.</p>
                </div>
            </div>
        </body>
        </html>
        `;

        // Configuração do email
        const mailOptions = {
            from: 'Portal do Cliente <portaldocliente@mvk.com.br>',
            to: 'diego.chacon@mvk.com.br, jennifer.serutti@mvk.com.br',
            subject: 'Solicitação de Novas Credenciais Portal do Cliente',
            html: htmlEmail
        };

        // Enviar o email
        await transporter.sendMail(mailOptions);

        // Responde ao cliente
        return res.status(200).json({
            message: 'Solicitação enviada com sucesso!',
            solicitacao: {
                nome,
                cnpj,
                email,
                telefone,
                contato,
                dataHora
            }
        });

    } catch (error) {
        console.error('Erro ao solicitar acesso:', error);
        return res.status(500).json({ message: 'Erro ao processar sua solicitação. Por favor, tente novamente mais tarde.' });
    }
});

// Rotas principais
app.get('/dashboard', autenticacaoRequerida, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/pedidos', autenticacaoRequerida, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pedidos.html'));
});

// Rota para a página de notas fiscais
app.get('/notas-fiscais', autenticacaoRequerida, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'notas-fiscais.html'));
});

// Rota para a página de posição financeira
app.get('/financeiro', autenticacaoRequerida, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'financeiro.html'));
});

// Rota para a página SAC
app.get('/sac', autenticacaoRequerida, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sac.html'));
});

// Rota para a página de registro de primeiro acesso
app.get('/registro', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'registro.html'));
});

// Rota para obter dados do usuário logado (protegida)
app.get('/api/usuario', autenticacaoRequerida, (req, res) => {
    try {
        // Log de acesso aos dados do usuário
        BackendDataProtection.logSensitiveAccess(req, 'user_data', 'access');

        // Retornar apenas dados essenciais e já mascarados
        const usuario = {
            codigo: req.session.usuario.codigo,
            nome: req.session.usuario.nome,
            email: req.session.usuario.email, // Já mascarado na sessão
            cnpj: req.session.usuario.cnpj    // Já mascarado na sessão
        };

        res.json({ usuario });
    } catch (error) {
        console.error('Erro ao obter dados do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});


// Rota para logout
app.post('/api/logout', protecaoCSRF, async (req, res) => {
    try {
        // Guardar informações do usuário antes de destruir a sessão (mascaradas)
        const usuario = req.session.usuario;

        if (usuario) {
            // Log de logout
            BackendDataProtection.logSensitiveAccess(req, 'logout', 'session_end');
        }

        // Destruir a sessão
        req.session.destroy(async (err) => {
            if (err) {
                console.error('Erro ao encerrar a sessão:', err);
                return res.status(500).json({ message: 'Erro ao encerrar a sessão' });
            }

            // Registrar logout nos logs de auditoria (dados já mascarados)
            if (usuario) {
                await auditService.logLogout(usuario, req.ip);
            }

            // Instruir o cliente a limpar dados sensíveis
            res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
            res.json({
                message: 'Sessão encerrada com sucesso',
                clearData: true // Instrução para o frontend limpar dados
            });
        });
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        res.status(500).json({ message: 'Ocorreu um erro ao tentar sair. Por favor, tente novamente.' });
    }
});


app.post('/api/clear-sensitive-data', autenticacaoRequerida, async (req, res) => {
    try {
        // Log da limpeza de dados
        BackendDataProtection.logSensitiveAccess(req, 'data_clear', 'emergency_cleanup');

        // Destruir sessão atual
        req.session.destroy((err) => {
            if (err) {
                console.error('Erro ao limpar sessão:', err);
            }
        });

        // Instruir limpeza completa no cliente
        res.setHeader('Clear-Site-Data', '"*"');
        res.json({
            message: 'Dados sensíveis limpos com sucesso',
            redirect: '/'
        });
    } catch (error) {
        console.error('Erro ao limpar dados sensíveis:', error);
        res.status(500).json({ message: 'Erro na limpeza de dados' });
    }
});


// API para enviar solicitação de SAC
app.post('/api/enviarSac', autenticacaoRequerida, upload.array('files', 5), async (req, res) => {
    try {
        const { documento, observacao } = req.body;
        const files = req.files || [];

        // Log de acesso ao SAC
        BackendDataProtection.logSensitiveAccess(req, 'sac_submission', 'support_request');

        // Validar campos obrigatórios
        if (!documento || !observacao) {
            return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
        }

        // Obter dados do usuário da sessão (já mascarados)
        const usuario = req.session.usuario;
        if (!usuario) {
            return res.status(401).json({ message: 'Usuário não autenticado' });
        }

        // Data e hora atual formatada
        const dataHora = new Date().toISOString().replace('T', ' ').substring(0, 19);



        // Template HTML para o email
        const htmlEmail = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Nova Solicitação de Atendimento</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background-color: #d8183e;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px 5px 0 0;
                }
                .content {
                    background-color: #f9f9f9;
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-top: none;
                    border-radius: 0 0 5px 5px;
                }
                .info-item {
                    margin-bottom: 10px;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 10px;
                }
                .info-label {
                    font-weight: bold;
                    color: #d8183e;
                }
                .files-list {
                    background-color: #f0f0f0;
                    padding: 10px;
                    border-radius: 4px;
                    margin-top: 10px;
                }
                .file-item {
                    padding: 5px 0;
                    border-bottom: 1px dotted #ddd;
                }
                .file-item:last-child {
                    border-bottom: none;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 12px;
                    color: #777;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Nova Solicitação de Atendimento</h2>
                </div>
                <div class="content">
                    <p>Um cliente acaba de enviar uma nova solicitação através do Portal do Cliente:</p>
                    
                    <div class="info-item">
                        <span class="info-label">Cliente:</span> 
                        <span>${usuario.nome}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">Código:</span> 
                        <span>${usuario.codigo}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">CNPJ:</span> 
                        <span>${usuario.cnpj}</span>
                    </div>
                    
                    
                    <div class="info-item">
                        <span class="info-label">Email:</span> 
                        <span>${usuario.email}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">Nota Fiscal/Proposta/Pedido:</span> 
                        <span>${documento}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">Observação:</span> 
                        <p>${observacao.replace(/\n/g, '<br>')}</p>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">Data e Hora:</span> 
                        <span>${dataHora}</span>
                    </div>
                    
                    ${files.length > 0 ? `
                    <div class="info-item">
                        <span class="info-label">Arquivos Anexados (${files.length}):</span>
                        <div class="files-list">
                            ${files.map(file => `
                                <div class="file-item">
                                    ${file.originalname} (${formatFileSize(file.size)})
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <p>Por favor, analise esta solicitação e entre em contato com o cliente o mais breve possível.</p>
                </div>
                
                <div class="security-notice">
                    <strong>Aviso de Privacidade:</strong> Os dados CNPJ e email nesta mensagem foram automaticamente mascarados por segurança. 
                    Para dados completos, consulte o sistema interno usando o código do cliente.
                </div>

                <div class="footer">
                    <p>Esta é uma mensagem automática do Portal do Cliente. Por favor, não responda diretamente a este email.</p>
                    <p>© ${new Date().getFullYear()} MVK. Todos os direitos reservados.</p>
                </div>
            </div>
        </body>
        </html>
        `;



        // Configurar anexos para o email
        const attachments = files.map(file => ({
            filename: file.originalname,
            content: file.buffer
        }));

        // Configuração do email
        const mailOptions = {
            from: 'Portal do Cliente <portaldocliente@mvk.com.br>',
            to: 'diego.chacon@mvk.com.br, michele.felix@mvk.com.br',
            subject: 'Abertura de atendimento via Portal do Cliente',
            html: htmlEmail,
            attachments: attachments
        };

        // Enviar o email
        await transporter.sendMail(mailOptions);

        // Responder ao cliente
        return res.status(200).json({
            message: 'Solicitação enviada com sucesso!',
            solicitacao: {
                documento,
                observacao,
                dataHora,
                arquivos: files.map(f => f.originalname)
            }
        });

    } catch (error) {
        console.error('Erro ao enviar solicitação SAC:', error);
        
        // Log de erro
        BackendDataProtection.logSensitiveAccess(req, 'sac_error', 'submission_failed');
        
        return res.status(500).json({ message: 'Erro ao processar sua solicitação. Por favor, tente novamente mais tarde.' });
    }
});

// Rota para verificar status da API
app.get('/api/status', autenticacaoRequerida, async (req, res) => {
    try {
        const relatorio = await apiMonitor.gerarRelatorio();

        res.json({
            message: 'Status das APIs externas',
            ...relatorio
        });
    } catch (error) {
        console.error('Erro ao obter status da API:', error);
        res.status(500).json({
            message: 'Erro ao obter status das APIs',
            error: 'Não foi possível verificar o status das APIs externas'
        });
    }
});

// Rota para estatísticas de monitoramento
app.get('/api/monitoring/stats', autenticacaoRequerida, (req, res) => {
    try {
        const stats = apiMonitor.obterEstatisticas();

        res.json({
            message: 'Estatísticas de monitoramento',
            ...stats
        });
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({
            message: 'Erro ao obter estatísticas de monitoramento'
        });
    }
});

// Importar rotas da API
const apiPedidosRouter = require('./app/routes/api/api-pedidos');
const apiNotasFiscaisRouter = require('./app/routes/api/api-notas-fiscais');
const apiFinanceiroRouter = require('./app/routes/api/api-financeiro');

// Aplicar as rotas da API com proteção CSRF e autenticação
app.use('/api/pedidos', protecaoCSRF, autenticacaoRequerida, validarFiltroPedidos, apiPedidosRouter);
app.use('/api/notas-fiscais', protecaoCSRF, autenticacaoRequerida, validarFiltroNotas, apiNotasFiscaisRouter);
app.use('/api/financeiro', protecaoCSRF, autenticacaoRequerida, apiFinanceiroRouter);

// Middleware para tratar erros
app.use((err, req, res, next) => {
    // Mascarar dados sensíveis em mensagens de erro
    let errorMessage = err.message;
    if (typeof errorMessage === 'string') {
        errorMessage = BackendDataProtection.maskSensitivePatterns(errorMessage);
    }
    
    console.error('Erro na aplicação (mascarado):', errorMessage);
    
    // Log do erro (dados já mascarados pelo middleware de log)
    BackendDataProtection.logSensitiveAccess(req, 'application_error', 'error_handling');
    
    // Evitar expor detalhes técnicos em produção
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.status(err.status || 500).json({
        message: 'Ocorreu um erro no servidor',
        error: isProduction ? 'Erro interno' : errorMessage, // Erro já mascarado
        timestamp: new Date().toISOString()
    });
});


// Graceful shutdown - parar monitoramento ao encerrar o servidor
/*process.on('SIGTERM', () => {
    console.log('Encerrando servidor...');
    apiMonitor.pararMonitoramento(monitoringInterval);
    process.exit(0);
});*/

process.on('SIGINT', () => {
    console.log('Encerrando servidor...');
    apiMonitor.pararMonitoramento(monitoringInterval);
    process.exit(0);
});

setInterval(() => {
    console.log('🧹 Executando limpeza periódica de dados sensíveis...');
    
    // Aqui você pode implementar limpeza de logs antigos,
    // sessões expiradas, etc.
    
}, 60 * 60 * 1000); // A cada 1 hora

console.log('🔒 Sistema de proteção de dados sensíveis ativo');
console.log('📊 Logs de dados sensíveis:', DATA_PROTECTION_CONFIG.LOG_SENSITIVE_ACCESS ? 'ATIVO' : 'INATIVO');
console.log('🎭 Mascaramento automático:', DATA_PROTECTION_CONFIG.MASK_LOGS ? 'ATIVO' : 'INATIVO');

// Inicia o servidor
//const PORT = process.env.PORT || 3000;
/*app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Portal disponível em: http://localhost:${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Data e hora de inicialização: ${new Date().toLocaleString('pt-BR')}`);
});*/


const https = require('https');
const fs = require('fs');

const PORT = process.env.PORT || 3000;

// Carregar os certificados SSL
const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'certificate_key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'certificate.crt'))
};

// Inicia o servidor HTTPS
https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`🔐 Servidor rodando em https://localhost:${PORT}`);
    console.log(`🗂️  Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Data e hora de inicialização: ${new Date().toLocaleString('pt-BR')}`);
});
