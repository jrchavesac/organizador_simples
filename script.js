document.getElementById('currentYear').textContent = new Date().getFullYear();
let sortDirections = {}; let currentColumnNames = []; let columnTypes = {}; let isRenamingColumns = false; let lastInferredData = null;
let currentTableData = [];
let lastOriginalColumnNames = [];
const typeMapping = { 'classificacao': 'integer_numeric', 'posicao': 'integer_numeric', 'ranking': 'integer_numeric', 'inscricao': 'numeric_string', 'matricula': 'numeric_string', 'nota': 'numeric', 'pontuacao': 'numeric', 'total': 'numeric', 'acertos': 'numeric', 'idade': 'integer_numeric' };
const predefinedColumnOptions = [ { value: '', text: 'Selecione...' }, { value: 'Classificação', text: 'Classificação' }, { value: 'Nome', text: 'Nome' }, { value: 'Inscrição', text: 'Inscrição' }, { value: 'Nota', text: 'Nota' }, { value: 'Pontuação', text: 'Pontuação' }, { value: 'Posição', text: 'Posição' }, { value: 'Matrícula', text: 'Matrícula' }, { value: 'Acertos', text: 'Acertos' }, { value: 'Idade', text: 'Idade' }, { value: 'Outro', text: 'Outro (digite abaixo)' } ];

let isManualMapping = false;
let manualMappingData = null;

const patterns = [
    // == PADRÕES REORDENADOS PARA PRIORIDADE CORRETA ==
    { 
        name: 'Classificação, Inscrição, Nome, Nota', 
        regex: /(\d+),\s*(\d+),\s*([A-ZÀ-Ÿ\s.-]+?),\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi, 
        columns: ['Classificação', 'Inscrição', 'Nome', 'Nota'] 
    },
    { 
        name: 'Inscrição, Nome, Nota', 
        regex: /(\d+),\s*([A-ZÀ-Ÿ\s.-]+?),\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi, 
        columns: ['Inscrição', 'Nome', 'Nota'] 
    },
    { name: 'Nome, Inscrição, Nota', regex: /([A-ZÀ-Ÿ\s.-]+?),\s*(\d+),\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi, columns: ['Nome', 'Inscrição', 'Nota'] }, 
    { name: 'Inscrição; Nome; Nota', regex: /(\d+);\s*([A-ZÀ-Ÿ\s.-]+?);\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi, columns: ['Inscrição', 'Nome', 'Nota'] }, 
    { name: 'Inscrição / Nome / Posição / Nota', regex: /(\d+)\s*\/\s*([A-ZÀ-Ÿ\s.-]+?)\s*\/\s*(\d+)\s*\/\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi, columns: ['Inscrição', 'Nome', 'Posição', 'Nota'] }, 
    { name: 'Classificação Inscrição Nome Nota (Concatenado)', regex: /(\d+)(\d+)([A-ZÀ-Ÿ\s.-]+?)(\d+\.?\d*)/gi, columns: ['Classificação', 'Inscrição', 'Nome', 'Nota'] }, 
    { name: 'Inscrição Nome Nota (Concatenado)', regex: /(\d+)([A-ZÀ-Ÿ\s.-]+?)(\d+\.?\d*)/gi, columns: ['Inscrição', 'Nome', 'Nota'] }, 
    { name: 'Nome, Idade', regex: /([A-ZÀ-Ÿ\s.-]+?),\s*(\d+)\s*(?:\/\s*|$)/gi, columns: ['Nome', 'Idade'] },
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
    const buttonIds = ['generatePdfButton', 'exportCsvButton', 'toggleRenameHeadersButton', 'mapColumnsButton'];
    buttonIds.forEach(id => {
        if (id !== exceptId) {
            const button = document.getElementById(id);
            if (button) {
                button.disabled = disable;
            }
        }
    });
}

function getColumnType(columnName) { const lowerName = columnName.toLowerCase(); for (const key in typeMapping) { if (lowerName.includes(key)) return typeMapping[key]; } if (lowerName.includes('nome')) return 'string'; return 'string'; }
function isNumeric(str) { if (str === null || str === undefined || str.trim() === '') return false; return /^-?\d+(\.\d+)?$/.test(str.trim()); }
function isInteger(str) { if (str === null || str === undefined || str.trim() === '') return false; return /^-?\d+$/.test(str.trim()); }
function inferAndApplyPattern(rawInputString) { if (!rawInputString) { return { columnNames: [], organizedData: [], patternDetected: true }; } let sanitizedString = rawInputString.replace(/-\s+/g, ''); let processedString = sanitizedString.replace(/\r\n|\r/g, ' ').replace(/º|°/g, '').replace(/(\d+),(\d{1,2})(?![0-9])/g, '$1.$2').trim(); let candidateBlocks = []; let finalColumnNames = []; let patternFound = false; for (const pattern of patterns) { const tempBlocks = []; let match; pattern.regex.lastIndex = 0; while ((match = pattern.regex.exec(processedString)) !== null) { tempBlocks.push(match.slice(1).map(field => field ? field.trim() : null)); } if (tempBlocks.length > 0) { finalColumnNames = pattern.columns; candidateBlocks = tempBlocks; patternFound = true; break; } } if (!patternFound && processedString.length > 0) { const lines = processedString.split('/').map(line => line.trim()).filter(line => line.length > 0); if (lines.length > 0) { const sampleLine = lines[0]; let fields = sampleLine.split(/[\s,;]+/).filter(f => f.length > 0); if (fields.length > 1) { finalColumnNames = Array.from({ length: fields.length }, (_, i) => `Campo ${i + 1}`); candidateBlocks = lines.map(line => line.split(/[\s,;]+/).filter(f => f.length > 0)); candidateBlocks = candidateBlocks.filter(block => block.length === fields.length); if (candidateBlocks.length === 0) { candidateBlocks = [[processedString]]; finalColumnNames = ['Dados Brutos']; } } else { candidateBlocks = [[processedString]]; finalColumnNames = ['Dados Brutos']; } } } const organizedData = []; candidateBlocks.forEach(rowFields => { const rowData = new Array(finalColumnNames.length).fill(null); for (let i = 0; i < Math.min(rowFields.length, finalColumnNames.length); i++) { const value = rowFields[i]; const colName = finalColumnNames[i]; const inferredType = getColumnType(colName); if (value !== null && value !== undefined && value !== '') { let cleanedValue = value.trim(); if (inferredType === 'numeric') rowData[i] = parseFloat(cleanedValue); else if (inferredType === 'integer_numeric') rowData[i] = parseInt(cleanedValue, 10); else rowData[i] = cleanedValue; } } organizedData.push(rowData); }); return { columnNames: finalColumnNames, organizedData, patternDetected: patternFound }; }

// Funções para a funcionalidade de mapeamento manual
function showManualMappingContainer() {
    isManualMapping = true;
    document.getElementById('ContainerResult').style.display = 'none';
    document.getElementById('manualMappingContainer').style.display = 'block';

    const rawData = document.getElementById('dataInput').value.trim();
    if (!rawData) {
        showToast("Por favor, insira dados para poder mapear.", 'warning');
        return;
    }

    const rowSep = document.getElementById('rowSeparator').value === '\\n' ? '\n' : document.getElementById('rowSeparator').value;
    const colSep = document.getElementById('columnSeparator').value === '\\t' ? '\t' : document.getElementById('columnSeparator').value;
    
    const lines = rawData.split(rowSep).filter(line => line.trim() !== '');

    if (lines.length === 0) {
        showToast("Nenhum dado válido para mapear.", 'warning');
        return;
    }

    // AQUI ESTÁ A MUDANÇA: Sempre pegamos os nomes de colunas dos dados brutos
    // para inicializar o painel de mapeamento, independentemente de
    // lastInferredData já existir. Isso garante que a 'Classificação'
    // nunca seja considerada um dado de entrada.
    const firstLine = lines[0];
    const initialFields = firstLine.split(colSep).filter(f => f.trim() !== '');
    
    document.getElementById('fieldCount').value = initialFields.length;
    
    createColumnNameInputs(initialFields);
    updatePreviewTable();
}

// Substitua esta função no seu script.js
function createColumnNameInputs(initialColumnNames) {
    const fieldsCount = parseInt(document.getElementById('fieldCount').value);
    const container = document.getElementById('columnNameInputs');
    container.innerHTML = '';
    
    // AQUI ESTÁ A LÓGICA CORRETA
    // Verifica se a primeira coluna é a "Classificação" e a remove temporariamente
    let columnsToDisplay = [...initialColumnNames];
    if (columnsToDisplay.length > 0 && columnsToDisplay[0].toLowerCase() === 'classificação') {
        columnsToDisplay.shift(); // Remove a primeira coluna (Classificação)
    }

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
        
        // Agora usamos a lista ajustada (columnsToDisplay) para preencher o input
        if (columnsToDisplay[i]) {
            input.value = columnsToDisplay[i];
        }

        input.addEventListener('input', updatePreviewTable);
        div.appendChild(input);
        container.appendChild(div);
    }
}

function updatePreviewTable() {
    const dataInput = document.getElementById('dataInput').value;
    const rowSep = document.getElementById('rowSeparator').value === '\\n' ? '\n' : document.getElementById('rowSeparator').value;
    const colSep = document.getElementById('columnSeparator').value === '\\t' ? '\t' : document.getElementById('columnSeparator').value;
    const lines = dataInput.split(rowSep).filter(line => line.trim() !== '');

    const fieldsCount = parseInt(document.getElementById('fieldCount').value);

    // Gerar cabeçalhos de prévia
    const previewTableHeaders = document.getElementById('previewTableHeaders');
    previewTableHeaders.innerHTML = '';
    for (let i = 0; i < fieldsCount; i++) {
        const th = document.createElement('th');
        th.className = 'px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200';
        th.textContent = document.getElementById(`colName${i}`)?.value || `Coluna ${i + 1}`;
        previewTableHeaders.appendChild(th);
    }

    // Gerar corpo da tabela de prévia
    const previewTableBody = document.getElementById('previewTableBody');
    previewTableBody.innerHTML = '';
    lines.slice(0, 5).forEach(line => {
        const tr = document.createElement('tr');
        const fields = line.split(colSep).map(f => f.trim());
        for (let i = 0; i < fieldsCount; i++) {
            const td = document.createElement('td');
            td.className = 'border px-4 py-2 dark:border-gray-500';
            td.textContent = fields[i] || '';
            tr.appendChild(td);
        }
        previewTableBody.appendChild(tr);
    });
}

function organizeData() {
    const dataInput = document.getElementById('dataInput').value.trim();
    const containerResult = document.getElementById('ContainerResult');
    const organizeButton = document.getElementById('organizeButton');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const organizeText = document.getElementById('organizeText');
    const patternWarning = document.getElementById('patternWarning');
    const manualMappingArea = document.getElementById('manualMappingArea');
    const mapColumnsButton = document.getElementById('mapColumnsButton');

    if (isRenamingColumns) {
        toggleColumnRename();
    }
    toggleActionButtons(false);
    patternWarning.style.display = 'none';
    manualMappingArea.style.display = 'none';

    if (dataInput === "") {
        alert("Por favor, digite algum dado na 'Lista dos candidatos' para organizar.");
        return;
    }

    organizeText.style.display = 'none';
    loadingSpinner.style.display = 'inline-block';
    organizeButton.disabled = true;

    setTimeout(() => {
        try {
            let { columnNames, organizedData, patternDetected } = inferAndApplyPattern(dataInput);
            
            // AQUI ESTÁ A MUDANÇA: Salva os nomes de colunas originais antes de adicionar a classificação
            lastOriginalColumnNames = [...columnNames];
            
            lastInferredData = { columnNames, organizedData, patternDetected };
            containerResult.style.display = 'block';
            mapColumnsButton.style.display = 'flex';

            columnTypes = {};
            columnNames.forEach(name => {
                columnTypes[name] = getColumnType(name);
            });
            
            organizedData.sort((a, b) => {
                const sortIndexes = {
                    nota: columnNames.indexOf('Nota Final') !== -1 ? columnNames.indexOf('Nota Final') : columnNames.indexOf('Nota'),
                    classificacao: columnNames.findIndex(name => /classificação|posição|ranking/i.test(name)),
                    nome: columnNames.indexOf('Nome'),
                    inscricao: columnNames.indexOf('Inscrição'),
                    idade: columnNames.indexOf('Idade')
                };

                if (sortIndexes.classificacao !== -1) {
                    const valA = a[sortIndexes.classificacao] !== null ? parseInt(a[sortIndexes.classificacao]) : Infinity;
                    const valB = b[sortIndexes.classificacao] !== null ? parseInt(b[sortIndexes.classificacao]) : Infinity;
                    if (valA !== valB) return valA - valB;
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
                    return String(nomeA).localeCompare(String(nomeB), undefined, { numeric: true, sensitivity: 'base' });
                }

                return 0;
            });

            let finalColumnNamesForTable = [...columnNames];
            const hasExistingClassification = finalColumnNamesForTable.some(name => /classificação|posição|ranking/i.test(name));

            if (!hasExistingClassification) {
                organizedData.forEach((row, index) => {
                    row.unshift(index + 1);
                });
                finalColumnNamesForTable.unshift('Classificação');
                columnTypes['Classificação'] = 'integer_numeric';
            }

            updateTable(finalColumnNamesForTable, organizedData);
            document.getElementById('ContainerResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
            showToast('Dados organizados com sucesso!');
        } finally {
            organizeText.style.display = 'inline';
            loadingSpinner.style.display = 'none';
            organizeButton.disabled = false;
        }
    }, 100);
}

function showManualMapping() { if (isRenamingColumns) { toggleColumnRename(); } toggleActionButtons(true, 'mapColumnsButton'); document.getElementById('patternWarning').style.display = 'block'; document.getElementById('manualMappingArea').style.display = 'block'; displayManualMappingOptions(currentColumnNames, currentTableData); document.getElementById('manualMappingArea').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function displayManualMappingOptions(columnNames, data) { const columnMappingInputsDiv = document.getElementById('columnMappingInputs'); columnMappingInputsDiv.innerHTML = ''; const displayLimit = columnNames.length; columnNames.slice(0, displayLimit).forEach((colName, index) => { const div = document.createElement('div'); div.className = 'flex flex-col items-center'; const label = document.createElement('label'); label.className = 'mb-1 text-sm dark:text-gray-300'; label.textContent = `Coluna ${index + 1}:`; div.appendChild(label); const select = document.createElement('select'); select.className = 'p-2 border rounded-md dark:bg-gray-700 dark:text-gray-100'; select.setAttribute('data-col-index', index); predefinedColumnOptions.forEach(option => { const opt = document.createElement('option'); opt.value = option.value; opt.textContent = option.text; if (option.value === colName) { opt.selected = true; } select.appendChild(opt); }); div.appendChild(select); const customInput = document.createElement('input'); customInput.type = 'text'; customInput.placeholder = 'Nome personalizado'; customInput.className = 'mt-2 p-2 border rounded-md w-32 dark:bg-gray-700 dark:text-gray-100'; if (!predefinedColumnOptions.some(opt => opt.value === colName && opt.value !== '')) { customInput.value = colName; select.value = 'Outro'; customInput.style.display = 'block'; } else { customInput.style.display = 'none'; } div.appendChild(customInput); select.addEventListener('change', (event) => { if (event.target.value === 'Outro') { customInput.style.display = 'block'; customInput.focus(); } else { customInput.style.display = 'none'; customInput.value = ''; } }); columnMappingInputsDiv.appendChild(div); }); document.getElementById('resultTable').style.display = 'none'; document.getElementById('tableHeaders').innerHTML = ''; document.getElementById('tableBody').innerHTML = ''; displayPreviewRows(data, columnNames); }
function displayPreviewRows(data, columnNames) { const tableHeaders = document.getElementById('tableHeaders'); const tableBody = document.getElementById('tableBody'); const previewRowCount = Math.min(data.length, 5); const headersToDisplay = columnNames.length > 0 ? columnNames : Array.from({ length: data[0].length }, (_, i) => `Campo ${i + 1}`); headersToDisplay.forEach((name, index) => { const th = document.createElement('th'); th.textContent = name; tableHeaders.appendChild(th); }); for (let i = 0; i < previewRowCount; i++) { const tr = document.createElement('tr'); const rowData = data[i]; for (let j = 0; j < headersToDisplay.length; j++) { const td = document.createElement('td'); const cellData = rowData && rowData[j] !== undefined ? rowData[j] : ''; td.textContent = String(cellData || '').substring(0, 50) + (String(cellData || '').length > 50 ? '...' : ''); tr.appendChild(td); } tableBody.appendChild(tr); } document.getElementById('resultTable').style.display = 'table'; }

function applyManualMapping() {
    const columnMappingInputsDiv = document.getElementById('columnMappingInputs');
    const selects = columnMappingInputsDiv.querySelectorAll('select');
    const customInputs = columnMappingInputsDiv.querySelectorAll('input[type="text"]');
    const newColumnNames = [];
    const originalDataIndices = [];
    let allMapped = true;

    selects.forEach((select, i) => {
        const selectedValue = select.value;
        const originalIndex = parseInt(select.getAttribute('data-col-index'));
        let finalColName;
        if (selectedValue === 'Outro') {
            finalColName = customInputs[i].value.trim();
        } else {
            finalColName = selectedValue;
        }
        if (finalColName === '' || finalColName === 'Selecione...') {
            allMapped = false;
        }
        newColumnNames.push(finalColName);
        originalDataIndices.push(originalIndex);
    });

    if (!allMapped) {
        alert("Por favor, nomeie todas as colunas ou selecione uma opção antes de aplicar o mapeamento.");
        return;
    }
    if (newColumnNames.length === 0 || newColumnNames.length !== selects.length) {
        return;
    }

    const rawData = document.getElementById('dataInput').value.trim();
    const rowSep = document.getElementById('rowSeparator').value === '\\n' ? '\n' : document.getElementById('rowSeparator').value;
    const colSep = document.getElementById('columnSeparator').value === '\\t' ? '\t' : document.getElementById('columnSeparator').value;
    const fieldsCount = parseInt(document.getElementById('fieldCount').value);
    
    let organizedData = [];

    // AQUI ESTÁ A LÓGICA CORRETA: Se os separadores forem iguais, o sistema usa a contagem de campos para dividir
    if (colSep === rowSep && fieldsCount > 0) {
        const allFields = rawData.split(colSep).filter(f => f.trim() !== '');
        
        let tempRow = [];
        for (let i = 0; i < allFields.length; i++) {
            tempRow.push(allFields[i].trim());
            if (tempRow.length === fieldsCount) {
                organizedData.push(tempRow);
                tempRow = [];
            }
        }
        if (tempRow.length > 0) {
            organizedData.push(tempRow);
        }
    } else {
        // Lógica padrão para separadores diferentes
        const candidates = rawData.split(rowSep).filter(line => line.trim() !== '');
        organizedData = candidates.map(candidateLine => candidateLine.replace(/\n/g, ' ').split(colSep).map(field => field.trim()));
    }
    
    lastOriginalColumnNames = [...newColumnNames];

    let remappedData = organizedData.map(row => {
        const newRow = [];
        originalDataIndices.forEach(originalIdx => {
            newRow.push(row[originalIdx]);
        });
        return newRow;
    });

    columnTypes = {};
    newColumnNames.forEach(name => {
        columnTypes[name] = getColumnType(name);
    });

    const hasExistingClassification = newColumnNames.some(name => /classificação|posição|ranking/i.test(name));

    if (!hasExistingClassification) {
        remappedData.sort((a, b) => {
            const notaIndex = newColumnNames.indexOf('Nota');
            if (notaIndex !== -1) {
                const valA = a[notaIndex] !== null ? parseFloat(a[notaIndex]) : -Infinity;
                const valB = b[notaIndex] !== null ? parseFloat(b[notaIndex]) : -Infinity;
                if (valB - valA !== 0) return valB - valA;
            }
            return 0;
        });
        remappedData.forEach((row, index) => {
            row.unshift(index + 1);
        });
        newColumnNames.unshift('Classificação');
        columnTypes['Classificação'] = 'integer_numeric';
    }

    document.getElementById('patternWarning').style.display = 'none';
    document.getElementById('manualMappingArea').style.display = 'none';
    updateTable(newColumnNames, remappedData);
    document.getElementById('resultTable').style.display = 'table';
    toggleActionButtons(false);
    showToast('Mapeamento aplicado com sucesso!');
}

// Funções para a funcionalidade de mapeamento manual
function showManualMappingContainer() {
    isManualMapping = true;
    document.getElementById('ContainerResult').style.display = 'none';
    document.getElementById('manualMappingContainer').style.display = 'block';

    const rawData = document.getElementById('dataInput').value.trim();
    if (!rawData) {
        showToast("Por favor, insira dados para poder mapear.", 'warning');
        return;
    }

    const rowSep = document.getElementById('rowSeparator').value === '\\n' ? '\n' : document.getElementById('rowSeparator').value;
    const colSep = document.getElementById('columnSeparator').value === '\\t' ? '\t' : document.getElementById('columnSeparator').value;
    const userFieldCount = parseInt(document.getElementById('fieldCount').value);
    
    let initialFields;

    // AQUI ESTÁ A MUDANÇA: Lógica para separadores ambíguos no mapeamento manual
    if (colSep === rowSep && userFieldCount > 0) {
        // Se os separadores de linha e coluna são os mesmos e o usuário
        // definiu a quantidade de campos, usamos essa informação para dividir.
        const allFields = rawData.split(colSep).filter(f => f.trim() !== '');
        initialFields = allFields.slice(0, userFieldCount);
    } else if (lastInferredData && lastInferredData.columnNames) {
        // Usa os dados inferidos se já existirem (com a remoção da classificação, se aplicável)
        initialFields = [...lastInferredData.columnNames];
        if (initialFields[0].toLowerCase() === 'classificação') {
            initialFields.shift();
        }
    } else {
        // Lógica de fallback
        const lines = rawData.split(rowSep).filter(line => line.trim() !== '');
        if (lines.length === 0) {
            showToast("Nenhum dado válido para mapear.", 'warning');
            return;
        }
        const firstLine = lines[0];
        initialFields = firstLine.split(colSep).filter(f => f.trim() !== '');
    }

    // Se o userFieldCount for diferente do número de campos inferidos,
    // ajusta o campo de texto de contagem para refletir a nova lógica.
    if (initialFields.length !== userFieldCount) {
        document.getElementById('fieldCount').value = initialFields.length;
    }
    
    createColumnNameInputs(initialFields);
    updatePreviewTable();
}


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
        
        // AQUI ESTÁ A MUDANÇA: Usamos o array de nomes de colunas que recebemos como parâmetro
        if (initialColumnNames && initialColumnNames[i]) {
            input.value = initialColumnNames[i];
        }

        input.addEventListener('input', updatePreviewTable);
        div.appendChild(input);
        container.appendChild(div);
    }
}

function hideManualMappingContainer() {
    isManualMapping = false;
    document.getElementById('organizeForm').style.display = 'block';
    document.getElementById('manualMappingContainer').style.display = 'none';
}

function updatePreviewTable() {
    const dataInput = document.getElementById('dataInput').value.trim();
    const rowSep = document.getElementById('rowSeparator').value === '\\n' ? '\n' : document.getElementById('rowSeparator').value;
    const colSep = document.getElementById('columnSeparator').value === '\\t' ? '\t' : document.getElementById('columnSeparator').value;
    const fieldsCount = parseInt(document.getElementById('fieldCount').value);

    let organizedLines = [];
    
    // AQUI ESTÁ A LÓGICA CORRETA: Se os separadores forem iguais, usa a contagem de campos
    if (colSep === rowSep && fieldsCount > 0) {
        // Primeiro, dividimos todo o texto em uma única lista de campos
        const allFields = dataInput.split(colSep).filter(f => f.trim() !== '');
        
        // Em seguida, agrupamos os campos para formar as linhas (candidatos)
        let tempCandidate = [];
        for (let i = 0; i < allFields.length; i++) {
            tempCandidate.push(allFields[i].trim());
            if (tempCandidate.length === fieldsCount) {
                organizedLines.push(tempCandidate.join(colSep));
                tempCandidate = [];
            }
        }
        if (tempCandidate.length > 0) {
            organizedLines.push(tempCandidate.join(colSep));
        }

    } else {
        // Lógica padrão para separadores diferentes
        const candidates = dataInput.split(rowSep).filter(line => line.trim() !== '');
        organizedLines = candidates.map(candidateLine => candidateLine.replace(/\n/g, ' '));
    }

    const columnNames = [];
    for (let i = 0; i < fieldsCount; i++) {
        const colNameInput = document.getElementById(`colName${i}`);
        columnNames.push(colNameInput ? colNameInput.value.trim() : `Coluna ${i + 1}`);
    }

    const notaIndex = columnNames.findIndex(name => /nota|note|final/i.test(name));
    if (notaIndex !== -1) {
        organizedLines.sort((a, b) => {
            const fieldsA = a.split(colSep);
            const fieldsB = b.split(colSep);
            const notaA = parseFloat(fieldsA[notaIndex]) || -Infinity;
            const notaB = parseFloat(fieldsB[notaIndex]) || -Infinity;
            return notaB - notaA;
        });
    }

    const previewTableHeaders = document.getElementById('previewTableHeaders');
    previewTableHeaders.innerHTML = '';
    for (let i = 0; i < fieldsCount; i++) {
        const th = document.createElement('th');
        th.className = 'px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200';
        th.textContent = columnNames[i] || `Coluna ${i + 1}`;
        previewTableHeaders.appendChild(th);
    }

    const previewTableBody = document.getElementById('previewTableBody');
    previewTableBody.innerHTML = '';
    organizedLines.slice(0, 5).forEach(line => {
        const tr = document.createElement('tr');
        const fields = line.split(colSep).map(f => f.trim());
        for (let i = 0; i < fieldsCount; i++) {
            const td = document.createElement('td');
            td.className = 'border px-4 py-2 dark:border-gray-500';
            td.textContent = fields[i] || '';
            tr.appendChild(td);
        }
        previewTableBody.appendChild(tr);
    });
}

function applyManualMapping() {
    // 1. Pega os nomes de colunas do formulário de mapeamento manual
    const newColumnNames = [];
    const fieldsCount = parseInt(document.getElementById('fieldCount').value);
    for (let i = 0; i < fieldsCount; i++) {
        const colNameInput = document.getElementById(`colName${i}`);
        if (colNameInput && colNameInput.value.trim() !== '') {
            newColumnNames.push(colNameInput.value.trim());
        } else {
            newColumnNames.push(`Coluna ${i + 1}`);
        }
    }

    // 2. Pega os dados originais e os re-organiza usando os novos separadores
    const rawData = document.getElementById('dataInput').value.trim();
    if (!rawData) {
        showToast('Nenhum dado para aplicar o mapeamento.', 'warning');
        return;
    }

    const rowSep = document.getElementById('rowSeparator').value === '\\n' ? '\n' : document.getElementById('rowSeparator').value;
    const colSep = document.getElementById('columnSeparator').value === '\\t' ? '\t' : document.getElementById('columnSeparator').value;
    
    const lines = rawData.split(rowSep).filter(line => line.trim() !== '');
    let organizedData = lines.map(line => line.split(colSep));

    // 3. Ordena os dados pela coluna de Nota
    const notaIndex = newColumnNames.findIndex(name => /nota/i.test(name));
    
    if (notaIndex !== -1) {
        organizedData.sort((a, b) => {
            const notaA = parseFloat(a[notaIndex]) || -Infinity;
            const notaB = parseFloat(b[notaIndex]) || -Infinity;
            return notaB - notaA; // Ordena de forma decrescente
        });
    }

    // 4. Adiciona a coluna de Classificação aos dados já ordenados
    let finalColumnNamesForTable = [...newColumnNames];
    const hasExistingClassification = finalColumnNamesForTable.some(name => /classificação|posição|ranking/i.test(name));

    if (!hasExistingClassification) {
        organizedData.forEach((row, index) => {
            row.unshift(index + 1);
        });
        finalColumnNamesForTable.unshift('Classificação');
    }

    // 5. Salva os dados finais para uso futuro
    lastInferredData = {
        columnNames: finalColumnNamesForTable,
        organizedData: organizedData,
        patternDetected: 'manual'
    };

    // 6. Esconde o formulário de mapeamento e exibe o resultado
    hideManualMappingContainer();
    document.getElementById('ContainerResult').style.display = 'block';

    // 7. Gera a nova tabela com os nomes e dados corrigidos
    updateTable(finalColumnNamesForTable, organizedData);

    showToast('Mapeamento aplicado com sucesso!', 'success');
}

document.addEventListener('DOMContentLoaded', (event) => {
    document.getElementById('rowSeparator').addEventListener('change', updatePreviewTable);
    document.getElementById('columnSeparator').addEventListener('change', updatePreviewTable);
    document.getElementById('fieldCount').addEventListener('change', () => {
        createColumnNameInputs();
        updatePreviewTable();
    });
});

function updateTable(columnNames, data) { const tableHeaders = document.getElementById('tableHeaders'); const tableBody = document.getElementById('tableBody'); tableHeaders.innerHTML = ''; tableBody.innerHTML = ''; currentColumnNames = columnNames; currentTableData = data; const newSortDirections = {}; currentColumnNames.forEach((name, index) => { const oldIndex = -1; if (oldIndex !== -1 && sortDirections[oldIndex] !== undefined) { newSortDirections[index] = sortDirections[oldIndex]; } else { newSortDirections[index] = true; } }); sortDirections = newSortDirections; columnNames.forEach((columnName, index) => { const th = document.createElement('th'); th.textContent = columnName; th.onclick = () => sortTable(index); const arrowSpan = document.createElement('span'); arrowSpan.className = 'sort-arrow ml-1 text-gray-400 opacity-0 transition-opacity duration-200'; th.appendChild(arrowSpan); tableHeaders.appendChild(th); }); data.forEach(row => { const tr = document.createElement('tr'); for (let i = 0; i < columnNames.length; i++) { const td = document.createElement('td'); let value = row[i]; const colName = columnNames[i]; const colType = columnTypes[colName] || getColumnType(colName); if (value !== null && value !== undefined) { value = String(value).replace(/[\r\n]+/g, ' ').trim(); } if (value !== null && value !== undefined) { if (colType === 'numeric') { td.textContent = parseFloat(value).toFixed(2); } else if (colType === 'integer_numeric') { td.textContent = parseInt(value, 10); } else if (colType === 'numeric_string') { td.textContent = String(value); } else { td.textContent = String(value); } } else { td.textContent = ''; } tr.appendChild(td); } tableBody.appendChild(tr); }); }
function sortTable(columnIndex) { if (isRenamingColumns) { return; } const table = document.getElementById('resultTable'); const tbody = table.getElementsByTagName('tbody')[0]; const rows = Array.from(tbody.getElementsByTagName('tr')); const headerCell = table.querySelector(`th:nth-child(${columnIndex + 1})`); const headerText = headerCell.textContent.replace(/[\u2191\u2193]/g, '').trim(); const currentArrow = headerCell.querySelector('.sort-arrow'); document.querySelectorAll('#tableHeaders th .sort-arrow').forEach(arrow => { arrow.classList.remove('opacity-100'); arrow.classList.add('opacity-0'); arrow.innerHTML = ''; }); sortDirections[columnIndex] = !sortDirections[columnIndex]; const colType = columnTypes[headerText] || getColumnType(headerText); const sortedRows = rows.sort((a, b) => { const textA = a.cells[columnIndex].textContent.trim(); const textB = b.cells[columnIndex].textContent.trim(); let valA, valB; if (colType === 'numeric' || colType === 'integer_numeric') { valA = parseFloat(textA.replace(',', '.')); valB = parseFloat(textB.replace(',', '.')); valA = isNaN(valA) ? (sortDirections[columnIndex] ? Infinity : -Infinity) : valA; valB = isNaN(valB) ? (sortDirections[columnIndex] ? Infinity : -Infinity) : valB; return sortDirections[columnIndex] ? valA - valB : valB - valA; } else if (colType === 'numeric_string') { valA = parseInt(textA); valB = parseInt(textB); valA = isNaN(valA) ? (sortDirections[columnIndex] ? Infinity : -Infinity) : valA; valB = isNaN(valB) ? (sortDirections[columnIndex] ? Infinity : -Infinity) : valB; return sortDirections[columnIndex] ? valA - valB : valB - valA; } else { return sortDirections[columnIndex] ? textA.localeCompare(textB, undefined, { numeric: true, sensitivity: 'base' }) : textB.localeCompare(textA, undefined, { numeric: true, sensitivity: 'base' }); } }); tbody.innerHTML = ''; sortedRows.forEach(row => tbody.appendChild(row)); currentArrow.classList.add('opacity-100'); currentArrow.innerHTML = sortDirections[columnIndex] ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>'; }
const themeToggle = document.getElementById('themeToggle'); const themeIcon = document.getElementById('themeIcon'); const htmlElement = document.documentElement; function updateThemeToggle(isDark) { if (isDark) { themeIcon.classList.remove('fa-moon'); themeIcon.classList.add('fa-sun'); themeToggle.title = 'Mudar para modo claro'; } else { themeIcon.classList.remove('fa-sun'); themeIcon.classList.add('fa-moon'); themeToggle.title = 'Mudar para modo escuro'; } } function applyTheme(theme) { if (theme === 'dark') { htmlElement.classList.add('dark'); updateThemeToggle(true); } else { htmlElement.classList.remove('dark'); updateThemeToggle(false); } } const savedTheme = localStorage.getItem('theme'); if (savedTheme) { applyTheme(savedTheme); } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) { applyTheme('dark'); } else { applyTheme('light'); }
window.onload = function() { document.getElementById('currentYear').textContent = new Date().getFullYear(); document.getElementById('ContainerResult').style.display = 'none'; document.getElementById('mapColumnsButton').style.display = 'none'; };
themeToggle.addEventListener('click', () => { if (htmlElement.classList.contains('dark')) { applyTheme('light'); localStorage.setItem('theme', 'light'); } else { applyTheme('dark'); localStorage.setItem('theme', 'dark'); } });
function searchTable() { let input = document.getElementById('searchInput').value.toUpperCase(); let table = document.getElementById('resultTable'); let tr = table.getElementsByTagName('tr'); for (let i = 1; i < tr.length; i++) { let td = tr[i].getElementsByTagName('td'); let found = false; for (let j = 0; j < td.length; j++) { if (td[j] && td[j].innerHTML.toUpperCase().indexOf(input) > -1) { found = true; break; } } tr[i].style.display = found ? '' : 'none'; } }
function generatePDF() { if (isRenamingColumns) { toggleColumnRename(); } try { const { jsPDF } = window.jspdf; const doc = new jsPDF(); const margin = 10; let y = margin; const lineHeight = 10; const pageWidth = doc.internal.pageSize.getWidth(); doc.setFontSize(16); doc.setFont("helvetica", "bold"); const customTitle = document.getElementById('pdfTitleInput').value.trim(); const title = customTitle === '' ? "Relatório de Resultados" : customTitle; const splitTitle = doc.splitTextToSize(title, pageWidth - 2 * margin); doc.text(splitTitle, pageWidth / 2, y, { align: 'center' }); y += (splitTitle.length * lineHeight) + lineHeight; const table = document.getElementById('resultTable'); if (!table || table.querySelector('tbody').children.length === 0) { alert("Erro: Gere a tabela primeiro clicando em 'Organizar'!"); return; } const headers = Array.from(document.querySelectorAll('#tableHeaders th')).map(th => th.textContent.replace(/[\u2191\u2193]/g, '').trim()); const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.replace(/\s*\n\s*/g, ' ').trim())); doc.autoTable({ head: [headers], body: rows, startY: y, margin: { left: margin, right: margin }, styles: { fontSize: 10, cellPadding: 2, halign: 'center', valign: 'middle', lineColor: [226, 232, 240], lineWidth: 0.5 }, headStyles: { fillColor: [76, 175, 80], textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle' }, alternateRowStyles: { fillColor: [248, 250, 252] }, didDrawPage: function(data) { } }); window.open(doc.output('bloburl'), '_blank'); showToast('PDF gerado e aberto em uma nova aba.'); } catch (error) { console.error("Erro ao gerar PDF:", error); alert("Erro ao gerar PDF. Veja o console para detalhes."); } }
function exportToCSV() { if (isRenamingColumns) { toggleColumnRename(); } const table = document.getElementById('resultTable'); const visibleRows = Array.from(table.querySelectorAll('tbody tr:not([style*="display: none"])')); if (visibleRows.length === 0) { alert("Não há dados visíveis para exportar. Limpe a busca ou verifique os dados."); return; } const headers = Array.from(table.querySelectorAll('thead th')) .map(th => { let headerText = th.textContent.replace(/[\u2191\u2193]/g, '').trim(); headerText = headerText.replace(/[\r\n]+/g, ' ').trim(); return `"${headerText.replace(/"/g, '""')}"`; }); const rows = visibleRows.map(tr => { return Array.from(tr.querySelectorAll('td')) .map(td => `"${td.textContent.replace(/"/g, '""')}"`) .join(';'); }); const csvContent = headers.join(';') + '\n' + rows.join('\n'); const bom = "\uFEFF"; const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'dados_organizados.csv'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href); showToast('Arquivo CSV gerado com sucesso, verifique seus downloads!'); }
function toggleColumnRename() { isRenamingColumns = !isRenamingColumns; const table = document.getElementById('resultTable'); const headers = document.querySelectorAll('#tableHeaders th'); const button = document.getElementById('toggleRenameHeadersButton'); const icon = button.querySelector('i'); const textSpan = button.querySelector('span:not(.tooltip-text)'); const tooltip = button.querySelector('.tooltip-text'); if (isManualMapping) { return; } if (isRenamingColumns) { toggleActionButtons(true, 'toggleRenameHeadersButton'); table.classList.add('table-editing-mode'); icon.classList.remove('fa-pencil-alt'); icon.classList.add('fa-save'); textSpan.textContent = 'Salvar Nomes'; tooltip.textContent = 'Salva os novos nomes dos cabeçalhos.'; button.classList.remove('bg-purple-600', 'hover:bg-purple-700', 'dark:bg-purple-500', 'dark:hover:bg-purple-400'); button.classList.add('bg-green-600', 'hover:bg-green-700', 'dark:bg-green-500', 'dark:hover:bg-green-400'); headers.forEach((th, index) => { th.onclick = null; th.classList.add('editable-header'); const originalText = th.textContent.replace(/[\u2191\u2193]/g, '').trim(); th.innerHTML = `<input type="text" value="${originalText}" class="w-full bg-transparent text-center font-semibold p-0 text-sm border-none focus:ring-0" data-original-index="${index}">`; }); const firstInput = headers[0].querySelector('input'); if (firstInput) firstInput.focus(); } else { toggleActionButtons(false); table.classList.remove('table-editing-mode'); icon.classList.remove('fa-save'); icon.classList.add('fa-pencil-alt'); textSpan.textContent = 'Renomear Cabeçalhos'; tooltip.textContent = 'Muda os nomes dos cabeçalhos.'; button.classList.remove('bg-green-600', 'hover:bg-green-700', 'dark:bg-green-500', 'dark:hover:bg-green-400'); button.classList.add('bg-purple-600', 'hover:bg-purple-700', 'dark:bg-purple-500', 'dark:hover:bg-purple-400'); const newColumnNames = []; headers.forEach(th => { const input = th.querySelector('input'); const newName = input ? input.value.trim() : th.textContent.trim(); newColumnNames.push(newName); th.innerHTML = newName; th.classList.remove('editable-header'); const originalIndex = parseInt(input.getAttribute('data-original-index')); th.onclick = () => sortTable(originalIndex); const arrowSpan = document.createElement('span'); arrowSpan.className = 'sort-arrow ml-1 text-gray-400 opacity-0 transition-opacity duration-200'; th.appendChild(arrowSpan); }); currentColumnNames = newColumnNames; showToast('Nomes dos cabeçalhos atualizados!'); } }
