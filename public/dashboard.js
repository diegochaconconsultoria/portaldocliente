document.addEventListener('DOMContentLoaded', function () {
    // Atualizar data e hora no rodapé
    const dataAtual = new Date();
    const dataFormatada = dataAtual.toLocaleDateString('pt-BR');
    const horaFormatada = dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    document.getElementById('lastUpdate').textContent = `${dataFormatada} - ${horaFormatada}`;

    // Buscar informações do usuário
    fetchUserInfo();

    // Configurar navegação do menu
    const menuLinks = document.querySelectorAll('.main-nav a');
    menuLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            const href = this.getAttribute('href');

            // Se o link for para o SAC ou outra página real, permitir a navegação normal
            if (href === '/sac' || (href.startsWith('/') && href !== '#')) {
                return; // Permite a navegação normal para páginas reais
            }

            // Para links de âncora ou outras seções, prevenir comportamento padrão
            e.preventDefault();

            // Remover classe 'active' de todos os itens
            menuLinks.forEach(item => {
                item.parentElement.classList.remove('active');
            });

            // Adicionar classe 'active' ao item clicado
            this.parentElement.classList.add('active');

            // Para seções não implementadas, mostrar mensagem
            if (href !== '#dashboard') {
                alert('Esta funcionalidade será implementada em breve!');
            }
        });
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

    document.getElementById('sidebarLogoutBtn').addEventListener('click', async function() {
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

            const userNameEl = document.getElementById('userName');
            if (userNameEl) {
                userNameEl.textContent = data.usuario.nome.split(' ')[0] || 'Usuário';
            }

            // Exibir nome do usuário no canto superior direito
            //document.getElementById('userName').textContent = data.usuario.nome.split(' ')[0] || 'Usuário';

            // Preencher informações do cliente no painel de boas-vindas
            document.getElementById('clientName').textContent = data.usuario.nome || 'N/A';
            document.getElementById('clientCode').textContent = data.usuario.codigo || 'N/A';
            document.getElementById('clientCnpj').textContent = data.usuario.cnpj || 'N/A';
            document.getElementById('clientEmail').textContent = data.usuario.email || 'N/A';

            // Salvar dados no localStorage para caso de perda de conexão
            const userData = {
                ...data.usuario,
                timestamp: new Date().getTime()
            };
            localStorage.setItem('usuarioPortal', JSON.stringify(userData));
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

                
                document.getElementById('clientName').textContent = userData.nome || 'N/A';
                document.getElementById('clientCode').textContent = userData.codigo || 'N/A';
                document.getElementById('clientCnpj').textContent = userData.cnpj || 'N/A';
                document.getElementById('clientEmail').textContent = userData.email || 'N/A';
                return;
            }
        }

        // Se não tiver dados válidos, redireciona para login
        alert('Sua sessão expirou ou ocorreu um erro. Por favor, faça login novamente.');
        window.location.href = '/';
    }
}