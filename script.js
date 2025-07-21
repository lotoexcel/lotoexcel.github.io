document.addEventListener('DOMContentLoaded', async () => {
    const combinationsContainer = document.getElementById('combinations-container');
    const totalCombinationsEl = document.getElementById('total-combinations');
    const markedCombinationsEl = document.getElementById('marked-combinations');
    const loadJsonBtn = document.getElementById('load-json-btn'); // <--- RESTAURADO
    const jsonFileInput = document.getElementById('json-file-input'); // <--- RESTAURADO
    const clearAllBtn = document.getElementById('clear-all-btn'); // <--- RESTAURADO
    const toggleViewBtn = document.getElementById('toggle-view-btn');
    const filterInput = document.getElementById('filter-input');
    const applyFilterBtn = document.getElementById('apply-filter-btn');
    const clearFilterBtn = document.getElementById('clear-filter-btn');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const loadingMessage = document.getElementById('loading-message');

    // --- Configuration ---
    const TOTAL_JSON_FILES = 32;
    const JSON_FILE_PREFIX = 'json_combinations/combinations_'; // Caminho para a subpasta
    const JSON_FILE_SUFFIX = '.json';
    const MARKED_COMBINATIONS_FILE = 'marked_combinations.json'; // Caminho para o arquivo gerado
    const COMBINATIONS_PER_BATCH_DISPLAY = 100; // Quantidade de combinações a renderizar por vez
    const MAX_COMBINATIONS_IN_MEMORY_FOR_FILTER = 500000; // Limite para carregar todos os JSONs para filtro.
                                                        // Se o totalCombinationsCount for maior que isso
                                                        // o filtro será apenas nas combinações carregadas.
                                                        // Ajuste conforme a memória do seu dispositivo.

    let totalCombinationsCount = 0; // Será calculado após o carregamento inicial
    let allCombinations = []; // Armazena combinações carregadas do JSON
    let markedIds = new Set(); // Armazena IDs de combinações marcadas
    let loadedFileIndex = -1; // Rastreia qual arquivo JSON foi carregado por último
    let currentDisplayIndex = 0; // Rastreia o índice inicial para o batch de exibição atual
    let showingOnlyMarked = false;
    let currentFilterNumbers = []; // Armazena números para filtragem (ex: [1, 2, 3])
    let filteredCombinations = []; // Armazena as combinações após a aplicação do filtro

    // --- LocalStorage Management ---
    const getMarkedCombinations = async () => {
        const localMarked = localStorage.getItem('lotofacilMarkedIds');
        const initialMarkedSet = localMarked ? new Set(JSON.parse(localMarked)) : new Set();

        try {
            const response = await fetch(MARKED_COMBINATIONS_FILE);
            if (response.ok) {
                const preMarkedIds = await response.json();
                if (Array.isArray(preMarkedIds)) {
                    preMarkedIds.forEach(id => initialMarkedSet.add(String(id)));
                    console.log(`Carregado ${preMarkedIds.length} IDs de ${MARKED_COMBINATIONS_FILE}.`);
                } else {
                    console.warn(`O conteúdo do arquivo ${MARKED_COMBINATIONS_FILE} não é um array.`);
                }
            } else {
                console.warn(`Não foi possível carregar ${MARKED_COMBINATIONS_FILE}: ${response.status} ${response.statusText}. Pode não existir ainda.`);
            }
        } catch (error) {
            console.warn(`Erro ao buscar ${MARKED_COMBINATIONS_FILE}:`, error);
        }
        return initialMarkedSet;
    };

    // Inicializa markedIds esperando a função assíncrona
    markedIds = await getMarkedCombinations();

    const saveMarkedCombinations = () => {
        localStorage.setItem('lotofacilMarkedIds', JSON.stringify(Array.from(markedIds)));
        updateMarkedCount();
    };

    // --- UI Update Functions ---
    const updateMarkedCount = () => {
        markedCombinationsEl.textContent = markedIds.size.toLocaleString();
    };

    const updateTotalCombinationsCount = () => {
        totalCombinationsEl.textContent = totalCombinationsCount.toLocaleString();
    };

    const formatCombination = (numbers) => {
        return numbers.map(n => n.toString().padStart(2, '0')).sort((a, b) => parseInt(a) - parseInt(b)).join(' ');
    };

    // --- Combination Rendering ---
    const createCombinationElement = (id, numbers) => {
        const div = document.createElement('div');
        div.classList.add('combination-item', 'text-sm', 'md:text-base', 'flex', 'items-center', 'justify-center', 'text-center');
        div.dataset.id = id;
        div.textContent = formatCombination(numbers);

        if (markedIds.has(id)) {
            div.classList.add('marked');
        }

        div.addEventListener('click', () => {
            toggleMarked(id, div);
        });
        return div;
    };

    // Função para renderizar as combinações em "batch" para evitar travamentos
    const renderCombinationsBatch = (combinations, append = true, startIndex = 0) => {
        if (!append) {
            combinationsContainer.innerHTML = '';
        }
        loadingMessage.classList.add('hidden');

        const fragment = document.createDocumentFragment();
        let renderedCount = 0;

        // Renderiza apenas o que cabe em um batch
        for (let i = startIndex; i < combinations.length && renderedCount < COMBINATIONS_PER_BATCH_DISPLAY; i++) {
            const comb = combinations[i];
            const element = createCombinationElement(comb.id, comb.numbers);
            fragment.appendChild(element);
            renderedCount++;
        }
        combinationsContainer.appendChild(fragment);

        return renderedCount; // Retorna quantos foram renderizados
    };

    const toggleMarked = (id, element) => {
        if (markedIds.has(id)) {
            markedIds.delete(id);
            element.classList.remove('marked');
        } else {
            markedIds.add(id);
            element.classList.add('marked');
        }
        saveMarkedCombinations();
    };

    // --- Data Loading and Filtering ---

    // Nova função para carregar todos os JSONs se o filtro exigir
    const ensureAllCombinationsLoaded = async () => {
        if (loadedFileIndex < TOTAL_JSON_FILES - 1) {
            loadingMessage.textContent = "Carregando todas as combinações para aplicar o filtro. Isso pode demorar...";
            loadingMessage.classList.remove('hidden');
            loadMoreBtn.classList.add('hidden'); // Esconde o botão durante o carregamento completo

            for (let i = loadedFileIndex + 1; i < TOTAL_JSON_FILES; i++) {
                const loaded = await loadNextJsonFile();
                if (!loaded) {
                    console.error("Não foi possível carregar todos os arquivos JSON para o filtro.");
                    loadingMessage.textContent = "Erro ao carregar todos os dados para o filtro.";
                    return false;
                }
            }
            loadingMessage.classList.add('hidden'); // Esconde após carregar
        }
        return true;
    };


    const loadNextJsonFile = async () => {
        loadedFileIndex++;
        if (loadedFileIndex >= TOTAL_JSON_FILES) {
            console.log('Todos os arquivos JSON foram carregados.');
            loadMoreBtn.classList.add('hidden');
            return false;
        }

        loadingMessage.textContent = `Carregando arquivo ${loadedFileIndex + 1} de ${TOTAL_JSON_FILES}...`;
        loadingMessage.classList.remove('hidden');
        loadMoreBtn.classList.add('hidden');

        try {
            const filePath = `${JSON_FILE_PREFIX}${loadedFileIndex}${JSON_FILE_SUFFIX}`;
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Erro HTTP! status: ${response.status} para ${filePath}`);
            }
            const data = await response.json();

            const newCombinations = data.map((numbers, index) => ({
                id: `${loadedFileIndex}-${index}`,
                numbers: numbers
            }));

            allCombinations = allCombinations.concat(newCombinations);
            totalCombinationsCount = allCombinations.length;
            updateTotalCombinationsCount();

            console.log(`Carregado ${filePath}. Total de combinações em memória: ${totalCombinationsCount}`);
            loadingMessage.classList.add('hidden');
            return true;
        } catch (error) {
            console.error('Erro ao carregar arquivo JSON:', error);
            loadingMessage.textContent = 'Erro ao carregar combinações.';
            return false;
        }
    };

    const displayInitialCombinations = async () => {
        await loadNextJsonFile();
        currentDisplayIndex = 0;
        const initialBatch = allCombinations.slice(currentDisplayIndex, currentDisplayIndex + COMBINATIONS_PER_BATCH_DISPLAY);
        renderCombinationsBatch(initialBatch, false);
        currentDisplayIndex += initialBatch.length;
        if (currentDisplayIndex < allCombinations.length || loadedFileIndex < TOTAL_JSON_FILES -1) {
             loadMoreBtn.classList.remove('hidden');
        }
    };

    const loadMoreCombinations = async () => {
        let combinationsSource = allCombinations; // Por padrão, carrega do allCombinations
        let currentSourceIndex = currentDisplayIndex; // Onde começar a carregar

        // Se estivermos em um modo filtrado, o "load more" deve continuar do resultado do filtro
        if (showingOnlyMarked || currentFilterNumbers.length > 0) {
            combinationsSource = filteredCombinations; // Fonte agora são as filtradas
            currentSourceIndex = combinationsContainer.children.length; // Carrega a partir do que já está na tela
        }

        let combinationsToLoad = combinationsSource.slice(currentSourceIndex, currentSourceIndex + COMBINATIONS_PER_BATCH_DISPLAY);

        // Se não houver combinações suficientes no 'allCombinations' e não estivermos filtrando
        if (combinationsToLoad.length < COMBINATIONS_PER_BATCH_DISPLAY && loadedFileIndex < TOTAL_JSON_FILES - 1 && !showingOnlyMarked && currentFilterNumbers.length === 0) {
            const loaded = await loadNextJsonFile();
            if (loaded) {
                combinationsToLoad = allCombinations.slice(currentSourceIndex, currentSourceIndex + COMBINATIONS_PER_BATCH_DISPLAY);
            }
        }

        const renderedCount = renderCombinationsBatch(combinationsToLoad, true);
        currentDisplayIndex += renderedCount; // Atualiza o índice para o próximo carregamento

        // Verifica se ainda há mais a carregar
        if (currentSourceIndex + renderedCount >= combinationsSource.length && loadedFileIndex >= TOTAL_JSON_FILES - 1 && currentFilterNumbers.length === 0 && !showingOnlyMarked) {
             loadMoreBtn.classList.add('hidden');
        } else if ((showingOnlyMarked || currentFilterNumbers.length > 0) && (currentSourceIndex + renderedCount >= combinationsSource.length)) {
             loadMoreBtn.classList.add('hidden'); // Se estiver filtrado e não houver mais filtradas, esconde
        } else {
            loadMoreBtn.classList.remove('hidden');
        }
    };


    const applyFilterAndRedraw = async () => {
        loadingMessage.textContent = "Aplicando filtro...";
        loadingMessage.classList.remove('hidden');
        loadMoreBtn.classList.add('hidden'); // Esconde enquanto filtra

        // Garantir que todos os dados relevantes para o filtro estão carregados
        // Se a quantidade de combinações em memória for muito grande, o filtro será parcial.
        if (totalCombinationsCount < MAX_COMBINATIONS_IN_MEMORY_FOR_FILTER) {
             const allDataLoaded = await ensureAllCombinationsLoaded();
             if (!allDataLoaded) {
                 loadingMessage.textContent = "Não foi possível carregar todos os dados para o filtro. Filtrando apenas os carregados.";
                 // Continua com os dados que conseguiu carregar
             }
        } else {
             console.warn("Muitas combinações para carregar tudo para o filtro. Filtrando apenas as carregadas na memória.");
             loadingMessage.textContent = "Filtrando apenas as combinações já carregadas na memória...";
        }


        // Aplicar o filtro sobre `allCombinations` (agora possivelmente completo)
        let tempFiltered = allCombinations;

        if (currentFilterNumbers.length > 0) {
            tempFiltered = tempFiltered.filter(comb =>
                currentFilterNumbers.every(filterNum => comb.numbers.includes(filterNum))
            );
        }

        if (showingOnlyMarked) {
            tempFiltered = tempFiltered.filter(comb => markedIds.has(comb.id));
        }

        filteredCombinations = tempFiltered; // Salva o resultado do filtro
        currentDisplayIndex = 0; // Reseta o índice de exibição para a nova lista filtrada

        renderCombinationsBatch(filteredCombinations, false, 0); // Renderiza o primeiro batch dos filtrados

        if (filteredCombinations.length > COMBINATIONS_PER_BATCH_DISPLAY) {
            loadMoreBtn.classList.remove('hidden'); // Mostra o botão se houver mais resultados filtrados
        } else {
            loadMoreBtn.classList.add('hidden');
        }
        loadingMessage.classList.add('hidden'); // Esconde a mensagem de "aplicando filtro"
    };


    // --- Event Listeners ---
    loadMoreBtn.addEventListener('click', loadMoreCombinations);

    loadJsonBtn.addEventListener('click', () => jsonFileInput.click());
    jsonFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const loadedIds = JSON.parse(e.target.result);
                    if (Array.isArray(loadedIds)) {
                        loadedIds.forEach(id => markedIds.add(String(id)));
                        saveMarkedCombinations();
                        applyFilterAndRedraw(); // Re-renderiza para mostrar os novos itens marcados
                        alert(`Successfully loaded ${loadedIds.length} IDs from JSON!`);
                    } else {
                        alert('Invalid JSON file format. Expected an array of IDs.');
                    }
                } catch (error) {
                    alert('Error parsing JSON file: ' + error.message);
                    console.error('JSON parsing error:', error);
                }
            };
            reader.readAsText(file);
        }
    });

    clearAllBtn.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja limpar TODAS as suas marcações? As combinações sorteadas (pré-marcadas) permanecerão marcadas.')) {
            // 1. Limpa as marcações do usuário do localStorage
            localStorage.removeItem('lotofacilMarkedIds');
            
            // 2. Recarrega o conjunto de marcações (que agora incluirá apenas as pré-marcadas do JSON)
            getMarkedCombinations().then(initialSet => {
                markedIds = initialSet; // Atualiza o Set principal com as combinações pré-marcadas
                saveMarkedCombinations(); // Salva o estado atual (apenas pré-marcadas) no localStorage
                applyFilterAndRedraw(); // Re-renderiza para refletir as mudanças
                alert('Todas as suas marcações foram limpas! As combinações pré-marcadas permanecem.');
            }).catch(error => {
                console.error("Erro ao limpar e recarregar marcações:", error);
                alert("Ocorreu um erro ao limpar as marcações. Por favor, tente novamente.");
            });
        }
    });

    toggleViewBtn.addEventListener('click', () => {
        showingOnlyMarked = !showingOnlyMarked;
        // Removida a linha que altera o textContent do botão para mantê-lo fixo
        // toggleViewBtn.textContent = showingOnlyMarked ? 'Show All Combinations' : 'Show Only Marked';
        toggleViewBtn.classList.toggle('bg-gray-500', showingOnlyMarked);
        toggleViewBtn.classList.toggle('hover:bg-gray-600', showingOnlyMarked);
        toggleViewBtn.classList.toggle('bg-green-500', !showingOnlyMarked);
        toggleViewBtn.classList.toggle('hover:bg-green-600', !showingOnlyMarked);
        applyFilterAndRedraw();
    });

    applyFilterBtn.addEventListener('click', () => {
        const rawInput = filterInput.value.trim();
        if (rawInput) {
            const parsedNumbers = rawInput.split(' ').map(numStr => parseInt(numStr, 10)).filter(num => !isNaN(num) && num >= 1 && num <= 25);
            if (parsedNumbers.length > 0 && parsedNumbers.length <= 15) {
                currentFilterNumbers = parsedNumbers.sort((a, b) => a - b);
                applyFilterAndRedraw();
            } else {
                alert('Por favor, insira números válidos (1-25) separados por espaços, até 15 números.');
            }
        } else {
            currentFilterNumbers = []; // Limpa o filtro se a entrada estiver vazia
            applyFilterAndRedraw();
        }
    });

    clearFilterBtn.addEventListener('click', () => {
        filterInput.value = '';
        currentFilterNumbers = [];
        applyFilterAndRedraw();
    });

    // --- Initial Setup ---
    updateMarkedCount();
    displayInitialCombinations();
});