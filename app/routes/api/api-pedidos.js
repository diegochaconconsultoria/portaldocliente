const express = require('express');
const router = express.Router();
const { autenticacaoRequerida } = require('../../middlewares/auth');
const axios = require('axios');
const https = require('https');

// Configuração da API externa
const API_CONFIG = {
    // TODO: Substituir pela URL real da API externa
    URL: 'https://192.168.0.251:8409/rest/VKPCLILPED',  
    // TODO: Substituir pelas credenciais reais
    AUTH: {
        username: 'admin', 
        password: 'msmvk'
    }
};

// Agente HTTPS que ignora a validação de certificados SSL (para desenvolvimento)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false // Ignora erros de certificado SSL
});

// Função auxiliar para converter datas de YYYY-MM-DD para YYYYMMDD
function converterDataParaAAAAMMDD(dataString) {
    if (!dataString) return "";
    return dataString.replace(/-/g, '');
}

// Rota para listar pedidos do cliente
router.get('/', autenticacaoRequerida, async (req, res) => {
    try {
        // Obter o código do cliente da sessão
        const codigoCliente = req.session.usuario.codigo;
        
        // Obter parâmetros de filtro da query
        const { dataInicio, dataFim, proposta, pedido, todos } = req.query;
        
        console.log('Consultando pedidos para o cliente:', codigoCliente);
        console.log('Filtros:', { dataInicio, dataFim, proposta, pedido, todos });
        
        // Preparar os dados para enviar para a API externa
        const requestData = {
            CodigoCliente: codigoCliente,
            Todos: todos === 'true' ? 'Sim' : 'Nao',
            Datainicio: dataInicio ? converterDataParaAAAAMMDD(dataInicio) : '',
            Datafim: dataFim ? converterDataParaAAAAMMDD(dataFim) : '',
            Proposta: proposta || '',
            Pedido: pedido || ''
        };
        
        console.log('Dados a serem enviados para a API:', requestData);
        
        try {
            // Realizar a chamada para a API externa
            const apiResponse = await axios({
                method: 'post',
                url: API_CONFIG.URL,
                auth: API_CONFIG.AUTH,
                httpsAgent,
                data: requestData
            });
            
            // Processar a resposta da API externa
            const responseData = apiResponse.data;
            console.log('Resposta da API externa:', responseData);
            
            // Enviar a resposta para o cliente
            res.json(responseData);
            
        } catch (apiError) {
            console.error('Erro na chamada da API externa:', apiError);
            
            // Se houve um erro na API, retornar um formato de resposta que indica que não encontrou pedidos
            const errorResponse = {
                success: false,
                pedido: [{
                    Numero: "pedido nao encontrado",
                    Proposta: "pedido nao encontrado",
                    Data: "pedido nao encontrado"
                }]
            };
            
            res.json(errorResponse);
        }
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
        res.status(500).json({ 
            message: 'Erro ao buscar pedidos. Por favor, tente novamente mais tarde.',
            success: false,
            pedido: [{
                Numero: "erro interno",
                Proposta: "erro interno",
                Data: "erro interno"
            }]
        });
    }
});

// Rota para buscar detalhes de um pedido específico
router.get('/:id', autenticacaoRequerida, async (req, res) => {
    try {
        const pedidoNumero = req.params.id;
        const codigoCliente = req.session.usuario.codigo;
        
        console.log(`Consultando detalhes do pedido ${pedidoNumero} para o cliente ${codigoCliente}`);
        
        // Em um cenário real, faríamos uma chamada API para obter os detalhes do pedido
        // Aqui estamos simulando com dados mockados
        try {
            // Exemplo de como seria a chamada para a API externa
            // const apiResponse = await axios({
            //     method: 'post',
            //     url: 'https://192.168.0.251:8409/rest/VKPCLILPEDDETALHE',
            //     auth: API_CONFIG.AUTH,
            //     httpsAgent,
            //     data: {
            //         CodigoCliente: codigoCliente,
            //         Pedido: pedidoNumero
            //     }
            // });
            
            // Simular detalhes do pedido
            const pedidoDetalhes = {
                Numero: pedidoNumero,
                Data: '20250315',
                Proposta: '78945',
                ValorTotal: 1250.75,
                Status: 'Aprovado',
                PrevisaoEntrega: '20250430',
                FormaPagamento: 'Boleto',
                Itens: [
                    {
                        Codigo: 'PRD001',
                        Descricao: 'Produto A - Modelo XYZ',
                        Quantidade: 2,
                        Unidade: 'UN',
                        ValorUnitario: 450.50,
                        ValorTotal: 901.00
                    },
                    {
                        Codigo: 'PRD002',
                        Descricao: 'Produto B - Modelo ABC',
                        Quantidade: 1,
                        Unidade: 'UN',
                        ValorUnitario: 349.75,
                        ValorTotal: 349.75
                    }
                ]
            };
            
            res.json({
                success: true,
                pedido: pedidoDetalhes
            });
            
        } catch (apiError) {
            console.error('Erro na chamada da API externa:', apiError);
            res.json({
                success: false,
                pedido: {
                    Numero: "pedido nao encontrado",
                    Proposta: "pedido nao encontrado",
                    Data: "pedido nao encontrado"
                }
            });
        }
    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido:', error);
        res.status(500).json({ 
            message: 'Erro ao buscar detalhes do pedido. Por favor, tente novamente mais tarde.',
            success: false
        });
    }
});

router.get('/detalhes/:numero', autenticacaoRequerida, async (req, res) => {
    try {
        const numeroPedido = req.params.numero;
        console.log(`Consultando detalhes do pedido ${numeroPedido}`);
        
        // URL da API externa
        const apiUrl = 'https://192.168.0.251:8409/rest/VKPCLIDPED';
        
        // Credenciais para autenticação
        const authConfig = {
            username: 'admin',
            password: 'msmvk'
        };
        
        try {
            // Realizar a chamada para a API externa
            const apiResponse = await axios({
                method: 'post',
                url: apiUrl,
                auth: authConfig,
                httpsAgent,
                data: {
                    pedido: numeroPedido
                }
            });
            
            // Processar a resposta da API externa
            const responseData = apiResponse.data;
            console.log('Resposta da API externa para detalhes do pedido:', responseData);
            
            // Enviar a resposta para o cliente
            res.json(responseData);
            
        } catch (apiError) {
            console.error('Erro na chamada da API externa para detalhes do pedido:', apiError);
            
            if (apiError.response) {
                return res.status(apiError.response.status).json({ 
                    message: 'Erro ao buscar detalhes do pedido na API externa',
                    error: apiError.response.data
                });
            }
            
            return res.status(500).json({ 
                message: 'Erro ao conectar com a API externa' 
            });
        }
    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido:', error);
        res.status(500).json({ 
            message: 'Erro ao buscar detalhes do pedido. Por favor, tente novamente mais tarde.'
        });
    }
});

router.post('/nota-fiscal', autenticacaoRequerida, async (req, res) => {
    try {
        const { chaveacesso } = req.body;
        
        if (!chaveacesso) {
            return res.status(400).json({ 
                message: 'Chave de acesso não fornecida' 
            });
        }
        
        // Fazer a requisição para a API externa
        try {
            const apiResponse = await axios({
                method: 'post',
                url: 'https://192.168.0.251:8409/rest/VKPCLIPNF',
                auth: {
                    username: 'admin',
                    password: 'msmvk'
                },
                httpsAgent,
                data: {
                    chaveacesso: chaveacesso
                }
            });
            
            // Retornar os dados para o cliente
            res.json(apiResponse.data);
            
        } catch (apiError) {
            console.error('Erro na chamada da API externa para nota fiscal:', apiError);
            
            if (apiError.response) {
                return res.status(apiError.response.status).json({ 
                    message: 'Erro ao buscar nota fiscal na API externa',
                    error: apiError.response.data
                });
            }
            
            return res.status(500).json({ 
                message: 'Erro ao conectar com a API externa' 
            });
        }
    } catch (error) {
        console.error('Erro ao buscar nota fiscal:', error);
        res.status(500).json({ 
            message: 'Erro ao buscar nota fiscal. Por favor, tente novamente mais tarde.'
        });
    }
});

module.exports = router;