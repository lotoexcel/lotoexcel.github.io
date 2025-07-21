// ========== VARIÁVEIS GLOBAIS ==========
let combinacoesSorteadas = new Set();
let offset = 0;
const LIMITE = 50;
let mostrarApenasSorteadas = false;

// ========== ELEMENTOS DOM ==========
const DOM = {
    tabela: document.getElementById('tabelaCombinacoes'),
    filtro: document.getElementById('filtro'),
    contador: document.getElementById('contador'),
    carregarMais: document.getElementById('carregarMais'),
    mostrarSorteadasBtn: document.getElementById('mostrarSorteadasBtn'),
    limparTudoBtn: document.getElementById('limparTudoBtn'),
    importarXLSXBtn: document.getElementById('importarXLSXBtn'),
    fileXLSX: document.getElementById('fileXLSX')
};

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', () => {
    // Carrega do localStorage
    const salvas = localStorage.getItem('lotofacilSorteadas');
    if (salvas) combinacoesSorteadas = new Set(JSON.parse(salvas));

    // Event Listeners
    DOM.filtro.addEventListener('input', filtrarCombinacoes);
    DOM.carregarMais.addEventListener('click', carregarMaisCombinacoes);
    DOM.mostrarSorteadasBtn.addEventListener('click', toggleMostrarSorteadas);
    DOM.limparTudoBtn.addEventListener('click', limparTudo);
    DOM.importarXLSXBtn.addEventListener('click', () => DOM.fileXLSX.click());
    DOM.fileXLSX.addEventListener('change', importarXLSX);
    
    // Carrega as primeiras combinações
    carregarMaisCombinacoes();
});

// ========== FUNÇÕES PRINCIPAIS ==========
function carregarMaisCombinacoes() {
    const container = DOM.tabela;
    const inicio = offset;
    const fim = Math.min(offset + LIMITE, 3268760); // Número total teórico

    for (let id = inicio; id < fim; id++) {
        const numeros = gerarNumerosDaCombinacao(id);
        const numerosFormatados = numeros.map(n => n.toString().padStart(2, '0')).join(' ');
        
        const tr = document.createElement('tr');
        if (combinacoesSorteadas.has(id)) tr.classList.add('combinacao-sorteada');
        
        tr.innerHTML = `
            <td>${id}</td>
            <td>${numerosFormatados}</td>
            <td>
                <button onclick="toggleSorteada(${id})" class="marcador">
                    ${combinacoesSorteadas.has(id) ? '✓ Sorteada' : 'Marcar'}
                </button>
            </td>
        `;
        container.appendChild(tr);
    }

    offset = fim;
    DOM.contador.textContent = `${offset.toLocaleString()}/3.268.760`;
    DOM.carregarMais.disabled = offset >= 3268760;
}

function toggleSorteada(id) {
    combinacoesSorteadas.has(id)
        ? combinacoesSorteadas.delete(id)
        : combinacoesSorteadas.add(id);

    localStorage.setItem('lotofacilSorteadas', JSON.stringify([...combinacoesSorteadas]));
    filtrarCombinacoes();
}

function toggleMostrarSorteadas() {
    mostrarApenasSorteadas = !mostrarApenasSorteadas;
    DOM.mostrarSorteadasBtn.textContent = mostrarApenasSorteadas ? 'Mostrar Todas' : 'Mostrar Sorteadas';
    DOM.tabela.innerHTML = '';
    offset = 0;
    carregarMaisCombinacoes();
}

function filtrarCombinacoes() {
    const numsFiltro = DOM.filtro.value.trim().split(/\s+/)
        .map(n => parseInt(n))
        .filter(n => !isNaN(n) && n >= 1 && n <= 25);

    DOM.tabela.innerHTML = '';
    offset = 0;

    if (numsFiltro.length === 0 && !mostrarApenasSorteadas) {
        carregarMaisCombinacoes();
        return;
    }

    // Para filtros, vamos gerar sob demanda
    let contador = 0;
    const container = DOM.tabela;
    
    for (let id = 0; id < 3268760 && contador < LIMITE; id++) {
        const numeros = gerarNumerosDaCombinacao(id);
        
        // Verifica filtros
        const passaFiltro = numsFiltro.length === 0 || numsFiltro.every(n => numeros.includes(n));
        const passaSorteada = !mostrarApenasSorteadas || combinacoesSorteadas.has(id);
        
        if (passaFiltro && passaSorteada) {
            const numerosFormatados = numeros.map(n => n.toString().padStart(2, '0')).join(' ');
            
            const tr = document.createElement('tr');
            if (combinacoesSorteadas.has(id)) tr.classList.add('combinacao-sorteada');
            
            tr.innerHTML = `
                <td>${id}</td>
                <td>${numerosFormatados}</td>
                <td>
                    <button onclick="toggleSorteada(${id})" class="marcador">
                        ${combinacoesSorteadas.has(id) ? '✓ Sorteada' : 'Marcar'}
                    </button>
                </td>
            `;
            container.appendChild(tr);
            contador++;
        }
    }
    
    offset = contador;
    DOM.contador.textContent = `Mostrando ${contador} combinações filtradas`;
}

function limparTudo() {
    if (confirm('Limpar todas as marcações?')) {
        combinacoesSorteadas = new Set();
        localStorage.removeItem('lotofacilSorteadas');
        DOM.tabela.innerHTML = '';
        offset = 0;
        carregarMaisCombinacoes();
    }
}

// ========== FUNÇÕES DE COMBINAÇÕES ==========
function gerarNumerosDaCombinacao(id) {
    // Algoritmo otimizado para gerar combinações sem usar recursão
    const numeros = [];
    let n = 25;
    let k = 15;
    let a = id;
    
    for (let i = 1; i <= n && numeros.length < k; i++) {
        const c = combinacao(n - i, k - numeros.length - 1);
        if (a >= c) {
            a -= c;
        } else {
            numeros.push(i);
        }
    }
    
    return numeros;
}

function calcularIdCombinacao(bolas) {
    // Algoritmo inverso para calcular o ID a partir dos números
    const sorted = [...bolas].sort((a, b) => a - b);
    let id = 0;
    let n = 25;
    let k = 15;
    
    for (let i = 0; i < sorted.length; i++) {
        const num = sorted[i];
        for (let j = (i === 0 ? 1 : sorted[i-1] + 1); j < num; j++) {
            id += combinacao(n - j, k - i - 1);
        }
    }
    
    return id;
}

function combinacao(n, k) {
    // Função auxiliar para cálculo de combinações (n choose k)
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    
    k = Math.min(k, n - k);
    let res = 1;
    for (let i = 1; i <= k; i++) {
        res = res * (n - k + i) / i;
    }
    
    return Math.round(res);
}

// ========== IMPORTAR XLSX HISTÓRICO ==========
async function importarXLSX(event) {
    const file = event.target.files[0];
    if (!file) return;

    DOM.importarXLSXBtn.innerHTML = '⏳ Processando...';

    try {
        const data = await readFile(file);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        let marcadas = 0;
        for (let i = 7; i < jsonData.length; i++) { // Pula cabeçalhos
            const linha = jsonData[i];
            if (!linha || linha.length < 16) continue;

            const bolas = linha.slice(1, 16).map(Number).filter(n => n >= 1 && n <= 25);
            if (bolas.length !== 15) continue;

            const id = calcularIdCombinacao(bolas);
            if (!combinacoesSorteadas.has(id)) {
                combinacoesSorteadas.add(id);
                marcadas++;
            }
        }

        localStorage.setItem('lotofacilSorteadas', JSON.stringify([...combinacoesSorteadas]));
        alert(`${marcadas} combinações importadas!`);
        filtrarCombinacoes();

    } catch (error) {
        alert("Erro: " + error.message);
    } finally {
        DOM.importarXLSXBtn.textContent = 'Importar Histórico';
        event.target.value = '';
    }
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}