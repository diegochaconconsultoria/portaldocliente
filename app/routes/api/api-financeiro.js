const express = require('express');
const router = express.Router();
const { autenticacaoRequerida } = require('../../middlewares/auth');
const apiProxy = require('../../services/api-proxy');

// Rota para buscar posição financeira
router.post('/', autenticacaoRequerida, async (req, res) => {
    try {
        const { Todos, CodigoCliente, Status, DataDe, DataAte } = req.body;
        
        console.log('Consultando posição financeira para o cliente:', CodigoCliente);
        
        // Preparar filtros
        const filtros = {
            Todos,
            CodigoCliente,
            Status,
            DataDe,
            DataAte
        };
        
        try {
            // Usar o proxy da API
            const responseData = await apiProxy.buscarPosicaoFinanceira(filtros);
            
            console.log('Dados de posição financeira obtidos com sucesso');
            
            // Retornar os dados para o cliente
            res.json(responseData);
            
        } catch (apiError) {
            console.error('Erro ao buscar posição financeira via proxy:', apiError);
            
            // Simular resposta de "não encontrado" em caso de erro
            return res.json({
                success: false,
                Titulos: [
                    {
                        NumeroTitulo: "Titulos Nao Encontrados",
                        Parcela: "Titulos Nao Encontrados",
                        Emissao: "Titulos Nao Encontrados",
                        Vencimento: "Titulos Nao Encontrados",
                        Valor: "Titulos Nao Encontrados",
                        ValorPago: "Titulos Nao Encontrados",
                        Saldo: "Titulos Nao Encontrados"
                    }
                ]
            });
        }
    } catch (error) {
        console.error('Erro ao buscar posição financeira:', error);
        res.status(500).json({ 
            message: 'Erro ao buscar posição financeira. Por favor, tente novamente mais tarde.'
        });
    }
});

module.exports = router;