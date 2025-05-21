// Garantir que os overlays estejam ocultos no carregamento da página
document.addEventListener('DOMContentLoaded', function () {
    // Ocultar overlays de mensagens
    document.querySelectorAll('.overlay-mensagem').forEach(function (overlay) {
        overlay.classList.add('hidden');
    });
});

// Também ocultar no evento window.onload
window.onload = function () {
    // Ocultar overlays de mensagens
    document.querySelectorAll('.overlay-mensagem').forEach(function (overlay) {
        overlay.classList.add('hidden');
    });
};

// Script para corrigir o problema do popup
(function () {
    // Executar imediatamente ao carregar o script
    console.log("Script de correção executado");

    // Esconder todos os modais imediatamente
    var modais = document.querySelectorAll('.modal');
    for (var i = 0; i < modais.length; i++) {
        modais[i].style.display = 'none';  // Usar display:none para garantir
        modais[i].classList.add('hidden');
    }

    // Adicionar listener ao event DOMContentLoaded como backup
    document.addEventListener('DOMContentLoaded', function () {
        console.log("DOM carregado - escondendo modais novamente");
        var modais = document.querySelectorAll('.modal');
        for (var i = 0; i < modais.length; i++) {
            modais[i].style.display = 'none';
            modais[i].classList.add('hidden');
        }
    });
})();

// Função para navegação para a página de pedidos via menu
function navegarParaPedidos(event) {
    // Prevenir a navegação padrão
    event.preventDefault();

    // Verificar se já estamos na página de pedidos
    if (window.location.pathname === '/pedidos') {
        // Se já estamos na página de pedidos, apenas atualize a lista
        buscarPedidos();
        return false;
    } else {
        // Se não estamos na página de pedidos, navegar normalmente
        window.location.href = '/pedidos';
        return false;
    }
}

// Fechar todos os modais no carregamento da página
window.onload = function () {
    console.log('onload: Fechando todos os modais');
    const modais = document.querySelectorAll('.modal');
    modais.forEach(function (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    });

    // Buscar pedidos após um pequeno atraso
    setTimeout(function () {
        //buscarPedidos();
    }, 300);
};

document.addEventListener('DOMContentLoaded', function () {
    console.log('Carregando página de pedidos...');

    // Configuração inicial da página de pedidos
    inicializarPaginaPedidos();

    // Garantir que os modais estão fechados no início
    document.querySelectorAll('.modal').forEach(function (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    });

    // Atualizar data e hora no rodapé
    atualizarDataRodape();

    // Buscar informações do usuário
    fetchUserInfo();
});

function inicializarPaginaPedidos() {
    console.log('Inicializando filtros da página de pedidos...');

    // Referências aos elementos do DOM com os IDs corretos
    const toggleTodos = document.getElementById('todosToggle');
    const dataInicio = document.getElementById('dataInicio');
    const dataFim = document.getElementById('dataFim');
    const proposta = document.getElementById('proposta');
    const pedido = document.getElementById('pedido');
    const btnBuscar = document.getElementById('buscarBtn');

    if (!toggleTodos || !dataInicio || !dataFim || !proposta || !pedido || !btnBuscar) {
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
    toggleTodos.addEventListener('change', function () {
        console.log('Toggle "Todos" alterado:', this.checked);
        const camposParaDesabilitar = [dataInicio, dataFim, proposta, pedido];

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
        buscarPedidos();
    });

    // Evento para permitir busca ao pressionar Enter nos campos de filtro
    const camposFiltro = [dataInicio, dataFim, proposta, pedido];
    camposFiltro.forEach(campo => {
        campo.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                console.log('Enter pressionado no campo', this.id);
                e.preventDefault(); // Evitar o envio do formulário
                buscarPedidos();
            }
        });
    });

    // Configurar fechamento do modal ao clicar fora do conteúdo
    window.addEventListener('click', function (e) {
        document.querySelectorAll('.modal').forEach(function (modal) {
            if (e.target === modal) {
                fecharModalDetalhes();
            }
        });
    });

    // Configurar botões de fechar
    document.querySelectorAll('.btn-fechar, .btn-secundario').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            fecharModalDetalhes();
        });
    });

    console.log('Filtros de pedidos inicializados com sucesso');
}

// Função para buscar pedidos com base nos filtros
async function buscarPedidos() {
    console.log('Iniciando busca de pedidos...');

    // Garantir que os modais estão fechados
    fecharModalDetalhes();

    const toggleTodos = document.getElementById('todosToggle');
    const dataInicio = document.getElementById('dataInicio');
    const dataFim = document.getElementById('dataFim');
    const proposta = document.getElementById('proposta');
    const pedido = document.getElementById('pedido');

    // Mostrar indicador de carregamento
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tabelaPedidos = document.getElementById('tabelaPedidos');
    const mensagemSemResultados = document.getElementById('mensagemSemResultados');

    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    if (tabelaPedidos) tabelaPedidos.classList.add('hidden');
    if (mensagemSemResultados) mensagemSemResultados.classList.add('hidden');

    // Construir URL de consulta com parâmetros de filtro
    let url = '/api/pedidos?';
    url += `todos=${toggleTodos.checked}&`;

    if (!toggleTodos.checked) {
        if (dataInicio.value) url += `dataInicio=${dataInicio.value}&`;
        if (dataFim.value) url += `dataFim=${dataFim.value}&`;
        if (proposta.value.trim()) url += `proposta=${encodeURIComponent(proposta.value.trim())}&`;
        if (pedido.value.trim()) url += `pedido=${encodeURIComponent(pedido.value.trim())}&`;
    }

    url = url.endsWith('&') ? url.slice(0, -1) : url; // Remover & final se houver
    console.log('URL de consulta:', url);

    try {
        // Fazer requisição à API usando GET
        console.log('Enviando requisição GET para a API de pedidos');
        const response = await fetch(url);

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
            throw new Error(`Erro ao buscar pedidos: ${response.status}`);
        }

        const data = await response.json();
        console.log('Dados recebidos da API:', data);

        // Processar os dados conforme o formato da resposta
        if (data && data.success === true && data.pedido && data.pedido.length > 0) {
            // Verificar se não é a mensagem de "pedido não encontrado"
            if (data.pedido[0].Numero !== "pedido nao encontrado") {
                console.log('Pedidos encontrados:', data.pedido.length);
                preencherTabelaPedidos(data.pedido);
                if (tabelaPedidos) tabelaPedidos.classList.remove('hidden');
            } else {
                console.log('Resposta de pedido não encontrado');
                if (mensagemSemResultados) mensagemSemResultados.classList.remove('hidden');
            }
        } else {
            console.log('Nenhum pedido encontrado ou success=false');
            if (mensagemSemResultados) mensagemSemResultados.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
        alert('Ocorreu um erro ao buscar os pedidos. Por favor, tente novamente.');
    } finally {
        // Esconder indicador de carregamento
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        console.log('Busca de pedidos finalizada');
    }
}

// Função para preencher a tabela com os pedidos retornados
function preencherTabelaPedidos(pedidos) {
    console.log('Preenchendo tabela com', pedidos.length, 'pedidos');
    const tabelaBody = document.getElementById('tabelaPedidosBody');

    if (!tabelaBody) {
        console.error('Elemento tabelaPedidosBody não encontrado');
        return;
    }

    tabelaBody.innerHTML = ''; // Limpa o conteúdo atual

    pedidos.forEach((pedido, index) => {
        console.log(`Processando pedido ${index + 1}:`, pedido);
        const row = document.createElement('tr');

        // As datas já estão vindo no formato DD/MM/YYYY, então apenas usamos diretamente
        let dataFormatada = pedido.Data || 'N/A';

        // Criar células da linha adaptadas ao formato de dados
        row.innerHTML = `
    <td data-label="Número">${pedido.Numero || 'N/A'}</td>
    <td data-label="Proposta">${pedido.Proposta || 'N/A'}</td>
    <td data-label="Data">${dataFormatada}</td>
    <td data-label="Operação">${pedido.Operacao || 'N/A'}</td>
    <td data-label="Ações">
        <button type="button" class="btn-detalhes" onclick="verDetalhesPedido('${pedido.Numero}')">
            Detalhes
        </button>
    </td>
        `;

        tabelaBody.appendChild(row);
    });

    console.log('Tabela preenchida com sucesso');
}

// Função para visualizar detalhes de um pedido específico
function verDetalhesPedido(numeroPedido) {
    if (!numeroPedido) {
        console.error("Número de pedido não especificado");
        return;
    }

    console.log('Abrindo detalhes do pedido:', numeroPedido);

    // Verificar se estamos tentando abrir o modal para um número de pedido válido
    if (numeroPedido === 'undefined' || numeroPedido === 'null' || numeroPedido === '') {
        console.error("Tentativa de abrir modal com número de pedido inválido");
        return;
    }

    // Mostrar o modal de carregamento
    var modalLoading = document.getElementById('modalLoading');
    if (modalLoading) {
        modalLoading.style.display = 'flex';
        modalLoading.classList.remove('hidden');
    }

    // Buscar detalhes do pedido
    fetch(`/api/pedidos/detalhes/${numeroPedido}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao buscar detalhes do pedido');
            }
            return response.json();
        })
        .then(data => {
            console.log('Detalhes do pedido recebidos:', data);

            // Preencher os dados no modal
            preencherDetalhesModal(data, numeroPedido);

            // Ocultar o modal de carregamento e mostrar o modal de detalhes
            if (modalLoading) {
                modalLoading.style.display = 'none';
                modalLoading.classList.add('hidden');
            }

            var modalDetalhes = document.getElementById('modalDetalhes');
            if (modalDetalhes) {
                modalDetalhes.style.display = 'flex';
                modalDetalhes.classList.remove('hidden');
            }
        })
        .catch(error => {
            console.error('Erro ao buscar detalhes do pedido:', error);

            // Ocultar o modal de carregamento e mostrar mensagem de erro
            if (modalLoading) {
                modalLoading.style.display = 'none';
                modalLoading.classList.add('hidden');
            }

            alert('Não foi possível carregar os detalhes do pedido. Por favor, tente novamente.');
        });
}

function preencherDetalhesModal(dados, numeroPedido) {
    // Informações básicas
    var elementos = {
        numeroPedido: document.getElementById('detalhe-numeroPedido'),
        proposta: document.getElementById('detalhe-proposta'),
        valorTotal: document.getElementById('detalhe-valorTotal'),
        transportadora: document.getElementById('detalhe-transportadora'),
        tipoOperacao: document.getElementById('detalhe-tipoOperacao'),
        chaveAcesso: document.getElementById('detalhe-chaveAcesso')
    };

    // Definir valores, verificando se os elementos existem
    if (elementos.numeroPedido) elementos.numeroPedido.textContent = numeroPedido;
    if (elementos.proposta) elementos.proposta.textContent = dados.proposta || 'N/A';
    if (elementos.valorTotal) elementos.valorTotal.textContent = formatarMoeda(dados.totalpedido);
    if (elementos.transportadora) elementos.transportadora.textContent = dados.transportadora || 'N/A';
    if (elementos.tipoOperacao) elementos.tipoOperacao.textContent = dados.tipooperacao || 'N/A';
    if (elementos.chaveAcesso) elementos.chaveAcesso.textContent = dados.chaveacesso || 'N/A';

    // Armazenar a chave de acesso para uso posterior no download
    chaveAcessoAtual = dados.chaveacesso || '';

    // Verificar se a OP foi gerada
    const opGerada = dados.Op === "OPGERADA";
    console.log('Status da OP:', dados.Op, 'OP Gerada:', opGerada);

    // Verificar se temos link de montagem
    const btnRelatorioMontagem = document.getElementById('btn-relatorio-montagem');
    if (btnRelatorioMontagem) {
        if (dados.LinkMontagem && dados.LinkMontagem.trim() !== '') {
            // Armazenar link para uso no evento de clique
            btnRelatorioMontagem.setAttribute('data-link', dados.LinkMontagem);
            // Mostrar o botão
            btnRelatorioMontagem.classList.remove('hidden');
        } else {
            // Esconder o botão se não houver link
            btnRelatorioMontagem.classList.add('hidden');
        }
    }
    
    // Adicionar verificação para botão Visualizar Produção
    const btnVisualizarProducao = document.getElementById('btn-visualizar-producao');
    if (btnVisualizarProducao) {
        // Verificar condições para mostrar o botão
        if (dados.status && dados.status.length > 0) {
            const status = dados.status[0];
            const producaoIniciada = status.producaoiniciada === 'Sim';
            
            if (producaoIniciada && opGerada) {
                btnVisualizarProducao.classList.remove('hidden');
                // Armazenar número do pedido para uso na função de visualização
                btnVisualizarProducao.setAttribute('data-pedido', numeroPedido);
            } else {
                btnVisualizarProducao.classList.add('hidden');
            }
        } else {
            btnVisualizarProducao.classList.add('hidden');
        }
    }

    // Status do pedido
    if (dados.status && dados.status.length > 0) {
        const status = dados.status[0];

        // Verificar se a produção foi iniciada
        const producaoIniciada = status.producaoiniciada === 'Sim';
        console.log('Produção iniciada:', producaoIniciada);

        atualizarStatusItem('conferido', status.conferido === 'Sim');
        atualizarStatusItem('producaoIniciada', producaoIniciada);
        atualizarStatusItem('producaoConcluida', status.Producaoconcluida === 'Sim');
        atualizarStatusItem('faturado', status.faturado === 'Sim');
        atualizarStatusItem('expedido', status.expedido === 'Sim');

        // Exibir ou ocultar o botão de download da Nota Fiscal
        const btnDownloadNF = document.getElementById('btn-download-nf');
        if (btnDownloadNF) {
            if (status.faturado === 'Sim') {
                btnDownloadNF.classList.remove('hidden');
            } else {
                btnDownloadNF.classList.add('hidden');
            }
        }

        // Atualizar as linhas de conexão entre os status
        atualizarLinhasStatus();
    }
}

// Função para visualizar o relatório de entrega e montagem
function visualizarRelatorioMontagem() {
    const btnRelatorioMontagem = document.getElementById('btn-relatorio-montagem');
    if (btnRelatorioMontagem) {
        const link = btnRelatorioMontagem.getAttribute('data-link');
        if (link) {
            // Abrir o link em uma nova aba
            window.open(link, '_blank');
        } else {
            console.error('Link de relatório de montagem não encontrado');
        }
    }
}

// Função para fazer o download da Nota Fiscal
function downloadNotaFiscal() {
    if (!chaveAcessoAtual) {
        alert('Chave de acesso não disponível. Não é possível baixar a nota fiscal.');
        return;
    }

    console.log('Iniciando download da nota fiscal com chave:', chaveAcessoAtual);

    // Mostrar overlay de processamento
    document.getElementById('overlay-processando-nf').classList.remove('hidden');

    // Fazer a requisição para a API
    fetch('/api/pedidos/nota-fiscal', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chaveacesso: chaveAcessoAtual
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
                link.download = `NotaFiscal_${chaveAcessoAtual.replace(/[^\d]/g, '')}.pdf`;
                document.body.appendChild(link);
                link.click();

                // Limpar
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 100);

                // Mostrar overlay de sucesso
                document.getElementById('overlay-sucesso-nf').classList.remove('hidden');

                // Ocultar overlay de sucesso após alguns segundos
                setTimeout(() => {
                    document.getElementById('overlay-sucesso-nf').classList.add('hidden');
                }, 3000);
            } else {
                throw new Error('Formato de resposta inválido ou PDF não encontrado');
            }
        })
        .catch(error => {
            console.error('Erro ao baixar nota fiscal:', error);

            // Ocultar overlay de processamento
            document.getElementById('overlay-processando-nf').classList.add('hidden');

            alert('Não foi possível baixar a nota fiscal. Por favor, tente novamente mais tarde.');
        });
}

// Função para atualizar um item de status
// Função atualizada para tornar o status "Produção Iniciada" clicável
function atualizarStatusItem(id, ativo) {
    const elemento = document.getElementById(`status-${id}`);
    if (elemento) {
        if (ativo) {
            elemento.classList.add('active');
        } else {
            elemento.classList.remove('active');
            elemento.classList.remove('clickable'); // Remover a classe clickable se existir
        }
    }
}

// Função para mostrar modal de carregamento
function mostrarModalCarregamento(mensagem) {
    // Verificar se o modal já existe
    let modalCarregamento = document.getElementById('modalCarregamentoProducao');

    if (!modalCarregamento) {
        // Criar o modal de carregamento se não existir
        modalCarregamento = document.createElement('div');
        modalCarregamento.id = 'modalCarregamentoProducao';
        modalCarregamento.className = 'modal';
        modalCarregamento.style.display = 'flex';

        modalCarregamento.innerHTML = `
            <div class="modal-content modal-loading">
                <div class="loading-spinner"></div>
                <p>${mensagem || 'Carregando...'}</p>
            </div>
        `;

        document.body.appendChild(modalCarregamento);
    } else {
        // Atualizar mensagem e exibir o modal existente
        const msgElement = modalCarregamento.querySelector('p');
        if (msgElement) msgElement.textContent = mensagem || 'Carregando...';

        modalCarregamento.style.display = 'flex';
        modalCarregamento.classList.remove('hidden');
    }
}

// Função para esconder modal de carregamento
function esconderModalCarregamento() {
    const modalCarregamento = document.getElementById('modalCarregamentoProducao');
    if (modalCarregamento) {
        modalCarregamento.style.display = 'none';
        modalCarregamento.classList.add('hidden');
    }
}

// Função para mostrar modal com dados de produção incluindo gráfico geral
function mostrarModalProducao(produtos, numeroPedido) {
    // Verificar se o modal já existe e removê-lo se for o caso
    let modalProducao = document.getElementById('modalProducao');
    if (modalProducao) {
        document.body.removeChild(modalProducao);
    }

    // Criar o modal
    modalProducao = document.createElement('div');
    modalProducao.id = 'modalProducao';
    modalProducao.className = 'modal';
    modalProducao.style.display = 'flex';

    // Calcular porcentagem geral
    let totalOrdens = 0;
    let totalProduzido = 0;

    produtos.forEach(produto => {
        totalOrdens += parseInt(produto.TotalOrdens) || 0;
        totalProduzido += parseInt(produto.TotalProd) || 0;
    });

    const porcentagemGeral = totalOrdens > 0 ? Math.round((totalProduzido / totalOrdens) * 100) : 0;

    // Determinar a cor com base na porcentagem geral
    let corGeral = '#dc3545'; // Vermelho para baixo progresso
    if (porcentagemGeral >= 50 && porcentagemGeral < 75) {
        corGeral = '#ffc107'; // Amarelo para progresso médio
    } else if (porcentagemGeral >= 75) {
        corGeral = '#28a745'; // Verde para bom progresso
    }

    // Gerar conteúdo HTML para os produtos
    let produtosHTML = '';

    produtos.forEach(produto => {
        // Determinar a cor da barra com base na porcentagem
        let corBarra = '#dc3545'; // Vermelho para baixo progresso
        if (produto.Porcentagem >= 50 && produto.Porcentagem < 75) {
            corBarra = '#ffc107'; // Amarelo para progresso médio
        } else if (produto.Porcentagem >= 75) {
            corBarra = '#28a745'; // Verde para bom progresso
        }

        produtosHTML += `
            <div class="produto-item">
                <div class="produto-header">
                    <div class="produto-info">
                        <h4>${produto.Produto} - Item ${produto.Item}</h4>
                        <p>${produto.Descricao}</p>
                    </div>
                    <div class="produto-qtd">
                        <span>Qtde: ${produto.Qtdvenda} ${produto.Unidade}</span>
                    </div>
                </div>
                <div class="progresso-container">
                    <div class="progresso-info">
                        <span class="porcentagem">${produto.Porcentagem}%</span>
                    </div>
                    <div class="progresso-barra-container">
                        <div class="progresso-barra" style="width: ${produto.Porcentagem}%; background-color: ${corBarra}"></div>
                    </div>
                </div>
            </div>
        `;
    });

    // Estrutura completa do modal
    modalProducao.innerHTML = `
        <div class="modal-content modal-producao">
            <div class="modal-header">
                <h3>Detalhes da Produção - Pedido ${numeroPedido}</h3>
                <button class="btn-fechar" onclick="fecharModalProducao()">&times;</button>
            </div>
            
            <div class="resumo-producao">
                <div class="grafico-geral-container">
                    <canvas id="graficoGeral" width="150" height="150"></canvas>
                </div>
                <div class="info-geral">
                    <h4>Progresso Geral</h4>
                    <div class="estatisticas">
                        <div class="estatistica-item">
                            <span class="estatistica-label">Total de Itens:</span>
                            <span class="estatistica-valor">${produtos.length}</span>
                        </div>
                        <div class="estatistica-item">
                            <span class="estatistica-label">Componentes Produzidos:</span>
                            <span class="estatistica-valor">${totalProduzido} de ${totalOrdens}</span>
                        </div>
                        <div class="estatistica-item">
                            <span class="estatistica-label">Conclusão:</span>
                            <span class="estatistica-valor porcentagem-geral">${porcentagemGeral}%</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="separador"></div>
            
            <div class="modal-body">
                <h4 class="secao-titulo">Detalhes por Produto</h4>
                <div class="produtos-container">
                    ${produtosHTML}
                </div>
            </div>
            
            <div class="modal-footer">
                <button class="btn-secundario" onclick="fecharModalProducao()">Fechar</button>
            </div>
        </div>
    `;

    // Adicionar o modal ao documento
    document.body.appendChild(modalProducao);

    // Adicionar função global para fechar o modal
    window.fecharModalProducao = function () {
        const modal = document.getElementById('modalProducao');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }
    };

    // Fechar modal ao clicar fora do conteúdo
    modalProducao.addEventListener('click', function (e) {
        if (e.target === modalProducao) {
            fecharModalProducao();
        }
    });

    // Importar Chart.js e inicializar o gráfico
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = function () {
        // Inicializar gráfico após o carregamento do Chart.js
        const ctx = document.getElementById('graficoGeral').getContext('2d');

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Concluído', 'Pendente'],
                datasets: [{
                    data: [porcentagemGeral, 100 - porcentagemGeral],
                    backgroundColor: [corGeral, '#e9ecef'],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '70%',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: function (context) {
                                return context.label + ': ' + context.raw + '%';
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true
                }
            }
        });

        // Adicionar texto percentual no centro do gráfico
        Chart.register({
            id: 'centerText',
            afterDraw: function (chart) {
                const width = chart.width;
                const height = chart.height;
                const ctx = chart.ctx;

                ctx.restore();
                const fontSize = (height / 114).toFixed(2);
                ctx.font = fontSize + 'em sans-serif';
                ctx.textBaseline = 'middle';

                const text = porcentagemGeral + '%';
                const textX = Math.round((width - ctx.measureText(text).width) / 2);
                const textY = height / 2;

                ctx.fillStyle = corGeral;
                ctx.fillText(text, textX, textY);
                ctx.save();
            }
        });
    };

    document.body.appendChild(script);
}

function visualizarProducao(numeroPedido) {
    if (!numeroPedido) {
        console.error("Número de pedido não especificado");
        return;
    }

    console.log('Visualizando produção do pedido:', numeroPedido);

    // Mostrar um modal de carregamento
    mostrarModalCarregamento('Carregando dados de produção...');

    // Configuração para a requisição com Basic Auth
    const headers = new Headers();
    headers.append('Authorization', 'Basic ' + btoa('admin:msmvk'));
    headers.append('Content-Type', 'application/json');

    // Corpo da requisição
    const requestBody = JSON.stringify({
        "Pedido": numeroPedido
    });

    // Realizar a requisição
    fetch('https://192.168.0.251:8409/rest/VKPCDETPRD', {
        method: 'POST',
        headers: headers,
        body: requestBody
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao buscar dados de produção: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados de produção recebidos:', data);

            // Ocultar modal de carregamento
            esconderModalCarregamento();

            // Mostrar os dados no modal
            if (data.success && data.Produtos && data.Produtos.length > 0) {
                mostrarModalProducao(data.Produtos, numeroPedido);
            } else {
                alert('Nenhum dado de produção encontrado para este pedido.');
            }
        })
        .catch(error => {
            console.error('Erro ao buscar dados de produção:', error);

            // Ocultar modal de carregamento
            esconderModalCarregamento();

            alert('Não foi possível carregar os dados de produção. Por favor, tente novamente mais tarde.');
        });
}

// Função para atualizar as linhas de conexão entre os status
function atualizarLinhasStatus() {
    const statusItems = document.querySelectorAll('.status-item');
    const statusLines = document.querySelectorAll('.status-line');

    // Para cada linha, verificar se os itens antes e depois estão ativos
    for (let i = 0; i < statusLines.length; i++) {
        const line = statusLines[i];
        if (i < statusItems.length - 1 &&
            statusItems[i].classList.contains('active') &&
            statusItems[i + 1].classList.contains('active')) {
            line.classList.add('active');
        } else {
            line.classList.remove('active');
        }
    }
}


// Função para fechar o modal de detalhes
function fecharModalDetalhes() {
    console.log("Fechando todos os modais");
    var modais = document.querySelectorAll('.modal');
    modais.forEach(function (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
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

// Função para mostrar mensagem de sucesso
function mostrarMensagemSucesso(mensagem) {
    // Verificar se já existe uma mensagem de sucesso e remover
    const mensagemExistente = document.querySelector('.mensagem-sucesso-nf');
    if (mensagemExistente) {
        mensagemExistente.remove();
    }

    // Criar elemento da mensagem
    const mensagemDiv = document.createElement('div');
    mensagemDiv.className = 'mensagem-sucesso-nf';
    mensagemDiv.innerHTML = `
        <div class="icone-sucesso">✓</div>
        <div class="texto-sucesso">${mensagem}</div>
    `;

    // Adicionar ao modal
    const modalFooter = document.querySelector('.modal-footer');
    if (modalFooter) {
        modalFooter.appendChild(mensagemDiv);
    } else {
        // Caso não encontre o footer, adicionar ao corpo do modal
        const modalBody = document.querySelector('.modal-body');
        if (modalBody) {
            modalBody.appendChild(mensagemDiv);
        }
    }

    // Remover a mensagem após alguns segundos
    setTimeout(() => {
        mensagemDiv.classList.add('fade-out');
        setTimeout(() => {
            mensagemDiv.remove();
        }, 500);
    }, 3000);
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

