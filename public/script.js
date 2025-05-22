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

    // Função para animação de transição com proteção de dados
    function showLoginTransition() {
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
        
        // Fase 1: Aniversário
        const anniversaryPhase = document.createElement('div');
        anniversaryPhase.id = 'anniversary-phase';
        anniversaryPhase.style.textAlign = 'center';
        anniversaryPhase.style.width = '100%';
        anniversaryPhase.style.height = '100%';
        anniversaryPhase.style.display = 'flex';
        anniversaryPhase.style.justifyContent = 'center';
        anniversaryPhase.style.alignItems = 'center';
        anniversaryPhase.style.overflow = 'hidden';
        
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
        
        document.head.appendChild(style);
        transitionScreen.appendChild(anniversaryPhase);
        transitionScreen.appendChild(loadingPhase);
        document.body.appendChild(transitionScreen);
        
        // Executar a sequência de animação
        setTimeout(function() {
            const img = document.getElementById('aniversarioImg');
            if (img) {
                img.style.opacity = '1';
                img.style.transform = 'scale(1)';
            }
            
            setTimeout(function() {
                anniversaryPhase.style.opacity = '0';
                anniversaryPhase.style.transition = 'opacity 0.7s ease-out';
                
                setTimeout(function() {
                    anniversaryPhase.style.display = 'none';
                    loadingPhase.style.display = 'block';
                    
                    setTimeout(function() {
                        window.location.href = '/dashboard';
                    }, 2000);
                }, 700);
            }, 3000);
        }, 100);
    }

    // Manipula o envio do formulário de login com proteção de dados
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const cnpj = document.getElementById('cnpj').value;
            const password = document.getElementById('password').value;
            
            // Validar campos sensíveis antes do envio
            if (window.SensitiveDataManager) {
                if (!window.SensitiveDataManager.validateSensitiveData(email, 'email')) {
                    alert('Por favor, insira um email válido.');
                    return;
                }
                
                if (!window.SensitiveDataManager.validateSensitiveData(cnpj, 'cnpj')) {
                    alert('Por favor, insira um CNPJ válido.');
                    return;
                }
            }
            
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
                    // Limpar campos sensíveis do formulário
                    document.getElementById('email').value = '';
                    document.getElementById('cnpj').value = '';
                    document.getElementById('password').value = '';
                    
                    // Armazenar dados de forma segura usando o novo sistema
                    if (window.secureStore && data.usuario) {
                        await window.secureStore({
                            nome: data.usuario.nome,
                            codigo: data.usuario.codigo,
                            // Não armazenar CNPJ completo no cliente
                            timestamp: new Date().getTime()
                        });
                    } else {
                        // Fallback para armazenamento tradicional (apenas dados não sensíveis)
                        localStorage.setItem('usuarioPortal', JSON.stringify({
                            nome: data.usuario.nome.split(' ')[0], // Apenas primeiro nome
                            codigo: data.usuario.codigo,
                            timestamp: new Date().getTime()
                        }));
                    }
                    
                    // Iniciar a animação de transição
                    showLoginTransition();
                    return;
                } else {
                    // Mostrar mensagem de erro mascarada
                    const errorMsg = data.message || 'Falha no login. Verifique suas credenciais.';
                    msgDiv.textContent = errorMsg;
                    msgDiv.style.display = 'block';
                    
                    // Limpar campos sensíveis em caso de erro
                    document.getElementById('password').value = '';
                    
                    // Restaurar botão
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = btnTexto;
                }
            } catch (error) {
                console.error('Erro ao fazer login:', error);
                
                // Limpar campos sensíveis
                document.getElementById('password').value = '';
                
                // Mostrar mensagem de erro genérica (sem expor detalhes técnicos)
                msgDiv.textContent = 'Ocorreu um erro ao tentar fazer login. Tente novamente.';
                msgDiv.style.display = 'block';
                
                // Restaurar botão
                btnSubmit.disabled = false;
                btnSubmit.textContent = btnTexto;
            }
        });
    }

    // Configurar limpeza automática de campos sensíveis
    setupSensitiveFieldsProtection();
});

/**
 * Configura proteção automática para campos sensíveis
 */
function setupSensitiveFieldsProtection() {
    // Selecionar todos os campos de entrada sensíveis
    const sensitiveFields = document.querySelectorAll('input[type="password"], input[name="cnpj"], input[name="email"]');
    
    sensitiveFields.forEach(field => {
        // Limpar campo quando a página perder o foco
        window.addEventListener('blur', () => {
            if (field.type === 'password') {
                field.value = '';
            }
        });
        
        // Configurar autocomplete seguro
        if (field.type === 'password') {
            field.setAttribute('autocomplete', 'current-password');
        } else if (field.name === 'email') {
            field.setAttribute('autocomplete', 'username');
        }
        
        // Prevenir cópia de senhas
        if (field.type === 'password') {
            field.addEventListener('copy', (e) => {
                e.preventDefault();
                console.warn('Cópia de senha bloqueada por segurança');
            });
            
            field.addEventListener('cut', (e) => {
                e.preventDefault();
                console.warn('Recorte de senha bloqueado por segurança');
            });
        }
        
        // Aplicar mascaramento em tempo real para campos CNPJ
        if (field.name === 'cnpj') {
            field.addEventListener('blur', function() {
                if (this.value && window.maskData) {
                    // Armazenar valor real em atributo data
                    this.setAttribute('data-real-value', this.value);
                    // Mostrar valor mascarado após perder o foco (opcional)
                    // this.value = window.maskData(this.value, 'cnpj');
                }
            });
            
            field.addEventListener('focus', function() {
                // Restaurar valor real quando receber foco
                const realValue = this.getAttribute('data-real-value');
                if (realValue) {
                    this.value = realValue;
                }
            });
        }
    });
    
    // Configurar limpeza automática em caso de inatividade
    setupInactivityProtection();
}

/**
 * Configura proteção contra inatividade
 */
function setupInactivityProtection() {
    let inactivityTimer;
    const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutos para login
    
    const resetInactivityTimer = () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            // Limpar todos os campos sensíveis
            const sensitiveFields = document.querySelectorAll('input[type="password"], input[name="cnpj"], input[name="email"]');
            sensitiveFields.forEach(field => {
                field.value = '';
            });
            
            // Mostrar aviso
            alert('Por motivos de segurança, os campos foram limpos devido à inatividade.');
        }, INACTIVITY_TIMEOUT);
    };
    
    // Eventos que resetam o timer
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetInactivityTimer, { passive: true });
    });
    
    resetInactivityTimer();
}

// Configurar proteção contra debugging (opcional)
if (typeof window !== 'undefined') {
    // Detectar DevTools aberto
    let devtools = {
        open: false,
        orientation: null
    };
    
    setInterval(() => {
        if (window.outerHeight - window.innerHeight > 200 || window.outerWidth - window.innerWidth > 200) {
            if (!devtools.open) {
                devtools.open = true;
                console.warn('⚠️ Ferramentas de desenvolvedor detectadas. Dados sensíveis podem estar protegidos.');
                
                // Opcional: Limpar dados sensíveis quando DevTools for aberto
                if (window.clearSecureData) {
                    // window.clearSecureData();
                }
            }
        } else {
            devtools.open = false;
        }
    }, 500);
}