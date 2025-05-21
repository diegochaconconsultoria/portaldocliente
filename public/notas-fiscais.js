// Script para corrigir o problema do popup
(function() {
    // Executar imediatamente ao carregar o script
    console.log("Script de correção executado");
    
    // Esconder todos os modais imediatamente
    var modais = document.querySelectorAll('.overlay-mensagem');
    for (var i = 0; i < modais.length; i++) {
        modais[i].style.display = 'none';  // Usar display:none para garantir
        modais[i].classList.add('hidden');
    }
    
    // Adicionar listener ao event DOMContentLoaded como backup
    document.addEventListener('DOMContentLoaded', function() {
        console.log("DOM carregado - escondendo modais novamente");
        var modais = document.querySelectorAll('.overlay-mensagem');
        for (var i = 0; i < modais.length; i++) {
            modais[i].style.display = 'none';
            modais[i].classList.add('hidden');
        }
    });
})();

// Fechar todos os modais no carregamento da página
window.onload = function() {
    console.log('onload: Fechando todos os modais');
    const modais = document.querySelectorAll('.overlay-mensagem');
    modais.forEach(function(modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    });
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('Carregando página de notas fiscais...');
    
    // Configuração inicial da página de notas fiscais
    inicializarPaginaNotas();
    
    // Garantir que os modais estão fechados no início
    document.querySelectorAll('.overlay-mensagem').forEach(function(modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    });
    
    // Atualizar data e hora no rodapé
    atualizarDataRodape();
    
    // Buscar informações do usuário
    fetchUserInfo();
});

function inicializarPaginaNotas() {
    console.log('Inicializando filtros da página de notas fiscais...');
    
    // Referências aos elementos do DOM com os IDs corretos
    const toggleTodos = document.getElementById('todosToggle');
    const dataInicio = document.getElementById('dataInicio');
    const dataFim = document.getElementById('dataFim');
    const numeroNota = document.getElementById('numeroNota');
    const btnBuscar = document.getElementById('buscarBtn');
    
    if (!toggleTodos || !dataInicio || !dataFim || !numeroNota || !btnBuscar) {
        console.error('Elementos do DOM não encontrados. Verifique se os IDs estão corretos no HTML.');
        return;
    }
    
    // Definir data de hoje como valor padrão para Data Até
    const hoje = new Date();
    dataFim.value = formatarData(hoje);
    
    // Definir data de 30 dias atrás como valor padrão para Data De
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    dataInicio.value = formatarData(trintaDiasAtras);
    
    // Evento de alteração no toggle "Todos"
    toggleTodos.addEventListener('change', function() {
        console.log('Toggle "Todos" alterado:', this.checked);
        const camposParaDesabilitar = [dataInicio, dataFim, numeroNota];
        
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
    btnBuscar.addEventListener('click', function(e) {
        e.preventDefault(); // Evitar comportamento padrão
        console.log('Botão Buscar clicado');
        buscarNotas();
    });
    
    // Evento para permitir busca ao pressionar Enter nos campos de filtro
    const camposFiltro = [dataInicio, dataFim, numeroNota];
    camposFiltro.forEach(campo => {
        campo.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                console.log('Enter pressionado no campo', this.id);
                e.preventDefault(); // Evitar o envio do formulário
                buscarNotas();
            }
        });
    });
    
    console.log('Filtros de notas fiscais inicializados com sucesso');
}

// Função para buscar notas com base nos filtros
async function buscarNotas() {
    console.log('Iniciando busca de notas fiscais...');
    
    const toggleTodos = document.getElementById('todosToggle');
    const dataInicio = document.getElementById('dataInicio');
    const dataFim = document.getElementById('dataFim');
    const numeroNota = document.getElementById('numeroNota');
    
    // Mostrar indicador de carregamento
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tabelaNotas = document.getElementById('tabelaNotas');
    const mensagemSemResultados = document.getElementById('mensagemSemResultados');
    
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    if (tabelaNotas) tabelaNotas.classList.add('hidden');
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
            Nota: numeroNota.value.trim() || "",
            Datade: !toggleTodos.checked && dataInicio.value ? converterDataParaAAAAMMDD(dataInicio.value) : "",
            Dataate: !toggleTodos.checked && dataFim.value ? converterDataParaAAAAMMDD(dataFim.value) : ""
        };
        
        console.log('Dados da requisição:', requestData);
        
        // Fazer requisição à API
        console.log('Enviando requisição POST para a API de notas fiscais');
        const response = await fetch('/api/notas-fiscais', {
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
            throw new Error(`Erro ao buscar notas fiscais: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Dados recebidos da API:', data);
        
        // Processar os dados conforme o formato da resposta
        if (data && data.success === true && data.Notas && data.Notas.length > 0) {
            // Verificar se não é a mensagem de "nota não encontrada"
            if (data.Notas[0].Numero !== "Nota nao encontrada") {
                console.log('Notas encontradas:', data.Notas.length);
                preencherTabelaNotas(data.Notas);
                if (tabelaNotas) tabelaNotas.classList.remove('hidden');
            } else {
                console.log('Resposta de nota não encontrada');
                if (mensagemSemResultados) mensagemSemResultados.classList.remove('hidden');
            }
        } else {
            console.log('Nenhuma nota encontrada ou success=false');
            if (mensagemSemResultados) mensagemSemResultados.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Erro ao buscar notas fiscais:', error);
        alert('Ocorreu um erro ao buscar as notas fiscais. Por favor, tente novamente.');
    } finally {
        // Esconder indicador de carregamento
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        console.log('Busca de notas fiscais finalizada');
    }
}
// Função para preencher a tabela com as notas fiscais retornadas
function preencherTabelaNotas(notas) {
    console.log('Preenchendo tabela com', notas.length, 'notas fiscais');
    const tabelaBody = document.getElementById('tabelaNotasBody');
    
    if (!tabelaBody) {
        console.error('Elemento tabelaNotasBody não encontrado');
        return;
    }
    
    tabelaBody.innerHTML = ''; // Limpa o conteúdo atual
    
    notas.forEach((nota, index) => {
        console.log(`Processando nota ${index+1}:`, nota);
        const row = document.createElement('tr');
        
        // Formatar data de emissão se necessário
        let dataEmissao = nota.Emissao || 'N/A';
        
        // Formatar valor da nota
        let valorFormatado = formatarMoeda(nota.ValorNF);
        
        // Criar células da linha
        row.innerHTML = `
            <td data-label="Número">${nota.Numero || 'N/A'}</td>
            <td data-label="Emissão">${dataEmissao}</td>
            <td data-label="Operação">${nota.Operacao || 'N/A'}</td>
            <td data-label="Valor">${valorFormatado}</td>
            <td data-label="Ações">
                <button type="button" class="btn-download" onclick="downloadNotaFiscal('${nota.chavenf}')">
                    Baixar NF
                </button>
            </td>
        `;
        
        tabelaBody.appendChild(row);
    });
    
    console.log('Tabela preenchida com sucesso');
}

// Função para fazer o download da Nota Fiscal
function downloadNotaFiscal(chaveNF) {
    if (!chaveNF) {
        alert('Chave de acesso não disponível. Não é possível baixar a nota fiscal.');
        return;
    }
    
    console.log('Iniciando download da nota fiscal com chave:', chaveNF);
    
    // Mostrar overlay de processamento
    document.getElementById('overlay-processando-nf').classList.remove('hidden');
    document.getElementById('overlay-processando-nf').style.display = 'flex';
    
    // Fazer a requisição para a API
    fetch('/api/notas-fiscais/download', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chaveacesso: chaveNF
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erro ao baixar nota fiscal: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data && data.PDF64) {
            console.log('PDF recebido em base64, iniciando download...');
            
            // Ocultar overlay de processamento
            document.getElementById('overlay-processando-nf').classList.add('hidden');
            document.getElementById('overlay-processando-nf').style.display = 'none';
            
            // Converter o base64 para um Blob
            const byteCharacters = atob(data.PDF64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            
            // Criar URL e link para download
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `NotaFiscal_${chaveNF.replace(/[^\d]/g, '')}.pdf`;
            document.body.appendChild(link);
            link.click();
            
            // Limpar
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
            
            // Mostrar overlay de sucesso
            document.getElementById('overlay-sucesso-nf').classList.remove('hidden');
            document.getElementById('overlay-sucesso-nf').style.display = 'flex';
            
            // Ocultar overlay de sucesso após alguns segundos
            setTimeout(() => {
                document.getElementById('overlay-sucesso-nf').classList.add('hidden');
                document.getElementById('overlay-sucesso-nf').style.display = 'none';
            }, 3000);
        } else {
            throw new Error('Formato de resposta inválido ou PDF não encontrado');
        }
    })
    .catch(error => {
        console.error('Erro ao baixar nota fiscal:', error);
        
        // Ocultar overlay de processamento
        document.getElementById('overlay-processando-nf').classList.add('hidden');
        document.getElementById('overlay-processando-nf').style.display = 'none';
        
        alert('Não foi possível baixar a nota fiscal. Por favor, tente novamente mais tarde.');
    });
}

// Função para converter data de YYYY-MM-DD para YYYYMMDD
function converterDataParaAAAAMMDD(dataString) {
    if (!dataString) return "";
    return dataString.replace(/-/g, '');
}

// Função para formatar valores monetários
// Função para formatar valores monetários
function formatarMoeda(valor) {
    if (valor === undefined || valor === null || valor === "Nota nao encontrada") return 'N/A';
    
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