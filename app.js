/* ========================================
   STATE MANAGEMENT & ENGINE
======================================== */
const $ = id => document.getElementById(id);
let dbProducts = JSON.parse(localStorage.getItem('pdv_products')) || [];
let dbSales = JSON.parse(localStorage.getItem('pdv_sales')) || [];
let cart = [];
let selectedCartIndex = -1;
let currentPayMethod = 'Dinheiro';

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = type === 'success' 
    ? `<i class="fa-solid fa-circle-check" style="color:var(--success)"></i> ${msg}` 
    : type === 'danger' 
      ? `<i class="fa-solid fa-circle-xmark" style="color:var(--danger)"></i> ${msg}` 
      : `<i class="fa-solid fa-info"></i> ${msg}`;
  
  $('toastContainer').appendChild(t);
  setTimeout(() => t.style.animation = 'slideOut .2s ease forwards', 3000);
  setTimeout(() => t.remove(), 3250);
}

function switchPage(pageId) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  const btn = Array.from(document.querySelectorAll('.nav-btn')).find(b => b.getAttribute('onclick').includes(pageId));
  if (btn) btn.classList.add('active');
  
  const targetPage = $(`page-${pageId}`);
  if (targetPage) targetPage.classList.add('active');
  
  if (pageId === 'pos') $('pluInput').focus();
  if (pageId === 'products') renderProducts();
  if (pageId === 'sales') renderSales();
  if (pageId === 'settings') updateStorageInfo();
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('pdv_theme', currentTheme);
  document.querySelector('.theme-toggle i').className = currentTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function updateLiveClock() {
  const d = new Date();
  if ($('billDate')) {
    $('billDate').textContent = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
  }
}

function updatePOSMeta() {
  if ($('billNumber')) {
    $('billNumber').textContent = `CONTA #${String(dbSales.length + 1).padStart(4, '0')}`;
  }
}

// Inicializador Automático
(function initSystem() {
  const savedTheme = localStorage.getItem('pdv_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.querySelector('.theme-toggle i').className = savedTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  
  updateLiveClock();
  setInterval(updateLiveClock, 1000);
  updatePOSMeta();
})();

/* ========================================
   POS OPERATIONS (CAIXA)
======================================== */
$('pluInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const val = e.target.value.trim();
    if (!val) return;
    
    let qty = 1;
    let code = val;
    
    if (val.includes('*')) {
      const parts = val.split('*');
      qty = parseFloat(parts[0]) || 1;
      code = parts[1] || '';
    }
    
    const prod = dbProducts.find(p => p.code === code);
    if (prod) {
      addToCart(prod, qty);
      e.target.value = '';
    } else {
      showToast('Produto não cadastrado!', 'danger');
      e.target.value = '';
    }
  }
});

function addToCart(prod, qty) {
  const exist = cart.find(item => item.product.code === prod.code);
  if (exist) {
    exist.qty += qty;
  } else {
    cart.push({ product: prod, qty: qty });
  }
  selectedCartIndex = cart.length - 1;
  renderCart();
  $('pluInput').focus();
}

function renderCart() {
  const container = $('cartItems');
  container.innerHTML = '';
  let sub = 0;
  
  cart.forEach((item, idx) => {
    const t = item.product.price * item.qty;
    sub += t;
    const r = document.createElement('div');
    r.className = `cart-item ${idx === selectedCartIndex ? 'selected' : ''}`;
    r.onclick = () => { selectedCartIndex = idx; renderCart(); };
    r.innerHTML = `
      <div class="index">${String(idx + 1).padStart(3, '0')}</div>
      <div class="name">${item.product.name}</div>
      <div class="qty">${item.qty}</div>
      <div class="price">${item.product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div class="total">${t.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    `;
    container.appendChild(r);
  });
  
  if (selectedCartIndex >= 0 && container.children[selectedCartIndex]) {
    container.children[selectedCartIndex].scrollIntoView({ block: 'nearest' });
  }
  
  $('subtotalVal').textContent = 'R$ ' + sub.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  $('totalVal').textContent = 'R$ ' + sub.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function removeSelectedCartItem() {
  if (selectedCartIndex < 0) return;
  cart.splice(selectedCartIndex, 1);
  selectedCartIndex = cart.length - 1;
  renderCart();
  $('pluInput').focus();
}

function changeQtyShortcut() {
  if (selectedCartIndex < 0) return;
  const n = prompt('Digite a nova quantidade:', cart[selectedCartIndex].qty);
  if (n !== null && parseFloat(n) > 0) {
    cart[selectedCartIndex].qty = parseFloat(n);
    renderCart();
  }
}

function clearCart() {
  if (!cart.length) return;
  if (confirm('Deseja realmente cancelar e esvaziar a venda atual?')) {
    cart = [];
    selectedCartIndex = -1;
    renderCart();
    showToast('Venda cancelada');
  }
}

function openManualEntryModal() {
  const sel = $('manualSelect');
  sel.innerHTML = '';
  if (!dbProducts.length) {
    showToast('Nenhum produto cadastrado', 'danger');
    return;
  }
  dbProducts.sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
    const o = document.createElement('option');
    o.value = p.code;
    o.textContent = `${p.name} (R$ ${p.price.toFixed(2)})`;
    sel.appendChild(o);
  });
  $('manualQty').value = '1';
  $('modalManual').classList.add('show');
}

function submitManualEntry() {
  const prod = dbProducts.find(p => p.code === $('manualSelect').value);
  const qty = parseFloat($('manualQty').value) || 1;
  if (prod) {
    addToCart(prod, qty);
    closeModal('modalManual');
  }
}

function openPaymentModal() {
  if (!cart.length) {
    showToast('Carrinho vazio!', 'danger');
    return;
  }
  const total = cart.reduce((a, c) => a + (c.product.price * c.qty), 0);
  $('payTotal').textContent = 'R$ ' + total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  $('payReceived').value = total.toFixed(2);
  setPayMethod('Dinheiro');
  calcChange();
  $('modalPayment').classList.add('show');
  setTimeout(() => $('payReceived').select(), 100);
}

function setPayMethod(m) {
  currentPayMethod = m;
  document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('selected'));
  
  if (m === 'Dinheiro') {
    $('pay-money').classList.add('selected');
    $('receivedGroup').style.display = 'flex';
    $('changeDisplay').style.display = 'flex';
  } else {
    $('receivedGroup').style.display = 'none';
    $('changeDisplay').style.display = 'none';
    if (m === 'Cartão Débito') $('pay-card-deb').classList.add('selected');
    if (m === 'Cartão Crédito') $('pay-card-cred').classList.add('selected');
    if (m === 'PIX') $('pay-pix').classList.add('selected');
  }
}

function calcChange() {
  const total = cart.reduce((a, c) => a + (c.product.price * c.qty), 0);
  const rec = parseFloat($('payReceived').value) || 0;
  const change = rec - total;
  $('payChange').textContent = 'R$ ' + (change > 0 ? change : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function completeSale() {
  const total = cart.reduce((a, c) => a + (c.product.price * c.qty), 0);
  const rec = parseFloat($('payReceived').value) || 0;
  
  if (currentPayMethod === 'Dinheiro' && rec < total) {
    showToast('Valor recebido menor que o total!', 'danger');
    return;
  }
  
  // Deduz estoque
  cart.forEach(item => {
    const p = dbProducts.find(prod => prod.code === item.product.code);
    if (p && p.stock !== undefined && p.stock !== '') {
      p.stock = Math.max(0, p.stock - item.qty);
    }
  });
  localStorage.setItem('pdv_products', JSON.stringify(dbProducts));
  
  // Cria venda
  const sale = {
    id: String(dbSales.length + 1).padStart(5, '0'),
    date: new Date().toISOString(),
    items: cart.map(i => ({ code: i.product.code, name: i.product.name, qty: i.qty, price: i.product.price })),
    total: total,
    method: currentPayMethod
  };
  
  dbSales.push(sale);
  localStorage.setItem('pdv_sales', JSON.stringify(dbSales));
  
  showToast('Venda finalizada com sucesso!', 'success');
  cart = [];
  selectedCartIndex = -1;
  renderCart();
  closeModal('modalPayment');
  updatePOSMeta();
}

function closeModal(id) {
  $(id).classList.remove('show');
  if (document.querySelector('#page-pos.active')) $('pluInput').focus();
}

/* ========================================
   PRODUCT DATABASE LAB
======================================== */
function renderProducts() {
  const q = $('searchProd').value.toLowerCase();
  const body = document.querySelector('#productsTable tbody');
  body.innerHTML = '';
  
  const filtered = dbProducts.filter(p => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  $('prodCount').textContent = `${filtered.length} listados`;
  
  filtered.sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${p.code}</td>
      <td>${p.name}</td>
      <td class="mono" style="text-align:right">R$ ${p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td class="mono" style="text-align:right">${p.stock || 0}</td>
      <td class="actions">
        <button class="btn-icon" onclick="editProduct('${p.code}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon del" onclick="deleteProduct('${p.code}')"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    `;
    body.appendChild(tr);
  });
}

function saveProduct() {
  const code = $('prodCode').value.trim();
  const name = $('prodName').value.trim();
  const price = parseFloat($('prodPrice').value) || 0;
  const stock = parseInt($('prodStock').value) || 0;
  
  if (!code || !name || price <= 0) {
    showToast('Preencha os campos obrigatórios corretamente!', 'danger');
    return;
  }
  
  const id = $('prodId').value;
  if (id) {
    const idx = dbProducts.findIndex(p => p.code === id);
    if (idx >= 0) dbProducts[idx] = { code, name, price, stock };
  } else {
    if (dbProducts.some(p => p.code === code)) {
      showToast('Código de barras já cadastrado!', 'danger');
      return;
    }
    dbProducts.push({ code, name, price, stock });
  }
  
  localStorage.setItem('pdv_products', JSON.stringify(dbProducts));
  showToast('Produto guardado!', 'success');
  resetProductForm();
  renderProducts();
}

function editProduct(code) {
  const p = dbProducts.find(prod => prod.code === code);
  if (!p) return;
  
  $('prodId').value = p.code;
  $('prodCode').value = p.code;
  $('prodName').value = p.name;
  $('prodPrice').value = p.price;
  $('prodStock').value = p.stock || 0;
  
  $('prodFormTitle').textContent = 'Editar Produto';
  $('btnCancelEdit').style.display = 'inline-flex';
}

function deleteProduct(code) {
  if (confirm(`Remover definitivamente o produto código ${code}?`)) {
    dbProducts = dbProducts.filter(p => p.code !== code);
    localStorage.setItem('pdv_products', JSON.stringify(dbProducts));
    renderProducts();
    showToast('Produto excluído');
  }
}

function resetProductForm() {
  $('prodId').value = '';
  $('prodCode').value = '';
  $('prodName').value = '';
  $('prodPrice').value = '';
  $('prodStock').value = '';
  $('prodFormTitle').textContent = 'Cadastrar Novo Produto';
  $('btnCancelEdit').style.display = 'none';
}

/* ========================================
   SALES ANALYTICS / HISTORY
======================================== */
function renderSales() {
  let rev = 0;
  let items = 0;
  dbSales.forEach(s => {
    rev += s.total;
    s.items.forEach(i => items += i.qty);
  });
  
  $('sumRevenue').textContent = 'R$ ' + rev.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  $('sumCount').textContent = dbSales.length;
  $('sumItems').textContent = items;
  $('sumAverage').textContent = 'R$ ' + (dbSales.length ? (rev / dbSales.length) : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  
  const body = document.querySelector('#salesTable tbody');
  body.innerHTML = '';
  
  dbSales.slice().reverse().forEach(s => {
    const tr = document.createElement('tr');
    const dt = new Date(s.date);
    const qty = s.items.reduce((a, c) => a + c.qty, 0);
    tr.innerHTML = `
      <td class="mono">#${s.id}</td>
      <td>${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR')}</td>
      <td class="mono" style="text-align:right">${qty}</td>
      <td class="mono" style="text-align:right;font-weight:700">R$ ${s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td><span class="status-indicator" style="background:var(--bg-tertiary);color:var(--text-primary)">${s.method}</span></td>
      <td class="actions"><button class="btn-icon del" onclick="voidSale('${s.id}')"><i class="fa-solid fa-ban"></i> Estornar</button></td>
    `;
    body.appendChild(tr);
  });
}

function voidSale(id) {
  if (confirm(`Deseja realizar o estorno da venda #${id}? O estoque NÃO será devolvido automaticamente nesta versão.`)) {
    dbSales = dbSales.filter(s => s.id !== id);
    localStorage.setItem('pdv_sales', JSON.stringify(dbSales));
    renderSales();
    showToast('Venda estornada com sucesso');
  }
}

/* ========================================
   SETTINGS & BACKUP DISK
======================================== */
function triggerBackupImport() {
  $('importFile').click();
}

function loadDemoData() {
  const demo = [
    { code: '78910001', name: 'Água Mineral Sem Gás 500ml', price: 2.50, stock: 120 },
    { code: '78910002', name: 'Refrigerante Cola Lata 350ml', price: 4.50, stock: 85 },
    { code: '78910003', name: 'Salgado Assado Frango Unidade', price: 6.00, stock: 15 },
    { code: '78910004', name: 'Chocolate Barra Ao Leite 100g', price: 7.99, stock: 40 },
    { code: '78910005', name: 'Biscoito Recheado Chocolate 130g', price: 3.20, stock: 60 },
    { code: '1010', name: 'Café Expresso Curto', price: 4.00, stock: 999 }
  ];
  
  demo.forEach(d => {
    if (!dbProducts.some(p => p.code === d.code)) dbProducts.push(d);
  });
  
  localStorage.setItem('pdv_products', JSON.stringify(dbProducts));
  showToast('Produtos de teste inseridos!', 'success');
}

function clearAllData() {
  if (confirm('ATENÇÃO: Isso apagará TODOS os produtos e histórico deste navegador de forma permanente. Deseja continuar?')) {
    localStorage.clear();
    dbProducts = [];
    dbSales = [];
    cart = [];
    selectedCartIndex = -1;
    renderCart();
    updatePOSMeta();
    showToast('Toda a base de dados limpa!', 'danger');
  }
}

function exportBackup() {
  const data = { products: dbProducts, sales: dbSales };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pdv_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.products) dbProducts = data.products;
      if (data.sales) dbSales = data.sales;
      
      localStorage.setItem('pdv_products', JSON.stringify(dbProducts));
      localStorage.setItem('pdv_sales', JSON.stringify(dbSales));
      
      showToast('Backup importado com sucesso!', 'success');
      updateStorageInfo();
      updatePOSMeta();
      event.target.value = '';
    } catch (err) {
      showToast('Arquivo de backup inválido!', 'danger');
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function updateStorageInfo() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('pdv_')) total += localStorage.getItem(key).length;
  }
  const kb = (total / 1024).toFixed(1);
  $('storageUsed').textContent = total > 1048576 ? (total / 1048576).toFixed(2) + ' MB' : kb + ' KB';
}

/* ========================================
   KEYBOARD SHORTCUTS
======================================== */
document.addEventListener('keydown', e => {
  // F2 = manual entry
  if (e.key === 'F2') {
    e.preventDefault();
    openManualEntryModal();
    return;
  }
  // F3 = focus PLU
  if (e.key === 'F3') {
    e.preventDefault();
    $('pluInput').focus();
    return;
  }
  // F4 = open payment
  if (e.key === 'F4') {
    e.preventDefault();
    openPaymentModal();
    return;
  }
  // Escape = close top modal
  if (e.key === 'Escape') {
    const modals = document.querySelectorAll('.modal-overlay.show');
    if (modals.length) modals[modals.length - 1].classList.remove('show');
    return;
  }
  // Alternar quantidades ou focar campo de entrada ao digitar fora de inputs
  if (document.querySelector('#page-pos.active') && !e.target.closest('input,textarea,select') && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
    if (e.key === '+' || e.key === '-') {
      e.preventDefault();
      if (e.key === '+') {
        if (selectedCartIndex >= 0) {
          cart[selectedCartIndex].qty++;
          renderCart();
        }
      } else {
        if (selectedCartIndex >= 0 && cart[selectedCartIndex].qty > 1) {
          cart[selectedCartIndex].qty--;
          renderCart();
        }
      }
      return;
    }
    $('pluInput').focus();
  }
  // Tecla Delete para apagar item selecionado
  if (e.key === 'Delete' && document.querySelector('#page-pos.active') && !e.target.closest('input,textarea,select')) {
    removeSelectedCartItem();
  }
});
