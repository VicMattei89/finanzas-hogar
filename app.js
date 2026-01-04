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
let categoryChartInstance = null;
let incomeVsExpenseChartInstance = null;
let expensesForecastChartInstance = null;
let incomeForecastChartInstance = null;
let balanceForecastChartInstance = null;
let editingLoanId = null;

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
        const request = indexedDB.open('FinanzasDB', 4);
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
    document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    
    if (sectionId === 'expenses') loadExpenses();
    else if (sectionId === 'income') loadIncome();
    else if (sectionId === 'loans') {
        loadLoans();
        checkLoanDates();
    }
    else if (sectionId === 'credits') {
        loadCredits();
        checkCreditDates();
    }
    else if (sectionId === 'forecast') {
        loadForecastData();
        setTimeout(() => {
            drawExpensesForecast();
            drawIncomeForecast();
            drawBalanceForecast();
        }, 100);
    }
    else if (sectionId === 'settings') renderCategories();
    else if (sectionId === 'dashboard') updateDashboard();
}

function switchForecastTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tab + 'Forecast').classList.add('active');
    
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    if (modalId === 'expenseModal') {
        document.getElementById('expenseDate').valueAsDate = new Date();
        loadCategoryDropdown('expenseCategory');
    } else if (modalId === 'incomeModal') {
        document.getElementById('incomeDate').valueAsDate = new Date();
        updateIncomeForm();
    } else if (modalId === 'loanModal') {
        document.getElementById('loanDueDate').valueAsDate = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000);
        updateLoanTypeFields();
        updateLoanPaymentType();
    } else if (modalId === 'creditModal') {
        document.getElementById('creditFirstPaymentDate').valueAsDate = new Date();
        document.getElementById('creditDueDate').valueAsDate = new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate());
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

function updateLoanTypeFields() {
    const type = document.getElementById('loanType').value;
    const label = document.querySelector('#loanModal h2');
    if (type === 'egreso') {
        label.textContent = '📤 Nuevo Egreso (Dinero que presté)';
    } else {
        label.textContent = '📥 Nuevo Ingreso (Dinero que me prestaron)';
    }
}

function updateLoanPaymentType() {
    const type = document.getElementById('loanPaymentType').value;
    const installmentsField = document.getElementById('installmentsField');
    if (type === 'installments') {
        installmentsField.style.display = 'block';
    } else {
        installmentsField.style.display = 'none';
    }
}

function updateReturnStatusFields() {
    const status = document.getElementById('loanReturnStatus').value;
    const partialFields = document.getElementById('partialReturnFields');
    if (status === 'partial') {
        partialFields.style.display = 'block';
    } else {
        partialFields.style.display = 'none';
    }
}

function calculateMonthlyPayment() {
    const amount = parseCLP(document.getElementById('creditAmount').value);
    const installments = parseInt(document.getElementById('creditInstallments').value) || 1;
    const monthlyPayment = Math.round(amount / installments);
    document.getElementById('creditMonthlyPayment').value = monthlyPayment;
}

function calculateInstallmentAmount() {
    const amount = parseCLP(document.getElementById('loanAmount').value);
    const installments = parseInt(document.getElementById('loanInstallments').value) || 1;
    const installmentAmount = Math.round(amount / installments);
    document.getElementById('loanInstallmentAmount').value = installmentAmount;
}

function loadCategoryDropdown(elementId) {
    const select = document.getElementById(elementId);
    select.innerHTML = '<option value="">Selecciona una categoría</option>';
    for (const [key, cat] of Object.entries(CATEGORIES)) {
        select.innerHTML += `<option value="${key}">${cat.icon} ${cat.label}</option>`;
    }
}

// GASTOS
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
            <div class="transaction-item">
                <div class="transaction-info">
                    <h4>${CATEGORIES[exp.category]?.icon || '📌'} ${CATEGORIES[exp.category]?.label || 'Otra'}</h4>
                    <p>${exp.description} • ${new Date(exp.date).toLocaleDateString('es-CL')}</p>
                </div>
                <div style="text-align: right; display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: bold; color: #f44336;">-${formatCLP(exp.amount)}</span>
                    <button onclick="deleteExpense(${exp.id})" class="btn-small btn-danger">🗑️</button>
                </div>
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
            <div class="transaction-item">
                <div class="transaction-info">
                    <h4>${INCOME_TYPES[inc.type]?.icon || '📌'} ${INCOME_TYPES[inc.type]?.label || 'Otro'}</h4>
                    <p>${inc.description} • ${new Date(inc.date).toLocaleDateString('es-CL')}</p>
                </div>
                <div style="text-align: right; display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: bold; color: #4CAF50;">+${formatCLP(inc.amount)}</span>
                    <button onclick="deleteIncome(${inc.id})" class="btn-small btn-danger">🗑️</button>
                </div>
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

// PRÉSTAMOS CON CUOTAS
function generatePaymentSchedule(amount, installments, startDate) {
    const schedule = [];
    const installmentAmount = Math.round(amount / installments);
    
    for (let i = 0; i < installments; i++) {
        const paymentDate = addMonthsToDate(new Date(startDate), i);
        schedule.push({
            number: i + 1,
            date: paymentDate.toISOString().split('T')[0],
            amount: i === installments - 1 ? amount - (installmentAmount * (installments - 1)) : installmentAmount,
            status: 'pending'
        });
    }
    
    return schedule;
}

function saveLoan(event) {
    event.preventDefault();
    const type = document.getElementById('loanType').value;
    const person = document.getElementById('loanPerson').value;
    const amount = parseCLP(document.getElementById('loanAmount').value);
    const paymentType = document.getElementById('loanPaymentType').value;
    const dueDate = document.getElementById('loanDueDate').value;
    const description = document.getElementById('loanDescription').value;
    
    if (!type || !person || !amount || !dueDate) {
        alert('Por favor completa todos los campos requeridos');
        return;
    }
    
    let paymentSchedule = null;
    if (paymentType === 'installments') {
        const installments = parseInt(document.getElementById('loanInstallments').value);
        if (!installments || installments < 2) {
            alert('Ingresa un número válido de cuotas (mínimo 2)');
            return;
        }
        paymentSchedule = generatePaymentSchedule(amount, installments, dueDate);
    }
    
    const loan = {
        type,
        person,
        amount,
        paymentType,
        dueDate,
        paymentSchedule,
        description,
        status: 'pending',
        returnHistory: [],
        timestamp: new Date().getTime(),
        createdDate: new Date().toISOString().split('T')[0]
    };
    
    const transaction = db.transaction(['loans'], 'readwrite');
    const store = transaction.objectStore('loans');
    store.add(loan);
    
    transaction.oncomplete = () => {
        alert('Préstamo guardado exitosamente');
        closeModal('loanModal');
        document.getElementById('loanModal').querySelector('form').reset();
        loadLoans();
        updateDashboard();
    };
}

function checkLoanDates() {
    const transaction = db.transaction(['loans'], 'readonly');
    const store = transaction.objectStore('loans');
    const request = store.getAll();
    
    request.onsuccess = () => {
        const loans = request.result;
        const today = new Date().toISOString().split('T')[0];
        const alerts = [];
        
        loans.forEach(loan => {
            if (loan.status === 'pending') {
                if (loan.paymentSchedule) {
                    const overduePayments = loan.paymentSchedule.filter(p => p.date <= today && p.status === 'pending');
                    if (overduePayments.length > 0) {
                        alerts.push({ ...loan, overdueCount: overduePayments.length });
                    }
                } else if (loan.dueDate <= today) {
                    alerts.push(loan);
                }
            }
        });
        
        const alertContainer = document.getElementById('loansAlerts');
        if (alerts.length > 0) {
            alertContainer.innerHTML = alerts.map(loan => `
                <div class="alert-box danger">
                    <strong>⚠️ Préstamo Vencido:</strong> ${loan.person} - ${formatCLP(loan.amount)}
                    <br><small>Vencimiento: ${new Date(loan.dueDate).toLocaleDateString('es-CL')}${loan.overdueCount ? ` (${loan.overdueCount} cuota(s) vencida(s))` : ''}</small>
                    <br><button onclick="editLoanReturn(${loan.id})" class="btn-small btn-primary" style="margin-top: 8px;">📅 Actualizar Estado</button>
                </div>
            `).join('');
        } else {
            alertContainer.innerHTML = '';
        }
    };
}

function editLoanReturn(loanId) {
    editingLoanId = loanId;
    const transaction = db.transaction(['loans'], 'readonly');
    const store = transaction.objectStore('loans');
    const request = store.get(loanId);
    
    request.onsuccess = () => {
        const loan = request.result;
        document.getElementById('loanReturnStatus').value = loan.status;
        updateReturnStatusFields();
        openModal('updateLoanReturnModal');
    };
}

function saveLoanReturn(event) {
    event.preventDefault();
    if (!editingLoanId) return;
    
    const status = document.getElementById('loanReturnStatus').value;
    const newDate = document.getElementById('newReturnDate').value;
    const notes = document.getElementById('returnNotes').value;
    const partialAmount = status === 'partial' ? parseCLP(document.getElementById('partialReturnAmount').value) : 0;
    
    const transaction = db.transaction(['loans'], 'readwrite');
    const store = transaction.objectStore('loans');
    const getRequest = store.get(editingLoanId);
    
    getRequest.onsuccess = () => {
        const loan = getRequest.result;
        loan.status = status;
        if (newDate) loan.dueDate = newDate;
        
        if (!loan.returnHistory) loan.returnHistory = [];
        loan.returnHistory.push({
            date: new Date().toISOString(),
            status: status,
            amount: partialAmount,
            notes: notes
        });
        
        const updateRequest = store.put(loan);
        updateRequest.onsuccess = () => {
            alert('Préstamo actualizado exitosamente');
            closeModal('updateLoanReturnModal');
            loadLoans();
            checkLoanDates();
            updateDashboard();
        };
    };
}

function loadLoans() {
    const transaction = db.transaction(['loans'], 'readonly');
    const store = transaction.objectStore('loans');
    const request = store.getAll();
    
    request.onsuccess = () => {
        const loans = request.result;
        const container = document.getElementById('loansList');
        
        if (loans.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔄</div><p>No hay préstamos registrados</p></div>';
            return;
        }
        
        container.innerHTML = loans.map(loan => {
            const typeIcon = loan.type === 'egreso' ? '📤' : '📥';
            const typeLabel = loan.type === 'egreso' ? 'Yo presté' : 'Me prestaron';
            const statusIcon = loan.status === 'completed' ? '✅' : loan.status === 'partial' ? '⚠️' : '⏳';
            const dueDate = new Date(loan.dueDate);
            const today = new Date();
            const isOverdue = dueDate < today && loan.status === 'pending';
            
            let scheduleHTML = '';
            if (loan.paymentSchedule && loan.paymentSchedule.length > 0) {
                scheduleHTML = `
                    <div class="payment-schedule">
                        <h4>📅 Calendario de Cuotas:</h4>
                        ${loan.paymentSchedule.map(payment => {
                            const payDate = new Date(payment.date);
                            const isPaid = payment.status === 'paid';
                            const isOverduePayment = payDate < today && payment.status === 'pending';
                            return `
                                <div class="payment-row ${isPaid ? 'paid' : ''} ${isOverduePayment ? 'overdue' : ''}">
                                    <strong>Cuota ${payment.number}</strong>
                                    <span>${payDate.toLocaleDateString('es-CL')}</span>
                                    <span>${formatCLP(payment.amount)}</span>
                                    <span>${payment.status === 'paid' ? '✅' : isOverduePayment ? '❌' : '⏳'}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }
            
            return `
                <div class="transaction-item" style="border-left-color: ${isOverdue ? '#f44336' : '#ff9800'};">
                    <div class="transaction-info">
                        <h4>${typeIcon} ${loan.person} - ${typeLabel}</h4>
                        <p>${loan.paymentType === 'single' ? '💵 Pago Único' : `📅 ${loan.paymentSchedule.length} Cuotas`} • ${new Date(loan.createdDate).toLocaleDateString('es-CL')}</p>
                        <p style="color: ${isOverdue ? '#f44336' : '#666'}; font-weight: 500;">Vence: ${dueDate.toLocaleDateString('es-CL')} ${statusIcon}</p>
                        ${loan.description ? `<p style="font-size: 12px; color: #999;">📝 ${loan.description}</p>` : ''}
                        ${scheduleHTML}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: #ff9800; margin-bottom: 8px;">${formatCLP(loan.amount)}</div>
                        <button onclick="editLoanReturn(${loan.id})" class="btn-small btn-primary" style="margin-right: 5px;">📅 Actualizar</button>
                        <button onclick="deleteLoan(${loan.id})" class="btn-small btn-danger">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    };
}

function deleteLoan(id) {
    if (!confirm('¿Estás seguro?')) return;
    const transaction = db.transaction(['loans'], 'readwrite');
    const store = transaction.objectStore('loans');
    store.delete(id);
    
    transaction.oncomplete = () => {
        loadLoans();
        updateDashboard();
    };
}

// CRÉDITOS MEJORADOS
function saveCredit(event) {
    event.preventDefault();
    const description = document.getElementById('creditDescription').value;
    const amount = parseCLP(document.getElementById('creditAmount').value);
    const installments = parseInt(document.getElementById('creditInstallments').value);
    const monthlyPayment = parseCLP(document.getElementById('creditMonthlyPayment').value);
    const paid = parseCLP(document.getElementById('creditPaid').value);
    const rate = parseFloat(document.getElementById('creditRate').value) || 0;
    const firstPaymentDate = document.getElementById('creditFirstPaymentDate').value;
    const dueDate = document.getElementById('creditDueDate').value;
    
    if (!description || !amount || !installments || !monthlyPayment || !firstPaymentDate || !dueDate) {
        alert('Por favor completa todos los campos requeridos');
        return;
    }
    
    // Generar cronograma de pagos
    const paymentSchedule = [];
    for (let i = 0; i < installments; i++) {
        const paymentDate = addMonthsToDate(new Date(firstPaymentDate), i);
        paymentSchedule.push({
            number: i + 1,
            date: paymentDate.toISOString().split('T')[0],
            amount: monthlyPayment,
            status: 'pending'
        });
    }
    
    const credit = {
        description,
        amount,
        installments,
        monthlyPayment,
        paid,
        rate,
        firstPaymentDate,
        dueDate,
        paymentSchedule,
        status: paid >= amount ? 'completed' : 'active',
        timestamp: new Date().getTime()
    };
    
    const transaction = db.transaction(['credits'], 'readwrite');
    const store = transaction.objectStore('credits');
    store.add(credit);
    
    transaction.oncomplete = () => {
        alert('Crédito guardado exitosamente');
        closeModal('creditModal');
        document.getElementById('creditModal').querySelector('form').reset();
        loadCredits();
        updateDashboard();
    };
}

function checkCreditDates() {
    const transaction = db.transaction(['credits'], 'readonly');
    const store = transaction.objectStore('credits');
    const request = store.getAll();
    
    request.onsuccess = () => {
        const credits = request.result;
        const today = new Date().toISOString().split('T')[0];
        const alerts = [];
        
        credits.forEach(credit => {
            if (credit.status === 'active' && credit.dueDate <= today && credit.paid < credit.amount) {
                alerts.push(credit);
            }
        });
        
        const alertContainer = document.getElementById('creditsAlerts');
        if (alerts.length > 0) {
            alertContainer.innerHTML = alerts.map(credit => `
                <div class="alert-box danger">
                    <strong>⚠️ Crédito Vencido:</strong> ${credit.description}
                    <br><small>Pendiente: ${formatCLP(credit.amount - credit.paid)} • Vence: ${new Date(credit.dueDate).toLocaleDateString('es-CL')}</small>
                </div>
            `).join('');
        } else {
            alertContainer.innerHTML = '';
        }
    };
}

function loadCredits() {
    const transaction = db.transaction(['credits'], 'readonly');
    const store = transaction.objectStore('credits');
    const request = store.getAll();
    
    request.onsuccess = () => {
        const credits = request.result;
        const container = document.getElementById('creditsList');
        
        if (credits.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💳</div><p>No hay créditos registrados</p></div>';
            return;
        }
        
        container.innerHTML = credits.map(credit => {
            const percentage = (credit.paid / credit.amount) * 100;
            const daysRemaining = Math.ceil((new Date(credit.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
            const today = new Date().toISOString().split('T')[0];
            
            let scheduleHTML = '';
            if (credit.paymentSchedule && credit.paymentSchedule.length > 0) {
                scheduleHTML = `
                    <div class="payment-schedule">
                        <h4>📅 Cronograma de Cuotas:</h4>
                        ${credit.paymentSchedule.slice(0, 5).map(payment => {
                            const isOverdue = payment.date <= today && payment.status === 'pending';
                            return `
                                <div class="payment-row ${isOverdue ? 'overdue' : ''}">
                                    <strong>Cuota ${payment.number}</strong>
                                    <span>${new Date(payment.date).toLocaleDateString('es-CL')}</span>
                                    <span>${formatCLP(payment.amount)}</span>
                                    <span>${isOverdue ? '❌' : '⏳'}</span>
                                </div>
                            `;
                        }).join('')}
                        ${credit.paymentSchedule.length > 5 ? `<p style="font-size: 12px; color: #999; margin-top: 5px;">... y ${credit.paymentSchedule.length - 5} cuota(s) más</p>` : ''}
                    </div>
                `;
            }
            
            return `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <h4>💳 ${credit.description}</h4>
                        <p>${credit.installments} cuotas de ${formatCLP(credit.monthlyPayment)} • ${credit.rate > 0 ? `Tasa: ${credit.rate}%` : 'Sin interés'}</p>
                        <div style="margin-top: 8px;">
                            <div style="background: #eee; height: 8px; border-radius: 4px; overflow: hidden;">
                                <div style="background: ${percentage < 100 ? '#2196F3' : '#4CAF50'}; height: 100%; width: ${percentage}%; transition: width 0.3s;"></div>
                            </div>
                            <p style="font-size: 11px; margin-top: 4px; color: #666;">Pagado: ${formatCLP(credit.paid)} / ${formatCLP(credit.amount)} (${percentage.toFixed(1)}%)</p>
                        </div>
                        <p style="font-size: 12px; color: ${daysRemaining < 30 ? '#f44336' : '#999'}; margin-top: 4px;">
                            ${daysRemaining > 0 ? `Vence en ${daysRemaining} días` : '⚠️ Vencido'}
                        </p>
                        ${scheduleHTML}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: #2196F3; margin-bottom: 8px;">${formatCLP(credit.amount - credit.paid)}</div>
                        <button onclick="deleteCredit(${credit.id})" class="btn-small btn-danger">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    };
}

function deleteCredit(id) {
    if (!confirm('¿Estás seguro?')) return;
    const transaction = db.transaction(['credits'], 'readwrite');
    const store = transaction.objectStore('credits');
    store.delete(id);
    
    transaction.oncomplete = () => {
        loadCredits();
        updateDashboard();
    };
}

// DASHBOARD
function updateDashboard() {
    const currentMonth = getCurrentMonth();
    
    const transaction = db.transaction(['expenses', 'income', 'loans', 'credits'], 'readonly');
    
    const expenseStore = transaction.objectStore('expenses');
    const incomeStore = transaction.objectStore('income');
    const loansStore = transaction.objectStore('loans');
    const creditsStore = transaction.objectStore('credits');
    
    const expensesRequest = expenseStore.getAll();
    const incomeRequest = incomeStore.getAll();
    const loansRequest = loansStore.getAll();
    const creditsRequest = creditsStore.getAll();
    
    let expenses = [];
    let incomes = [];
    let loans = [];
    let credits = [];
    
    expensesRequest.onsuccess = () => {
        expenses = expensesRequest.result.filter(e => e.date.startsWith(currentMonth));
    };
    
    incomeRequest.onsuccess = () => {
        incomes = incomeRequest.result.filter(i => i.date.startsWith(currentMonth));
    };
    
    loansRequest.onsuccess = () => {
        loans = loansRequest.result;
    };
    
    creditsRequest.onsuccess = () => {
        credits = creditsRequest.result;
        
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
        const balance = totalIncome - totalExpenses;
        const toReturn = loans.reduce((sum, l) => {
            if (l.status === 'pending') return sum + l.amount;
            if (l.status === 'partial' && l.returnHistory) {
                const partialReturned = l.returnHistory.filter(r => r.status === 'partial').reduce((s, r) => s + r.amount, 0);
                return sum + (l.amount - partialReturned);
            }
            return sum;
        }, 0);
        
        document.getElementById('totalExpenses').textContent = formatCLP(totalExpenses);
        document.getElementById('totalIncome').textContent = formatCLP(totalIncome);
        document.getElementById('balance').textContent = formatCLP(balance);
        document.getElementById('toReturn').textContent = formatCLP(toReturn);
        
        updateRecentTransactions(expenses, incomes);
        drawCategoryChart(expenses);
        drawIncomeVsExpenseChart(totalIncome, totalExpenses);
    };
}

function updateRecentTransactions(expenses, incomes) {
    const all = [
        ...expenses.map(e => ({ ...e, type: 'expense' })),
        ...incomes.map(i => ({ ...i, type: 'income' }))
    ];
    
    all.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = all.slice(0, 5);
    
    const container = document.getElementById('recentTransactions');
    
    if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>No hay transacciones este mes</p></div>';
        return;
    }
    
    container.innerHTML = recent.map(t => {
        if (t.type === 'expense') {
            return `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <h4>${CATEGORIES[t.category]?.icon || '📌'} ${CATEGORIES[t.category]?.label || 'Otra'}</h4>
                        <p>${t.description} • ${new Date(t.date).toLocaleDateString('es-CL')}</p>
                    </div>
                    <div style="font-weight: bold; color: #f44336;">-${formatCLP(t.amount)}</div>
                </div>
            `;
        } else {
            return `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <h4>${INCOME_TYPES[t.type]?.icon || '📌'} ${INCOME_TYPES[t.type]?.label || 'Otro'}</h4>
                        <p>${t.description} • ${new Date(t.date).toLocaleDateString('es-CL')}</p>
                    </div>
                    <div style="font-weight: bold; color: #4CAF50;">+${formatCLP(t.amount)}</div>
                </div>
            `;
        }
    }).join('');
}

// GRÁFICOS
function drawCategoryChart(expenses) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    
    const categories = {};
    for (const [key] of Object.entries(CATEGORIES)) {
        categories[key] = expenses.filter(e => e.category === key).reduce((sum, e) => sum + e.amount, 0);
    }
    
    const labels = Object.keys(categories).map(k => CATEGORIES[k]?.label || k);
    const data = Object.values(categories);
    
    if (categoryChartInstance) categoryChartInstance.destroy();
    
    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function drawIncomeVsExpenseChart(income, expenses) {
    const ctx = document.getElementById('incomeVsExpenseChart');
    if (!ctx) return;
    
    if (incomeVsExpenseChartInstance) incomeVsExpenseChartInstance.destroy();
    
    incomeVsExpenseChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{
                label: 'Monto CLP',
                data: [income, expenses],
                backgroundColor: ['#4CAF50', '#f44336']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// PRONÓSTICO DE 6 MESES
function loadForecastData() {
    const transaction = db.transaction(['expenses', 'income'], 'readonly');
    const expenseStore = transaction.objectStore('expenses');
    const incomeStore = transaction.objectStore('income');
    
    const expensesRequest = expenseStore.getAll();
    const incomeRequest = incomeStore.getAll();
    
    expensesRequest.onsuccess = () => {
        incomeRequest.onsuccess = () => {
            generateForecastSummary(expensesRequest.result, incomeRequest.result);
        };
    };
}

function generateForecastSummary(allExpenses, allIncomes) {
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
        
        const totalExp = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totalInc = monthIncomes.reduce((sum, i) => sum + i.amount, 0);
        
        return {
            month: month,
            monthStr: monthStr,
            expenses: totalExp,
            income: totalInc,
            balance: totalInc - totalExp
        };
    });
    
    window.forecastData = forecastData;
    updateForecastSummary(forecastData);
}

function updateForecastSummary(data) {
    const container = document.getElementById('forecastSummary');
    container.innerHTML = data.map(d => `
        <div class="summary-card">
            <h3>${MONTHS_LABELS[d.month.getMonth()]} ${d.month.getFullYear()}</h3>
            <p style="font-size: 12px; color: rgba(255,255,255,0.9);">Ingresos</p>
            <div class="amount">${formatCLP(d.income)}</div>
            <p style="font-size: 12px; color: rgba(255,255,255,0.9); margin-top: 8px;">Gastos: ${formatCLP(d.expenses)}</p>
        </div>
    `).join('');
}

function drawExpensesForecast() {
    if (!window.forecastData) return;
    const ctx = document.getElementById('expensesForecastChart');
    if (!ctx) return;
    
    const labels = window.forecastData.map(d => MONTHS_LABELS[d.month.getMonth()]);
    const data = window.forecastData.map(d => d.expenses);
    
    if (expensesForecastChartInstance) expensesForecastChartInstance.destroy();
    
    expensesForecastChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gastos Proyectados',
                data: data,
                borderColor: '#f44336',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function drawIncomeForecast() {
    if (!window.forecastData) return;
    const ctx = document.getElementById('incomeForecastChart');
    if (!ctx) return;
    
    const labels = window.forecastData.map(d => MONTHS_LABELS[d.month.getMonth()]);
    const data = window.forecastData.map(d => d.income);
    
    if (incomeForecastChartInstance) incomeForecastChartInstance.destroy();
    
    incomeForecastChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ingresos Proyectados',
                data: data,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function drawBalanceForecast() {
    if (!window.forecastData) return;
    const ctx = document.getElementById('balanceForecastChart');
    if (!ctx) return;
    
    const labels = window.forecastData.map(d => MONTHS_LABELS[d.month.getMonth()]);
    const data = window.forecastData.map(d => d.balance);
    
    if (balanceForecastChartInstance) balanceForecastChartInstance.destroy();
    
    balanceForecastChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Balance Proyectado',
                data: data,
                backgroundColor: data.map(d => d >= 0 ? '#4CAF50' : '#f44336')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// GESTIÓN DE CATEGORÍAS
function renderCategories() {
    const container = document.getElementById('categoriesList');
    
    container.innerHTML = Object.entries(CATEGORIES).map(([key, cat]) => `
        <div class="category-card">
            <div style="display: flex; align-items: center; flex: 1;">
                <div class="icon">${cat.icon}</div>
                <div class="info">
                    <h4>${cat.label}</h4>
                    <p style="font-size: 12px; color: #999;">ID: ${key}</p>
                </div>
            </div>
            <div class="actions">
                <button onclick="editCategory('${key}')" class="btn-small" style="background: #667eea; color: white;">✏️</button>
                <button onclick="deleteCategory('${key}')" class="btn-small btn-danger">🗑️</button>
            </div>
        </div>
    `).join('');
}

function saveNewCategory(event) {
    event.preventDefault();
    const icon = document.getElementById('categoryIcon').value.trim();
    const name = document.getElementById('categoryName').value.trim();
    
    if (!icon || !name) {
        alert('Por favor completa todos los campos');
        return;
    }
    
    const newKey = name.toLowerCase().replace(/\s+/g, '_');
    
    if (CATEGORIES[newKey]) {
        alert('Esta categoría ya existe');
        return;
    }
    
    CATEGORIES[newKey] = { icon, label: name };
    localStorage.setItem('categories', JSON.stringify(CATEGORIES));
    
    alert('Categoría agregada exitosamente');
    closeModal('newCategoryModal');
    document.getElementById('newCategoryModal').querySelector('form').reset();
    renderCategories();
    loadCategoryDropdown('expenseCategory');
}

function editCategory(key) {
    const newName = prompt('Nuevo nombre para la categoría:', CATEGORIES[key].label);
    if (newName && newName.trim()) {
        CATEGORIES[key].label = newName.trim();
        localStorage.setItem('categories', JSON.stringify(CATEGORIES));
        renderCategories();
        alert('Categoría actualizada');
    }
}

function deleteCategory(key) {
    if (!confirm('¿Estás seguro? Los gastos de esta categoría no se eliminarán, solo la categoría.')) return;
    
    delete CATEGORIES[key];
    localStorage.setItem('categories', JSON.stringify(CATEGORIES));
    renderCategories();
    alert('Categoría eliminada');
}

// EXPORTAR E IMPORTAR DATOS
function exportData() {
    const transaction = db.transaction(['expenses', 'income', 'loans', 'credits'], 'readonly');
    const expenseStore = transaction.objectStore('expenses');
    const incomeStore = transaction.objectStore('income');
    const loansStore = transaction.objectStore('loans');
    const creditsStore = transaction.objectStore('credits');
    
    const expensesRequest = expenseStore.getAll();
    const incomeRequest = incomeStore.getAll();
    const loansRequest = loansStore.getAll();
    const creditsRequest = creditsStore.getAll();
    
    let expenses = [];
    let incomes = [];
    let loans = [];
    let credits = [];
    
    expensesRequest.onsuccess = () => {
        expenses = expensesRequest.result;
    };
    
    incomeRequest.onsuccess = () => {
        incomes = incomeRequest.result;
    };
    
    loansRequest.onsuccess = () => {
        loans = loansRequest.result;
    };
    
    creditsRequest.onsuccess = () => {
        credits = creditsRequest.result;
        
        const data = {
            version: '4.2.0',
            timestamp: new Date().toISOString(),
            categories: CATEGORIES,
            expenses: expenses,
            incomes: incomes,
            loans: loans,
            credits: credits
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finanzas-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!confirm('¿Deseas restaurar todos los datos del backup? Esto sobrescribirá los datos actuales.')) return;
            
            clearDatabase().then(() => {
                const transaction = db.transaction(['expenses', 'income', 'loans', 'credits'], 'readwrite');
                const expenseStore = transaction.objectStore('expenses');
                const incomeStore = transaction.objectStore('income');
                const loansStore = transaction.objectStore('loans');
                const creditsStore = transaction.objectStore('credits');
                
                data.expenses.forEach(exp => expenseStore.add(exp));
                data.incomes.forEach(inc => incomeStore.add(inc));
                data.loans.forEach(loan => loansStore.add(loan));
                data.credits.forEach(credit => creditsStore.add(credit));
                
                CATEGORIES = data.categories || CATEGORIES;
                localStorage.setItem('categories', JSON.stringify(CATEGORIES));
                
                transaction.oncomplete = () => {
                    alert('Datos restaurados exitosamente');
                    updateDashboard();
                    renderCategories();
                };
            });
        } catch (error) {
            alert('Error al importar: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function clearDatabase() {
    return new Promise((resolve) => {
        const transaction = db.transaction(['expenses', 'income', 'loans', 'credits'], 'readwrite');
        const expenseStore = transaction.objectStore('expenses');
        const incomeStore = transaction.objectStore('income');
        const loansStore = transaction.objectStore('loans');
        const creditsStore = transaction.objectStore('credits');
        
        expenseStore.clear();
        incomeStore.clear();
        loansStore.clear();
        creditsStore.clear();
        
        transaction.oncomplete = () => resolve();
    });
}

function clearAllData() {
    if (!confirm('⚠️ ¿Estás completamente seguro? Esto eliminará TODOS tus datos. No se puede deshacer.')) return;
    if (!confirm('Segunda confirmación: ¿Deseas eliminar todos los datos?')) return;
    
    clearDatabase().then(() => {
        CATEGORIES = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        localStorage.setItem('categories', JSON.stringify(CATEGORIES));
        alert('Todos los datos han sido eliminados');
        updateDashboard();
        renderCategories();
    });
}

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    initDB().then(() => {
        updateMonthDisplay();
        loadCategoryDropdown('expenseCategory');
        updateDashboard();
        renderCategories();
    }).catch(err => {
        console.error('Error inicializando DB:', err);
        alert('Error al inicializar la aplicación. Por favor recarga la página.');
    });
});
