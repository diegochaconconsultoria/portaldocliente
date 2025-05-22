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
                // Usar o sistema de limpeza segura de dados
                if (window.clearSecureData) {
                    window.clearSecureData();
                } else {
                    // Fallback para limpeza tradicional
                    localStorage.removeItem('usuarioPortal');
                }
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
                // Usar o sistema de limpeza segura de dados
                if (window.clearSecureData) {
                    window.clearSecureData();
                } else {
                    localStorage.removeItem('usuarioPortal');
                }
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
            alert('Ocorreu um erro ao tentar sair. Por favor, tente novamente.');
        }
    });
});

// Função para buscar informações do usuário com proteção de dados
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

            // Usar mascaramento seguro para dados sensíveis
            const clientName = document.getElementById('clientName');
            const clientCode = document.getElementById('clientCode');
            const clientCnpj = document.getElementById('clientCnpj');
            const clientEmail = document.getElementById('clientEmail');

            if (clientName) clientName.textContent = data.usuario.nome || 'N/A';
            if (clientCode) clientCode.textContent = data.usuario.codigo || 'N/A';
            
            // Aplicar mascaramento para CNPJ e Email
            if (clientCnpj) {
                const maskedCnpj = window.maskData ? 
                    window.maskData(data.usuario.cnpj, 'cnpj') : 
                    '**.***.***/****-**';
                clientCnpj.textContent = maskedCnpj;
            }
            
            if (clientEmail) {
                const maskedEmail = window.maskData ? 
                    window.maskData(data.usuario.email, 'email') : 
                    '*****@*****.***';
                clientEmail.textContent = maskedEmail;
            }

            // Armazenar dados de forma segura
            if (window.secureStore) {
                await window.secureStore({
                    nome: data.usuario.nome,
                    codigo: data.usuario.codigo,
                    // Não armazenar CNPJ nem email completo
                    timestamp: new Date().getTime()
                });
            } else {
                // Fallback para armazenamento tradicional (sem dados sensíveis)
                const userData = {
                    nome: data.usuario.nome.split(' ')[0], // Apenas primeiro nome
                    codigo: data.usuario.codigo,
                    timestamp: new Date().getTime()
                };
                localStorage.setItem('usuarioPortal', JSON.stringify(userData));
            }
        }
    } catch (error) {
        console.error('Erro ao buscar informações do usuário:', error);

        // Tentar recuperar dados de forma segura
        let userData = null;
        
        if (window.secureRetrieve) {
            userData = await window.secureRetrieve();
        } else {
            // Fallback para localStorage tradicional
            const localData = localStorage.getItem('usuarioPortal');
            if (localData) {
                try {
                    userData = JSON.parse(localData);
                } catch (e) {
                    console.error('Erro ao processar dados locais:', e);
                }
            }
        }

        if (userData) {
            const now = new Date().getTime();
            if (userData.timestamp && (now - userData.timestamp < 3600000)) {
                const userNameEl = document.getElementById('userName');
                if (userNameEl) {
                    userNameEl.textContent = userData.nome || 'Usuário';
                }

                // Aplicar dados mascarados aos elementos da página
                const clientName = document.getElementById('clientName');
                const clientCode = document.getElementById('clientCode');
                const clientCnpj = document.getElementById('clientCnpj');
                const clientEmail = document.getElementById('clientEmail');

                if (clientName) clientName.textContent = userData.nome || 'N/A';
                if (clientCode) clientCode.textContent = userData.codigo || 'N/A';
                if (clientCnpj) clientCnpj.textContent = '**.***.***/****-**';
                if (clientEmail) clientEmail.textContent = '*****@*****.***';
                
                return;
            }
        }

        // Se não tiver dados válidos ou estiverem expirados
        alert('Sua sessão expirou ou ocorreu um erro. Por favor, faça login novamente.');
        
        // Limpar dados sensíveis antes de redirecionar
        if (window.clearSecureData) {
            window.clearSecureData();
        }
        
        window.location.href = '/';
    }
}