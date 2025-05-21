document.addEventListener('DOMContentLoaded', function () {
    console.log('Carregando página de posição financeira...');

    // Configuração inicial da página financeira
    inicializarPaginaFinanceira();

    // Atualizar data e hora no rodapé
    atualizarDataRodape();

    // Buscar informações do usuário
    fetchUserInfo();
});

function inicializarPaginaFinanceira() {
    console.log('Inicializando filtros da página financeira...');

    // Referências aos elementos do DOM com os IDs corretos
    const toggleTodos = document.getElementById('todosToggle');
    const statusSelect = document.getElementById('statusSelect');
    const dataVencimentoDe = document.getElementById('dataVencimentoDe');
    const dataVencimentoAte = document.getElementById('dataVencimentoAte');
    const btnBuscar = document.getElementById('buscarBtn');

    if (!toggleTodos || !statusSelect || !dataVencimentoDe || !dataVencimentoAte || !btnBuscar) {
        console.error('Elementos do DOM não encontrados. Verifique se os IDs estão corretos no HTML.');
        return;
    }

    // Definir data de hoje como valor padrão para Data Até
    const hoje = new Date();
    dataVencimentoAte.value = formatarData(hoje);

    // Definir data de 30 dias atrás como valor padrão para Data De
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    dataVencimentoDe.value = formatarData(trintaDiasAtras);

    // Evento de alteração no toggle "Todos"
    toggleTodos.addEventListener('change', function () {
        console.log('Toggle "Todos" alterado:', this.checked);
        const camposParaDesabilitar = [dataVencimentoDe, dataVencimentoAte, statusSelect];

        // Se o toggle estiver ligado (Sim), desabilita os campos
        if (this.checked) {
            camposParaDesabilitar.forEach(campo => {
                campo.disabled = true;
            });
        } else {
            // Se estiver desligado (Não), habilita os campos
            camposParaDesabilitar.forEach(campo => {
                campo.disabled = false;
            });
        }
    });

    // Evento de click no botão Buscar
    btnBuscar.addEventListener('click', function (e) {
        e.preventDefault(); // Evitar comportamento padrão
        console.log('Botão Buscar clicado');
        buscarTitulos();
    });

    // Evento para permitir busca ao pressionar Enter nos campos de filtro
    const camposFiltro = [dataVencimentoDe, dataVencimentoAte];
    camposFiltro.forEach(campo => {
        campo.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                console.log('Enter pressionado no campo', this.id);
                e.preventDefault(); // Evitar o envio do formulário
                buscarTitulos();
            }
        });
    });

    console.log('Filtros da página financeira inicializados com sucesso');
}

// Função para buscar títulos com base nos filtros
async function buscarTitulos() {
    console.log('Iniciando busca de títulos financeiros...');

    const toggleTodos = document.getElementById('todosToggle');
    const statusSelect = document.getElementById('statusSelect');
    const dataVencimentoDe = document.getElementById('dataVencimentoDe');
    const dataVencimentoAte = document.getElementById('dataVencimentoAte');

    // Mostrar indicador de carregamento
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tabelaTitulos = document.getElementById('tabelaTitulos');
    const totalizadores = document.getElementById('totalizadores');
    const mensagemSemResultados = document.getElementById('mensagemSemResultados');

    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    if (tabelaTitulos) tabelaTitulos.classList.add('hidden');
    if (totalizadores) totalizadores.classList.add('hidden');
    if (mensagemSemResultados) mensagemSemResultados.classList.add('hidden');

    try {
        // Obter informações do usuário logado
        const userResponse = await fetch('/api/usuario');
        if (!userResponse.ok) {
            throw new Error('Erro ao obter informações do usuário');
        }

        const userData = await userResponse.json();
        const codigoCliente = userData.usuario.codigo;

        // Construir os dados da requisição
        const requestData = {
            Todos: toggleTodos.checked ? "Sim" : "Nao",
            CodigoCliente: codigoCliente,
            Status: statusSelect.value,
            DataDe: !toggleTodos.checked && dataVencimentoDe.value ? converterDataParaAAAAMMDD(dataVencimentoDe.value) : "",
            DataAte: !toggleTodos.checked && dataVencimentoAte.value ? converterDataParaAAAAMMDD(dataVencimentoAte.value) : ""
        };

        console.log('Dados da requisição:', requestData);

        // Fazer requisição à API
        console.log('Enviando requisição POST para a API financeira');
        const response = await fetch('/api/financeiro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        console.log('Status da resposta:', response.status);

        if (!response.ok) {
            // Se a resposta não for 2xx
            if (response.status === 401) {
                console.error('Erro 401: Não autorizado');
                alert('Sua sessão expirou. Por favor, faça login novamente.');
                window.location.href = '/';
                return;
            }

            const errorText = await response.text();
            console.error('Texto do erro:', errorText);
            throw new Error(`Erro ao buscar títulos financeiros: ${response.status}`);
        }

        const data = await response.json();
        console.log('Dados recebidos da API:', data);

        // Processar os dados conforme o formato da resposta
        if (data && data.success === true && data.Titulos && data.Titulos.length > 0) {
            // Verificar se não é a mensagem de "títulos não encontrados"
            if (data.Titulos[0].NumeroTitulo !== "Titulos Nao Encontrados") {
                console.log('Títulos encontrados:', data.Titulos.length);
                preencherTabelaTitulos(data.Titulos);
                atualizarTotalizadores(data.Titulos);
                if (tabelaTitulos) tabelaTitulos.classList.remove('hidden');
                if (totalizadores) totalizadores.classList.remove('hidden');
            } else {
                console.log('Resposta de títulos não encontrados');
                if (mensagemSemResultados) mensagemSemResultados.classList.remove('hidden');
            }
        } else {
            console.log('Nenhum título encontrado ou success=false');
            if (mensagemSemResultados) mensagemSemResultados.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Erro ao buscar títulos financeiros:', error);
        alert('Ocorreu um erro ao buscar os títulos financeiros. Por favor, tente novamente.');
    } finally {
        // Esconder indicador de carregamento
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        console.log('Busca de títulos financeiros finalizada');
    }
}

function obterDadosClienteLogado() {
    // Para diagnóstico
    console.log('Tentando obter dados do cliente logado...');

    // Dados do cliente
    let dadosCliente = {
        nome: '',
        cnpj: '',
        codigo: ''
    };

    // 1. Verificar elementos na página
    const nomeElement = document.getElementById('clientName');
    const cnpjElement = document.getElementById('clientCnpj');
    const codigoElement = document.getElementById('clientCode');

    if (nomeElement) {
        dadosCliente.nome = nomeElement.textContent.trim();
        console.log('Nome encontrado na página:', dadosCliente.nome);
    }

    if (cnpjElement) {
        dadosCliente.cnpj = cnpjElement.textContent.trim();
        console.log('CNPJ encontrado na página:', dadosCliente.cnpj);
    }

    if (codigoElement) {
        dadosCliente.codigo = codigoElement.textContent.trim();
        console.log('Código encontrado na página:', dadosCliente.codigo);
    }

    // 2. Verificar no localStorage
    console.log('Verificando localStorage...');
    const localData = localStorage.getItem('usuarioPortal');
    if (localData) {
        try {
            const userData = JSON.parse(localData);
            console.log('Dados encontrados no localStorage:', userData);

            // Preencher os campos que ainda estão vazios
            if (!dadosCliente.nome && userData.nome) dadosCliente.nome = userData.nome;
            if (!dadosCliente.cnpj && userData.cnpj) dadosCliente.cnpj = userData.cnpj;
            if (!dadosCliente.codigo && userData.codigo) dadosCliente.codigo = userData.codigo;
        } catch (e) {
            console.error('Erro ao obter dados do cliente do localStorage:', e);
        }
    } else {
        console.log('Nenhum dado encontrado no localStorage');
    }

    // Resultado final
    console.log('Dados finais do cliente:', dadosCliente);
    return dadosCliente;
}

// Função para preencher a tabela com os títulos retornados
function preencherTabelaTitulos(titulos) {
    console.log('Preenchendo tabela com', titulos.length, 'títulos');
    const tabelaBody = document.getElementById('tabelaTitulosBody');

    if (!tabelaBody) {
        console.error('Elemento tabelaTitulosBody não encontrado');
        return;
    }

    tabelaBody.innerHTML = ''; // Limpa o conteúdo atual

    const numeroWhatsapp = "5514997782644"; // Formato: código do país + DDD + número
    //Obter informações do cliente logado
    const dadosCliente = obterDadosClienteLogado();
    const nomeCliente = dadosCliente.nome || '';
    const cnpjCliente = dadosCliente.cnpj || '';
    const codigoCliente = dadosCliente.codigo || '';

    titulos.forEach((titulo, index) => {
        console.log(`Processando título ${index + 1}:`, titulo);
        const row = document.createElement('tr');

        // Formatar datas de emissão e vencimento
        let dataEmissao = formatarDataExibicao(titulo.Emissao);
        let dataVencimento = formatarDataExibicao(titulo.Vencimento);

        // Formatar valores monetários
        let valorFormatado = formatarMoeda(titulo.Valor);
        let valorPagoFormatado = formatarMoeda(titulo.ValorPago);
        let saldoFormatado = formatarMoeda(titulo.Saldo);

        // Determinar classes para destaque de status
        const hoje = new Date();
        const dataVenc = parseDataAAAAMMDD(titulo.Vencimento);
        let classeVencimento = '';

        if (titulo.ValorPago >= titulo.Valor) {
            classeVencimento = 'pago';
        } else if (dataVenc < hoje) {
            classeVencimento = 'vencido';
        } else {
            classeVencimento = 'a-vencer';
        }

        let mostrarBotaoWhatsapp = true;

        // Não mostrar para títulos vencidos com saldo > 0
        if (dataVenc < hoje && parseFloat(titulo.Saldo) > 0) {
            mostrarBotaoWhatsapp = false;
        }

        // Não mostrar para títulos com saldo = 0
        if (parseFloat(titulo.Saldo) === 0) {
            mostrarBotaoWhatsapp = false;
        }

        // Criar mensagem para o WhatsApp
        // Criar mensagem para o WhatsApp com o formato solicitado
        const mensagemWhatsapp = encodeURIComponent(
            `Ola,\n` +
            `Gostaria da segunda via do Boleto do Título ${titulo.NumeroTitulo || 'N/A'}\n` +
            `Parcela ${titulo.Parcela || 'N/A'}\n` +
            `Vencimento ${dataVencimento}\n\n` +
            `Nome: ${nomeCliente}\n` +
            `CNPJ: ${cnpjCliente}\n` +
            `Codigo do Cliente: ${codigoCliente}`
        );

        const urlWhatsapp = `https://api.whatsapp.com/send?phone=${numeroWhatsapp}&text=${mensagemWhatsapp}`;

        /*
        // Criar células da linha
        row.innerHTML = `
        <td>${titulo.NumeroTitulo || 'N/A'}</td>
        <td>${titulo.Parcela || 'N/A'}</td>
        <td>${dataEmissao}</td>
        <td class="${classeVencimento}">${dataVencimento}</td>
        <td>${valorFormatado}</td>
        <td>${valorPagoFormatado}</td>
        <td class="${classeVencimento}">
            ${saldoFormatado}
            <a href="${urlWhatsapp}" target="_blank" class="btn-whatsapp" title="Solicitar 2ª via por WhatsApp">
                <i class="icon-whatsapp">📱</i> WhatsApp
            </a>
        </td>
    `;*/

        // Criar células da linha
        let conteudoCelula = `
<td>${titulo.NumeroTitulo || 'N/A'}</td>
<td>${titulo.Parcela || 'N/A'}</td>
<td>${dataEmissao}</td>
<td class="${classeVencimento}">${dataVencimento}</td>
<td>${valorFormatado}</td>
<td>${valorPagoFormatado}</td>
<td class="${classeVencimento}">
    ${saldoFormatado}
`;

        if (mostrarBotaoWhatsapp) {
            // Criar mensagem para o WhatsApp com o formato solicitado
            const mensagemWhatsapp = encodeURIComponent(
                `Ola,\n` +
                `Gostaria da segunda via do Boleto do Título ${titulo.NumeroTitulo || 'N/A'}\n` +
                `Parcela ${titulo.Parcela || 'N/A'}\n` +
                `Vencimento ${dataVencimento}\n\n` +
                `Nome: ${nomeCliente}\n` +
                `CNPJ: ${cnpjCliente}\n` +
                `Codigo do Cliente: ${codigoCliente}`
            );

            const urlWhatsapp = `https://api.whatsapp.com/send?phone=${numeroWhatsapp}&text=${mensagemWhatsapp}`;

            // Adicionar o botão com o novo título
            conteudoCelula += `
        <a href="${urlWhatsapp}" target="_blank" class="btn-whatsapp" title="Solicitar 2ª via por WhatsApp">
            <i class="icon-whatsapp">📱</i> 2ª Via Boleto
        </a>
    `;
        }

        conteudoCelula += `</td>`;

        row.innerHTML = conteudoCelula;

        tabelaBody.appendChild(row);
    });

    console.log('Tabela preenchida com sucesso');
}

// Função para atualizar os totalizadores
function atualizarTotalizadores(titulos) {
    const totalTitulos = document.getElementById('totalTitulos');
    const valorTotal = document.getElementById('valorTotal');
    const valorPago = document.getElementById('valorPago');
    const saldoDevedor = document.getElementById('saldoDevedor');

    if (!totalTitulos || !valorTotal || !valorPago || !saldoDevedor) {
        console.error('Elementos dos totalizadores não encontrados');
        return;
    }

    // Calcular totais
    const total = titulos.reduce((sum, titulo) => sum + parseFloat(titulo.Valor || 0), 0);
    const pago = titulos.reduce((sum, titulo) => sum + parseFloat(titulo.ValorPago || 0), 0);
    const saldo = titulos.reduce((sum, titulo) => sum + parseFloat(titulo.Saldo || 0), 0);

    // Atualizar elementos na tela
    totalTitulos.textContent = titulos.length;
    valorTotal.textContent = formatarMoeda(total);
    valorPago.textContent = formatarMoeda(pago);
    saldoDevedor.textContent = formatarMoeda(saldo);
}

// Função para converter data de YYYY-MM-DD para YYYYMMDD
function converterDataParaAAAAMMDD(dataString) {
    if (!dataString) return "";
    return dataString.replace(/-/g, '');
}

// Função para formatar data no formato YYYYMMDD para exibição como DD/MM/YYYY
function formatarDataExibicao(dataAAAAMMDD) {
    if (!dataAAAAMMDD || dataAAAAMMDD === "Titulos Nao Encontrados") return 'N/A';

    try {
        const ano = dataAAAAMMDD.substring(0, 4);
        const mes = dataAAAAMMDD.substring(4, 6);
        const dia = dataAAAAMMDD.substring(6, 8);
        return `${dia}/${mes}/${ano}`;
    } catch (e) {
        console.error('Erro ao formatar data:', e);
        return dataAAAAMMDD; // Retorna o valor original em caso de erro
    }
}

// Função para converter data no formato YYYYMMDD para objeto Date
function parseDataAAAAMMDD(dataAAAAMMDD) {
    if (!dataAAAAMMDD || dataAAAAMMDD === "Titulos Nao Encontrados") return null;

    try {
        const ano = parseInt(dataAAAAMMDD.substring(0, 4));
        const mes = parseInt(dataAAAAMMDD.substring(4, 6)) - 1; // Meses em JS são de 0-11
        const dia = parseInt(dataAAAAMMDD.substring(6, 8));
        return new Date(ano, mes, dia);
    } catch (e) {
        console.error('Erro ao converter data:', e);
        return null;
    }
}

// Função para formatar valores monetários
function formatarMoeda(valor) {
    if (valor === undefined || valor === null || valor === "Titulos Nao Encontrados") return 'N/A';

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// Funções auxiliares
function formatarData(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function atualizarDataRodape() {
    const dataAtual = new Date();
    const dataFormatada = dataAtual.toLocaleDateString('pt-BR');
    const horaFormatada = dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const elementoLastUpdate = document.getElementById('lastUpdate');
    if (elementoLastUpdate) {
        elementoLastUpdate.textContent = `${dataFormatada} - ${horaFormatada}`;
    }
}



// Função para buscar informações do usuário
async function fetchUserInfo() {
    try {
        const response = await fetch('/api/usuario');

        // Se a resposta não for ok, redireciona para login
        if (!response.ok) {
            window.location.href = '/';
            return;
        }

        const data = await response.json();

        // Exibir informações do usuário na página
        if (data.usuario) {
            // Exibir nome do usuário no canto superior direito
            const userNameEl = document.getElementById('userName');
            document.getElementById('clientCnpj').textContent = userData.cnpj;
            if (userNameEl) {
                userNameEl.textContent = data.usuario.nome.split(' ')[0] || 'Usuário';
            }
        }
    } catch (error) {
        console.error('Erro ao buscar informações do usuário:', error);

        // Verificar se temos dados no localStorage como fallback
        const localData = localStorage.getItem('usuarioPortal');
        if (localData) {
            const userData = JSON.parse(localData);

            // Verificar se os dados não estão expirados (1 hora)
            const now = new Date().getTime();
            if (userData.timestamp && (now - userData.timestamp < 3600000)) {
                const userNameEl = document.getElementById('userName');
                if (userNameEl) {
                    userNameEl.textContent = userData.nome.split(' ')[0] || 'Usuário';
                }
                return;
            }
        }

        // Se não tiver dados válidos, redireciona para login
        alert('Sua sessão expirou ou ocorreu um erro. Por favor, faça login novamente.');
        window.location.href = '/';
    }
}