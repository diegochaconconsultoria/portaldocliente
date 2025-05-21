document.addEventListener('DOMContentLoaded', function() {
    // Atualizar data e hora no rodapé
    const dataAtual = new Date();
    const dataFormatada = dataAtual.toLocaleDateString('pt-BR');
    const horaFormatada = dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    document.getElementById('lastUpdate').textContent = `${dataFormatada} - ${horaFormatada}`;
    
    // Obter informações do usuário da sessão
    fetchUserInfo();
    
    // Handler para upload de arquivos
    const fileUpload = document.getElementById('fileUpload');
    const fileList = document.getElementById('fileList');
    const uploadedFiles = new Set(); // Para armazenar os arquivos selecionados
    
    if (fileUpload) {
        fileUpload.addEventListener('change', function() {
            // Limpa a mensagem de lista vazia se houver
            if (fileList.querySelector('.empty-list')) {
                fileList.innerHTML = '';
            }
            
            // Para cada arquivo selecionado
            Array.from(this.files).forEach(file => {
                // Verifique se o arquivo já foi adicionado
                if (uploadedFiles.has(file.name)) {
                    return;
                }
                
                // Verifique o tamanho do arquivo (limite de 10MB)
                if (file.size > 10 * 1024 * 1024) {
                    alert(`O arquivo "${file.name}" excede o tamanho máximo de 10MB.`);
                    return;
                }
                
                // Verifique o tipo de arquivo (PDF, JPG, PNG)
                const fileType = file.type.toLowerCase();
                if (!fileType.includes('pdf') && !fileType.includes('jpeg') && 
                    !fileType.includes('jpg') && !fileType.includes('png')) {
                    alert(`O arquivo "${file.name}" não é um formato aceito. Por favor, use PDF, JPG ou PNG.`);
                    return;
                }
                
                // Adicione o arquivo à lista
                uploadedFiles.add(file.name);
                
                // Crie o item da lista
                const li = document.createElement('li');
                
                // Formato do nome do arquivo com tamanho
                const fileSize = formatFileSize(file.size);
                
                li.innerHTML = `
                    <span class="file-name" title="${file.name}">${file.name}</span>
                    <span class="file-size">${fileSize}</span>
                    <button type="button" class="file-remove" data-filename="${file.name}">×</button>
                `;
                
                fileList.appendChild(li);
                
                // Adicione o evento para remover o arquivo
                const removeBtn = li.querySelector('.file-remove');
                removeBtn.addEventListener('click', function() {
                    const filename = this.getAttribute('data-filename');
                    uploadedFiles.delete(filename);
                    li.remove();
                    
                    // Se a lista ficar vazia, mostre a mensagem de lista vazia
                    if (fileList.children.length === 0) {
                        fileList.innerHTML = '<li class="empty-list">Nenhum arquivo anexado</li>';
                    }
                });
            });
        });
    }
    
    // Configurar evento de envio do formulário
    const sacForm = document.getElementById('sacForm');
    if (sacForm) {
        sacForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const documento = document.getElementById('documento').value;
            const observacao = document.getElementById('observacao').value;
            
            // Validação básica
            if (!documento.trim() || !observacao.trim()) {
                alert('Por favor, preencha todos os campos obrigatórios.');
                return;
            }
            
            // Desabilitar o botão de envio para evitar múltiplos cliques
            const submitButton = document.querySelector('.btn-submit');
            const originalText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'Enviando...';
            
            try {
                // Preparar os dados do formulário
                const formData = new FormData();
                formData.append('documento', documento);
                formData.append('observacao', observacao);
                
                // Adicionar os arquivos
                const fileInput = document.getElementById('fileUpload');
                Array.from(fileInput.files).forEach(file => {
                    if (uploadedFiles.has(file.name)) {
                        formData.append('files', file);
                    }
                });
                
                // Enviar a solicitação
                const response = await fetch('/api/enviarSac', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Mostrar mensagem de sucesso
                    document.getElementById('sacForm').style.display = 'none';
                    document.getElementById('successMessage').style.display = 'block';
                    
                    // Exibir o email do usuário na mensagem de sucesso
                    const userEmail = document.getElementById('clientEmail');
                    if (userEmail) {
                        document.getElementById('userEmail').textContent = userEmail.textContent;
                    }
                    
                    // Configurar botão para nova solicitação
                    document.getElementById('newRequestBtn').addEventListener('click', function() {
                        // Limpar o formulário
                        sacForm.reset();
                        fileList.innerHTML = '<li class="empty-list">Nenhum arquivo anexado</li>';
                        uploadedFiles.clear();
                        
                        // Mostrar o formulário novamente
                        document.getElementById('sacForm').style.display = 'block';
                        document.getElementById('successMessage').style.display = 'none';
                    });
                } else {
                    alert(data.message || 'Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.');
                    // Reabilitar o botão de envio
                    submitButton.disabled = false;
                    submitButton.textContent = originalText;
                }
            } catch (error) {
                console.error('Erro ao enviar a solicitação:', error);
                alert('Ocorreu um erro ao enviar sua solicitação. Por favor, tente novamente.');
                // Reabilitar o botão de envio
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        });
    }
    
    // Configurar evento de logout
    document.getElementById('logoutBtn').addEventListener('click', async function() {
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
    
    // Função para formatar o tamanho do arquivo
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' bytes';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    }
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
            document.getElementById('userName').textContent = data.usuario.nome.split(' ')[0] || 'Usuário';
            
            // Se estiver na página de SAC, preencher o email do usuário
            const userEmail = document.getElementById('userEmail');
            if (userEmail) {
                userEmail.textContent = data.usuario.email || 'N/A';
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
                document.getElementById('userName').textContent = userData.nome.split(' ')[0] || 'Usuário';
                return;
            }
        }
        
        // Se não tiver dados válidos, redireciona para login
        alert('Sua sessão expirou ou ocorreu um erro. Por favor, faça login novamente.');
        window.location.href = '/';
    }
}