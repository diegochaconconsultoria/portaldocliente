// transition.js - Gerencia a animação de transição após o login
function showLoginTransition() {
    // Verifique se a tela de transição já existe, se não, crie-a
    let transitionScreen = document.getElementById('transition-screen');
    
    if (!transitionScreen) {
        // Criar a tela de transição dinamicamente
        transitionScreen = document.createElement('div');
        transitionScreen.id = 'transition-screen';
        transitionScreen.style.position = 'fixed';
        transitionScreen.style.top = '0';
        transitionScreen.style.left = '0';
        transitionScreen.style.width = '100%';
        transitionScreen.style.height = '100%';
        transitionScreen.style.backgroundColor = '#f5f5f5';
        transitionScreen.style.zIndex = '9999';
        transitionScreen.style.display = 'flex';
        transitionScreen.style.flexDirection = 'column';
        transitionScreen.style.justifyContent = 'center';
        transitionScreen.style.alignItems = 'center';
        
        // Fase 1: Aniversário
        const anniversaryPhase = document.createElement('div');
        anniversaryPhase.id = 'anniversary-phase';
        anniversaryPhase.style.textAlign = 'center';
        anniversaryPhase.style.padding = '20px';
        anniversaryPhase.style.maxWidth = '500px';
        
        anniversaryPhase.innerHTML = `
            <img src="30anos.png" alt="30 Anos MVK" style="max-width: 100%; height: auto; margin-bottom: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); border-radius: 8px;">
            <h2 style="color: #d8183e; font-size: 28px; margin: 20px 0;">Celebrando 30 Anos de Parceria!</h2>
        `;
        
        // Fase 2: Carregamento
        const loadingPhase = document.createElement('div');
        loadingPhase.id = 'loading-phase';
        loadingPhase.style.display = 'none';
        loadingPhase.style.textAlign = 'center';
        loadingPhase.style.padding = '20px';
        loadingPhase.style.maxWidth = '400px';
        
        loadingPhase.innerHTML = `
            <img src="logo.png" alt="Logo MVK" style="width: 150px; height: auto;">
            <h2 style="color: #d8183e; margin: 20px 0 10px;">Bem-vindo ao Portal do Cliente</h2>
            <p style="color: #777; margin-bottom: 25px;">Carregando seu ambiente personalizado...</p>
            <div style="margin: 0 auto; width: 50px; height: 50px; border: 5px solid rgba(216, 24, 62, 0.2); border-radius: 50%; border-top-color: #d8183e; animation: spin 1s linear infinite;"></div>
        `;
        
        // Adicionar estilos para a animação de spin
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
    } else {
        // Se já existe, apenas garantir que está visível e na fase inicial
        transitionScreen.style.display = 'flex';
        const anniversaryPhase = document.getElementById('anniversary-phase');
        const loadingPhase = document.getElementById('loading-phase');
        
        if (anniversaryPhase) anniversaryPhase.style.display = 'block';
        if (loadingPhase) loadingPhase.style.display = 'none';
    }
    
    // Executar a sequência de animação
    setTimeout(function() {
        const anniversaryPhase = document.getElementById('anniversary-phase');
        const loadingPhase = document.getElementById('loading-phase');
        
        if (anniversaryPhase) anniversaryPhase.style.display = 'none';
        if (loadingPhase) loadingPhase.style.display = 'block';
        
        setTimeout(function() {
            window.location.href = '/dashboard';
        }, 2000);
    }, 3000);
}

// Exportar a função para uso global
window.showLoginTransition = showLoginTransition;