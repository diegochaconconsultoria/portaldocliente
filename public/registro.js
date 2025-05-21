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

    // Adiciona a máscara para o campo Telefone
    const telefoneInput = document.getElementById('telefone');
    if (telefoneInput) {
        telefoneInput.addEventListener('input', function(e) {
            let value = e.target.value;
            
            // Remove todos os caracteres não numéricos
            value = value.replace(/\D/g, '');
            
            // Adiciona a formatação do telefone
            if (value.length <= 11) {
                if (value.length > 2) {
                    value = `(${value.substring(0, 2)}) ${value.substring(2)}`;
                }
                if (value.length > 9) {
                    value = `${value.substring(0, 9)}-${value.substring(9)}`;
                }
            }
            
            e.target.value = value;
        });
    }

    // Manipula o envio do formulário
    const registroForm = document.getElementById('registroForm');
    if (registroForm) {
        registroForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Verificar se o checkbox de consentimento foi marcado
            const consentimento = document.getElementById('consentimento');
            if (!consentimento.checked) {
                alert('Você precisa concordar com os termos para prosseguir.');
                return;
            }
            
            // Mostrar mensagem de carregamento
            const btnSubmit = document.querySelector('button[type="submit"]');
            const btnTexto = btnSubmit.textContent;
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Enviando...';
            
            const nome = document.getElementById('nome').value;
            const cnpj = document.getElementById('cnpj').value;
            const email = document.getElementById('email').value;
            const telefone = document.getElementById('telefone').value;
            const contato = document.getElementById('contato').value;
            
            try {
                const response = await fetch('/api/solicitarAcesso', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        nome, 
                        cnpj, 
                        email, 
                        telefone, 
                        contato,
                        consentimento: true
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Criar elemento para mensagem de sucesso
                    const sucessoDiv = document.createElement('div');
                    sucessoDiv.className = 'mensagem-sucesso';
                    sucessoDiv.innerHTML = `
                        <h3>Solicitação Enviada com Sucesso!</h3>
                        <p>Sua solicitação foi recebida e será analisada por nossa equipe.</p>
                        <p>Em breve entraremos em contato através do email <strong>${email}</strong> com suas credenciais de acesso.</p>
                        <div class="botoes">
                            <button class="btn-voltar" onclick="window.location.href='/'">Voltar para Login</button>
                        </div>
                    `;
                    
                    // Substituir o formulário pela mensagem de sucesso
                    const form = document.getElementById('registroForm');
                    const loginForm = document.querySelector('.login-form');
                    loginForm.removeChild(form);
                    
                    // Esconder o link "Já tem acesso"
                    const firstAccess = document.querySelector('.first-access');
                    if (firstAccess) {
                        firstAccess.style.display = 'none';
                    }
                    
                    // Adicionar a mensagem de sucesso
                    loginForm.appendChild(sucessoDiv);
                    
                    // Adicionar estilos para a mensagem de sucesso
                    const style = document.createElement('style');
                    style.textContent = `
                        .mensagem-sucesso {
                            text-align: center;
                            padding: 20px 0;
                        }
                        .mensagem-sucesso h3 {
                            color: #28a745;
                            margin-bottom: 15px;
                        }
                        .mensagem-sucesso p {
                            margin-bottom: 10px;
                            color: #333;
                        }
                        .botoes {
                            margin-top: 25px;
                        }
                        .btn-voltar {
                            background-color: var(--primary-color);
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: 600;
                            transition: background-color 0.3s;
                        }
                        .btn-voltar:hover {
                            background-color: var(--primary-hover);
                        }
                    `;
                    document.head.appendChild(style);
                    
                } else {
                    // Restaurar botão e mostrar erro
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = btnTexto;
                    alert(data.message || 'Erro ao processar sua solicitação.');
                }
            } catch (error) {
                console.error('Erro ao solicitar acesso:', error);
                // Restaurar botão e mostrar erro
                btnSubmit.disabled = false;
                btnSubmit.textContent = btnTexto;
                alert('Ocorreu um erro ao enviar sua solicitação. Tente novamente.');
            }
        });
    }
});