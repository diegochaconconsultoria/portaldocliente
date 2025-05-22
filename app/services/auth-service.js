/**
 * Serviço de autenticação para o Portal do Cliente
 */
const crypto = require('crypto');

// Simulação de database para armazenar tentativas de login
// Em produção, isso seria um banco de dados real
const loginAttempts = {};

// Limite de tentativas de login
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutos em milissegundos

// Políticas de senha
const SENHA_MIN_LENGTH = 8;
const SENHA_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Verificar se um CNPJ é válido
 * @param {string} cnpj - CNPJ a ser validado
 * @returns {boolean} - Se o CNPJ é válido
 */
function validarCNPJ(cnpj) {
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
 * Verificar se uma senha atende às políticas de segurança
 * @param {string} senha - Senha a ser validada
 * @returns {Object} - Resultado da validação com detalhes
 */
function validarSenha(senha) {
    if (!senha || senha.length < SENHA_MIN_LENGTH) {
        return {
            valido: false,
            mensagem: `A senha deve ter pelo menos ${SENHA_MIN_LENGTH} caracteres`
        };
    }

    if (!SENHA_REGEX.test(senha)) {
        return {
            valido: false,
            mensagem: 'A senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais'
        };
    }

    return { valido: true };
}

/**
 * Verificar se um usuário está bloqueado por excesso de tentativas
 * @param {string} identificador - Email ou CNPJ do usuário
 * @returns {Object} - Status do bloqueio e tempo restante
 */
function verificarBloqueio(identificador) {
    const tentativas = loginAttempts[identificador];
    
    if (!tentativas) {
        return { bloqueado: false };
    }
    
    if (tentativas.count >= MAX_LOGIN_ATTEMPTS && Date.now() - tentativas.timestamp < LOCKOUT_TIME) {
        const tempoRestante = Math.ceil((LOCKOUT_TIME - (Date.now() - tentativas.timestamp)) / 60000);
        return {
            bloqueado: true,
            tempoRestante
        };
    }
    
    // Se o tempo de bloqueio já passou, reiniciar contagem
    if (tentativas.count >= MAX_LOGIN_ATTEMPTS && Date.now() - tentativas.timestamp >= LOCKOUT_TIME) {
        loginAttempts[identificador] = { count: 0, timestamp: Date.now() };
        return { bloqueado: false };
    }
    
    return { bloqueado: false };
}

/**
 * Registrar uma tentativa de login
 * @param {string} identificador - Email ou CNPJ do usuário
 * @param {boolean} sucesso - Se o login foi bem-sucedido
 */
function registrarTentativaLogin(identificador, sucesso) {
    if (sucesso) {
        // Reset das tentativas em caso de sucesso
        loginAttempts[identificador] = { count: 0, timestamp: Date.now() };
        return;
    }
    
    if (!loginAttempts[identificador]) {
        loginAttempts[identificador] = { count: 1, timestamp: Date.now() };
    } else {
        loginAttempts[identificador].count += 1;
        loginAttempts[identificador].timestamp = Date.now();
    }
}

/**
 * Hash de senha com sal
 * @param {string} senha - Senha a ser hasheada
 * @returns {Object} - Hash e sal
 */
function hashSenha(senha) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(senha, salt, 1000, 64, 'sha512').toString('hex');
    
    return { hash, salt };
}

/**
 * Verificar senha
 * @param {string} senha - Senha a ser verificada
 * @param {string} hash - Hash armazenado
 * @param {string} salt - Sal armazenado
 * @returns {boolean} - Se a senha é válida
 */
function verificarSenha(senha, hash, salt) {
    const hashVerificar = crypto.pbkdf2Sync(senha, salt, 1000, 64, 'sha512').toString('hex');
    return hash === hashVerificar;
}

/**
 * Gerar tokens de autenticação com refresh token
 * @param {Object} usuario - Dados do usuário
 * @returns {Object} - Tokens gerados
 */
function gerarTokensAutenticacao(usuario) {
    // Token de acesso
    const accessToken = gerarToken(usuario);
    
    // Token de refresh com validade maior
    const refreshToken = crypto.randomBytes(40).toString('hex');
    
    return {
        accessToken,
        refreshToken
    };
}

module.exports = {
    validarCNPJ,
    validarSenha,
    verificarBloqueio,
    registrarTentativaLogin,
    hashSenha,
    verificarSenha,
    gerarTokensAutenticacao
};