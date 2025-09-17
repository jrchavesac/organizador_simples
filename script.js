document.getElementById('currentYear').textContent = new Date().getFullYear();
const typeMapping = {
    'classificacao': 'integer_numeric',
    'posicao': 'integer_numeric',
    'ranking': 'integer_numeric',
    'inscricao': 'numeric_string',
    'matricula': 'numeric_string',
    'nota': 'numeric',
    'pontuacao': 'numeric',
    'total': 'numeric',
    'acertos': 'numeric',
    'idade': 'integer_numeric'
};
const predefinedColumnOptions = [{
    value: '',
    text: 'Selecione...'
}, {
    value: 'Classificação',
    text: 'Classificação'
}, {
    value: 'Nome',
    text: 'Nome'
}, {
    value: 'Inscrição',
    text: 'Inscrição'
}, {
    value: 'Nota',
    text: 'Nota'
}, {
    value: 'Pontuação',
    text: 'Pontuação'
}, {
    value: 'Posição',
    text: 'Posição'
}, {
    value: 'Matrícula',
    text: 'Matrícula'
}, {
    value: 'Acertos',
    text: 'Acertos'
}, {
    value: 'Idade',
    text: 'Idade'
}, {
    value: 'Outro',
    text: 'Outro (digite abaixo)'
}];

// Encapsulamento de variáveis de estado
const appState = {
    sortDirections: {},
    currentColumnNames: [],
    columnTypes: {},
    isRenamingColumns: false,
    lastInferredData: null,
    currentTableData: [],
    lastOriginalColumnNames: [],
    isManualMapping: false,
    manualMappingData: null
};

const patterns = [
    // == PADRÕES PREVISTOS ORDENADOS PELA PRIORIDADE CORRETA ==
    {
        name: 'PF (Agente e Escrivão)',
        regex: /(\d+),\s*([A-ZÀ-Ÿ\s.()-]+?),\s*(\d+\.?\d*),\s*(\d+),\s*(\d+\.?\d*),\s*(\d+),\s*(\d+\.?\d*),\s*(\d+),\s*(\d+\.?\d*),\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi,
        columns: [
            'Inscrição',
            'Nome',
            'Nota Básicos Bloco I',
            'Acertos Básicos Bloco I',
            'Nota Básicos Bloco II',
            'Acertos Básicos Bloco II',
            'Nota Específicos Bloco III',
            'Acertos Específicos Bloco III',
            'Nota Objetiva',
            'Nota Discursiva (P2)'
        ],
        calculation: {
            source1: 'Nota Objetiva',
            source2: 'Nota Discursiva (P2)',
            destination: 'Nota Final Total'
        }
    },
    {
        name: 'PF (Delegado)',
        regex: /(\d+),\s*([A-ZÀ-Ÿ\s.()-]+?),\s*(\d+\.?\d*),\s*(\d+),\s*(\d+\.?\d*),\s*(\d+\.?\d*),\s*(\d+\.?\d*),\s*(\d+\.?\d*),\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi,
        columns: [
            'Inscrição',
            'Nome',
            'Nota Específicos (P1)',
            'Acertos Específicos (P1)',
            'Nota Discursiva Q1',
            'Nota Discursiva Q2',
            'Nota Discursiva Q3',
            'Nota Discursiva Peça Prof.',
            'Nota Discursiva Total'
        ],
        calculation: {
            source1: 'Nota Específicos (P1)',
            source2: 'Nota Discursiva Total',
            destination: 'Nota Final Total'
        }
    },
    {
        name: 'PF (Perito)',
        regex: /(\d+),\s*([A-ZÀ-Ÿ\s.()-]+?),\s*(\d+\.?\d*),\s*(\d+),\s*(\d+\.?\d*),\s*(\d+),\s*(\d+\.?\d*),\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi,
        columns: [
            'Inscrição',
            'Nome',
            'Nota Básicos (P1)',
            'Acertos Básicos (P1)',
            'Nota Específicos (P1)',
            'Acertos Específicos (P1)',
            'Nota Objetiva',
            'Nota Discursiva (P2)'
        ],
        calculation: {
            source1: 'Nota Objetiva',
            source2: 'Nota Discursiva (P2)',
            destination: 'Nota Final Total'
        }
    },
    {
        name: 'PRF (Inscrição, Nome, 5 Notas)',
        regex: /(\d+),\s*([A-ZÀ-Ÿ\s.()-]+?),\s*(\d+\.?\d*),\s*(\d+\.?\d*),\s*(\d+\.?\d*),\s*(\d+\.?\d*),\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi,
        columns: ['Inscrição', 'Nome', 'Nota Bloco I', 'Nota Bloco II', 'Nota Bloco III', 'Nota Objetiva', 'Nota Discursiva'],
        calculation: {
            source1: 'Nota Objetiva',
            source2: 'Nota Discursiva',
            destination: 'Nota Final Total'
        }
    },
    {
        name: 'Inscrição, Nome, Nota P1, Nota P2, Nota Objetiva',
        regex: /(\d+),\s*([A-ZÀ-Ÿ\s.()-]+?),\s*(\d+\.?\d*),\s*(\d+\.?\d*),\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi,
        columns: [
            'Inscrição',
            'Nome',
            'Nota P1',
            'Nota P2',
            'Nota Objetiva'
        ]
    },
    {
        name: 'Classificação, Inscrição, Nome, Nota',
        regex: /(\d+),\s*(\d+),\s*([A-ZÀ-Ÿ\s.()-]+?),\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi,
        columns: ['Classificação', 'Inscrição', 'Nome', 'Nota']
    },
	{
        name: 'Inscrição, Nome, Nota, Classificação',
        regex: /(\d+),\s*([A-ZÀ-Ÿ\s.()-]+?),\s*(\d+\.?\d*),\s*(\d+)\s*(?:\/\s*|$)/gi,
        columns: ['Inscrição', 'Nome', 'Nota', 'Classificação']
    },
    {
        name: 'Inscrição, Nome, Nota',
        regex: /(\d+),\s*([A-ZÀ-Ÿ\s.()-]+?),\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi,
        columns: ['Inscrição', 'Nome', 'Nota']
    },
    {
        name: 'Nome, Inscrição, Nota',
        regex: /([A-ZÀ-Ÿ\s.()-]+?),\s*(\d+),\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi,
        columns: ['Nome', 'Inscrição', 'Nota']
    },
    {
        name: 'Inscrição; Nome; Nota',
        regex: /(\d+);\s*([A-ZÀ-Ÿ\s.()-]+?);\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi,
        columns: ['Inscrição', 'Nome', 'Nota']
    },
    {
        name: 'Inscrição / Nome / Posição / Nota',
        regex: /(\d+)\s*\/\s*([A-ZÀ-Ÿ\s.()-]+?)\s*\/\s*(\d+)\s*\/\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi,
        columns: ['Inscrição', 'Nome', 'Posição', 'Nota']
    },
    {
        name: 'Classificação Inscrição Nome Nota (Concatenado)',
        regex: /(\d+)(\d+)([A-ZÀ-Ÿ\s.()-]+?)(\d+\.?\d*)/gi,
        columns: ['Classificação', 'Inscrição', 'Nome', 'Nota']
    },
    {
        name: 'Inscrição Nome Nota (Concatenado)',
        regex: /(\d+)([A-ZÀ-Ÿ\s.()-]+?)(\d+\.?\d*)/gi,
        columns: ['Inscrição', 'Nome', 'Nota']
    },
    {
        name: 'Nome, Idade',
        regex: /([A-ZÀ-Ÿ\s.()-]+?),\s*(\d+)\s*(?:\/\s*|$)/gi,
        columns: ['Nome', 'Idade']
    },
    {
        name: 'Classificação, Nome, Nota (Tabulado)',
        regex: /(\d+)[ºª]?\s*(?:\t|\s{2,})([A-ZÀ-Ÿ\s.-]+?)(?:\t|\s{2,})(\d+\.?\d*)/gi,
        columns: ['Classificação', 'Nome', 'Nota']
    },
    {
        name: 'Dados com Rótulos (Inscrição, Candidato, Nota)',
        regex: /Inscrição:\s*(\d+),\s*Candidato:\s*([A-ZÀ-Ÿ\s.-]+?),\s*Nota Final:\s*(\d+\.?\d*)/gi,
        columns: ['Inscrição', 'Nome', 'Nota']
    },
    {
        name: 'Nome com Condição Especial Opcional',
        regex: /(\d+)\.\s*([A-ZÀ-Ÿ\s.-]+?)(\s*\(.*?\))?\s*-\s*(\d+\.?\d*)/gi,
        columns: ['Classificação', 'Nome', 'Condição Especial', 'Nota']
    },
    {
        name: 'Inscrição, Nome, Múltiplas Notas (Ponto e Vírgula)',
        regex: /(\d+);\s*([A-ZÀ-Ÿ\s.-]+?);\s*(\d+\.?\d*);\s*(\d+\.?\d*);\s*(\d+\.?\d*);\s*(\d+\.?\d*)/gi,
        columns: ['Inscrição', 'Nome', 'Nota (Port.)', 'Nota (Mat.)', 'Nota (Espec.)', 'Nota Final']
    },
    {
        name: 'Lista de Nomes (separados por vírgula)',
        regex: /([A-ZÀ-Ÿ\s.()-]+?)(?:,|$|\s*\/\s*)/gi,
        columns: ['Nome']
    }
];

function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, duration);
}

function toggleActionButtons(disable, exceptId = null) {
    const buttonIds = ['gerarPdfButton', 'exportCsvButton', 'toggleRenameHeadersButton', 'mapColumnsButton'];
    buttonIds.forEach(id => {
        if (id !== exceptId) {
            const button = document.getElementById(id);
            if (button) {
                button.disabled = disable;
            }
        }
    });
}

function getColumnType(columnName) {
    const lowerName = columnName.toLowerCase();
    for (const key in typeMapping) {
        if (lowerName.includes(key)) return typeMapping[key];
    }
    if (lowerName.includes('nome')) return 'string';
    return 'string';
}

function inferAndApplyPattern(processedString) {
    if (!processedString) {
        return {
            columnNames: [],
            organizedData: [],
            patternDetected: null
        };
    }

    let candidateBlocks = [];
    let finalColumnNames = [];
    let patternFound = null;

    for (const pattern of patterns) {
        const tempBlocks = [];
        let match;
        pattern.regex.lastIndex = 0;
        while ((match = pattern.regex.exec(processedString)) !== null) {
            tempBlocks.push(match.slice(1).map(field => field ? field.trim() : null));
        }
        if (tempBlocks.length > 0) {
            finalColumnNames = pattern.columns;
            candidateBlocks = tempBlocks;
            patternFound = pattern;
            break;
        }
    }

    if (!patternFound && processedString.length > 0) {
        const lines = processedString.split('/').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length > 0) {
            const sampleLine = lines[0];
            let fields = sampleLine.split(/[\s,;]+/).filter(f => f.length > 0);
            if (fields.length > 1) {
                finalColumnNames = Array.from({
                    length: fields.length
                }, (_, i) => `Campo ${i + 1}`);
                candidateBlocks = lines.map(line => line.split(/[\s,;]+/).filter(f => f.length > 0));
                candidateBlocks = candidateBlocks.filter(block => block.length === fields.length);
                if (candidateBlocks.length === 0) {
                    candidateBlocks = [
                        [processedString]
                    ];
                    finalColumnNames = ['Dados Brutos'];
                }
            } else {
                candidateBlocks = [
                    [processedString]
                ];
                finalColumnNames = ['Dados Brutos'];
            }
        }
    }

    const organizedData = [];
    candidateBlocks.forEach(rowFields => {
        const rowData = new Array(finalColumnNames.length).fill(null);
        for (let i = 0; i < Math.min(rowFields.length, finalColumnNames.length); i++) {
            const value = rowFields[i];
            const colName = finalColumnNames[i];
            const inferredType = getColumnType(colName);
            if (value !== null && value !== undefined && value !== '') {
                let cleanedValue = value.trim();
                if (inferredType === 'numeric') rowData[i] = parseFloat(cleanedValue);
                else if (inferredType === 'integer_numeric') rowData[i] = parseInt(cleanedValue, 10);
                else rowData[i] = cleanedValue;
            }
        }
        organizedData.push(rowData);
    });

    return {
        columnNames: finalColumnNames,
        organizedData,
        patternDetected: patternFound
    };
}

function parseWithManualSettings() {
    const dataInput = document.getElementById('dataInput').value.trim();
    const rowSep = document.getElementById('rowSeparator').value.replace(/\\n/g, '\n');
    const colSep = document.getElementById('columnSeparator').value.replace(/\\t/g, '\t');
    const fieldsCount = parseInt(document.getElementById('fieldCount').value);

    if (!dataInput) return [];

    let organizedData = [];

    if (colSep === rowSep && fieldsCount > 0) {
        const allFields = dataInput.split(colSep).map(f => f.trim()).filter(Boolean);

        for (let i = 0; i < allFields.length; i += fieldsCount) {
            const chunk = allFields.slice(i, i + fieldsCount);
            while (chunk.length < fieldsCount) {
                chunk.push('');
            }
            organizedData.push(chunk);
        }
    } else {
        const lines = dataInput.split(rowSep).filter(line => line.trim() !== '');
        organizedData = lines.map(line => {
            const fields = line.split(colSep).map(field => field.trim());
            while (fields.length < fieldsCount) {
                fields.push('');
            }
            return fields.slice(0, fieldsCount);
        });
    }
    return organizedData;
}

function ordenarDados(columnNames, data) {
    data.sort((a, b) => {
        const sortIndexes = {
            notaObjetiva: columnNames.indexOf('Nota Objetiva'),
            notaP2: columnNames.indexOf('Nota P2'),
            notaFinal: columnNames.indexOf('Nota Final') !== -1 ? columnNames.indexOf('Nota Final') : columnNames.indexOf('Nota Final Total'),
            nota: columnNames.indexOf('Nota'),
            classificacao: columnNames.findIndex(name => /classificação|posição|ranking/i.test(name)),
            nome: columnNames.indexOf('Nome'),
            idade: columnNames.indexOf('Idade')
        };

        if (sortIndexes.notaObjetiva !== -1) {
            const valA = a[sortIndexes.notaObjetiva] !== null ? parseFloat(a[sortIndexes.notaObjetiva]) : -Infinity;
            const valB = b[sortIndexes.notaObjetiva] !== null ? parseFloat(b[sortIndexes.notaObjetiva]) : -Infinity;
            if (valA !== valB) return valB - valA;
            if (sortIndexes.notaP2 !== -1) {
                const desempateA = a[sortIndexes.notaP2] !== null ? parseFloat(a[sortIndexes.notaP2]) : -Infinity;
                const desempateB = b[sortIndexes.notaP2] !== null ? parseFloat(b[sortIndexes.notaP2]) : -Infinity;
                if (desempateA !== desempateB) return desempateB - desempateA;
            }
        }
        if (sortIndexes.classificacao !== -1) {
            const valA = a[sortIndexes.classificacao] !== null ? parseInt(a[sortIndexes.classificacao]) : Infinity;
            const valB = b[sortIndexes.classificacao] !== null ? parseInt(b[sortIndexes.classificacao]) : Infinity;
            if (valA !== valB) return valA - valB;
        }
        if (sortIndexes.notaFinal !== -1) {
            const valA = a[sortIndexes.notaFinal] !== null ? parseFloat(a[sortIndexes.notaFinal]) : -Infinity;
            const valB = b[sortIndexes.notaFinal] !== null ? parseFloat(b[sortIndexes.notaFinal]) : -Infinity;
            if (valA !== valB) return valB - valA;
        }
        if (sortIndexes.nota !== -1) {
            const valA = a[sortIndexes.nota] !== null ? parseFloat(a[sortIndexes.nota]) : -Infinity;
            const valB = b[sortIndexes.nota] !== null ? parseFloat(b[sortIndexes.nota]) : -Infinity;
            if (valA !== valB) return valB - valA;
        }
        if (sortIndexes.idade !== -1) {
            const valA = a[sortIndexes.idade] !== null ? parseInt(a[sortIndexes.idade]) : -Infinity;
            const valB = b[sortIndexes.idade] !== null ? parseInt(b[sortIndexes.idade]) : -Infinity;
            if (valA !== valB) return valB - valA;
        }
        if (sortIndexes.nome !== -1) {
            const nomeA = a[sortIndexes.nome] || '';
            const nomeB = b[sortIndexes.nome] || '';
            return String(nomeA).localeCompare(String(nomeB), undefined, {
                numeric: true,
                sensitivity: 'base'
            });
        }
        return 0;
    });
}

function resetAppState() {
    appState.sortDirections = {};
    appState.currentColumnNames = [];
    appState.columnTypes = {};
    appState.isRenamingColumns = false;
    appState.lastInferredData = null;
    appState.currentTableData = [];
    appState.lastOriginalColumnNames = [];
    appState.isManualMapping = false;
    appState.manualMappingData = null;
}

function organizeData() {
    resetAppState();
    
	const dataInput = document.getElementById('dataInput').value.trim();

    // 1. Chame a função de limpeza e armazene o resultado
    const dadosLimpos = limparEntradaDados(dataInput);
    
    // ⭐ 2. Atualize o valor do campo de entrada com os dados limpos
    document.getElementById('dataInput').value = dadosLimpos;
	
    const containerResult = document.getElementById('ContainerResult');
    const organizeButton = document.getElementById('organizeButton');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const organizeText = document.getElementById('organizeText');
    const mapColumnsButton = document.getElementById('mapColumnsButton');

    if (appState.isRenamingColumns) {
        toggleColumnRename();
    }
    toggleActionButtons(false);

    if (dataInput === "") {
        alert("Por favor, digite algum dado na 'Lista dos candidatos' para organizar.");
        return;
    }

    organizeText.style.display = 'none';
    loadingSpinner.style.display = 'inline-block';
    organizeButton.disabled = true;

    setTimeout(() => {
        let organizedData;
        let columnNames;
        let patternDetected;
        let isCsv = false;

        try {
            const lines = dataInput.split('\n');
            const hasMultipleLines = lines.length > 1;
            let delimiter = '';

            if (hasMultipleLines && lines[0].includes('"')) {
                if (lines[0].includes(';')) {
                    delimiter = ';';
                } else if (lines[0].includes(',')) {
                    delimiter = ',';
                }
            }

            if (delimiter) {
                isCsv = true;
                columnNames = lines[0].split(delimiter).map(name => name.replace(/"/g, '').trim());
                organizedData = lines.slice(1).map(line => line.split(delimiter).map(field => field.replace(/"/g, '').trim()));
                organizedData = organizedData.filter(row => row.some(field => field.length > 0));

                if (organizedData.length === 0) {
                    throw new Error("CSV não possui dados válidos.");
                }

                appState.currentColumnNames = columnNames;
                appState.currentTableData = organizedData;
                atualizarTabela(appState.currentColumnNames, appState.currentTableData);
                containerResult.style.display = 'block';
                mapColumnsButton.style.display = 'none';
                showToast("Dados do CSV organizados!");
                return;
            }

            const result = inferAndApplyPattern(dadosLimpos);
            // Uso de .map para clonagem de arrays
            organizedData = result.organizedData.map(row => [...row]);
            columnNames = [...result.columnNames];
            patternDetected = result.patternDetected;

            if (!patternDetected) {
                showToast("Padrão não detectado. Por favor, mapeie os dados manualmente.");
                showManualMappingContainer();
                document.getElementById('manualMappingContainer').scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                return;
            }

            if (patternDetected && patternDetected.calculation) {
                const {
                    source1,
                    source2,
                    destination
                } = patternDetected.calculation;
                columnNames.push(destination);
                organizedData = organizedData.map(row => {
                    const value1 = parseFloat(row[columnNames.indexOf(source1)]);
                    const value2 = parseFloat(row[columnNames.indexOf(source2)]);
                    const total = value1 + value2;
                    return [...row, total];
                });
            }

            appState.lastOriginalColumnNames = [...columnNames];
            appState.lastInferredData = {
                columnNames,
                organizedData,
                patternDetected
            };

            appState.columnTypes = {};
            columnNames.forEach(name => {
                appState.columnTypes[name] = getColumnType(name);
            });

            if (patternDetected && patternDetected.name !== 'Lista de Nomes (separados por vírgula)') {
                ordenarDados(columnNames, organizedData);
            }

            const hasExistingClassification = columnNames.some(name => /classificação|posição|ranking/i.test(name));
            if (!hasExistingClassification) {
                organizedData.forEach((row, index) => {
                    row.unshift(index + 1);
                });
                columnNames.unshift('Classificação');
                appState.columnTypes['Classificação'] = 'integer_numeric';
            }

            appState.currentColumnNames = columnNames;
            appState.currentTableData = organizedData;

            atualizarTabela(appState.currentColumnNames, appState.currentTableData);

            containerResult.style.display = 'block';
            mapColumnsButton.style.display = 'flex';
            document.getElementById('manualMappingContainer').style.display = 'none';
            document.querySelector('form').style.display = 'block';
            containerResult.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            showToast("Dados organizados automaticamente!");

        } catch (error) {
            console.error(error);
            showToast("Ocorreu um erro ao organizar os dados.");
        } finally {
            organizeText.style.display = 'inline';
            loadingSpinner.style.display = 'none';
            organizeButton.disabled = false;
        }
    }, 100);
}

function showManualMappingContainer() {
    appState.isManualMapping = true;
    document.getElementById('ContainerResult').style.display = 'none';
    document.getElementById('manualMappingContainer').style.display = 'block';

    const rawData = document.getElementById('dataInput').value.trim();
    if (!rawData) {
        showToast("Por favor, insira dados para poder mapear.", 'warning');
        return;
    }
	
	const dadosLimpos = limparEntradaDados(rawData);
    document.getElementById('dataInput').value = dadosLimpos;
	
    const rowSep = document.getElementById('rowSeparator').value === '\\n' ? '\n' : document.getElementById('rowSeparator').value;
    const colSep = document.getElementById('columnSeparator').value === '\\t' ? '\t' : document.getElementById('columnSeparator').value;
    const userFieldCount = parseInt(document.getElementById('fieldCount').value);

    let initialFields;

    if (colSep === rowSep && userFieldCount > 0) {
        const allFields = rawData.split(colSep).filter(f => f.trim() !== '');
        initialFields = allFields.slice(0, userFieldCount);
    } else if (appState.lastInferredData && appState.lastInferredData.columnNames) {
        initialFields = [...appState.lastInferredData.columnNames];
        if (initialFields[0].toLowerCase() === 'classificação') {
            initialFields.shift();
        }
    } else {
        const lines = rawData.split(rowSep).filter(line => line.trim() !== '');
        if (lines.length === 0) {
            showToast("Nenhum dado válido para mapear.", 'warning');
            return;
        }
        const firstLine = lines[0];
        initialFields = firstLine.split(colSep).filter(f => f.trim() !== '');
    }

    if (initialFields.length !== userFieldCount) {
        document.getElementById('fieldCount').value = initialFields.length;
    }

    createColumnNameInputs(initialFields);
    updatePreviewTable();
}

function limparEntradaDados(inputString) {
    if (!inputString) return "";

    const lines = inputString.split(/\r\n|\r|\n/);
    const regexDiarioOficial = /DIÁRIO OFICIAL/i;
    const filteredLines = lines.filter(line => !regexDiarioOficial.test(line));
    let processedString = filteredLines.join(' ');

    processedString = processedString.replace(/-\s+/g, '');
    processedString = processedString.replace(/º|°/g, '').replace(/(\d+),(\d{1,2})(?![0-9])/g, '$1.$2').trim();
    processedString = processedString.replace(/\.\s*$/, '').trim();

    return processedString;
}

// Função ÚNICA para criação dos inputs de nome de coluna
function createColumnNameInputs(initialColumnNames) {
    const fieldsCount = parseInt(document.getElementById('fieldCount').value);
    const container = document.getElementById('columnNameInputs');
    container.innerHTML = '';

    for (let i = 0; i < fieldsCount; i++) {
        const div = document.createElement('div');
        div.className = 'w-1/2 md:w-1/3 lg:w-1/4 px-2 mb-4';
        const label = document.createElement('label');
        label.htmlFor = `colName${i}`;
        label.className = 'block text-gray-700 dark:text-gray-300 font-bold mb-2';
        label.textContent = `Coluna ${i + 1}`;
        div.appendChild(label);
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `colName${i}`;
        input.name = `colName${i}`;
        input.className = 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 dark:bg-gray-800 leading-tight focus:outline-none focus:shadow-outline';

        if (initialColumnNames && initialColumnNames[i]) {
            input.value = initialColumnNames[i];
        }

        input.addEventListener('input', updatePreviewTable);
        div.appendChild(input);
        container.appendChild(div);
    }
}

function hideManualMappingContainer() {
    appState.isManualMapping = false;
    document.getElementById('organizeForm').style.display = 'block';
    document.getElementById('manualMappingContainer').style.display = 'none';
    document.getElementById('ContainerResult').style.display = 'block';
}

function updatePreviewTable() {
    const fieldsCount = parseInt(document.getElementById('fieldCount').value);
    let organizedData = parseWithManualSettings();

    const columnNames = [];
    for (let i = 0; i < fieldsCount; i++) {
        const colNameInput = document.getElementById(`colName${i}`);
        const colName = colNameInput ? colNameInput.value.trim() : `Coluna ${i + 1}`;
        columnNames.push(colName || `Coluna ${i + 1}`);
    }

    ordenarDados(columnNames, organizedData);

    const previewTableHeaders = document.getElementById('previewTableHeaders');
    previewTableHeaders.innerHTML = '';
    columnNames.forEach(name => {
        const th = document.createElement('th');
        th.className = 'px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200';
        th.textContent = name;
        previewTableHeaders.appendChild(th);
    });

    const previewTableBody = document.getElementById('previewTableBody');
    previewTableBody.innerHTML = '';
    organizedData.slice(0, 5).forEach(row => {
        const tr = document.createElement('tr');
        for (let i = 0; i < fieldsCount; i++) {
            const td = document.createElement('td');
            td.className = 'border px-4 py-2 dark:border-gray-500';

            const colName = columnNames[i];
            const cellValue = row[i];
            const numericValue = parseFloat(cellValue);
            let displayValue = cellValue || '';

            if (!isNaN(numericValue) && (colName.includes('Nota') || colName.includes('Acertos')) && (numericValue % 1 === 0)) {
                displayValue = parseInt(numericValue, 10);
            } else {
                displayValue = cellValue;
            }

            td.textContent = displayValue;
            tr.appendChild(td);
        }
        previewTableBody.appendChild(tr);
    });
}

function applyManualMapping() {
    const newColumnNames = [];
    const fieldsCount = parseInt(document.getElementById('fieldCount').value);
    for (let i = 0; i < fieldsCount; i++) {
        const colNameInput = document.getElementById(`colName${i}`);
        newColumnNames.push((colNameInput && colNameInput.value.trim()) || `Coluna ${i + 1}`);
    }

    let organizedData = parseWithManualSettings();

    if (organizedData.length === 0) {
        showToast('Nenhum dado válido para aplicar o mapeamento.', 'warning');
        return;
    }

    appState.lastOriginalColumnNames = [...newColumnNames];
    appState.columnTypes = {};
    newColumnNames.forEach(name => {
        appState.columnTypes[name] = getColumnType(name);
    });

    ordenarDados(newColumnNames, organizedData);

    const addRank = !newColumnNames.some(name => /classificação|posição|ranking/i.test(name));
    let finalColumnNamesForTable = [...newColumnNames];
    if (addRank) {
        organizedData.forEach((row, index) => {
            row.unshift(index + 1);
        });
        finalColumnNamesForTable.unshift('Classificação');
    }

    atualizarTabela(finalColumnNamesForTable, organizedData);
    document.getElementById('ContainerResult').style.display = 'block';
    hideManualMappingContainer();
    document.getElementById('ContainerResult').scrollIntoView({
        behavior: 'smooth'
    });
    showToast('Mapeamento manual aplicado com sucesso!');
}

function atualizarTabela(columnNames, data) {
    const tableHeaders = document.getElementById('tableHeaders');
    const tableBody = document.getElementById('tableBody');
    tableHeaders.innerHTML = '';
    tableBody.innerHTML = '';
    appState.currentColumnNames = columnNames;
    appState.currentTableData = data;
    const newSortDirections = {};
    appState.currentColumnNames.forEach((name, index) => {
        const oldIndex = -1;
        if (oldIndex !== -1 && appState.sortDirections[oldIndex] !== undefined) {
            newSortDirections[index] = appState.sortDirections[oldIndex];
        } else {
            newSortDirections[index] = true;
        }
    });
    appState.sortDirections = newSortDirections;
    const globalTooltip = document.getElementById('global-tooltip');

    columnNames.forEach((columnName, index) => {
        const th = document.createElement('th');
        th.className = 'relative group py-2';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'absolute top-0 left-0 p-1 text-red-500 opacity-0 group-hover:opacity-100 group-hover:text-red-700 transition-opacity duration-200';
        deleteBtn.textContent = '×';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteColumn(index);
        };

        deleteBtn.addEventListener('mouseenter', () => {
            globalTooltip.classList.remove('opacity-0', 'invisible');
        });
        deleteBtn.addEventListener('mouseleave', () => {
            globalTooltip.classList.add('opacity-0', 'invisible');
        });
        deleteBtn.addEventListener('mousemove', (e) => {
            globalTooltip.style.left = e.clientX + 15 + 'px';
            globalTooltip.style.top = e.clientY + 15 + 'px';
        });

        const contentContainer = document.createElement('div');
        contentContainer.className = 'flex items-center justify-center px-4';

        const textSpan = document.createElement('span');
        textSpan.textContent = columnName;

        const arrowSpan = document.createElement('span');
        arrowSpan.className = 'sort-arrow ml-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200';

        th.appendChild(deleteBtn);
        contentContainer.appendChild(textSpan);
        contentContainer.appendChild(arrowSpan);

        th.appendChild(contentContainer);
        th.onclick = () => ordenarTabela(index);

        tableHeaders.appendChild(th);
    });

    data.forEach(row => {
        const tr = document.createElement('tr');
        for (let i = 0; i < columnNames.length; i++) {
            const td = document.createElement('td');
            let value = row[i];
            const colName = columnNames[i];
            const colType = appState.columnTypes[colName] || getColumnType(colName);
            if (value !== null && value !== undefined) {
                value = String(value).replace(/[\r\n]+/g, ' ').trim();
            }
            if (value !== null && value !== undefined) {
                if (colType === 'numeric') {
                    if (colName.includes('Acertos') || (parseFloat(value) % 1 === 0)) {
                        td.textContent = parseInt(value, 10);
                    } else {
                        td.textContent = parseFloat(value).toFixed(2);
                    }
                } else if (colType === 'integer_numeric') {
                    td.textContent = parseInt(value, 10);
                } else if (colType === 'numeric_string') {
                    td.textContent = String(value);
                } else {
                    td.textContent = String(value);
                }
            } else {
                td.textContent = '';
            }
            tr.appendChild(td);
        }
        tableBody.appendChild(tr);
    });
}

function deleteColumn(columnIndex) {
    if (confirm(`Tem certeza que deseja excluir a coluna "${appState.currentColumnNames[columnIndex]}"?`)) {
        appState.currentColumnNames.splice(columnIndex, 1);
        appState.currentTableData.forEach(row => {
            row.splice(columnIndex, 1);
        });
        atualizarTabela(appState.currentColumnNames, appState.currentTableData);
        showToast('Coluna excluída com sucesso!');
        document.getElementById('global-tooltip').classList.add('opacity-0', 'invisible');
    }
}

function ordenarTabela(columnIndex) {
    if (appState.isRenamingColumns) {
        return;
    }
    const table = document.getElementById('resultTable');
    const tbody = table.getElementsByTagName('tbody')[0];
    const rows = Array.from(tbody.getElementsByTagName('tr'));
    const headerCell = table.querySelector(`th:nth-child(${columnIndex + 1})`);
    const headerText = headerCell.textContent.replace(/[\u2191\u2193]/g, '').replace('×', '').trim();
    const currentArrow = headerCell.querySelector('.sort-arrow');
    document.querySelectorAll('#tableHeaders th .sort-arrow').forEach(arrow => {
        arrow.classList.remove('opacity-100');
        arrow.classList.add('opacity-0');
        arrow.innerHTML = '';
    });
    appState.sortDirections[columnIndex] = !appState.sortDirections[columnIndex];
    const colType = appState.columnTypes[headerText] || getColumnType(headerText);
    const sortedRows = rows.sort((a, b) => {
        const textA = a.cells[columnIndex].textContent.trim();
        const textB = b.cells[columnIndex].textContent.trim();
        let valA, valB;
        if (colType === 'numeric' || colType === 'integer_numeric') {
            valA = parseFloat(textA.replace(',', '.'));
            valB = parseFloat(textB.replace(',', '.'));
            valA = isNaN(valA) ? (appState.sortDirections[columnIndex] ? Infinity : -Infinity) : valA;
            valB = isNaN(valB) ? (appState.sortDirections[columnIndex] ? Infinity : -Infinity) : valB;
            return appState.sortDirections[columnIndex] ? valA - valB : valB - valA;
        } else if (colType === 'numeric_string') {
            valA = parseInt(textA);
            valB = parseInt(textB);
            valA = isNaN(valA) ? (appState.sortDirections[columnIndex] ? Infinity : -Infinity) : valA;
            valB = isNaN(valB) ? (appState.sortDirections[columnIndex] ? Infinity : -Infinity) : valB;
            return appState.sortDirections[columnIndex] ? valA - valB : valB - valA;
        } else {
            return appState.sortDirections[columnIndex] ? textA.localeCompare(textB, undefined, {
                numeric: true,
                sensitivity: 'base'
            }) : textB.localeCompare(textA, undefined, {
                numeric: true,
                sensitivity: 'base'
            });
        }
    });
    tbody.innerHTML = '';
    sortedRows.forEach(row => tbody.appendChild(row));
    currentArrow.classList.add('opacity-100');
    currentArrow.innerHTML = appState.sortDirections[columnIndex] ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>';
}
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const htmlElement = document.documentElement;

function updateThemeToggle(isDark) {
    if (isDark) {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
        themeToggle.title = 'Mudar para modo claro';
    } else {
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
        themeToggle.title = 'Mudar para modo escuro';
    }
}

function applyTheme(theme) {
    if (theme === 'dark') {
        htmlElement.classList.add('dark');
        updateThemeToggle(true);
    } else {
        htmlElement.classList.remove('dark');
        updateThemeToggle(false);
    }
}
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    applyTheme(savedTheme);
} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
} else {
    applyTheme('light');
}
window.onload = function() {
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    document.getElementById('ContainerResult').style.display = 'none';
    document.getElementById('mapColumnsButton').style.display = 'none';
};
themeToggle.addEventListener('click', () => {
    if (htmlElement.classList.contains('dark')) {
        applyTheme('light');
        localStorage.setItem('theme', 'light');
    } else {
        applyTheme('dark');
        localStorage.setItem('theme', 'dark');
    }
});

function pesquisarTabela() {
    let input = document.getElementById('searchInput').value.toUpperCase();
    let table = document.getElementById('resultTable');
    let tr = table.getElementsByTagName('tr');
    for (let i = 1; i < tr.length; i++) {
        let td = tr[i].getElementsByTagName('td');
        let found = false;
        for (let j = 0; j < td.length; j++) {
            if (td[j] && td[j].innerHTML.toUpperCase().indexOf(input) > -1) {
                found = true;
                break;
            }
        }
        tr[i].style.display = found ? '' : 'none';
    }
}

function gerarPDF() {
    if (appState.isRenamingColumns) {
        toggleColumnRename();
    }

    try {
        const {
            jsPDF
        } = window.jspdf;
        const margin = 10;
        let y = margin;
        const lineHeight = 10;
        const table = document.getElementById('resultTable');
        if (!table || table.querySelector('tbody').children.length === 0) {
            alert("Erro: Gere a tabela primeiro clicando em 'Organizar'!");
            return;
        }

        const headers = Array.from(document.querySelectorAll('#tableHeaders th'))
            .map(th => {
                const textSpan = th.querySelector('.flex.items-center.justify-center.px-4 span');
                return textSpan ? textSpan.textContent.trim() : th.textContent.replace(/[\u2191\u2193]/g, '').replace('×', '').trim();
            });

        const orientation = headers.length > 7 ? 'l' : 'p';
        const doc = new jsPDF({
            orientation: orientation,
            unit: 'mm',
            format: 'a4'
        });
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        const customTitle = document.getElementById('pdfTitleInput').value.trim();
        const title = customTitle === '' ? "Relatório de Resultados" : customTitle;
        const splitTitle = doc.splitTextToSize(title, pageWidth - 2 * margin);
        doc.text(splitTitle, pageWidth / 2, y, {
            align: 'center'
        });
        y += (splitTitle.length * lineHeight) + (lineHeight / 5);

        const rows = Array.from(table.querySelectorAll('tbody tr'))
            .map(tr => Array.from(tr.querySelectorAll('td'))
                .map(td => td.textContent.replace(/\s*\n\s*/g, ' ').trim()));

        doc.autoTable({
            head: [headers],
            body: rows,
            startY: y,
            margin: {
                left: margin,
                right: margin
            },
            styles: {
                fontSize: 10,
                cellPadding: 2,
                halign: 'center',
                valign: 'middle',
                lineColor: [226, 232, 240],
                lineWidth: 0.5
            },
            headStyles: {
                fillColor: [76, 175, 80],
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle'
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            didDrawPage: function(data) {}
        });

        window.open(doc.output('bloburl'), '_blank');
        showToast('PDF gerado e aberto em uma nova aba.');
    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Erro ao gerar PDF. Veja o console para detalhes.");
    }
}

function exportarCSV() {
    if (appState.isRenamingColumns) {
        toggleColumnRename();
    }
    const table = document.getElementById('resultTable');
    const visibleRows = Array.from(table.querySelectorAll('tbody tr:not([style*="display: none"])'));
    if (visibleRows.length === 0) {
        alert("Não há dados visíveis para exportar. Limpe a busca ou verifique os dados.");
        return;
    }
    const headers = Array.from(table.querySelectorAll('thead th'))
        .map(th => {
            const textSpan = th.querySelector('.flex.items-center.justify-center.px-4 span');
            let headerText = textSpan ? textSpan.textContent.trim() : th.textContent.replace(/[\u2191\u2193]/g, '').trim();
            headerText = headerText.replace('×', '').trim();
            headerText = headerText.replace(/[\r\n]+/g, ' ').trim();
            return `"${headerText.replace(/"/g, '""')}"`;
        });
    const rows = visibleRows.map(tr => {
        return Array.from(tr.querySelectorAll('td'))
            .map(td => `"${td.textContent.replace(/"/g, '""')}"`)
            .join(';');
    });
    const csvContent = headers.join(';') + '\n' + rows.join('\n');
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], {
        type: 'text/csv;charset=utf-8;'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'dados_organizados.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('Arquivo CSV gerado com sucesso, verifique seus downloads!');
}

function toggleColumnRename() {
    if (appState.isManualMapping) {
        return;
    }
    appState.isRenamingColumns = !appState.isRenamingColumns;

    const table = document.getElementById('resultTable');
    const headers = document.querySelectorAll('#tableHeaders th');
    const deleteButtons = document.querySelectorAll('#tableHeaders th button');
    const button = document.getElementById('toggleRenameHeadersButton');
    const icon = button.querySelector('i');
    const textSpan = button.querySelector('span:not(.tooltip-text)');
    const tooltip = button.querySelector('.tooltip-text');

    if (appState.isRenamingColumns) {
        toggleActionButtons(true, 'toggleRenameHeadersButton');
        table.classList.add('table-editing-mode');

        icon.classList.remove('fa-pencil-alt');
        icon.classList.add('fa-save');
        textSpan.textContent = 'Salvar Nomes';
        tooltip.textContent = 'Salve os novos nomes dos cabeçalhos.';
        button.classList.remove('bg-purple-600', 'hover:bg-purple-700', 'dark:bg-purple-500', 'dark:hover:bg-purple-400');
        button.classList.add('bg-green-600', 'hover:bg-green-700', 'dark:bg-green-500', 'dark:hover:bg-green-400');

        deleteButtons.forEach(btn => btn.style.display = 'none');

        headers.forEach((th, index) => {
            const originalText = appState.currentColumnNames[index];
            th.onclick = null;
            th.classList.add('editable-header');
            th.innerHTML = `<input type="text" value="${originalText}" class="w-full bg-transparent text-center font-semibold p-0 text-sm border-none focus:ring-0" data-original-index="${index}">`;
        });

        const firstInput = headers[0].querySelector('input');
        if (firstInput) firstInput.focus();

    } else {
        toggleActionButtons(false);
        table.classList.remove('table-editing-mode');

        icon.classList.remove('fa-save');
        icon.classList.add('fa-pencil-alt');
        textSpan.textContent = 'Renomear Cabeçalhos';
        tooltip.textContent = 'Mude os nomes dos cabeçalhos.';
        button.classList.remove('bg-green-600', 'hover:bg-green-700', 'dark:bg-green-500', 'dark:hover:bg-green-400');
        button.classList.add('bg-purple-600', 'hover:bg-purple-700', 'dark:bg-purple-500', 'dark:hover:bg-purple-400');

        const newColumnNames = [];
        headers.forEach(th => {
            const input = th.querySelector('input');
            const newName = input ? input.value.trim() : th.textContent.trim();
            newColumnNames.push(newName);
        });

        appState.currentColumnNames = newColumnNames;
        atualizarTabela(appState.currentColumnNames, appState.currentTableData);
        showToast('Nomes dos cabeçalhos atualizados!');
    }
}


document.addEventListener('DOMContentLoaded', (event) => {
    document.getElementById('rowSeparator').addEventListener('change', updatePreviewTable);
    document.getElementById('columnSeparator').addEventListener('change', updatePreviewTable);
    document.getElementById('fieldCount').addEventListener('input', () => {
        const fieldCount = parseInt(document.getElementById('fieldCount').value) || 0;
        const existingNames = Array.from(document.querySelectorAll('#columnNameInputs input')).map(input => input.value);
        while (existingNames.length < fieldCount) {
            existingNames.push(`Coluna ${existingNames.length + 1}`);
        }
        createColumnNameInputs(existingNames.slice(0, fieldCount));
        updatePreviewTable();
    });
});
