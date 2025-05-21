document.addEventListener('DOMContentLoaded', function () {
    console.log('Carregando página de detalhes do pedido...');

    // Atualizar data e hora no rodapé
    atualizarDataRodape();

    // Buscar informações do usuário
    fetchUserInfo();

    // Obter número do pedido da URL
    const urlParams = new URLSearchParams(window.location.search);
    const numeroPedido = urlParams.get('numero');

    if (!numeroPedido) {
        console.error('Número do pedido não encontrado na URL');
        mostrarMensagemErro('Pedido não especificado. Por favor, volte à lista de pedidos e tente novamente.');
        return;
    }

    const btnVisualizarProducao = document.getElementById('btnVisualizarProducao');
    if (btnVisualizarProducao) {
        console.log('Botão de visualizar produção encontrado!');
        btnVisualizarProducao.addEventListener('click', function() {
            console.log('Botão de visualizar produção clicado!');
            visualizarProducao(numeroPedido);
        });
    } else {
        console.error('Botão de visualizar produção não encontrado!');
    }
    

    // Exibir número do pedido no título
    document.getElementById('numeroPedido').textContent = numeroPedido;

    // Buscar detalhes do pedido
    buscarDetalhesPedido(numeroPedido);

    document.getElementById('btnVisualizarProducao').addEventListener('click', function() {
        const urlParams = new URLSearchParams(window.location.search);
        const numeroPedido = urlParams.get('numero');
        visualizarProducao(numeroPedido);
    });

    // Configurar botão de voltar
    document.getElementById('btnVoltar').addEventListener('click', function () {
        window.location.href = '/pedidos';
    });


    // Configurar evento de logout
    document.getElementById('logoutBtn').addEventListener('click', async function () {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST'
            });

            if (response.ok) {
                // Limpar dados locais
                localStorage.removeItem('usuarioPortal');
                // Redirecionar para a página de login
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
            alert('Ocorreu um erro ao tentar sair. Por favor, tente novamente.');
        }
    });
});

// Função para buscar detalhes do pedido
async function buscarDetalhesPedido(numeroPedido) {
    console.log('Buscando detalhes do pedido:', numeroPedido);

    // Elementos de interface
    const loadingIndicator = document.getElementById('loadingIndicator');
    const detalhesContent = document.getElementById('detalhesContent');
    const mensagemErro = document.getElementById('mensagemErro');

    try {
        // Fazer requisição à API
        const response = await fetch(`/api/pedidos/detalhes/${numeroPedido}`);

        if (!response.ok) {
            console.error('Erro ao buscar detalhes do pedido. Status:', response.status);
            throw new Error('Erro ao buscar detalhes do pedido');
        }

        const data = await response.json();
        console.log('Detalhes do pedido recebidos:', data);

        // Preencher os dados na interface
        preencherDetalhesPedido(data);

        // Mostrar conteúdo e esconder indicador de carregamento
        loadingIndicator.classList.add('hidden');
        detalhesContent.classList.remove('hidden');
        mensagemErro.classList.add('hidden');
    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido:', error);
        loadingIndicator.classList.add('hidden');
        detalhesContent.classList.add('hidden');
        mensagemErro.classList.remove('hidden');
    }
}

function preencherDetalhesPedido(dados) {
    // Informações básicas
    document.getElementById('proposta').textContent = dados.proposta || 'N/A';
    document.getElementById('valorTotal').textContent = formatarMoeda(dados.totalpedido);
    document.getElementById('transportadora').textContent = dados.transportadora || 'N/A';
    document.getElementById('tipoOperacao').textContent = dados.tipooperacao || 'N/A';
    document.getElementById('chaveAcesso').textContent = dados.chaveacesso || 'N/A';
    
    // Status do pedido
    if (dados.status && dados.status.length > 0) {
        const status = dados.status[0];
        
        atualizarStatusItem('conferido', status.conferido === 'Sim');
        atualizarStatusItem('producaoIniciada', status.producaoiniciada === 'Sim');
        atualizarStatusItem('producaoConcluida', status.Producaoconcluida === 'Sim');
        atualizarStatusItem('faturado', status.faturado === 'Sim');
        atualizarStatusItem('expedido', status.expedido === 'Sim');
        
        // Atualizar as linhas de conexão entre os status
        atualizarLinhasStatus();
        
        // Gerenciar o botão de visualizar produção
        const btnVisualizarProducao = document.getElementById('btnVisualizarProducao');
        if (btnVisualizarProducao) {
            // Sempre mostrar o botão, mas habilitar somente se produção já iniciada
            if (status.producaoiniciada === 'Sim' || status.Producaoconcluida === 'Sim' || 
                status.faturado === 'Sim' || status.expedido === 'Sim') {
                // Habilitar o botão para todos os estados a partir de produção iniciada
                btnVisualizarProducao.disabled = false;
                btnVisualizarProducao.classList.remove('disabled');
            } else {
                // Desabilitar o botão somente se a produção não foi iniciada
                btnVisualizarProducao.disabled = true;
                btnVisualizarProducao.classList.add('disabled');
            }
        } else {
            console.error('Botão de visualizar produção não encontrado na função preencherDetalhesPedido');
        }
    }
}


// Função para atualizar um item de status
function atualizarStatusItem(id, ativo) {
    const elemento = document.getElementById(`status-${id}`);
    if (elemento) {
        if (ativo) {
            elemento.classList.add('active');
        } else {
            elemento.classList.remove('active');
        }
    }
}

// Função para atualizar as linhas de conexão entre os status
function atualizarLinhasStatus() {
    const statusItems = document.querySelectorAll('.status-item');
    const statusLines = document.querySelectorAll('.status-line');

    // Para cada linha, verificar se os itens antes e depois estão ativos
    statusLines.forEach((line, index) => {
        if (statusItems[index].classList.contains('active') &&
            statusItems[index + 1].classList.contains('active')) {
            line.classList.add('active');
        } else {
            line.classList.remove('active');
        }
    });
}

// Função para formatar valores monetários
function formatarMoeda(valor) {
    if (valor === undefined || valor === null) return 'N/A';

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// Função para visualizar produção
// Adicione esta função ao código se ela ainda não existir
function visualizarProducao(numeroPedido) {
    if (!numeroPedido) {
        console.error("Número de pedido não especificado");
        return;
    }
    
    console.log('Visualizando produção do pedido:', numeroPedido);
    alert(`Visualização de produção para o pedido ${numeroPedido} em implementação.`);
}

// Função para mostrar mensagem de erro
function mostrarMensagemErro(mensagem) {
    const mensagemErro = document.getElementById('mensagemErro');
    mensagemErro.textContent = mensagem;
    mensagemErro.classList.remove('hidden');

    document.getElementById('loadingIndicator').classList.add('hidden');
    document.getElementById('detalhesContent').classList.add('hidden');
}

// Função para atualizar a data no rodapé
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