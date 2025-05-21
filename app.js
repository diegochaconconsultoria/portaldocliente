const express = require('express'); 
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const nodemailer = require('nodemailer');
const axios = require('axios'); // Adicionar axios para chamadas HTTP
const https = require('https'); // Para lidar com certificados SSL
const multer = require('multer'); // Para processar uploads de arquivos

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

// Middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'sua-chave-secreta-aqui',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Defina como true se estiver usando HTTPS
        maxAge: 3600000 // 1 hora em milissegundos
    }
}));

// Configuração do transportador de email
const transporter = nodemailer.createTransport({
    host: 'email-ssl.com.br',
    port: 465,
    secure: true, // true para porta 465, false para outras portas
    auth: {
        user: 'portaldocliente@mvk.com.br',
        pass: '@Vendas3200'
    }
});

// Agente HTTPS que ignora a validação de certificados SSL (para desenvolvimento)
// Em produção, é recomendável configurar certificados válidos
const httpsAgent = new https.Agent({
    rejectUnauthorized: false // Ignora erros de certificado SSL
});

// Verificar se o usuário está autenticado (middleware)
const autenticacaoRequerida = (req, res, next) => {
    if (!req.session.usuario) {
        return res.redirect('/');
    }
    next();
};

const apiPedidosRouter = require('./app/routes/api/api-pedidos');
const apiNotasFiscaisRouter = require('./app/routes/api/api-notas-fiscais'); 
const apiFinanceiroRouter = require('./app/routes/api/api-financeiro');

app.use('/api/pedidos', apiPedidosRouter);
app.use('/api/notas-fiscais', apiNotasFiscaisRouter);
app.use('/api/financeiro', apiFinanceiroRouter);

// Função auxiliar para formatar o tamanho do arquivo
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Rotas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, cnpj, password } = req.body;

        // Valida os campos
        if (!email || !cnpj || !password) {
            return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
        }

        // Remove caracteres especiais do CNPJ (pontos, traços e barras)
        const cnpjNumerico = cnpj.replace(/[^\d]/g, '');

        // Configuração da requisição para a API externa
        const apiConfig = {
            method: 'post',
            url: 'https://192.168.0.251:8409/rest/VKPCLILOGIN',
            auth: {
                username: 'admin',
                password: 'msmvk'
            },
            data: {
                "email": email,
                "Pass": password,
                "cgc": cnpjNumerico
            },
            httpsAgent: httpsAgent // Ignora erros de certificado SSL
        };

        try {
            // Faz a requisição para a API externa
            const apiResponse = await axios(apiConfig);
            const userData = apiResponse.data;

            // Verifica se a autenticação foi bem-sucedida
            if (userData.sucess === true) {
                // Cria a sessão do usuário com os dados retornados pela API
                req.session.usuario = {
                    codigo: userData.Codigo,
                    nome: userData.Nome,
                    cnpj: userData.cgc,
                    email: userData.email
                };

                return res.status(200).json({ 
                    message: 'Login realizado com sucesso',
                    usuario: {
                        nome: userData.Nome,
                        codigo: userData.Codigo
                    }
                });
            } else {
                // Autenticação falhou
                return res.status(401).json({ message: 'Credenciais inválidas' });
            }
        } catch (apiError) {
            console.error('Erro na chamada da API externa:', apiError);
            
            // Verifica se temos uma resposta da API mesmo com erro
            if (apiError.response && apiError.response.data) {
                return res.status(401).json({ 
                    message: 'Falha na autenticação',
                    error: apiError.response.data
                });
            }
            
            // Erro de conexão ou outro problema
            return res.status(500).json({ 
                message: 'Erro ao conectar com o servidor de autenticação' 
            });
        }
    } catch (error) {
        console.error('Erro no login:', error);
        return res.status(500).json({ message: 'Erro interno no servidor' });
    }
});

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

// Rota para obter dados do usuário logado
app.get('/api/usuario', autenticacaoRequerida, (req, res) => {
    res.json({ 
        usuario: req.session.usuario 
    });
});

// Rota para logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao encerrar a sessão' });
        }
        res.json({ message: 'Sessão encerrada com sucesso' });
    });
});

// API para enviar solicitação de SAC
app.post('/api/enviarSac', autenticacaoRequerida, upload.array('files', 5), async (req, res) => {
    try {
        const { documento, observacao } = req.body;
        const files = req.files || [];
        
        // Validar campos obrigatórios
        if (!documento || !observacao) {
            return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
        }

        // Obter dados do usuário da sessão
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
        return res.status(500).json({ message: 'Erro ao processar sua solicitação. Por favor, tente novamente mais tarde.' });
    }
});


// API para buscar pedidos do cliente
app.get('/api/pedidos', autenticacaoRequerida, async (req, res) => {
    try {
        // Obter o código do cliente da sessão
        const codigoCliente = req.session.usuario.codigo;
        
        // Obter parâmetros de filtro da query
        const { dataInicio, dataFim, proposta, pedido } = req.query;
        
        // Obter parâmetros de paginação
        const pagina = parseInt(req.query.pagina) || 1;
        const itensPorPagina = 10;
        
        // Aqui você faria a chamada à API externa real
        // Por enquanto, vamos simular dados mockados
        
        // Simular pedidos mockados (em um cenário real, esses dados viriam da API externa)
        const pedidosMock = [
            {
                id: '1',
                numero: '123456',
                proposta: '78945',
                data: '2025-03-15',
                valorTotal: 1250.75,
                status: 'aprovado',
                previsaoEntrega: '2025-04-30',
                formaPagamento: 'Boleto',
                itens: [
                    {
                        codigo: 'PRD001',
                        descricao: 'Produto A - Modelo XYZ',
                        quantidade: 2,
                        unidade: 'UN',
                        valorUnitario: 450.50,
                        valorTotal: 901.00
                    },
                    {
                        codigo: 'PRD002',
                        descricao: 'Produto B - Modelo ABC',
                        quantidade: 1,
                        unidade: 'UN',
                        valorUnitario: 349.75,
                        valorTotal: 349.75
                    }
                ]
            },
            {
                id: '2',
                numero: '123457',
                proposta: '78946',
                data: '2025-03-20',
                valorTotal: 2780.00,
                status: 'em_producao',
                previsaoEntrega: '2025-05-10',
                formaPagamento: 'Cartão de Crédito',
                itens: [
                    {
                        codigo: 'PRD003',
                        descricao: 'Produto C - Modelo 123',
                        quantidade: 4,
                        unidade: 'UN',
                        valorUnitario: 695.00,
                        valorTotal: 2780.00
                    }
                ]
            },
            {
                id: '3',
                numero: '123458',
                proposta: null,
                data: '2025-03-25',
                valorTotal: 899.90,
                status: 'pendente',
                previsaoEntrega: null,
                formaPagamento: 'Transferência',
                itens: [
                    {
                        codigo: 'PRD004',
                        descricao: 'Produto D - Modelo Premium',
                        quantidade: 1,
                        unidade: 'UN',
                        valorUnitario: 899.90,
                        valorTotal: 899.90
                    }
                ]
            }
        ];
        
        // Filtrar os pedidos com base nos parâmetros recebidos
        let pedidosFiltrados = [...pedidosMock];
        
        if (dataInicio) {
            pedidosFiltrados = pedidosFiltrados.filter(p => new Date(p.data) >= new Date(dataInicio));
        }
        
        if (dataFim) {
            pedidosFiltrados = pedidosFiltrados.filter(p => new Date(p.data) <= new Date(dataFim));
        }
        
        if (proposta) {
            pedidosFiltrados = pedidosFiltrados.filter(p => p.proposta && p.proposta.includes(proposta));
        }
        
        if (pedido) {
            pedidosFiltrados = pedidosFiltrados.filter(p => p.numero.includes(pedido));
        }
        
        // Calcular paginação
        const totalPedidos = pedidosFiltrados.length;
        const totalPaginas = Math.ceil(totalPedidos / itensPorPagina);
        const inicio = (pagina - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        const pedidosPaginados = pedidosFiltrados.slice(inicio, fim);
        
        // Responder com os dados
        res.json({
            pedidos: pedidosPaginados,
            totalPedidos,
            pagina,
            totalPaginas,
            itensPorPagina
        });
        
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
        res.status(500).json({ message: 'Erro ao buscar pedidos. Por favor, tente novamente mais tarde.' });
    }
});

// API para buscar detalhes de um pedido específico
app.get('/api/pedidos/:id', autenticacaoRequerida, async (req, res) => {
    try {
        const pedidoId = req.params.id;
        
        // Aqui você faria a chamada à API externa real
        // Por enquanto, vamos simular dados mockados
        
        // Simular detalhes do pedido (em um cenário real, esses dados viriam da API externa)
        const pedidosMock = {
            '1': {
                id: '1',
                numero: '123456',
                proposta: '78945',
                data: '2025-03-15',
                valorTotal: 1250.75,
                status: 'aprovado',
                previsaoEntrega: '2025-04-30',
                formaPagamento: 'Boleto',
                itens: [
                    {
                        codigo: 'PRD001',
                        descricao: 'Produto A - Modelo XYZ',
                        quantidade: 2,
                        unidade: 'UN',
                        valorUnitario: 450.50,
                        valorTotal: 901.00
                    },
                    {
                        codigo: 'PRD002',
                        descricao: 'Produto B - Modelo ABC',
                        quantidade: 1,
                        unidade: 'UN',
                        valorUnitario: 349.75,
                        valorTotal: 349.75
                    }
                ]
            },
            '2': {
                id: '2',
                numero: '123457',
                proposta: '78946',
                data: '2025-03-20',
                valorTotal: 2780.00,
                status: 'em_producao',
                previsaoEntrega: '2025-05-10',
                formaPagamento: 'Cartão de Crédito',
                itens: [
                    {
                        codigo: 'PRD003',
                        descricao: 'Produto C - Modelo 123',
                        quantidade: 4,
                        unidade: 'UN',
                        valorUnitario: 695.00,
                        valorTotal: 2780.00
                    }
                ]
            },
            '3': {
                id: '3',
                numero: '123458',
                proposta: null,
                data: '2025-03-25',
                valorTotal: 899.90,
                status: 'pendente',
                previsaoEntrega: null,
                formaPagamento: 'Transferência',
                itens: [
                    {
                        codigo: 'PRD004',
                        descricao: 'Produto D - Modelo Premium',
                        quantidade: 1,
                        unidade: 'UN',
                        valorUnitario: 899.90,
                        valorTotal: 899.90
                    }
                ]
            }
        };
        
        const pedido = pedidosMock[pedidoId];
        
        if (!pedido) {
            return res.status(404).json({ message: 'Pedido não encontrado' });
        }
        
        // Responder com os dados do pedido
        res.json(pedido);
        
    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido:', error);
        res.status(500).json({ message: 'Erro ao buscar detalhes do pedido. Por favor, tente novamente mais tarde.' });
    }
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Portal disponível em: http://localhost:${PORT}`);
    console.log(`Data e hora de inicialização: ${new Date().toLocaleString('pt-BR')}`);
});