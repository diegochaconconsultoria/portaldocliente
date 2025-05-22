const express = require('express');
const router = express.Router();
const { autenticacaoRequerida } = require('../../middlewares/auth');
const apiProxy = require('../../services/api-proxy');

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
        
        // Preparar os dados para enviar para a API externa
        const filtros = {
            CodigoCliente: codigoCliente,
            Todos: todos === 'true' ? 'Sim' : 'Nao',
            Datainicio: dataInicio ? converterDataParaAAAAMMDD(dataInicio) : '',
            Datafim: dataFim ? converterDataParaAAAAMMDD(dataFim) : '',
            Proposta: proposta || '',
            Pedido: pedido || ''
        };
        
        try {
            // Usar o proxy da API
            const responseData = await apiProxy.buscarPedidos(filtros);
            
            console.log('Dados de pedidos obtidos com sucesso');
            
            // Enviar a resposta para o cliente
            res.json(responseData);
            
        } catch (apiError) {
            console.error('Erro ao buscar pedidos via proxy:', apiError);
            
            // Retornar resposta de erro padronizada
            const errorResponse = {
                success: false,
                pedido: [{
                    Numero: "pedido nao encontrado",
                    Proposta: "pedido nao encontrado",
                    Data: "pedido nao encontrado",
                    Operacao: "pedido nao encontrado"
                }]
            };
            
            res.json(errorResponse);
        }
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
        res.status(500).json({ 
            message: 'Erro ao buscar pedidos. Por favor, tente novamente mais tarde.',
            success: false
        });
    }
});

// Rota para buscar detalhes de um pedido específico
router.get('/detalhes/:numero', autenticacaoRequerida, async (req, res) => {
    try {
        const numeroPedido = req.params.numero;
        
        console.log(`Consultando detalhes do pedido ${numeroPedido}`);
        
        try {
            // Usar o proxy da API
            const responseData = await apiProxy.buscarDetalhesPedido(numeroPedido);
            
            console.log('Detalhes do pedido obtidos com sucesso');
            
            // Enviar a resposta para o cliente
            res.json(responseData);
            
        } catch (apiError) {
            console.error('Erro ao buscar detalhes do pedido via proxy:', apiError);
            
            return res.status(500).json({ 
                message: 'Erro ao buscar detalhes do pedido',
                error: 'Não foi possível obter os detalhes do pedido solicitado'
            });
        }
    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido:', error);
        res.status(500).json({ 
            message: 'Erro ao buscar detalhes do pedido. Por favor, tente novamente mais tarde.'
        });
    }
});

// Rota para download de nota fiscal
router.post('/nota-fiscal', autenticacaoRequerida, async (req, res) => {
    try {
        const { chaveacesso } = req.body;
        
        if (!chaveacesso) {
            return res.status(400).json({ 
                message: 'Chave de acesso é obrigatória' 
            });
        }
        
        try {
            // Usar o proxy da API
            const responseData = await apiProxy.downloadNotaFiscal(chaveacesso);
            
            if (responseData && responseData.PDF64) {
                res.json({
                    PDF64: responseData.PDF64,
                    success: true
                });
            } else {
                throw new Error('Dados de PDF não encontrados na resposta');
            }
            
        } catch (apiError) {
            console.error('Erro ao baixar nota fiscal via proxy:', apiError);
            
            return res.status(500).json({ 
                message: 'Erro ao buscar nota fiscal',
                error: 'Não foi possível obter a nota fiscal solicitada'
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