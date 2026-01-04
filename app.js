// CONFIGURACIÓN INICIAL
let DEFAULT_CATEGORIES = {
    food: { icon: '🛒', label: 'Alimentación' },
    housing: { icon: '🏠', label: 'Vivienda' },
    transport: { icon: '🚗', label: 'Transporte' },
    utilities: { icon: '⚡', label: 'Servicios' },
    health: { icon: '🏥', label: 'Salud' },
    education: { icon: '📚', label: 'Educación' },
    entertainment: { icon: '🎬', label: 'Entretenimiento' },
    other: { icon: '📌', label: 'Otros' }
};

let CATEGORIES = JSON.parse(localStorage.getItem('categories')) || JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));

const INCOME_TYPES = {
    salary: { icon: '💼', label: 'Sueldo' },
    gift: { icon: '🎁', label: 'Regalo' },
    sale: { icon: '🛍️', label: 'Venta' },
    other: { icon: '📌', label: 'Otro' }
};

const MONTHS_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

let currentDate = new Date();
let db;
let budgetVsActualChartInstance = null;
let balanceForecastChartInstance = null;

// FUNCIONES DE FORMATO
function formatCLP(amount) {
    return '$' + new Intl.NumberFormat('es-CL').format(Math.round(amount));
}

function parseCLP(amount) {
    return parseInt(amount) || 0;
}

// INICIALIZACIÓN DE BASE DE DATOS
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('FinanzasDB', 5);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve();
        };
        request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains('expenses')) {
                dbInstance.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
            }
            if (!dbInstance.objectStoreNames.contains('income')) {
                dbInstance.createObjectStore('income', { keyPath: 'id', autoIncrement: true });
            }
            if (!dbInstance.objectStoreNames.contains('loans')) {
                dbInstance.createObjectStore('loans', { keyPath: 'id', autoIncrement: true });
            }
            if (!dbInstance.objectStoreNames.contains('credits')) {
                dbInstance.createObjectStore('credits', { keyPath: 'id', autoIncrement: true });
            }
            if (!dbInstance.objectStoreNames.contains('budgets')) {
                dbInstance.createObjectStore('budgets', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// FUNCIONES DE UTILIDAD
function getCurrentMonth() {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function getMonthFromDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function addMonthsToDate(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

function updateMonthDisplay() {
    const monthName = MONTHS_LABELS[currentDate.getMonth()];
    document.getElementById('monthDisplay').textContent = `${monthName} ${currentDate.getFullYear()}`;
}

function previousMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    updateMonthDisplay();
    updateDashboard();
}

function nextMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    updateMonthDisplay();
    updateDashboard();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

// NAVEGACIÓN Y MODALES
function switchSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    if (sectionId === 'budget') {
        loadBudgetSection();
    } else if (sectionId === 'expenses') {
        loadExpenses();
    } else if (sectionId === 'income') {
        loadIncome();
    } else if (sectionId === 'loans') {
        loadLoans();
    } else if (sectionId === 'credits') {
        loadCredits();
    } else if (sectionId === 'forecast') {
        loadForecastData();
        setTimeout(() => drawBalanceForecast(), 100);
    } else if (sectionId === 'dashboard') {
        updateDashboard();
    }
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    if (modalId === 'budgetModal') {
        renderBudgetForm();
    } else if (modalId === 'expenseModal') {
        document.getElementById('expenseDate').valueAsDate = new Date();
        loadCategoryDropdown('expenseCategory');
    } else if (modalId === 'incomeModal') {
        document.getElementById('incomeDate').valueAsDate = new Date();
        updateIncomeForm();
    } else if (modalId === 'loanModal') {
        document.getElementById('loanDueDate').valueAsDate = new Date();
    } else if (modalId === 'creditModal') {
        document.getElementById('creditMonthlyPayment').valueAsDate = new Date();
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function updateIncomeForm() {
    const type = document.getElementById('incomeType').value;
    const salaryFields = document.getElementById('salaryFields');
    if (type === 'salary') {
        salaryFields.style.display = 'block';
    } else {
        salaryFields.style.display = 'none';
    }
}

function loadCategoryDropdown(elementId) {
    const select = document.getElementById(elementId);
    select.innerHTML = '<option value="">Selecciona una categoría</option>';
    for (const [key, cat] of Object.entries(CATEGORIES)) {
        select.innerHTML += `<option value="${key}">${cat.icon} ${cat.label}</option>`;
    }
}

// PRESUPUESTO
function renderBudgetForm() {
    const container = document.getElementById('budgetInputs');
    let html = '';
    
    for (const [key, cat] of Object.entries(CATEGORIES)) {
        const inputId = `budget_${key}`;
        html += `
            <div class="budget-input-row">
                <div class="budget-input-label">${cat.icon} ${cat.label}</div>
                <div class="budget-input-field">
                    <input type="number" id="${inputId}" step="1" placeholder="0" value="0">
                    <span style="color: #999; padding: 8px; font-size: 12px;">CLP</span>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // Cargar valores actuales si existen
    const transaction = db.transaction(['budgets'], 'readonly');
    const store = transaction.objectStore('budgets');
    const request = store.getAll();
    
    request.onsuccess = () => {
        const budgets = request.result;
        const currentMonthBudget = budgets.find(b => b.month === getCurrentMonth());
        
        if (currentMonthBudget) {
            for (const [key, value] of Object.entries(currentMonthBudget.categories || {})) {
                const inputElement = document.getElementById(`budget_${key}`);
                if (inputElement) {
                    inputElement.value = value;
                }
            }
        }
    };
}

function saveBudget(event) {
    event.preventDefault();
    
    const categories = {};
    let totalBudget = 0;
    
    for (const [key] of Object.entries(CATEGORIES)) {
        const value = parseCLP(document.getElementById(`budget_${key}`).value);
        categories[key] = value;
        totalBudget += value;
    }
    
    // Obtener ingreso promedio de últimos 3 meses
    const transaction = db.transaction(['income'], 'readonly');
    const store = transaction.objectStore('income');
    const request = store.getAll();
    
    request.onsuccess = () => {
        const incomes = request.result;
        const last3Months = [];
        const today = new Date();
        
        for (let i = 0; i < 3; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            last3Months.push(getMonthFromDate(date));
        }
        
        const last3MonthsIncome = incomes.filter(i => last3Months.includes(i.date.substring(0, 7)));
        const avgIncome = last3MonthsIncome.length > 0 
            ? last3MonthsIncome.reduce((sum, i) => sum + i.amount, 0) / 3
            : 0;
        
        if (totalBudget > avgIncome && avgIncome > 0) {
            alert(`⚠️ ADVERTENCIA: Tu presupuesto total ($${formatCLP(totalBudget)}) excede tu ingreso promedio de los últimos 3 meses ($${formatCLP(avgIncome)}). Considera ajustar los montos.`);
        }
        
        const budget = {
            month: getCurrentMonth(),
            categories: categories,
            timestamp: new Date().getTime()
        };
        
        const budgetTransaction = db.transaction(['budgets'], 'readwrite');
        const budgetStore = budgetTransaction.objectStore('budgets');
        
        // Buscar si ya existe presupuesto para este mes
        const checkRequest = budgetStore.getAll();
        checkRequest.onsuccess = () => {
            const existing = checkRequest.result.find(b => b.month === getCurrentMonth());
            
            if (existing) {
                budget.id = existing.id;
                budgetStore.put(budget);
            } else {
                budgetStore.add(budget);
            }
            
            budgetTransaction.oncomplete = () => {
                alert('Presupuesto guardado exitosamente');
                closeModal('budgetModal');
                loadBudgetSection();
                updateDashboard();
            };
        };
    };
}

function loadBudgetSection() {
    const transaction = db.transaction(['budgets'], 'readonly');
    const store = transaction.objectStore('budgets');
    const request = store.getAll();
    
    request.onsuccess = () => {
        const budgets = request.result;
        const currentMonthBudget = budgets.find(b => b.month === getCurrentMonth());
        
        if (!currentMonthBudget) {
            document.getElementById('budgetList').innerHTML = `
                <div class="alert-box info">
                    <strong>📊 Sin Presupuesto Planificado</strong>
                    <p>No tienes presupuesto asignado para ${MONTHS_LABELS[currentDate.getMonth()]} ${currentDate.getFullYear()}.</p>
                    <p style="margin-top: 10px;">Haz clic en el botón "Planificar Presupuesto" para empezar.</p>
                </div>
            `;
            return;
        }
        
        renderBudgetComparison(currentMonthBudget);
    };
}

function renderBudgetComparison(budget) {
    const currentMonth = getCurrentMonth();
    const transaction = db.transaction(['expenses', 'credits'], 'readonly');
    const expenseStore = transaction.objectStore('expenses');
    const creditStore = transaction.objectStore('credits');
    
    const expensesRequest = expenseStore.getAll();
    const creditsRequest = creditStore.getAll();
    
    let expenses = [];
    let credits = [];
    
    expensesRequest.onsuccess = () => {
        expenses = expensesRequest.result.filter(e => e.date.startsWith(currentMonth));
    };
    
    creditsRequest.onsuccess = () => {
        credits = creditsRequest.result;
        
        let html = '';
        let totalSpent = 0;
        let totalBudget = 0;
        
        for (const [key, cat] of Object.entries(CATEGORIES)) {
            const budgetAmount = budget.categories[key] || 0;
            const spent = expenses.filter(e => e.category === key).reduce((sum, e) => sum + e.amount, 0);
            const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
            const remaining = budgetAmount - spent;
            
            let progressClass = '';
            let statusIcon = '';
            
            if (budgetAmount === 0) {
                statusIcon = '⚪';
            } else if (percentage >= 100) {
                statusIcon = '❌';
                progressClass = 'danger';
            } else if (percentage >= 80) {
                statusIcon = '⚠️';
                progressClass = 'warning';
            } else {
                statusIcon = '✅';
            }
            
            totalSpent += spent;
            totalBudget += budgetAmount;
            
            html += `
                <div class="budget-card">
                    <div class="budget-header">
                        <h4>${cat.icon} ${cat.label} ${statusIcon}</h4>
                        <div class="amount">${formatCLP(spent)} / ${formatCLP(budgetAmount)}</div>
                    </div>
                    <div class="budget-progress">
                        <div class="progress-bar">
                            <div class="progress-fill ${progressClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                        </div>
                        <div class="progress-text">
                            <span>${percentage.toFixed(1)}%</span>
                            <span>${budgetAmount > 0 ? (remaining >= 0 ? '✅ ' : '❌ ') + formatCLP(Math.abs(remaining)) + ' ' + (remaining >= 0 ? 'disponible' : 'excedido') : 'Sin presupuesto'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Agregar créditos como "Pagos Recurrentes"
        const monthlyCredit = credits.reduce((sum, c) => sum + c.monthlyPayment, 0);
        if (monthlyCredit > 0) {
            html += `
                <div class="budget-card" style="border-left: 4px solid #2196F3;">
                    <div class="budget-header">
                        <h4>💳 Pagos Recurrentes (Créditos/Préstamos)</h4>
                        <div class="amount">${formatCLP(monthlyCredit)}</div>
                    </div>
                    <p style="font-size: 12px; color: #666; margin: 0;">Cuotas mensuales comprometidas</p>
                </div>
            `;
            totalSpent += monthlyCredit;
        }
        
        document.getElementById('budgetList').innerHTML = `
            <div class="budget-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-bottom: 20px;">
                <div class="budget-header">
                    <h4 style="color: white;">📊 Resumen del Presupuesto</h4>
                </div>
                <div style="margin: 15px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <p style="color: rgba(255,255,255,0.9); font-size: 12px; margin: 0;">Presupuesto Total</p>
                        <p style="color: white; font-size: 20px; font-weight: bold; margin: 5px 0;">${formatCLP(totalBudget)}</p>
                    </div>
                    <div>
                        <p style="color: rgba(255,255,255,0.9); font-size: 12px; margin: 0;">Gastado</p>
                        <p style="color: white; font-size: 20px; font-weight: bold; margin: 5px 0;">${formatCLP(totalSpent)}</p>
                    </div>
                </div>
                <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px; text-align: center;">
                    <p style="color: white; margin: 0;">Disponible: <strong>${formatCLP(totalBudget - totalSpent)}</strong></p>
                </div>
            </div>
            ${html}
        `;
    };
}

// GASTOS CON VALIDACIÓN DE PRESUPUESTO
function checkBudgetWarning() {
    const category = document.getElementById('expenseCategory').value;
    const warningDiv = document.getElementById('expenseWarning');
    
    if (!category) {
        warningDiv.innerHTML = '';
        return;
    }
    
    const transaction = db.transaction(['budgets'], 'readonly');
    const store = transaction.objectStore('budgets');
    const request = store.getAll();
    
    request.onsuccess = () => {
        const budgets = request.result;
        const currentMonthBudget = budgets.find(b => b.month === getCurrentMonth());
        
        if (!currentMonthBudget || !currentMonthBudget.categories[category] || currentMonthBudget.categories[category] === 0) {
            warningDiv.innerHTML = `
                <div class="alert-box">
                    <strong>⚠️ Sin Presupuesto</strong>
                    <p>Esta categoría no tiene presupuesto asignado. Puedes registrar el gasto igual, pero se registrará sin límite presupuestario.</p>
                </div>
            `;
        } else {
            warningDiv.innerHTML = '';
        }
    };
}

function saveExpense(event) {
    event.preventDefault();
    const date = document.getElementById('expenseDate').value;
    const category = document.getElementById('expenseCategory').value;
    const description = document.getElementById('expenseDescription').value;
    const amount = parseCLP(document.getElementById('expenseAmount').value);
    
    if (!date || !category || !description || !amount) {
        alert('Por favor completa todos los campos');
        return;
    }
    
    const expense = { date, category, description, amount, timestamp: new Date().getTime() };
    
    const transaction = db.transaction(['expenses'], 'readwrite');
    const store = transaction.objectStore('expenses');
    store.add(expense);
    
    transaction.oncomplete = () => {
        alert('Gasto guardado exitosamente');
        closeModal('expenseModal');
        document.getElementById('expenseModal').querySelector('form').reset();
        loadExpenses();
        updateDashboard();
    };
}

function loadExpenses() {
    const currentMonth = getCurrentMonth();
    const transaction = db.transaction(['expenses'], 'readonly');
    const store = transaction.objectStore('expenses');
    const request = store.getAll();
    
    request.onsuccess = () => {
        const expenses = request.result.filter(e => e.date.startsWith(currentMonth));
        const container = document.getElementById('expensesList');
        
        if (expenses.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💸</div><p>No hay gastos registrados</p></div>';
            return;
        }
        
        container.innerHTML = expenses.map(exp => `
            <div class="budget-card">
                <div class="budget-header">
                    <h4>${CATEGORIES[exp.category]?.icon || '📌'} ${CATEGORIES[exp.category]?.label || 'Otra'}</h4>
                    <div class="amount" style="color: #f44336;">-${formatCLP(exp.amount)}</div>
                </div>
                <p style="margin: 0; font-size: 12px; color: #666;">${exp.description} • ${new Date(exp.date).toLocaleDateString('es-CL')}</p>
                <button onclick="deleteExpense(${exp.id})" class="btn-small btn-danger" style="margin-top: 10px;">🗑️ Eliminar</button>
            </div>
        `).join('');
    };
}

function deleteExpense(id) {
    if (!confirm('¿Estás seguro?')) return;
    const transaction = db.transaction(['expenses'], 'readwrite');
    const store = transaction.objectStore('expenses');
    store.delete(id);
    
    transaction.oncomplete = () => {
        loadExpenses();
        updateDashboard();
    };
}

// INGRESOS
function saveIncome(event) {
    event.preventDefault();
    const date = document.getElementById('incomeDate').value;
    const type = document.getElementById('incomeType').value;
    const description = document.getElementById('incomeDescription').value;
    const amount = parseCLP(document.getElementById('incomeAmount').value);
    
    if (!date || !type || !description || !amount) {
        alert('Por favor completa todos los campos');
        return;
    }
    
    let month = null;
    if (type === 'salary') {
        month = document.getElementById('salaryMonth').value;
    }
    
    const income = { date, type, description, amount, month, timestamp: new Date().getTime() };
    
    const transaction = db.transaction(['income'], 'readwrite');
    const store = transaction.objectStore('income');
    store.add(income);
    
    transaction.oncomplete = () => {
        alert('Ingreso guardado exitosamente');
        closeModal('incomeModal');
        document.getElementById('incomeModal').querySelector('form').reset();
        loadIncome();
        updateDashboard();
    };
}

function loadIncome() {
    const currentMonth = getCurrentMonth();
    const transaction = db.transaction(['income'], 'readonly');
    const store = transaction.objectStore('income');
    const request = store.getAll();
    
    request.onsuccess = () => {
        const incomes = request.result.filter(i => i.date.startsWith(currentMonth));
        const container = document.getElementById('incomeList');
        
        if (incomes.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💹</div><p>No hay ingresos registrados</p></div>';
            return;
        }
        
        container.innerHTML = incomes.map(inc => `
            <div class="budget-card">
                <div class="budget-header">
                    <h4>${INCOME_TYPES[inc.type]?.icon || '📌'} ${INCOME_TYPES[inc.type]?.label || 'Otro'}</h4>
                    <div class="amount" style="color: #4CAF50;">+${formatCLP(inc.amount)}</div>
                </div>
                <p style="margin: 0; font-size: 12px; color: #666;">${inc.description} • ${new Date(inc.date).toLocaleDateString('es-CL')}</p>
                <button onclick="deleteIncome(${inc.id})" class="btn-small btn-danger" style="margin-top: 10px;">🗑️ Eliminar</button>
            </div>
        `).join('');
    };
}

function deleteIncome(id) {
    if (!confirm('¿Estás seguro?')) return;
    const transaction = db.transaction(['income'], 'readwrite');
    const store = transaction.objectStore('income');
    store.delete(id);
    
    transaction.oncomplete = () => {
        loadIncome();
        updateDashboard();
    };
}

// LOANS y CREDITS (funciones básicas)
function saveLoan(event) {
    event.preventDefault();
    const loan = {
        type: document.getElementById('loanType').value,
        person: document.getElementById('loanPerson').value,
        amount: parseCLP(document.getElementById('loanAmount').value),
        dueDate: document.getElementById('loanDueDate').value,
        timestamp: new Date().getTime()
    };
    
    const transaction = db.transaction(['loans'], 'readwrite');
    transaction.objectStore('loans').add(loan);
    transaction.oncomplete = () => {
        alert('Préstamo guardado');
        closeModal('loanModal');
        loadLoans();
        updateDashboard();
    };
}

function loadLoans() {
    const transaction = db.transaction(['loans'], 'readonly');
    const request = transaction.objectStore('loans').getAll();
    
    request.onsuccess = () => {
        const loans = request.result;
        const container = document.getElementById('loansList');
        if (loans.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔄</div><p>No hay préstamos</p></div>';
            return;
        }
        container.innerHTML = loans.map(loan => `
            <div class="budget-card">
                <div class="budget-header">
                    <h4>${loan.person}</h4>
                    <div class="amount">${formatCLP(loan.amount)}</div>
                </div>
                <p style="margin: 0; font-size: 12px; color: #666;">Vence: ${new Date(loan.dueDate).toLocaleDateString('es-CL')}</p>
                <button onclick="deleteLoan(${loan.id})" class="btn-small btn-danger" style="margin-top: 10px;">🗑️</button>
            </div>
        `).join('');
    };
}

function deleteLoan(id) {
    if (!confirm('¿Estás seguro?')) return;
    db.transaction(['loans'], 'readwrite').objectStore('loans').delete(id);
}

function saveCredit(event) {
    event.preventDefault();
    const credit = {
        description: document.getElementById('creditDescription').value,
        amount: parseCLP(document.getElementById('creditAmount').value),
        installments: parseInt(document.getElementById('creditInstallments').value),
        monthlyPayment: parseCLP(document.getElementById('creditMonthlyPayment').value),
        paid: parseCLP(document.getElementById('creditPaid').value),
        timestamp: new Date().getTime()
    };
    
    const transaction = db.transaction(['credits'], 'readwrite');
    transaction.objectStore('credits').add(credit);
    transaction.oncomplete = () => {
        alert('Crédito guardado');
        closeModal('creditModal');
        loadCredits();
        updateDashboard();
    };
}

function loadCredits() {
    const transaction = db.transaction(['credits'], 'readonly');
    const request = transaction.objectStore('credits').getAll();
    
    request.onsuccess = () => {
        const credits = request.result;
        const container = document.getElementById('creditsList');
        if (credits.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💳</div><p>No hay créditos</p></div>';
            return;
        }
        container.innerHTML = credits.map(credit => `
            <div class="budget-card">
                <div class="budget-header">
                    <h4>💳 ${credit.description}</h4>
                    <div class="amount">${formatCLP(credit.monthlyPayment)}/mes</div>
                </div>
                <p style="margin: 0; font-size: 12px; color: #666;">${credit.installments} cuotas de ${formatCLP(credit.monthlyPayment)}</p>
            </div>
        `).join('');
    };
}

// DASHBOARD
function updateDashboard() {
    const currentMonth = getCurrentMonth();
    const transaction = db.transaction(['expenses', 'income', 'budgets', 'credits'], 'readonly');
    
    const expenseStore = transaction.objectStore('expenses');
    const incomeStore = transaction.objectStore('income');
    const budgetStore = transaction.objectStore('budgets');
    const creditStore = transaction.objectStore('credits');
    
    let allExpenses = [];
    let allIncomes = [];
    let currentBudget = null;
    let allCredits = [];
    
    expenseStore.getAll().onsuccess = (e) => {
        allExpenses = e.target.result.filter(ex => ex.date.startsWith(currentMonth));
    };
    
    incomeStore.getAll().onsuccess = (e) => {
        allIncomes = e.target.result.filter(inc => inc.date.startsWith(currentMonth));
    };
    
    budgetStore.getAll().onsuccess = (e) => {
        currentBudget = e.target.result.find(b => b.month === currentMonth);
    };
    
    creditStore.getAll().onsuccess = (e) => {
        allCredits = e.target.result;
        
        const totalExpenses = allExpenses.reduce((s, ex) => s + ex.amount, 0);
        const totalIncome = allIncomes.reduce((s, inc) => s + inc.amount, 0);
        const balance = totalIncome - totalExpenses;
        
        document.getElementById('totalExpenses').textContent = formatCLP(totalExpenses);
        document.getElementById('totalIncome').textContent = formatCLP(totalIncome);
        document.getElementById('balance').textContent = formatCLP(balance);
        document.getElementById('budgetStatus').textContent = currentBudget ? formatCLP(Object.values(currentBudget.categories || {}).reduce((a,b) => a+b, 0)) : 'Sin plan';
        
        renderBudgetVsActual(currentBudget, allExpenses, allCredits);
        renderDashboardBudget(currentBudget, allExpenses);
        showBudgetSuggestions(allExpenses, allIncomes, allCredits);
    };
}

function renderBudgetVsActual(budget, expenses, credits) {
    const ctx = document.getElementById('budgetVsActualChart');
    if (!ctx || !budget) return;
    
    const labels = [];
    const budgetData = [];
    const actualData = [];
    
    for (const [key, cat] of Object.entries(CATEGORIES)) {
        labels.push(cat.label);
        budgetData.push(budget.categories[key] || 0);
        actualData.push(expenses.filter(e => e.category === key).reduce((s, e) => s + e.amount, 0));
    }
    
    if (budgetVsActualChartInstance) budgetVsActualChartInstance.destroy();
    
    budgetVsActualChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Presupuesto',
                    data: budgetData,
                    backgroundColor: '#667eea'
                },
                {
                    label: 'Gasto Real',
                    data: actualData,
                    backgroundColor: '#f44336'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderDashboardBudget(budget, expenses) {
    if (!budget) return;
    
    const container = document.getElementById('dashboardBudget');
    let html = '';
    
    for (const [key, cat] of Object.entries(CATEGORIES)) {
        const budgetAmount = budget.categories[key] || 0;
        const spent = expenses.filter(e => e.category === key).reduce((s, e) => s + e.amount, 0);
        const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
        
        html += `
            <div class="budget-card">
                <div class="budget-header">
                    <h4>${cat.icon} ${cat.label}</h4>
                    <div class="amount">${formatCLP(spent)} / ${formatCLP(budgetAmount)}</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${percentage > 100 ? 'danger' : percentage > 80 ? 'warning' : ''}" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function showBudgetSuggestions(expenses, incomes, credits) {
    const container = document.getElementById('budgetSuggestions');
    const transaction = db.transaction(['budgets'], 'readonly');
    const request = transaction.objectStore('budgets').getAll();
    
    request.onsuccess = () => {
        const budgets = request.result;
        const last3Months = [];
        const today = new Date();
        
        for (let i = 0; i < 3; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            last3Months.push(getMonthFromDate(date));
        }
        
        // Encontrar categorías sin presupuesto en los últimos 3 meses
        const categoriesWithoutBudget = {};
        
        for (const [key, cat] of Object.entries(CATEGORIES)) {
            let count = 0;
            for (const month of last3Months) {
                const budget = budgets.find(b => b.month === month);
                if (!budget || !budget.categories[key] || budget.categories[key] === 0) {
                    count++;
                }
            }
            if (count === 3) {
                categoriesWithoutBudget[key] = cat;
            }
        }
        
        let suggestions = '';
        
        // Sugerencia 1: Categorías sin presupuesto
        if (Object.keys(categoriesWithoutBudget).length > 0) {
            // Calcular promedio de ingresos últimos 3 meses
            const last3MonthsIncome = incomes.filter(i => last3Months.includes(i.date.substring(0, 7)));
            const avgIncome = last3MonthsIncome.length > 0
                ? last3MonthsIncome.reduce((s, i) => s + i.amount, 0) / 3
                : 0;
            
            suggestions += `
                <div class="suggestion-box">
                    <h4>💡 Sugerencia: Agregar Presupuesto</h4>
                    <p>Las siguientes categorías no tienen presupuesto asignado en los últimos 3 meses:</p>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        ${Object.entries(categoriesWithoutBudget).map(([key, cat]) => `
                            <li>${cat.icon} ${cat.label}</li>
                        `).join('')}
                    </ul>
                    <p>Tu ingreso promedio de los últimos 3 meses es: <strong>${formatCLP(avgIncome)}</strong></p>
                    <p>Considera asignar presupuestos a estas categorías sin exceder tu ingreso promedio.</p>
                </div>
            `;
        }
        
        // Sugerencia 2: Categorías con sobrante
        const currentMonth = getCurrentMonth();
        const currentBudget = budgets.find(b => b.month === currentMonth);
        
        if (currentBudget && Object.keys(categoriesWithoutBudget).length > 0) {
            const surplusCategories = [];
            const monthExpenses = expenses.filter(e => e.date.startsWith(currentMonth));
            
            for (const [key, cat] of Object.entries(CATEGORIES)) {
                const budgetAmount = currentBudget.categories[key] || 0;
                const spent = monthExpenses.filter(e => e.category === key).reduce((s, e) => s + e.amount, 0);
                const surplus = budgetAmount - spent;
                
                if (surplus > 10000) { // Si hay más de $10.000 de sobrante
                    surplusCategories.push({ key, cat, surplus });
                }
            }
            
            if (surplusCategories.length > 0) {
                suggestions += `
                    <div class="suggestion-box" style="background: #e8f5e9; border-left-color: #4CAF50;">
                        <h4 style="color: #2e7d32;">✅ Reasignación Sugerida</h4>
                        <p>Puedes reasignar presupuesto de estas categorías que tienen sobrante:</p>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            ${surplusCategories.map(({cat, surplus}) => `
                                <li>${cat.icon} ${cat.label}: ${formatCLP(surplus)} disponible</li>
                            `).join('')}
                        </ul>
                        <p>Total disponible para reasignar: <strong>${formatCLP(surplusCategories.reduce((s, c) => s + c.surplus, 0))}</strong></p>
                    </div>
                `;
            } else {
                suggestions += `
                    <div class="suggestion-box" style="background: #fff3cd; border-left-color: #ffc107;">
                        <h4 style="color: #856404;">⚠️ Revisar Presupuesto</h4>
                        <p>No hay categorías con presupuesto sobrante para reasignar. Por favor revisa tu presupuesto general.</p>
                    </div>
                `;
            }
        }
        
        container.innerHTML = suggestions;
    };
}

function loadForecastData() {
    const transaction = db.transaction(['expenses', 'income'], 'readonly');
    const expenseStore = transaction.objectStore('expenses');
    const incomeStore = transaction.objectStore('income');
    
    expenseStore.getAll().onsuccess = (e1) => {
        incomeStore.getAll().onsuccess = (e2) => {
            const allExpenses = e1.target.result;
            const allIncomes = e2.target.result;
            const months = [];
            const today = new Date();
            
            for (let i = 0; i < 6; i++) {
                const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
                months.push(date);
            }
            
            const forecastData = months.map(month => {
                const monthStr = getMonthFromDate(month);
                const monthExpenses = allExpenses.filter(e => e.date.startsWith(monthStr));
                const monthIncomes = allIncomes.filter(i => i.date.startsWith(monthStr));
                
                return {
                    month: month,
                    expenses: monthExpenses.reduce((s, e) => s + e.amount, 0),
                    income: monthIncomes.reduce((s, i) => s + i.amount, 0)
                };
            });
            
            window.forecastData = forecastData;
        };
    };
}

function drawBalanceForecast() {
    if (!window.forecastData) return;
    const ctx = document.getElementById('balanceForecastChart');
    if (!ctx) return;
    
    const labels = window.forecastData.map(d => MONTHS_LABELS[d.month.getMonth()]);
    const balances = window.forecastData.map(d => d.income - d.expenses);
    
    if (balanceForecastChartInstance) balanceForecastChartInstance.destroy();
    
    balanceForecastChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Balance Proyectado',
                data: balances,
                backgroundColor: balances.map(b => b >= 0 ? '#4CAF50' : '#f44336')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function exportData() {
    const transaction = db.transaction(['expenses', 'income', 'loans', 'credits', 'budgets'], 'readonly');
    let allData = {};
    let completed = 0;
    
    ['expenses', 'income', 'loans', 'credits', 'budgets'].forEach(storeName => {
        transaction.objectStore(storeName).getAll().onsuccess = (e) => {
            allData[storeName] = e.target.result;
            completed++;
            
            if (completed === 5) {
                const data = {
                    version: '4.3.0',
                    timestamp: new Date().toISOString(),
                    categories: CATEGORIES,
                    ...allData
                };
                
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `finanzas-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
        };
    });
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!confirm('¿Restaurar todos los datos?')) return;
            
            const transaction = db.transaction(['expenses', 'income', 'loans', 'credits', 'budgets'], 'readwrite');
            ['expenses', 'income', 'loans', 'credits', 'budgets'].forEach(store => {
                transaction.objectStore(store).clear();
                (data[store] || []).forEach(item => {
                    delete item.id;
                    transaction.objectStore(store).add(item);
                });
            });
            
            CATEGORIES = data.categories || CATEGORIES;
            localStorage.setItem('categories', JSON.stringify(CATEGORIES));
            alert('Datos restaurados');
            updateDashboard();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (!confirm('¿Eliminar TODOS los datos?')) return;
    if (!confirm('Segunda confirmación - ¿Estás seguro?')) return;
    
    const transaction = db.transaction(['expenses', 'income', 'loans', 'credits', 'budgets'], 'readwrite');
    ['expenses', 'income', 'loans', 'credits', 'budgets'].forEach(store => {
        transaction.objectStore(store).clear();
    });
    
    alert('Datos eliminados');
    updateDashboard();
}

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    initDB().then(() => {
        updateMonthDisplay();
        loadCategoryDropdown('expenseCategory');
        updateDashboard();
    }).catch(err => {
        console.error('Error:', err);
        alert('Error al inicializar la aplicación');
    });
});
