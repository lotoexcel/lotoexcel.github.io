document.addEventListener('DOMContentLoaded', async () => {
    const combinationsContainer = document.getElementById('combinations-container');
    const totalCombinationsEl = document.getElementById('total-combinations');
    const markedCombinationsEl = document.getElementById('marked-combinations');
    const loadJsonBtn = document.getElementById('load-json-btn');
    const jsonFileInput = document.getElementById('json-file-input');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const toggleViewBtn = document.getElementById('toggle-view-btn');
    const filterInput = document.getElementById('filter-input');
    const applyFilterBtn = document.getElementById('apply-filter-btn');
    const clearFilterBtn = document.getElementById('clear-filter-btn');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const loadingMessage = document.getElementById('loading-message');

    // --- Configuration ---
    const TOTAL_JSON_FILES = 32;
    const JSON_FILE_PREFIX = 'json_combinations/combinations_';
    const JSON_FILE_SUFFIX = '.json';
    const MARKED_COMBINATIONS_FILE = 'marked_combinations.json';
    const COMBINATIONS_PER_BATCH_DISPLAY = 25; // Quantidade de combinações a renderizar por vez

    let allCombinationsLoadedForDisplay = []; // Armazena APENAS as combinações carregadas e prontas para exibição (não todas 3.2M)
    let markedIds = new Set(); // Armazena IDs de combinações marcadas
    let loadedFileIndex = -1; // Rastreia qual arquivo JSON foi carregado por último para o carregamento inicial/infinito
    let currentDisplayIndex = 0; // Rastreia o índice inicial para o batch de exibição atual na lista ATUALMENTE sendo exibida
    let showingOnlyMarked = false;
    let currentFilterNumbers = []; // Armazena números para filtragem (ex: [1, 2, 3])
    let currentSearchCombinations = []; // Armazena o resultado completo da busca/filtro (seja todas, ou apenas marcadas, ou filtradas)
    let isSearching = false; // Flag para evitar buscas concorrentes

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

    markedIds = await getMarkedCombinations();

    const saveMarkedCombinations = () => {
        localStorage.setItem('lotofacilMarkedIds', JSON.stringify(Array.from(markedIds)));
        updateMarkedCount();
    };

    // --- UI Update Functions ---
    const updateMarkedCount = () => {
        markedCombinationsEl.textContent = markedIds.size.toLocaleString();
    };

    const updateTotalCombinationsCount = (count) => {
        totalCombinationsEl.textContent = count.toLocaleString();
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

    const renderCombinationsBatch = (combinations, append = true) => {
        if (!append) {
            combinationsContainer.innerHTML = '';
        }
        loadingMessage.classList.add('hidden');

        const fragment = document.createDocumentFragment();
        combinations.forEach(comb => {
            const element = createCombinationElement(comb.id, comb.numbers);
            fragment.appendChild(element);
        });
        combinationsContainer.appendChild(fragment);

        // Define a visibilidade do botão "Carregar Mais"
        if (currentSearchCombinations.length > currentDisplayIndex) {
            loadMoreBtn.classList.remove('hidden');
        } else {
            loadMoreBtn.classList.add('hidden');
        }
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

    // Função para buscar e filtrar em todos os arquivos JSON
    const performFullSearch = async () => {
        if (isSearching) return; // Evita múltiplas buscas ao mesmo tempo
        isSearching = true;

        combinationsContainer.innerHTML = '';
        loadingMessage.textContent = "Buscando combinações... Aguarde (pode levar alguns segundos).";
        loadingMessage.classList.remove('hidden');
        loadMoreBtn.classList.add('hidden');
        updateTotalCombinationsCount(0); // Reseta o contador enquanto busca

        currentSearchCombinations = [];
        let totalProcessedCombinations = 0;

        for (let i = 0; i < TOTAL_JSON_FILES; i++) {
            loadingMessage.textContent = `Buscando combinações... Processando arquivo ${i + 1} de ${TOTAL_JSON_FILES}.`;
            // Pequeno delay para permitir que a UI atualize e evitar bloqueio
            await new Promise(resolve => setTimeout(resolve, 10));

            try {
                const filePath = `${JSON_FILE_PREFIX}${i}${JSON_FILE_SUFFIX}`;
                const response = await fetch(filePath);
                if (!response.ok) {
                    throw new Error(`Erro HTTP! status: ${response.status} para ${filePath}`);
                }
                const data = await response.json();

                data.forEach((numbers, indexInFile) => {
                    const id = `${i}-${indexInFile}`; // Unique ID: "fileIndex-combinationIndex"
                    totalProcessedCombinations++; // Conta todas as combinações processadas

                    let matchesFilter = true;
                    if (currentFilterNumbers.length > 0) {
                        matchesFilter = currentFilterNumbers.every(filterNum => numbers.includes(filterNum));
                    }

                    let matchesMarked = true;
                    if (showingOnlyMarked) {
                        matchesMarked = markedIds.has(id);
                    }

                    if (matchesFilter && matchesMarked) {
                        currentSearchCombinations.push({ id, numbers });
                    }
                });

                updateTotalCombinationsCount(currentSearchCombinations.length); // Atualiza o contador com os resultados encontrados

            } catch (error) {
                console.error(`Erro ao carregar ou filtrar arquivo JSON ${i}:`, error);
                loadingMessage.textContent = `Erro ao carregar combinações do arquivo ${i + 1}.`;
                // Continua para o próximo arquivo, não para a busca completamente
            }
        }

        currentDisplayIndex = 0; // Resetar o índice de exibição para a nova lista de resultados
        renderCombinationsBatch(currentSearchCombinations.slice(currentDisplayIndex, currentDisplayIndex + COMBINATIONS_PER_BATCH_DISPLAY), false);
        currentDisplayIndex += COMBINATIONS_PER_BATCH_DISPLAY;

        loadingMessage.classList.add('hidden');
        isSearching = false;
        // Se houver resultados, o botão 'Carregar Mais' será gerenciado por renderCombinationsBatch
        // Se não houver, ele permanecerá hidden
    };


    const loadNextJsonFileForInitialDisplay = async () => {
        loadedFileIndex++;
        if (loadedFileIndex >= TOTAL_JSON_FILES) {
            console.log('Todos os arquivos JSON foram carregados para exibição inicial/rolagem.');
            return false;
        }

        loadingMessage.textContent = `Carregando arquivo ${loadedFileIndex + 1} de ${TOTAL_JSON_FILES}...`;
        loadingMessage.classList.remove('hidden');
        loadMoreBtn.classList.add('hidden'); // Esconde temporariamente

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

            allCombinationsLoadedForDisplay = allCombinationsLoadedForDisplay.concat(newCombinations);
            updateTotalCombinationsCount(allCombinationsLoadedForDisplay.length);

            console.log(`Carregado ${filePath}. Total de combinações em memória para exibição: ${allCombinationsLoadedForDisplay.length}`);
            loadingMessage.classList.add('hidden');
            return true;
        } catch (error) {
            console.error('Erro ao carregar arquivo JSON:', error);
            loadingMessage.textContent = 'Erro ao carregar combinações.';
            return false;
        }
    };


    const displayInitialCombinations = async () => {
        await loadNextJsonFileForInitialDisplay();
        currentSearchCombinations = allCombinationsLoadedForDisplay; // A lista inicial é a lista de busca atual
        currentDisplayIndex = 0; // Sempre começar do zero para a lista atual
        
        renderCombinationsBatch(currentSearchCombinations.slice(currentDisplayIndex, currentDisplayIndex + COMBINATIONS_PER_BATCH_DISPLAY), false);
        currentDisplayIndex += COMBINATIONS_PER_BATCH_DISPLAY;
        
        // Garante que o total de combinações exibidas na página principal esteja correto
        // para a primeira carga. O total geral da Lotofácil (3.2M) será exibido quando tivermos a contagem real.
        // Por agora, mostra o total de combinacoes carregadas no batch inicial.
        updateTotalCombinationsCount(currentSearchCombinations.length); 

        if (currentSearchCombinations.length > currentDisplayIndex || loadedFileIndex < TOTAL_JSON_FILES - 1) {
             loadMoreBtn.classList.remove('hidden');
        } else {
             loadMoreBtn.classList.add('hidden');
        }
    };

    const loadMoreCombinations = async () => {
        if (isSearching) return; // Não carrega mais enquanto uma busca está ativa

        // Se estiver em modo filtrado ou apenas marcadas, carregue mais do resultado da busca
        if (showingOnlyMarked || currentFilterNumbers.length > 0) {
            const nextBatch = currentSearchCombinations.slice(currentDisplayIndex, currentDisplayIndex + COMBINATIONS_PER_BATCH_DISPLAY);
            renderCombinationsBatch(nextBatch, true);
            currentDisplayIndex += nextBatch.length;
            // Ocultar botão 'Carregar Mais' se todos os resultados filtrados forem exibidos
            if (currentDisplayIndex >= currentSearchCombinations.length) {
                loadMoreBtn.classList.add('hidden');
            }
        } else {
            // Se não estiver filtrando, continue carregando arquivos JSON
            let combinationsToLoad = allCombinationsLoadedForDisplay.slice(currentDisplayIndex, currentDisplayIndex + COMBINATIONS_PER_BATCH_DISPLAY);

            if (combinationsToLoad.length < COMBINATIONS_PER_BATCH_DISPLAY && loadedFileIndex < TOTAL_JSON_FILES - 1) {
                const loaded = await loadNextJsonFileForInitialDisplay();
                if (loaded) {
                    combinationsToLoad = allCombinationsLoadedForDisplay.slice(currentDisplayIndex, currentDisplayIndex + COMBINATIONS_PER_BATCH_DISPLAY);
                }
            }

            renderCombinationsBatch(combinationsToLoad, true);
            currentDisplayIndex += combinationsToLoad.length;

            if (currentDisplayIndex >= allCombinationsLoadedForDisplay.length && loadedFileIndex >= TOTAL_JSON_FILES - 1) {
                loadMoreBtn.classList.add('hidden');
            } else {
                loadMoreBtn.classList.remove('hidden');
            }
        }
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
                        // Após carregar um novo JSON de marcadas, refaça a busca para atualizar a exibição
                        performFullSearch(); 
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
            localStorage.removeItem('lotofacilMarkedIds');
            
            getMarkedCombinations().then(initialSet => {
                markedIds = initialSet;
                saveMarkedCombinations();
                // Após limpar, refaça a busca para atualizar a exibição
                performFullSearch(); 
                alert('Todas as suas marcações foram limpas! As combinações pré-marcadas permanecem.');
            }).catch(error => {
                console.error("Erro ao limpar e recarregar marcações:", error);
                alert("Ocorreu um erro ao limpar as marcações. Por favor, tente novamente.");
            });
        }
    });

    toggleViewBtn.addEventListener('click', () => {
        showingOnlyMarked = !showingOnlyMarked;
        toggleViewBtn.classList.toggle('bg-gray-500', showingOnlyMarked);
        toggleViewBtn.classList.toggle('hover:bg-gray-600', showingOnlyMarked);
        toggleViewBtn.classList.toggle('bg-green-500', !showingOnlyMarked);
        toggleViewBtn.classList.toggle('hover:bg-green-600', !showingOnlyMarked);
        
        // Sempre que a view muda (todas/marcadas), aciona a busca completa
        performFullSearch();
    });

    applyFilterBtn.addEventListener('click', () => {
        const rawInput = filterInput.value.trim();
        if (rawInput) {
            const parsedNumbers = rawInput.split(' ').map(numStr => parseInt(numStr, 10)).filter(num => !isNaN(num) && num >= 1 && num <= 25);
            if (parsedNumbers.length > 0 && parsedNumbers.length <= 15) {
                currentFilterNumbers = parsedNumbers.sort((a, b) => a - b);
                // Aplica o filtro desencadeando a busca completa
                performFullSearch();
            } else {
                alert('Por favor, insira números válidos (1-25) separados por espaços, até 15 números.');
            }
        } else {
            currentFilterNumbers = []; // Limpa o filtro se a entrada estiver vazia
            // Limpa o filtro desencadeando a busca completa
            performFullSearch();
        }
    });

    clearFilterBtn.addEventListener('click', () => {
        filterInput.value = '';
        currentFilterNumbers = [];
        // Limpa o filtro desencadeando a busca completa
        performFullSearch();
    });

    // --- Initial Setup ---
    updateMarkedCount();
    // A carga inicial agora é apenas a primeira parte do "Carregar Mais"
    // ou a exibição de resultados de uma busca se o filtro estiver ativo.
    // Para iniciar, vamos chamar performFullSearch() sem filtro para exibir tudo.
    // Se você quer que o padrão inicial seja apenas o "Carregar Mais" sem pré-filtragem,
    // chame displayInitialCombinations()
    displayInitialCombinations();
});
