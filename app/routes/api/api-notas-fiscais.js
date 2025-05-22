const express = require('express');
const router = express.Router();
const { autenticacaoRequerida } = require('../../middlewares/auth');
const apiProxy = require('../../services/api-proxy');

// Rota para buscar notas fiscais
router.post('/', autenticacaoRequerida, async (req, res) => {
    try {
        const { Todos, CodigoCliente, Nota, Datade, Dataate } = req.body;
        
        console.log('Consultando notas fiscais para o cliente:', CodigoCliente);
        
        // Validar parâmetros obrigatórios
        if (!CodigoCliente) {
            return res.status(400).json({ 
                message: 'Código do cliente é obrigatório' 
            });
        }
        
        // Preparar filtros
        const filtros = {
            Todos,
            CodigoCliente,
            Nota,
            Datade,
            Dataate
        };
        
        try {
            // Usar o proxy da API
            const responseData = await apiProxy.buscarNotasFiscais(filtros);
            
            console.log('Dados de notas fiscais obtidos com sucesso');
            
            // Retornar os dados para o cliente
            res.json(responseData);
            
        } catch (apiError) {
            console.error('Erro ao buscar notas fiscais via proxy:', apiError);
            
            // Simular resposta de "não encontrado" em caso de erro
            return res.json({ 
                success: false, 
                Notas: [
                    {
                        Numero: "Nota nao encontrada",         
                        ValorNF: "Nota nao encontrada",     
                        Emissao: "Nota nao encontrada",        
                        chavenf: "Nota nao encontrada",         
                        Operacao: "Nota nao encontrada"    
                    }
                ]
            });
        }
    } catch (error) {
        console.error('Erro ao buscar notas fiscais:', error);
        res.status(500).json({ 
            message: 'Erro ao buscar notas fiscais. Por favor, tente novamente mais tarde.'
        });
    }
});

// Rota para download de nota fiscal
router.post('/download', autenticacaoRequerida, async (req, res) => {
    try {
        const { chaveacesso } = req.body;
        
        if (!chaveacesso) {
            return res.status(400).json({ 
                message: 'Chave de acesso não fornecida' 
            });
        }
        
        try {
            // Usar o proxy da API
            const responseData = await apiProxy.downloadNotaFiscal(chaveacesso);
            
            console.log('Download de nota fiscal realizado com sucesso');
            
            // Retornar os dados para o cliente
            res.json(responseData);
            
        } catch (apiError) {
            console.error('Erro ao fazer download de nota fiscal via proxy:', apiError);
            
            return res.status(500).json({ 
                message: 'Erro ao baixar nota fiscal na API externa',
                error: 'Não foi possível baixar a nota fiscal solicitada'
            });
        }
    } catch (error) {
        console.error('Erro ao baixar nota fiscal:', error);
        res.status(500).json({ 
            message: 'Erro ao baixar nota fiscal. Por favor, tente novamente mais tarde.'
        });
    }
});

module.exports = router;