document.getElementById('currentYear').textContent = new Date().getFullYear();
let sortDirections = {}; let currentColumnNames = []; let columnTypes = {}; let isRenamingColumns = false; let lastInferredData = null;
let currentTableData = [];
const typeMapping = { 'classificacao': 'integer_numeric', 'posicao': 'integer_numeric', 'ranking': 'integer_numeric', 'inscricao': 'numeric_string', 'matricula': 'numeric_string', 'nota': 'numeric', 'pontuacao': 'numeric', 'total': 'numeric', 'acertos': 'numeric', 'idade': 'integer_numeric' };
const predefinedColumnOptions = [ { value: '', text: 'Selecione...' }, { value: 'Classificação', text: 'Classificação' }, { value: 'Nome', text: 'Nome' }, { value: 'Inscrição', text: 'Inscrição' }, { value: 'Nota', text: 'Nota' }, { value: 'Pontuação', text: 'Pontuação' }, { value: 'Posição', text: 'Posição' }, { value: 'Matrícula', text: 'Matrícula' }, { value: 'Acertos', text: 'Acertos' }, { value: 'Idade', text: 'Idade' }, { value: 'Outro', text: 'Outro (digite abaixo)' } ];
const patterns = [
    {
        name: 'PRF (Inscrição, Nome, 5 Notas + Soma)',
        regex: /(\d+),\s*([A-Za-zÀ-ÿ\s.-]+?),\s*(\d+\.\d{2}),\s*(\d+\.\d{2}),\s*(\d+\.\d{2}),\s*(\d+\.\d{2}),\s*(\d+\.\d{2})\s*(?:\/\s*|$)/gi,
        columns: [ 'Inscrição', 'Nome', 'Nota Bloco I', 'Nota Bloco II', 'Nota Bloco III', 'Nota Final Objetiva', 'Nota Discursiva', 'Nota Final Total' ],
        postProcess: (row) => {
            const notaObjetiva = parseFloat(row[5]) || 0;
            const notaDiscursiva = parseFloat(row[6]) || 0;
            const total = (notaObjetiva + notaDiscursiva).toFixed(2);
            row.push(total);
            return row;
        }
    },
    { name: 'Nome, Inscrição, Nota', regex: /(.*),\s*(\d+),\s*(\d+\.?\d*)\s*$/gm, columns: ['Nome', 'Inscrição', 'Nota'] },
    { name: 'Inscrição; Nome; Nota', regex: /(\d+);\s*([A-ZÀ-Ÿ\s.-]+?);\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi, columns: ['Inscrição', 'Nome', 'Nota'] },
    { name: 'Classificação, Inscrição, Nome, Nota', regex: /(\d+),\s*(\d+),\s*([A-ZÀ-Ÿ\s.-]+?),\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi, columns: ['Classificação', 'Inscrição', 'Nome', 'Nota'] },
    { name: 'Inscrição / Nome / Posição / Nota', regex: /(\d+)\s*\/\s*([A-ZÀ-Ÿ\s.-]+?)\s*\/\s*(\d+)\s*\/\s*(\d+\.?\d*)\s*(?:\/\s*|$)/gi, columns: ['Inscrição', 'Nome', 'Posição', 'Nota'] },
    { name: 'Classificação Inscrição Nome Nota (Concatenado)', regex: /(\d+)(\d+)([A-ZÀ-Ÿ\s.-]+?)(\d+\.?\d*)/gi, columns: ['Classificação', 'Inscrição', 'Nome', 'Nota'] },
    { name: 'Inscrição Nome Nota (Concatenado)', regex: /(\d+)([A-ZÀ-Ÿ\s.-]+?)(\d+\.?\d*)/gi, columns: ['Inscrição', 'Nome', 'Nota'] },
    { name: 'Nome, Idade', regex: /([A-ZÀ-Ÿ\s.-]+?),\s*(\d+)\s*(?:\/\s*|$)/gi, columns: ['Nome', 'Idade'] }
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

function inferAndApplyPattern(rawInputString) {
    if (!rawInputString) {
        return { columnNames: [], organizedData: [], patternDetected: true };
    }
    let sanitizedString = rawInputString.replace(/-\s+/g, '');
    let processedString = sanitizedString.replace(/\r\n|\r/g, '\n').replace(/º|°/g, '').replace(/(\d+),(\d{1,2})(?![0-9])/g, '$1.$2').trim();
    
    let candidateBlocks = [];
    let finalColumnNames = [];
    let patternFound = false;

    for (const pattern of patterns) {
        let tempBlocks = [];
        let match;
        pattern.regex.lastIndex = 0;
        
        if (pattern.regex.flags.includes('m')) {
            const lines = processedString.split('\n').filter(line => line.trim() !== '');
            lines.forEach(line => {
                pattern.regex.lastIndex = 0;
                const singleMatch = pattern.regex.exec(line.trim());
                if (singleMatch) {
                    tempBlocks.push(singleMatch.slice(1).map(field => field.trim()));
                }
            });
        } else {
            const records = processedString.split('/').map(rec => rec.trim()).filter(rec => rec.length > 0);
            records.forEach(record => {
                pattern.regex.lastIndex = 0;
                while ((match = pattern.regex.exec(record)) !== null) {
                    tempBlocks.push(match.slice(1).map(field => field.trim()));
                }
            });
        }

        if (tempBlocks.length > 0) {
            if (pattern.postProcess) {
                tempBlocks = tempBlocks.map(row => pattern.postProcess(row));
            }
            finalColumnNames = pattern.columns;
            candidateBlocks = tempBlocks;
            patternFound = true;
            break;
        }
    }

    if (!patternFound && processedString.length > 0) {
        const lines = processedString.split('/').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length > 0) {
            const sampleLine = lines[0];
            let fields = sampleLine.split(/[\s,;]+/).filter(f => f.length > 0);
            if (fields.length > 1) {
                finalColumnNames = Array.from({ length: fields.length }, (_, i) => `Campo ${i + 1}`);
                candidateBlocks = lines.map(line => line.split(/[\s,;]+/).filter(f => f.length > 0));
                candidateBlocks = candidateBlocks.filter(block => block.length === fields.length);
                if (candidateBlocks.length === 0) {
                    candidateBlocks = [[processedString]];
                    finalColumnNames = ['Dados Brutos'];
                }
            } else {
                candidateBlocks = [[processedString]];
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
    return { columnNames: finalColumnNames, organizedData, patternDetected: patternFound };
}

function organizeData() {
    const dataInput = document.getElementById('dataInput').value.trim();
    const addRankingColumn = document.getElementById('addRankingColumn').checked;
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
            lastInferredData = { columnNames, organizedData, patternDetected };
            containerResult.style.display = 'block';
            mapColumnsButton.style.display = 'flex';
            columnTypes = {};
            columnNames.forEach(name => {
                columnTypes[name] = getColumnType(name);
            });

            // ==========================================================
            // LÓGICA DE ORDENAÇÃO ATUALIZADA
            // ==========================================================
            organizedData.sort((a, b) => {
                // Prioridade 1: Nota Final Total
                const notaTotalIndex = columnNames.indexOf('Nota Final Total');
                if (notaTotalIndex !== -1 && a[notaTotalIndex] !== null && b[notaTotalIndex] !== null) {
                    const valA = parseFloat(a[notaTotalIndex]);
                    const valB = parseFloat(b[notaTotalIndex]);
                    const comp = (isNaN(valB) ? -Infinity : valB) - (isNaN(valA) ? -Infinity : valA);
                    if (comp !== 0) return comp;
                }

                // Prioridade 2: Nota (para outros padrões)
                const notaIndex = columnNames.indexOf('Nota');
                if (notaIndex !== -1 && a[notaIndex] !== null && b[notaIndex] !== null) {
                    const valA = parseFloat(a[notaIndex]);
                    const valB = parseFloat(b[notaIndex]);
                    const comp = (isNaN(valB) ? -Infinity : valB) - (isNaN(valA) ? -Infinity : valA);
                    if (comp !== 0) return comp;
                }

                // Critérios de desempate
                const idadeIndex = columnNames.indexOf('Idade');
                if (idadeIndex !== -1 && a[idadeIndex] !== null && b[idadeIndex] !== null) {
                    const valA = parseInt(a[idadeIndex]);
                    const valB = parseInt(b[idadeIndex]);
                    const comp = (isNaN(valB) ? -Infinity : valB) - (isNaN(valA) ? -Infinity : valA);
                    if (comp !== 0) return comp;
                }

                const nomeIndex = columnNames.indexOf('Nome');
                if (nomeIndex !== -1 && a[nomeIndex] !== null && b[nomeIndex] !== null) {
                    const nomeA = a[nomeIndex] || '';
                    const nomeB = b[nomeIndex] || '';
                    return String(nomeA).localeCompare(String(nomeB), undefined, { numeric: true, sensitivity: 'base' });
                }
                
                return 0;
            });

            let finalColumnNamesForTable = [...columnNames];
            if (addRankingColumn) {
                const columnsToRemove = ['Classificação', 'Posição', 'Ranking'];
                columnsToRemove.forEach(colName => {
                    const existingIndex = finalColumnNamesForTable.indexOf(colName);
                    if (existingIndex !== -1) {
                        finalColumnNamesForTable.splice(existingIndex, 1);
                        organizedData.forEach(row => {
                            row.splice(existingIndex, 1);
                        });
                    }
                });
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
function applyManualMapping() { const columnMappingInputsDiv = document.getElementById('columnMappingInputs'); const selects = columnMappingInputsDiv.querySelectorAll('select'); const customInputs = columnMappingInputsDiv.querySelectorAll('input[type="text"]'); const newColumnNames = []; const originalDataIndices = []; let allMapped = true; selects.forEach((select, i) => { const selectedValue = select.value; const originalIndex = parseInt(select.getAttribute('data-col-index')); let finalColName; if (selectedValue === 'Outro') { finalColName = customInputs[i].value.trim(); } else { finalColName = selectedValue; } if (finalColName === '' || finalColName === 'Selecione...') { allMapped = false; } newColumnNames.push(finalColName); originalDataIndices.push(originalIndex); }); if (!allMapped) { alert("Por favor, nomeie todas as colunas ou selecione uma opção antes de aplicar o mapeamento."); return; } if (newColumnNames.length === 0 || newColumnNames.length !== selects.length) { return; } let remappedData = currentTableData.map(row => { const newRow = []; originalDataIndices.forEach(originalIdx => { newRow.push(row[originalIdx]); }); return newRow; }); columnTypes = {}; newColumnNames.forEach(name => { columnTypes[name] = getColumnType(name); }); const addRankingColumn = document.getElementById('addRankingColumn').checked; if (addRankingColumn) { const columnsToRemove = ['Classificação', 'Posição', 'Ranking']; columnsToRemove.forEach(colName => { const existingIndex = newColumnNames.indexOf(colName); if (existingIndex !== -1) { newColumnNames.splice(existingIndex, 1); remappedData.forEach(row => { row.splice(existingIndex, 1); }); } }); remappedData.forEach((row, index) => { row.unshift(index + 1); }); newColumnNames.unshift('Classificação'); columnTypes['Classificação'] = 'integer_numeric'; } document.getElementById('patternWarning').style.display = 'none'; document.getElementById('manualMappingArea').style.display = 'none'; updateTable(newColumnNames, remappedData); document.getElementById('resultTable').style.display = 'table'; toggleActionButtons(false); showToast('Mapeamento aplicado com sucesso!'); }
function updateTable(columnNames, data) { const tableHeaders = document.getElementById('tableHeaders'); const tableBody = document.getElementById('tableBody'); tableHeaders.innerHTML = ''; tableBody.innerHTML = ''; currentColumnNames = columnNames; currentTableData = data; const newSortDirections = {}; currentColumnNames.forEach((name, index) => { const oldIndex = -1; if (oldIndex !== -1 && sortDirections[oldIndex] !== undefined) { newSortDirections[index] = sortDirections[oldIndex]; } else { newSortDirections[index] = true; } }); sortDirections = newSortDirections; columnNames.forEach((columnName, index) => { const th = document.createElement('th'); th.textContent = columnName; th.onclick = () => sortTable(index); const lowerCaseName = columnName.toLowerCase(); if (lowerCaseName.includes('nome')) { th.classList.add('w-1/2'); } else if (['inscrição', 'classificação', 'posição', 'idade'].some(term => lowerCaseName.includes(term))) { th.classList.add('w-24'); } else if (lowerCaseName.includes('nota')) { th.classList.add('w-32'); } const arrowSpan = document.createElement('span'); arrowSpan.className = 'sort-arrow ml-1 text-gray-400 opacity-0 transition-opacity duration-200'; th.appendChild(arrowSpan); tableHeaders.appendChild(th); }); data.forEach(row => { const tr = document.createElement('tr'); for (let i = 0; i < columnNames.length; i++) { const td = document.createElement('td'); let value = row[i]; const colName = columnNames[i]; const colType = columnTypes[colName] || getColumnType(colName); if (value !== null && value !== undefined) { value = String(value).replace(/[\r\n]+/g, ' ').trim(); } if (value !== null && value !== undefined) { if (colType === 'numeric') { td.textContent = parseFloat(value).toFixed(2); } else if (colType === 'integer_numeric') { td.textContent = parseInt(value, 10); } else if (colType === 'numeric_string') { td.textContent = String(value); } else { td.textContent = String(value); } } else { td.textContent = ''; } tr.appendChild(td); } tableBody.appendChild(tr); }); }
function sortTable(columnIndex) { if (isRenamingColumns) { return; } const table = document.getElementById('resultTable'); const tbody = table.getElementsByTagName('tbody')[0]; const rows = Array.from(tbody.getElementsByTagName('tr')); const headerCell = table.querySelector(`th:nth-child(${columnIndex + 1})`); const headerText = headerCell.textContent.replace(/[\u2191\u2193]/g, '').trim(); const currentArrow = headerCell.querySelector('.sort-arrow'); document.querySelectorAll('#tableHeaders th .sort-arrow').forEach(arrow => { arrow.classList.remove('opacity-100'); arrow.classList.add('opacity-0'); arrow.innerHTML = ''; }); sortDirections[columnIndex] = !sortDirections[columnIndex]; const colType = columnTypes[headerText] || getColumnType(headerText); const sortedRows = rows.sort((a, b) => { const textA = a.cells[columnIndex].textContent.trim(); const textB = b.cells[columnIndex].textContent.trim(); let valA, valB; if (colType === 'numeric' || colType === 'integer_numeric') { valA = parseFloat(textA.replace(',', '.')); valB = parseFloat(textB.replace(',', '.')); valA = isNaN(valA) ? (sortDirections[columnIndex] ? Infinity : -Infinity) : valA; valB = isNaN(valB) ? (sortDirections[columnIndex] ? Infinity : -Infinity) : valB; return sortDirections[columnIndex] ? valA - valB : valB - valA; } else if (colType === 'numeric_string') { valA = parseInt(textA); valB = parseInt(textB); valA = isNaN(valA) ? (sortDirections[columnIndex] ? Infinity : -Infinity) : valA; valB = isNaN(valB) ? (sortDirections[columnIndex] ? Infinity : -Infinity) : valB; return sortDirections[columnIndex] ? valA - valB : valB - valA; } else { return sortDirections[columnIndex] ? textA.localeCompare(textB, undefined, { numeric: true, sensitivity: 'base' }) : textB.localeCompare(textA, undefined, { numeric: true, sensitivity: 'base' }); } }); tbody.innerHTML = ''; sortedRows.forEach(row => tbody.appendChild(row)); currentArrow.classList.add('opacity-100'); currentArrow.innerHTML = sortDirections[columnIndex] ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>'; }
const themeToggle = document.getElementById('themeToggle'); const themeIcon = document.getElementById('themeIcon'); const htmlElement = document.documentElement; function updateThemeToggle(isDark) { if (isDark) { themeIcon.classList.remove('fa-moon'); themeIcon.classList.add('fa-sun'); themeToggle.title = 'Mudar para modo claro'; } else { themeIcon.classList.remove('fa-sun'); themeIcon.classList.add('fa-moon'); themeToggle.title = 'Mudar para modo escuro'; } } function applyTheme(theme) { if (theme === 'dark') { htmlElement.classList.add('dark'); updateThemeToggle(true); } else { htmlElement.classList.remove('dark'); updateThemeToggle(false); } } const savedTheme = localStorage.getItem('theme'); if (savedTheme) { applyTheme(savedTheme); } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) { applyTheme('dark'); } else { applyTheme('light'); }
window.onload = function() { document.getElementById('currentYear').textContent = new Date().getFullYear(); document.getElementById('ContainerResult').style.display = 'none'; document.getElementById('mapColumnsButton').style.display = 'none'; };
themeToggle.addEventListener('click', () => { if (htmlElement.classList.contains('dark')) { applyTheme('light'); localStorage.setItem('theme', 'light'); } else { applyTheme('dark'); localStorage.setItem('theme', 'dark'); } });
function searchTable() { let input = document.getElementById('searchInput').value.toUpperCase(); let table = document.getElementById('resultTable'); let tr = table.getElementsByTagName('tr'); for (let i = 1; i < tr.length; i++) { let td = tr[i].getElementsByTagName('td'); let found = false; for (let j = 0; j < td.length; j++) { if (td[j] && td[j].innerHTML.toUpperCase().indexOf(input) > -1) { found = true; break; } } tr[i].style.display = found ? '' : 'none'; } }
function generatePDF() { if (isRenamingColumns) { toggleColumnRename(); } try { const { jsPDF } = window.jspdf; const doc = new jsPDF(); const margin = 10; let y = margin; const lineHeight = 10; const pageWidth = doc.internal.pageSize.getWidth(); doc.setFontSize(16); doc.setFont("helvetica", "bold"); const customTitle = document.getElementById('pdfTitleInput').value.trim(); const title = customTitle === '' ? "Relatório de Resultados" : customTitle; const splitTitle = doc.splitTextToSize(title, pageWidth - 2 * margin); doc.text(splitTitle, pageWidth / 2, y, { align: 'center' }); y += (splitTitle.length * lineHeight) + lineHeight; const table = document.getElementById('resultTable'); if (!table || table.querySelector('tbody').children.length === 0) { alert("Erro: Gere a tabela primeiro clicando em 'Organizar'!"); return; } const headers = Array.from(document.querySelectorAll('#tableHeaders th')).map(th => th.textContent.replace(/[\u2191\u2193]/g, '').trim()); const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.replace(/\s*\n\s*/g, ' ').trim())); doc.autoTable({ head: [headers], body: rows, startY: y, margin: { left: margin, right: margin }, styles: { fontSize: 10, cellPadding: 2, halign: 'center', valign: 'middle', lineColor: [226, 232, 240], lineWidth: 0.5 }, headStyles: { fillColor: [76, 175, 80], textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle' }, alternateRowStyles: { fillColor: [248, 250, 252] }, didDrawPage: function(data) { } }); window.open(doc.output('bloburl'), '_blank'); showToast('PDF gerado e aberto em uma nova aba.'); } catch (error) { console.error("Erro ao gerar PDF:", error); alert("Erro ao gerar PDF. Veja o console para detalhes."); } }
function exportToCSV() { if (isRenamingColumns) { toggleColumnRename(); } const table = document.getElementById('resultTable'); const visibleRows = Array.from(table.querySelectorAll('tbody tr:not([style*="display: none"])')); if (visibleRows.length === 0) { alert("Não há dados visíveis para exportar. Limpe a busca ou verifique os dados."); return; } const headers = Array.from(table.querySelectorAll('thead th')) .map(th => { let headerText = th.textContent.replace(/[\u2191\u2193]/g, '').trim(); headerText = headerText.replace(/[\r\n]+/g, ' ').trim(); return `"${headerText.replace(/"/g, '""')}"`; }); const rows = visibleRows.map(tr => { return Array.from(tr.querySelectorAll('td')) .map(td => `"${td.textContent.replace(/"/g, '""')}"`) .join(';'); }); const csvContent = headers.join(';') + '\n' + rows.join('\n'); const bom = "\uFEFF"; const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'dados_organizados.csv'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href); showToast('Arquivo CSV gerado com sucesso, verifique seus downloads!'); }
function toggleColumnRename() { isRenamingColumns = !isRenamingColumns; const table = document.getElementById('resultTable'); const headers = document.querySelectorAll('#tableHeaders th'); const button = document.getElementById('toggleRenameHeadersButton'); const icon = button.querySelector('i'); const textSpan = button.querySelector('span:not(.tooltip-text)'); const tooltip = button.querySelector('.tooltip-text'); if (isRenamingColumns) { toggleActionButtons(true, 'toggleRenameHeadersButton'); table.classList.add('table-editing-mode'); icon.classList.remove('fa-pencil-alt'); icon.classList.add('fa-save'); textSpan.textContent = 'Salvar Nomes'; tooltip.textContent = 'Salva os novos nomes dos cabeçalhos.'; button.classList.remove('bg-purple-600', 'hover:bg-purple-700', 'dark:bg-purple-500', 'dark:hover:bg-purple-400'); button.classList.add('bg-green-600', 'hover:bg-green-700', 'dark:bg-green-500', 'dark:hover:bg-green-400'); headers.forEach((th, index) => { th.onclick = null; th.classList.add('editable-header'); const originalText = th.textContent.replace(/[\u2191\u2193]/g, '').trim(); th.innerHTML = `<input type="text" value="${originalText}" class="w-full bg-transparent text-center font-semibold p-0 text-sm border-none focus:ring-0" data-original-index="${index}">`; }); const firstInput = headers[0].querySelector('input'); if (firstInput) firstInput.focus(); } else { toggleActionButtons(false); table.classList.remove('table-editing-mode'); icon.classList.remove('fa-save'); icon.classList.add('fa-pencil-alt'); textSpan.textContent = 'Renomear Cabeçalhos'; tooltip.textContent = 'Muda os nomes dos cabeçalhos.'; button.classList.remove('bg-green-600', 'hover:bg-green-700', 'dark:bg-green-500', 'dark:hover:bg-green-400'); button.classList.add('bg-purple-600', 'hover:bg-purple-700', 'dark:bg-purple-500', 'dark:hover:bg-purple-400'); const newColumnNames = []; headers.forEach(th => { const input = th.querySelector('input'); const newName = input ? input.value.trim() : th.textContent.trim(); newColumnNames.push(newName); th.innerHTML = newName; th.classList.remove('editable-header'); const originalIndex = parseInt(input.getAttribute('data-original-index')); th.onclick = () => sortTable(originalIndex); const arrowSpan = document.createElement('span'); arrowSpan.className = 'sort-arrow ml-1 text-gray-400 opacity-0 transition-opacity duration-200'; th.appendChild(arrowSpan); }); currentColumnNames = newColumnNames; showToast('Nomes dos cabeçalhos atualizados!'); } }
