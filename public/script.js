document.addEventListener('DOMContentLoaded', function() {
    // Adiciona a máscara para o campo CNPJ
    const cnpjInput = document.getElementById('cnpj');
    if (cnpjInput) {
        cnpjInput.addEventListener('input', function(e) {
            let value = e.target.value;
            
            // Remove todos os caracteres não numéricos
            value = value.replace(/\D/g, '');
            
            // Adiciona a formatação do CNPJ
            if (value.length <= 14) {
                value = value.replace(/^(\d{2})(\d)/, '$1.$2');
                value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
                value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
                value = value.replace(/(\d{4})(\d)/, '$1-$2');
            }
            
            e.target.value = value;
        });
    }

 // Função para animação de transição
function showLoginTransition() {
    // Criar a tela de transição dinamicamente
    const transitionScreen = document.createElement('div');
    transitionScreen.id = 'transition-screen';
    transitionScreen.style.position = 'fixed';
    transitionScreen.style.top = '0';
    transitionScreen.style.left = '0';
    transitionScreen.style.width = '100%';
    transitionScreen.style.height = '100%';
    transitionScreen.style.backgroundColor = '#131313';
    transitionScreen.style.zIndex = '9999';
    transitionScreen.style.display = 'flex';
    transitionScreen.style.flexDirection = 'column';
    transitionScreen.style.justifyContent = 'center';
    transitionScreen.style.alignItems = 'center';
    
    // Fase 1: Aniversário - apenas imagem em tela cheia
    const anniversaryPhase = document.createElement('div');
    anniversaryPhase.id = 'anniversary-phase';
    anniversaryPhase.style.textAlign = 'center';
    anniversaryPhase.style.width = '100%';
    anniversaryPhase.style.height = '100%';
    anniversaryPhase.style.display = 'flex';
    anniversaryPhase.style.justifyContent = 'center';
    anniversaryPhase.style.alignItems = 'center';
    anniversaryPhase.style.overflow = 'hidden';
    
    // Imagem com efeito de fade-in e zoom
    anniversaryPhase.innerHTML = `
        <img src="30anos.png" alt="30 Anos MVK" style="
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
            opacity: 0;
            transform: scale(0.95);
            transition: opacity 1s ease-in-out, transform 1.5s ease-in-out;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            border-radius: 8px;
        " id="aniversarioImg">
    `;
    
    // Fase 2: Carregamento
    const loadingPhase = document.createElement('div');
    loadingPhase.id = 'loading-phase';
    loadingPhase.style.display = 'none';
    loadingPhase.style.textAlign = 'center';
    loadingPhase.style.padding = '20px';
    loadingPhase.style.maxWidth = '400px';
    
    loadingPhase.innerHTML = `
        <img src="logo.png" alt="Logo MVK" style="width: 180px; height: auto;">
        <h2 style="color: #ffffff; margin: 20px 0 10px;">Bem-vindo ao Portal do Cliente</h2>
        <p style="color: #aaaaaa; margin-bottom: 25px;">Carregando seu ambiente personalizado...</p>
        <div style="margin: 0 auto; width: 50px; height: 50px; border: 5px solid rgba(216, 24, 62, 0.2); border-radius: 50%; border-top-color: #d8183e; animation: spin 1s linear infinite;"></div>
    `;
    
    // Adicionar estilos para a animação
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    
    // Adicionar elementos à página
    document.head.appendChild(style);
    transitionScreen.appendChild(anniversaryPhase);
    transitionScreen.appendChild(loadingPhase);
    document.body.appendChild(transitionScreen);
    
    // Executar a sequência de animação
    setTimeout(function() {
        // Aplicar efeito de fade-in e zoom à imagem
        const img = document.getElementById('aniversarioImg');
        if (img) {
            img.style.opacity = '1';
            img.style.transform = 'scale(1)';
        }
        
        // Após 3 segundos, passar para a fase de carregamento
        setTimeout(function() {
            anniversaryPhase.style.opacity = '0';
            anniversaryPhase.style.transition = 'opacity 0.7s ease-out';
            
            setTimeout(function() {
                anniversaryPhase.style.display = 'none';
                loadingPhase.style.display = 'block';
                
                // Após 2 segundos na fase de carregamento, redirecionar
                setTimeout(function() {
                    window.location.href = '/dashboard';
                }, 2000);
            }, 700);
        }, 3000);
    }, 100);
}

    // Manipula o envio do formulário de login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const cnpj = document.getElementById('cnpj').value;
            const password = document.getElementById('password').value;
            
            // Mostrar feedback de carregamento
            const btnSubmit = document.querySelector('.btn-login');
            const btnTexto = btnSubmit.textContent;
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Autenticando...';
            
            // Adicionando uma div para mensagens de erro
            let msgDiv = document.querySelector('.error-message');
            if (!msgDiv) {
                msgDiv = document.createElement('div');
                msgDiv.className = 'error-message';
                loginForm.appendChild(msgDiv);
            }
            msgDiv.textContent = '';
            msgDiv.style.display = 'none';
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, cnpj, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Armazenar dados no localStorage para uso nas telas subsequentes
                    localStorage.setItem('usuarioPortal', JSON.stringify({
                        nome: data.usuario.nome,
                        codigo: data.usuario.codigo,
                        cnpj: cnpj,
                        timestamp: new Date().getTime()
                    }));
                    
                    // Iniciar a animação de transição
                    showLoginTransition();
                    
                    // Não redirecionar - a função de transição fará isso
                    return;
                } else {
                    // Mostrar mensagem de erro
                    msgDiv.textContent = data.message || 'Falha no login. Verifique suas credenciais.';
                    msgDiv.style.display = 'block';
                    
                    // Restaurar botão
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = btnTexto;
                }
            } catch (error) {
                console.error('Erro ao fazer login:', error);
                
                // Mostrar mensagem de erro
                msgDiv.textContent = 'Ocorreu um erro ao tentar fazer login. Tente novamente.';
                msgDiv.style.display = 'block';
                
                // Restaurar botão
                btnSubmit.disabled = false;
                btnSubmit.textContent = btnTexto;
            }
        });
    }
});