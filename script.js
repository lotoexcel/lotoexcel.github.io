
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
const LIMITE = 100;
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
    const inicio = offset;
    const fim = offset + LIMITE;
    const combos = mostrarApenasSorteadas
        ? todasCombinacoes.filter(c => combinacoesSorteadas.has(c.id))
        : todasCombinacoes;

    for (let i = inicio; i < fim && i < combos.length; i++) {
        const combo = combos[i];
        const tr = document.createElement('tr');
        if (combinacoesSorteadas.has(combo.id)) tr.classList.add('combinacao-sorteada');

        tr.innerHTML = `
                    <td class="px-6 py-4">${combo.id}</td>
                    <td class="px-6 py-4">${combo.numeros}</td>
                    <td class="px-6 py-4">
                        <button onclick="toggleSorteada(${combo.id})" class="px-3 py-1 rounded-md ${combinacoesSorteadas.has(combo.id)
                ? 'bg-green-100 text-green-600'
                : 'bg-gray-100 text-gray-600'
            }">
                            ${combinacoesSorteadas.has(combo.id) ? '✓ Sorteada' : 'Marcar'}
                        </button>
                    </td>
                `;
        DOM.tabela.appendChild(tr);
    }

    offset = fim;
    DOM.contador.textContent = `${Math.min(offset, combos.length).toLocaleString()}/${combos.length.toLocaleString()}`;
    DOM.carregarMais.disabled = offset >= combos.length;
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

// ========== IMPORTAR XLSX HISTÓRICO ==========
async function importarXLSX(event) {
    const file = event.target.files[0];
    if (!file) return;

    DOM.importarXLSXBtn.innerHTML = '<span class="loading-spinner">⏳</span> Processando...';

    try {
        const data = await readFile(file);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];

        // Encontra início dos dados (pula cabeçalhos)
        let startRow = 0;
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            const cell = worksheet[XLSX.utils.encode_cell({ c: 0, r: R })];
            if (cell && cell.v === "Concurso") {
                startRow = R + 1;
                break;
            }
        }

        const historico = XLSX.utils.sheet_to_json(worksheet, {
            range: startRow,
            header: ["concurso", "data", "bola1", "bola2", "bola3", "bola4", "bola5",
                "bola6", "bola7", "bola8", "bola9", "bola10", "bola11", "bola12",
                "bola13", "bola14", "bola15"]
        });

        let marcadas = 0;
        const mapaCombos = new Map(todasCombinacoes.map(c => [c.numeros, c]));

        historico.forEach(linha => {
            const numeros = [];
            for (let i = 1; i <= 15; i++) {
                const num = linha[`bola${i}`];
                if (num >= 1 && num <= 25) numeros.push(num);
            }

            if (numeros.length === 15) {
                const chave = numeros.sort((a, b) => a - b).map(n => n.toString().padStart(2, '0')).join(' ');
                const combo = mapaCombos.get(chave);
                if (combo && !combinacoesSorteadas.has(combo.id)) {
                    combinacoesSorteadas.add(combo.id);
                    marcadas++;
                }
            }
        });

        localStorage.setItem('lotofacilSorteadas', JSON.stringify([...combinacoesSorteadas]));
        alert(`${marcadas} combinações marcadas como sorteadas!`);
        filtrarCombinacoes();

    } catch (error) {
        alert("Erro ao processar XLSX: " + error.message);
    } finally {
        DOM.importarXLSXBtn.textContent = 'Importar Histórico';
        DOM.fileXLSX.value = '';
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