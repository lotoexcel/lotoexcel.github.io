document.addEventListener('DOMContentLoaded', function() {
    // App configuration and state
    const App = {
        // Core data stores
        allCombinations: [], // Master list of all combinations loaded from CSV
        drawnCombinations: new Set(), // IDs of combinations marked as drawn
        filteredCombinations: [], // Combinations after applying filter text and 'show drawn'
        
        // UI pagination control
        offset: 0,
        limitPerPage: 100, // Number of combinations to load per click

        // UI state flags
        showOnlyDrawn: false, // Flag for 'Mostrar Sorteadas' button

        // DOM elements cache
        elements: {
            tableBody: document.getElementById('tabelaCombinacoes'),
            filterInput: document.getElementById('filtro'),
            newDrawnTextarea: document.getElementById('novasSorteadas'),
            markDrawnBtn: document.getElementById('marcarSorteadasBtn'), // Renamed ID in HTML
            loadMoreBtn: document.getElementById('carregarMaisBtn'), // Renamed ID in HTML
            counterSpan: document.getElementById('contador'),
            noResultsDiv: document.getElementById('semResultados'),
            loadCSVBtn: document.getElementById('carregarCSVBtn'),
            importXLSXBtn: document.getElementById('importarXLSXBtn'),
            exportCSVBtn: document.getElementById('exportarCSVBtn'),
            clearAllBtn: document.getElementById('limparTudoBtn'),
            toggleDrawnBtn: document.getElementById('mostrarSorteadasBtn')
        },

        // File input elements (created dynamically to manage 'click' event)
        fileInputs: {
            csv: null,
            xlsx: null
        },

        // --- Initialization ---
        init: function() {
            this.createFileInputs();
            this.setupEventListeners();
            this.loadDrawnHistory(); // Load previously drawn combinations from local storage
            this.updateCounter(); // Initial counter update
        },

        // --- Setup Functions ---
        createFileInputs: function() {
            this.fileInputs.csv = this.createHiddenFileInput('csv');
            this.fileInputs.xlsx = this.createHiddenFileInput('xlsx');
        },

        createHiddenFileInput: function(acceptType) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = `.${acceptType}`;
            input.style.display = 'none';
            document.body.appendChild(input);
            return input;
        },

        setupEventListeners: function() {
            // Main action buttons
            this.elements.loadCSVBtn.addEventListener('click', () => this.fileInputs.csv.click());
            this.elements.importXLSXBtn.addEventListener('click', () => this.fileInputs.xlsx.click());
            this.elements.exportCSVBtn.addEventListener('click', this.exportUpdatedCSV.bind(this));
            this.elements.clearAllBtn.addEventListener('click', this.clearAllData.bind(this));
            this.elements.toggleDrawnBtn.addEventListener('click', this.toggleShowDrawn.bind(this));
            
            // File input change listeners
            this.fileInputs.csv.addEventListener('change', (e) => this.handleFileUpload(e, this.processCSV.bind(this)));
            this.fileInputs.xlsx.addEventListener('change', (e) => this.handleFileUpload(e, this.processXLSX.bind(this)));
            
            // Other interactive elements
            this.elements.filterInput.addEventListener('input', this.applyFilters.bind(this));
            this.elements.markDrawnBtn.addEventListener('click', this.addDrawnCombinationsFromTextarea.bind(this));
            this.elements.loadMoreBtn.addEventListener('click', this.loadMoreCombinations.bind(this));
        },

        // --- File Handling Functions ---
        handleFileUpload: async function(event, callback) {
            const file = event.target.files[0];
            if (!file) return;
            
            const button = event.target === this.fileInputs.csv ? this.elements.loadCSVBtn : this.elements.importXLSXBtn;
            const originalText = button.textContent;
            
            this.showLoading(button);
            
            try {
                const data = await this.readFile(file, event.target === this.fileInputs.csv ? 'text' : 'arraybuffer');
                await callback(data);
            } catch (error) {
                console.error('Error processing file:', error);
                alert(`Erro ao processar arquivo: ${error.message}`);
            } finally {
                this.hideLoading(button, originalText);
                event.target.value = ''; // Clear file input value to allow re-uploading the same file
            }
        },

        readFile: function(file, type) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                if (type === 'text') {
                    reader.readAsText(file);
                } else if (type === 'arraybuffer') {
                    reader.readAsArrayBuffer(file);
                } else {
                    reject(new Error('Invalid file read type.'));
                }
            });
        },

        processCSV: function(csvData) {
            this.resetAppState(); // Clear previous data
            
            return new Promise((resolve) => {
                Papa.parse(csvData, {
                    header: true,
                    skipEmptyLines: true,
                    step: (results) => {
                        const data = results.data;
                        const numbers = [];
                        
                        // Collect the 15 numbers (N1 to N15 or 0-indexed if no header)
                        for (let i = 1; i <= 15; i++) {
                            const num = parseInt(data[`N${i}`] || data[i-1]);
                            if (!isNaN(num) && num >= 1 && num <= 25) {
                                numbers.push(num);
                            }
                        }
                        
                        if (numbers.length === 15) {
                            const id = parseInt(data.id) || this.allCombinations.length + 1;
                            this.allCombinations.push({
                                id: id,
                                numbersFormatted: this.formatNumbersForDisplay(numbers),
                                numbersArray: numbers.sort((a,b) => a - b), // Store sorted array for easier filtering
                                isDrawn: this.drawnCombinations.has(id) || data.sorteada === '1' // Check existing drawn state or CSV flag
                            });
                        }
                    },
                    complete: () => {
                        this.finalizeDataLoad();
                        resolve();
                    },
                    error: (error) => {
                        console.error('PapaParse error:', error);
                        alert('Erro ao processar o CSV. Verifique o formato do arquivo.');
                        this.resetAppState(); // Clear any partial data
                        resolve(); // Resolve to allow finally block to run
                    }
                });
            });
        },

        processXLSX: function(data) {
            if (this.allCombinations.length === 0) {
                alert('Por favor, carregue o CSV com todas as combinações primeiro para importar o histórico.');
                return;
            }
            
            try {
                const dataArray = new Uint8Array(data);
                const workbook = XLSX.read(dataArray, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                
                // Find the starting row for data (after headers)
                let range = XLSX.utils.decode_range(worksheet['!ref']);
                let startRow = 0;
                
                for (let R = range.s.r; R <= range.e.r; ++R) {
                    const cellAddress = { c: 0, r: R }; // Column A
                    const cellRef = XLSX.utils.encode_cell(cellAddress);
                    if (worksheet[cellRef] && worksheet[cellRef].v === "Concurso") { // Assumes "Concurso" is the header
                        startRow = R + 1;
                        break;
                    }
                }
                
                if (startRow === 0) {
                    throw new Error("Não foi possível encontrar o início dos dados ('Concurso' header) no arquivo XLSX.");
                }
                
                const historico = XLSX.utils.sheet_to_json(worksheet, {
                    range: startRow,
                    header: ["concurso", "data", "bola1", "bola2", "bola3", "bola4", "bola5", 
                             "bola6", "bola7", "bola8", "bola9", "bola10", "bola11", "bola12", 
                             "bola13", "bola14", "bola15"]
                });
                
                const combinationsMap = new Map(); // Use Map for efficient lookup
                this.allCombinations.forEach(c => combinationsMap.set(c.numbersFormatted, c));

                let newMarksCount = 0;
                const updatedCombinationIds = [];

                historico.forEach(row => {
                    const numbers = [];
                    for (let i = 1; i <= 15; i++) {
                        const num = parseInt(row[`bola${i}`]);
                        if (!isNaN(num) && num >= 1 && num <= 25) {
                            numbers.push(num);
                        }
                    }
                    
                    if (numbers.length === 15) {
                        const formattedNums = this.formatNumbersForDisplay(numbers);
                        const combination = combinationsMap.get(formattedNums);
                        
                        if (combination && !this.drawnCombinations.has(combination.id)) {
                            this.drawnCombinations.add(combination.id);
                            combination.isDrawn = true; // Update internal state of the combination
                            newMarksCount++;
                            updatedCombinationIds.push(combination.id); // Collect IDs for UI update
                        }
                    }
                });

                this.saveDrawnHistory(); // Save updated drawn state
                this.updateTableRows(updatedCombinationIds); // Update only affected rows in the UI
                alert(`${newMarksCount} combinações marcadas como sorteadas do histórico.`);
                
            } catch (error) {
                console.error('Erro ao processar XLSX:', error);
                alert('Erro ao processar arquivo XLSX: ' + error.message);
            }
        },

        // --- Filtering and Display Functions ---
        toggleShowDrawn: function() {
            this.showOnlyDrawn = !this.showOnlyDrawn;
            
            // Update button text and style
            if (this.showOnlyDrawn) {
                this.elements.toggleDrawnBtn.classList.remove('bg-yellow-500');
                this.elements.toggleDrawnBtn.classList.add('bg-yellow-600');
                this.elements.toggleDrawnBtn.textContent = 'Mostrar Todas';
            } else {
                this.elements.toggleDrawnBtn.classList.remove('bg-yellow-600');
                this.elements.toggleDrawnBtn.classList.add('bg-yellow-500');
                this.elements.toggleDrawnBtn.textContent = 'Mostrar Sorteadas';
            }
            
            this.applyFilters();
        },

        applyFilters: function() {
            const filterText = this.elements.filterInput.value.trim();
            const filterNumbers = filterText.split(/\s+/)
                .map(num => parseInt(num))
                .filter(num => !isNaN(num) && num >= 1 && num <= 25)
                .sort((a,b) => a - b); // Ensure filter numbers are sorted for consistent checking
            
            this.filteredCombinations = this.allCombinations.filter(combination => {
                // Apply number filter
                const matchesNumbers = filterNumbers.length === 0 || 
                                       filterNumbers.every(num => combination.numbersArray.includes(num));
                
                // Apply 'show only drawn' filter
                const matchesDrawnStatus = !this.showOnlyDrawn || combination.isDrawn;

                return matchesNumbers && matchesDrawnStatus;
            });

            this.offset = 0; // Reset pagination offset for new filter
            this.elements.tableBody.innerHTML = ''; // Clear current table display
            this.renderTable(); // Re-render table with filtered results
        },

        renderTable: function() {
            const combinationsToDisplay = this.filteredCombinations.slice(this.offset, this.offset + this.limitPerPage);
            
            if (combinationsToDisplay.length === 0 && this.offset === 0) { // No results found initially
                this.elements.noResultsDiv.classList.remove('hidden');
                this.elements.loadMoreBtn.disabled = true;
                this.elements.loadMoreBtn.textContent = 'Nenhuma combinação para carregar';
            } else {
                this.elements.noResultsDiv.classList.add('hidden');
                combinationsToDisplay.forEach(combination => this.addTableRow(combination));
                this.offset += this.limitPerPage;

                // Disable load more button if no more combinations to load
                if (this.offset >= this.filteredCombinations.length) {
                    this.elements.loadMoreBtn.disabled = true;
                    this.elements.loadMoreBtn.textContent = 'Todas as combinações carregadas';
                } else {
                    this.elements.loadMoreBtn.disabled = false;
                    this.elements.loadMoreBtn.textContent = 'Carregar Mais';
                }
            }
            this.updateCounter();
        },

        addTableRow: function(combination) {
            const tr = document.createElement('tr');
            if (combination.isDrawn) {
                tr.classList.add('combinacao-sorteada');
            }
            tr.dataset.id = combination.id; // Store ID on the row for easier lookup

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">${combination.id}</td>
                <td class="px-6 py-4 whitespace-nowrap">${combination.numbersFormatted}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <button class="deletar-btn bg-red-100 text-red-600 px-3 py-1 rounded-md text-sm mr-2">
                        Deletar
                    </button>
                    <button class="marcar-btn ${combination.isDrawn ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'} px-3 py-1 rounded-md text-sm">
                        ${combination.isDrawn ? '✓ Sorteada' : 'Marcar'}
                    </button>
                </td>
            `;
            
            // Attach event listeners using the current 'this' context of App
            tr.querySelector('.deletar-btn').addEventListener('click', () => this.deleteCombination(combination.id));
            tr.querySelector('.marcar-btn').addEventListener('click', () => this.toggleDrawnStatus(combination.id));
            
            this.elements.tableBody.appendChild(tr);
        },

        loadMoreCombinations: function() {
            this.renderTable();
        },

        updateTableRows: function(idsToUpdate) {
            idsToUpdate.forEach(id => {
                const row = this.elements.tableBody.querySelector(`tr[data-id="${id}"]`);
                if (row) {
                    const combination = this.allCombinations.find(c => c.id === id);
                    if (combination) {
                        row.classList.toggle('combinacao-sorteada', combination.isDrawn);
                        const btn = row.querySelector('.marcar-btn');
                        btn.classList.toggle('bg-gray-100', !combination.isDrawn);
                        btn.classList.toggle('text-gray-600', !combination.isDrawn);
                        btn.classList.toggle('bg-green-100', combination.isDrawn);
                        btn.classList.toggle('text-green-600', combination.isDrawn);
                        btn.textContent = combination.isDrawn ? '✓ Sorteada' : 'Marcar';
                    }
                }
            });
            this.updateCounter();
        },

        // --- Combination Actions ---
        toggleDrawnStatus: function(id) {
            const combination = this.allCombinations.find(c => c.id === id);
            if (!combination) return;

            if (this.drawnCombinations.has(id)) {
                this.drawnCombinations.delete(id);
                combination.isDrawn = false;
            } else {
                this.drawnCombinations.add(id);
                combination.isDrawn = true;
            }
            
            this.updateTableRows([id]); // Update only the specific row
            this.saveDrawnHistory();
        },

        addDrawnCombinationsFromTextarea: function() {
            const input = this.elements.newDrawnTextarea.value.trim();
            if (!input) {
                alert('Insira as combinações sorteadas (uma por linha).');
                return;
            }
            
            const lines = input.split('\n')
                .map(line => line.trim())
                .filter(line => line);
            
            let markedCount = 0;
            const updatedCombinationIds = [];
            
            lines.forEach(line => {
                const numbers = line.split(/\s+/)
                    .map(num => parseInt(num))
                    .filter(num => !isNaN(num) && num >= 1 && num <= 25)
                    .sort((a, b) => a - b);
                
                if (numbers.length === 15) {
                    const formattedNums = this.formatNumbersForDisplay(numbers);
                    const combination = this.allCombinations.find(c => c.numbersFormatted === formattedNums);
                    
                    if (combination && !this.drawnCombinations.has(combination.id)) {
                        this.drawnCombinations.add(combination.id);
                        combination.isDrawn = true;
                        markedCount++;
                        updatedCombinationIds.push(combination.id);
                    }
                }
            });
            
            this.updateTableRows(updatedCombinationIds); // Update affected rows in the UI
            this.saveDrawnHistory();
            this.elements.newDrawnTextarea.value = ''; // Clear textarea
            alert(`${markedCount} combinações marcadas como sorteadas.`);
        },

        deleteCombination: function(id) {
            if (!confirm('Tem certeza que deseja deletar esta combinação?')) {
                return;
            }
            // Remove from allCombinations
            const initialLength = this.allCombinations.length;
            this.allCombinations = this.allCombinations.filter(c => c.id !== id);

            if (this.allCombinations.length < initialLength) {
                // Remove from drawnCombinations if it was marked
                this.drawnCombinations.delete(id);
                this.saveDrawnHistory();

                // Re-apply filters and re-render the table
                this.applyFilters();
                alert(`Combinação ${id} deletada.`);
            } else {
                alert(`Combinação ${id} não encontrada.`);
            }
        },

        exportUpdatedCSV: function() {
            if (this.allCombinations.length === 0) {
                alert('Nenhuma combinação carregada para exportar.');
                return;
            }
            
            let csvContent = "id,N1,N2,N3,N4,N5,N6,N7,N8,N9,N10,N11,N12,N13,N14,N15,sorteada\n";
            
            this.allCombinations.forEach(c => {
                csvContent += [
                    c.id,
                    ...c.numbersArray, // Already sorted
                    this.drawnCombinations.has(c.id) ? '1' : '0'
                ].join(',') + '\n';
            });
            
            this.downloadFile(csvContent, 'combinacoes_lotofacil_atualizado.csv', 'text/csv');
        },

        clearAllData: function() {
            if (confirm('Tem certeza que deseja limpar tudo? Isso removerá todas as combinações e marcações.')) {
                this.resetAppState(true); // Pass true to also clear drawn history
                alert('Todos os dados foram limpos.');
            }
        },

        // --- Helper Functions ---
        showLoading: function(button) {
            button.disabled = true;
            button.innerHTML = '<span class="loading-spinner">⏳</span> Processando...';
        },

        hideLoading: function(button, text) {
            button.disabled = false;
            button.textContent = text;
        },

        resetAppState: function(clearHistory = false) {
            this.allCombinations = [];
            this.filteredCombinations = [];
            this.elements.tableBody.innerHTML = '';
            this.offset = 0;
            this.elements.loadMoreBtn.disabled = false;
            this.elements.loadMoreBtn.textContent = 'Carregar Mais';
            this.elements.filterInput.value = '';
            this.elements.newDrawnTextarea.value = '';
            this.elements.noResultsDiv.classList.add('hidden');
            this.showOnlyDrawn = false; // Reset filter state
            this.elements.toggleDrawnBtn.classList.remove('bg-yellow-600');
            this.elements.toggleDrawnBtn.classList.add('bg-yellow-500');
            this.elements.toggleDrawnBtn.textContent = 'Mostrar Sorteadas';

            if (clearHistory) {
                this.drawnCombinations = new Set();
                localStorage.removeItem('lotofacilSorteadas');
            }
            this.updateCounter();
        },

        finalizeDataLoad: function() {
            // Ensure allCombinations are sorted by ID after loading, if necessary
            this.allCombinations.sort((a, b) => a.id - b.id);
            // After loading, apply filters (which also triggers initial table render)
            this.applyFilters(); 
            this.saveDrawnHistory();
        },

        formatNumbersForDisplay: function(numbersArray) {
            return numbersArray
                .sort((a, b) => a - b) // Ensure numbers are always sorted for consistent formatting
                .map(num => num.toString().padStart(2, '0'))
                .join(' ');
        },

        loadDrawnHistory: function() {
            const history = localStorage.getItem('lotofacilSorteadas');
            if (history) {
                try {
                    // Convert stored array back to Set
                    this.drawnCombinations = new Set(JSON.parse(history));
                } catch (e) {
                    console.error('Erro ao carregar histórico de sorteadas:', e);
                    this.drawnCombinations = new Set(); // Reset if corrupted
                }
            }
        },

        saveDrawnHistory: function() {
            // Convert Set to Array for localStorage
            localStorage.setItem('lotofacilSorteadas', JSON.stringify([...this.drawnCombinations]));
            this.updateCounter();
        },

        updateCounter: function() {
            const total = this.allCombinations.length;
            const displayedCount = Math.min(this.offset, this.filteredCombinations.length);
            const drawnCount = this.drawnCombinations.size;
            this.elements.counterSpan.textContent = `${displayedCount.toLocaleString()}/${this.filteredCombinations.length.toLocaleString()} (${drawnCount} sorteadas)`;
        },

        downloadFile: function(content, fileName, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url); // Clean up the URL object
        }
    };

    // Initialize the application
    App.init();
});