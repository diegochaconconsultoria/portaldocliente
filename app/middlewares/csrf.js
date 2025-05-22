/**
 * Middleware para proteção contra CSRF
 */
const csurf = require('csurf');

// Configuração do middleware csurf
const csrfProtection = csurf({
    cookie: {
        key: '_csrf', // Nome do cookie
        httpOnly: true, // Não acessível via JavaScript
        secure: process.env.NODE_ENV === 'production', // Apenas HTTPS em produção
        sameSite: 'strict', // Prevenção contra CSRF
        maxAge: 3600 // 1 hora em segundos
    }
});

// Middleware para gerar e verificar tokens CSRF
const protecaoCSRF = (req, res, next) => {
    // Métodos que não precisam de verificação CSRF
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return csrfProtection(req, res, next);
    }
    
    // Verificar token CSRF para métodos que podem modificar dados
    return csrfProtection(req, res, (err) => {
        if (err) {
            console.error('Erro CSRF:', err);
            return res.status(403).json({
                message: 'Falha na validação de segurança',
                error: 'Token de segurança inválido ou expirado',
                code: 'CSRF_ERROR'
            });
        }
        next();
    });
};

// Middleware para fornecer o token CSRF
const obterTokenCSRF = (req, res) => {
    return res.json({
        token: req.csrfToken()
    });
};

module.exports = {
    protecaoCSRF,
    obterTokenCSRF
};