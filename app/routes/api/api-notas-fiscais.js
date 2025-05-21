/**
 * Rotas da API para consulta de notas fiscais
 */

const express = require('express');
const router = express.Router();
const { autenticacaoRequerida } = require('../../middlewares/auth');
const axios = require('axios');
const https = require('https');

// Configuração da API externa
const API_CONFIG = {
    // URLs da API externa
    URLS: {
        CONSULTA: 'https://192.168.0.251:8409/rest/VKPCLILNF',
        DOWNLOAD: 'https://192.168.0.251:8409/rest/VKPCLIPNF'
    },
    // Credenciais para autenticação
    AUTH: {
        username: 'admin',
        password: 'msmvk'
    }
};

// Agente HTTPS que ignora a validação de certificados SSL (para desenvolvimento)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false // Ignora erros de certificado SSL
});

// Rota para buscar notas fiscais
router.post('/', autenticacaoRequerida, async (req, res) => {
    try {
        const { Todos, CodigoCliente, Nota, Datade, Dataate } = req.body;
        
        console.log('Consultando notas fiscais para o cliente:', CodigoCliente);
        console.log('Parâmetros:', { Todos, Nota, Datade, Dataate });
        
        // Validar parâmetros obrigatórios
        if (!CodigoCliente) {
            return res.status(400).json({ 
                message: 'Código do cliente é obrigatório' 
            });
        }
        
        try {
            // Fazer a requisição para a API externa
            const apiResponse = await axios({
                method: 'post',
                url: API_CONFIG.URLS.CONSULTA,
                auth: API_CONFIG.AUTH,
                httpsAgent,
                data: {
                    Todos,
                    CodigoCliente,
                    Nota,
                    Datade,
                    Dataate
                }
            });
            
            console.log('Resposta da API externa:', apiResponse.data);
            
            // Retornar os dados para o cliente
            res.json(apiResponse.data);
            
        } catch (apiError) {
            console.error('Erro na chamada da API externa para notas fiscais:', apiError);
            
            if (apiError.response) {
                return res.status(apiError.response.status).json({ 
                    message: 'Erro ao buscar notas fiscais na API externa',
                    error: apiError.response.data
                });
            }
            
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
        
        // Fazer a requisição para a API externa
        try {
            const apiResponse = await axios({
                method: 'post',
                url: API_CONFIG.URLS.DOWNLOAD,
                auth: API_CONFIG.AUTH,
                httpsAgent,
                data: {
                    chaveacesso
                }
            });
            
            // Retornar os dados para o cliente
            res.json(apiResponse.data);
            
        } catch (apiError) {
            console.error('Erro na chamada da API externa para download de nota fiscal:', apiError);
            
            if (apiError.response) {
                return res.status(apiError.response.status).json({ 
                    message: 'Erro ao baixar nota fiscal na API externa',
                    error: apiError.response.data
                });
            }
            
            return res.status(500).json({ 
                message: 'Erro ao conectar com a API externa' 
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