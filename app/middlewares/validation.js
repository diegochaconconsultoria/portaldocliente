/**
 * Middleware para validação de entrada
 */
const validator = require('validator');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// Configurar DOMPurify
const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
 * Sanitizar objetos recursivamente
 * @param {any} obj - Objeto a ser sanitizado
 * @returns {any} - Objeto sanitizado
 */
function sanitizeObject(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (typeof obj === 'string') {
        return purify.sanitize(obj);
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    
    if (typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = sanitizeObject(obj[key]);
            }
        }
        return result;
    }
    
    return obj;
}

/**
 * Validar CNPJ completo
 * @param {string} cnpj - CNPJ a ser validado
 * @returns {boolean} - Se o CNPJ é válido
 */
function validarCNPJ(cnpj) {
    // Remove caracteres não numéricos
    cnpj = cnpj.replace(/[^\d]+/g, '');

    if (cnpj.length !== 14) return false;

    // Elimina CNPJs inválidos conhecidos
    if (
        cnpj === "00000000000000" ||
        cnpj === "11111111111111" ||
        cnpj === "22222222222222" ||
        cnpj === "33333333333333" ||
        cnpj === "44444444444444" ||
        cnpj === "55555555555555" ||
        cnpj === "66666666666666" ||
        cnpj === "77777777777777" ||
        cnpj === "88888888888888" ||
        cnpj === "99999999999999"
    )
        return false;

    // Valida DVs
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    const digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }

    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado.toString() !== digitos.charAt(0)) return false;

    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }

    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado.toString() !== digitos.charAt(1)) return false;

    return true;
}

/**
 * Validar email
 * @param {string} email - Email a ser validado
 * @returns {boolean} - Se o email é válido
 */
function validarEmail(email) {
    return validator.isEmail(email);
}

/**
 * Validar data no formato YYYY-MM-DD
 * @param {string} data - Data a ser validada
 * @returns {boolean} - Se a data é válida
 */
function validarData(data) {
    return validator.isDate(data, { format: 'YYYY-MM-DD' });
}

/**
 * Middleware para sanitizar entradas
 */
function sanitizarEntradas(req, res, next) {
    // Sanitizar body
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    
    // Sanitizar query params
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    
    // Sanitizar params
    if (req.params) {
        req.params = sanitizeObject(req.params);
    }
    
    next();
}

// Validação específica para dados de login
function validarLogin(req, res, next) {
    const { email, cnpj, password } = req.body;
    
    const erros = [];
    
    // Validar campos obrigatórios
    if (!email) erros.push('Email é obrigatório');
    if (!cnpj) erros.push('CNPJ é obrigatório');
    if (!password) erros.push('Senha é obrigatória');
    
    // Validar formato de email
    if (email && !validarEmail(email)) erros.push('Email em formato inválido');
    
    // Validar CNPJ
    if (cnpj) {
        const cnpjNumerico = cnpj.replace(/[^\d]+/g, '');
        if (!validarCNPJ(cnpjNumerico)) erros.push('CNPJ inválido');
    }
    
    // Se houver erros, retornar resposta de erro
    if (erros.length > 0) {
        return res.status(400).json({
            message: 'Dados de entrada inválidos',
            erros
        });
    }
    
    next();
}

// Validação específica para filtros de pedidos
function validarFiltroPedidos(req, res, next) {
    const { dataInicio, dataFim, proposta, pedido } = req.query;
    
    const erros = [];
    
    // Validar datas se fornecidas
    if (dataInicio && !validarData(dataInicio)) erros.push('Data inicial em formato inválido');
    if (dataFim && !validarData(dataFim)) erros.push('Data final em formato inválido');
    
    // Validar tamanho dos campos
    if (proposta && proposta.length > 20) erros.push('Número da proposta excede o tamanho máximo');
    if (pedido && pedido.length > 20) erros.push('Número do pedido excede o tamanho máximo');
    
    // Se houver erros, retornar resposta de erro
    if (erros.length > 0) {
        return res.status(400).json({
            message: 'Filtros inválidos',
            erros
        });
    }
    
    next();
}

// Validação específica para filtros de notas fiscais
function validarFiltroNotas(req, res, next) {
    const { Todos, CodigoCliente, Nota, Datade, Dataate } = req.body;
    
    const erros = [];
    
    // Validar campos obrigatórios
    if (CodigoCliente === undefined) erros.push('Código do cliente é obrigatório');
    
    // Validar datas se fornecidas e se não for "Todos"
    if (Todos !== "Sim") {
        if (Datade && !/^\d{8}$/.test(Datade)) erros.push('Data inicial em formato inválido');
        if (Dataate && !/^\d{8}$/.test(Dataate)) erros.push('Data final em formato inválido');
    }
    
    // Validar tamanho dos campos
    if (Nota && Nota.length > 20) erros.push('Número da nota excede o tamanho máximo');
    
    // Se houver erros, retornar resposta de erro
    if (erros.length > 0) {
        return res.status(400).json({
            message: 'Filtros inválidos',
            erros
        });
    }
    
    next();
}

module.exports = {
    sanitizarEntradas,
    validarLogin,
    validarFiltroPedidos,
    validarFiltroNotas
};