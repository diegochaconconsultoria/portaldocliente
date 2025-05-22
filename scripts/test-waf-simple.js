/**
 * Script de teste básico para WAF
 */

const http = require('http');

async function testWAF() {
    console.log('🧪 Testando WAF básico...\n');
    
    const tests = [
        {
            name: 'Requisição Normal',
            path: '/',
            expected: 200
        },
        {
            name: 'Dashboard WAF',
            path: '/admin/waf/dashboard',
            expected: [200, 401] // Pode retornar 401 se não autenticado
        },
        {
            name: 'Stats WAF',
            path: '/admin/waf/stats',
            expected: [200, 401]
        }
    ];
    
    for (const test of tests) {
        try {
            console.log(`🔍 Testando: ${test.name}`);
            
            const result = await makeRequest(test.path);
            const expectedArray = Array.isArray(test.expected) ? test.expected : [test.expected];
            
            if (expectedArray.includes(result.statusCode)) {
                console.log(`   ✅ PASSOU - Status: ${result.statusCode}`);
            } else {
                console.log(`   ⚠️ INESPERADO - Status: ${result.statusCode} (esperado: ${test.expected})`);
            }
            
        } catch (error) {
            console.log(`   ❌ ERRO - ${error.message}`);
        }
        
        console.log('');
    }
    
    console.log('🏁 Testes básicos concluídos!');
}

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'GET'
        };
        
        const req = http.request(options, (res) => {
            resolve({
                statusCode: res.statusCode,
                headers: res.headers
            });
        });
        
        req.on('error', reject);
        req.setTimeout(5000, () => reject(new Error('Timeout')));
        req.end();
    });
}

if (require.main === module) {
    testWAF().catch(console.error);
}

module.exports = { testWAF };
