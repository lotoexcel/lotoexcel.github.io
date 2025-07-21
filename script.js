
// ========== GERADOR DE COMBINAÇÕES ==========
function gerarCombinacoes() {
    console.log("Gerando combinações...");
    const combinacoes = [];
    const numeros = Array.from({ length: 25 }, (_, i) => i + 1);

    function combinar(inicio, combo) {
        if (combo.length === 15) {
            combinacoes.push({
                id: combinacoes.length + 1,
                numeros: combo.map(n => n.toString().padStart(2, '0')).join(' '),
                numerosArray: [...combo]
            });
            return;
        }

        for (let i = inicio; i <= 25; i++) {
            combo.push(i);
            combinar(i + 1, combo);
            combo.pop();
        }
    }

    combinar(1, []);
    return combinacoes;
}

// ========== VARIÁVEIS GLOBAIS ==========
let todasCombinacoes = [];
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

    // Gera as combinações
    DOM.mostrarSorteadasBtn.innerHTML = '<span class="loading-spinner">⏳</span> Gerando...';
    setTimeout(() => {
        todasCombinacoes = gerarCombinacoes();
        DOM.mostrarSorteadasBtn.textContent = 'Mostrar Sorteadas';
        carregarMaisCombinacoes();
    }, 100);

    // Event Listeners
    DOM.filtro.addEventListener('input', filtrarCombinacoes);
    DOM.carregarMais.addEventListener('click', carregarMaisCombinacoes);
    DOM.mostrarSorteadasBtn.addEventListener('click', toggleMostrarSorteadas);
    DOM.limparTudoBtn.addEventListener('click', limparTudo);
    DOM.importarXLSXBtn.addEventListener('click', () => DOM.fileXLSX.click());
    DOM.fileXLSX.addEventListener('change', importarXLSX);
});

// ========== FUNÇÕES PRINCIPAIS ==========
function carregarMaisCombinacoes() {
    const container = DOM.tabela;
    const inicio = offset;
    const fim = Math.min(offset + LIMITE, 3268760); // Número total teórico

    for (let id = inicio; id < fim; id++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${id}</td>
            <td>${gerarNumerosDaCombinacao(id)}</td>
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

    const combosFiltradas = todasCombinacoes.filter(c =>
        (mostrarApenasSorteadas ? combinacoesSorteadas.has(c.id) : true) &&
        (numsFiltro.length === 0 || numsFiltro.every(n => c.numerosArray.includes(n)))
    );

    // Substitui temporariamente para paginação
    const originais = todasCombinacoes;
    todasCombinacoes = combosFiltradas;
    carregarMaisCombinacoes();
    todasCombinacoes = originais;
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

function gerarNumerosDaCombinacao(id) {
    // Lógica para converter um ID único em uma combinação válida
    // (Implementação simplificada - você pode usar um algoritmo mais eficiente)
    let numeros = [];
    let contador = 0;
    for (let i = 1; i <= 25 && numeros.length < 15; i++) {
        if ((id & (1 << (i - 1))) !== 0) {
            numeros.push(i.toString().padStart(2, '0'));
        }
    }
    return numeros.join(' ');
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

            const id = calcularIdCombinacao(bolas); // Você precisa implementar esta função
            if (!combinacoesSorteadas.has(id)) {
                combinacoesSorteadas.add(id);
                marcadas++;
            }
        }

        localStorage.setItem('lotofacilSorteadas', JSON.stringify([...combinacoesSorteadas]));
        alert(`${marcadas} combinações importadas!`);

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