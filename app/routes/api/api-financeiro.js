/**
 * Rotas da API para consulta de posição financeira
 */

const express = require('express');
const router = express.Router();
const { autenticacaoRequerida } = require('../../middlewares/auth');
const axios = require('axios');
const https = require('https');

// Configuração da API externa
const API_CONFIG = {
    // URL da API externa
    URL: 'https://192.168.0.251:8409/rest/VKPCLIDFIN',
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

// Rota para buscar posição financeira
router.post('/', autenticacaoRequerida, async (req, res) => {
    try {
        const { Todos, CodigoCliente, Status, DataDe, DataAte } = req.body;
        
        // Obter o código do cliente da sessão
        //const codigoCliente = req.session.usuario.codigo;
        
        //console.log('Consultando posição financeira para o cliente:', codigoCliente);
        //console.log('Parâmetros:', { Todos, CodigoCliente, Status, DataDe, DataAte });
        
        try {
            // Fazer a requisição para a API externa
            const apiResponse = await axios({
                method: 'post',
                url: API_CONFIG.URL,
                auth: API_CONFIG.AUTH,
                httpsAgent,
                data: {
                    Todos,
                    CodigoCliente,
                    Status,
                    DataDe,
                    DataAte
                }
            });
            
            console.log('Resposta da API externa:', apiResponse.data);
            
            // Retornar os dados para o cliente
            res.json(apiResponse.data);
            
        } catch (apiError) {
            console.error('Erro na chamada da API externa para posição financeira:', apiError);
            
            if (apiError.response) {
                return res.status(apiError.response.status).json({ 
                    message: 'Erro ao buscar posição financeira na API externa',
                    error: apiError.response.data
                });
            }
            
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