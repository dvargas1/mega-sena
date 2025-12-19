/**
 * Dashboard Logic
 * - Conteúdo SEMPRE visível
 * - Ações bloqueadas se pagamento não confirmado
 */

let currentUser = null;
let paymentStatus = null;
let refreshInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  await init();

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('joinBolaoBtn')?.addEventListener('click', handleJoinBolao);
  document.getElementById('alreadyPaidBtn')?.addEventListener('click', handleAlreadyPaid);

  // Seleção de números
  document.getElementById('autoGenerateBtn')?.addEventListener('click', handleAutoGenerate);
  document.getElementById('manualSelectBtn')?.addEventListener('click', handleManualSelect);
  document.getElementById('clearSelectionBtn')?.addEventListener('click', handleClearSelection);
  document.getElementById('confirmSelectionBtn')?.addEventListener('click', handleConfirmSelection);

  // Copiar PIX
  const copyBtn = document.getElementById('copyPixBtn');
  const pixKeyEl = document.getElementById('pixKeyValue');

  if (copyBtn && pixKeyEl) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pixKeyEl.textContent.trim());
        showToast('✅ Chave PIX copiada!', 'success');
      } catch {
        showToast('❌ Erro ao copiar PIX', 'error');
      }
    });
  }

  document.getElementById('quotaQuantity')?.addEventListener('input', updateTotalAmount);

  refreshInterval = setInterval(refreshData, 30000);
});

/* ================= INIT ================= */

async function init() {
  try {
    showLoading(true);

    const auth = await api.getCurrentUser();
    if (!auth?.success) {
      window.location.href = '/';
      return;
    }

    currentUser = auth.user;

    document.getElementById('userName').textContent = `Olá, ${currentUser.name}!`;

    if (currentUser.isAdmin) {
      document.getElementById('adminPanelBtn')?.style.setProperty('display', 'inline-block');
    }

    // ⚠️ SEÇÃO DE NÚMEROS SEMPRE VISÍVEL
    document.getElementById('selectionSection').style.display = 'block';

    // ⚠️ SEÇÃO DE PARTICIPANTES SEMPRE VISÍVEL
    document.getElementById('participantsSection').style.display = 'block';

    await loadPaymentStatus();
    await loadBolaoInfo();
    await loadMySelections();
    await loadParticipants();

  } catch (err) {
    console.error(err);
    showToast('Erro ao carregar dashboard', 'error');
  } finally {
    showLoading(false);
  }
}

/* ================= PAYMENT ================= */

async function loadPaymentStatus() {
  const res = await api.getPaymentStatus();
  paymentStatus = res.status;

  document.getElementById('quotaUnitValue').textContent =
    `R$ ${res.quotaValue.toFixed(2).replace('.', ',')}`;

  updateTotalAmount();

  // Pagamento
  if (paymentStatus === 'not_joined') {
    showPaymentSection('join');
  } else if (paymentStatus === 'pending' || paymentStatus === 'claimed') {
    showPaymentSection('pending');
  } else if (paymentStatus === 'confirmed') {
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('waitingSection').style.display = 'none';
  }

  // 🔐 Controle de permissão
  toggleSelectionPermissions(paymentStatus === 'confirmed');
}

function showPaymentSection(state) {
  document.getElementById('paymentSection').style.display = 'block';
  document.getElementById('waitingSection').style.display = 'none';

  document.getElementById('joinBolaoBtn').style.display =
    state === 'join' ? 'inline-block' : 'none';

  document.getElementById('alreadyPaidBtn').style.display =
    state === 'pending' ? 'inline-block' : 'none';

  document.getElementById('paymentStatus').innerHTML =
    state === 'pending'
      ? '<p>⏳ Após pagar, clique em "Já paguei"</p>'
      : '';
}

/* ================= PERMISSIONS ================= */

function toggleSelectionPermissions(canSelect) {
  const section = document.getElementById('selectionSection');
  const controls = section.querySelectorAll('button, input');

  controls.forEach(el => {
    el.disabled = !canSelect;
  });

  const noticeId = 'paymentNotice';
  let notice = document.getElementById(noticeId);

  if (!canSelect) {
    if (!notice) {
      notice = document.createElement('div');
      notice.id = noticeId;
      notice.className = 'warning-box';
      notice.textContent =
        '👁️ Você pode visualizar tudo, mas só pode escolher números após o pagamento ser confirmado.';
      section.prepend(notice);
    }
  } else {
    notice?.remove();
  }
}

/* ================= ACTIONS ================= */

async function handleJoinBolao() {
  try {
    showLoading(true);
    const qty = parseInt(document.getElementById('quotaQuantity').value) || 1;
    await api.joinBolao(qty);
    showToast('Agora realize o pagamento via PIX', 'success');
    await loadPaymentStatus();
  } finally {
    showLoading(false);
  }
}

async function handleAlreadyPaid() {
  try {
    showLoading(true);
    await api.claimPaid();
    showToast('Pagamento registrado!', 'success');
    await loadPaymentStatus();
  } finally {
    showLoading(false);
  }
}

async function handleLogout() {
  await api.logout();
  window.location.href = '/';
}

/* ================= SELECTION ================= */

let selectedNumbers = [];

async function handleAutoGenerate() {
  try {
    showLoading(true);
    const response = await api.generateNumbers();
    if (response.success && response.numbers) {
      selectedNumbers = response.numbers;
      await api.selectNumbers(selectedNumbers);
      displaySelectedNumbers();
      showToast('✅ Números gerados e salvos automaticamente!', 'success');
      document.getElementById('manualSelectionArea').style.display = 'none';
    }
  } catch (error) {
    showToast('❌ Erro ao gerar números', 'error');
  } finally {
    showLoading(false);
  }
}

async function handleManualSelect() {
  document.getElementById('manualSelectionArea').style.display = 'block';
  await loadNumberGrid();
}

async function loadNumberGrid() {
  const grid = document.getElementById('numberGrid');
  grid.innerHTML = '';

  for (let i = 1; i <= 60; i++) {
    const btn = document.createElement('button');
    btn.className = 'number-btn';
    btn.textContent = i;
    btn.dataset.number = i;

    if (selectedNumbers.includes(i)) {
      btn.classList.add('selected');
    }

    btn.addEventListener('click', () => toggleNumber(i, btn));
    grid.appendChild(btn);
  }
}

function toggleNumber(num, btn) {
  const index = selectedNumbers.indexOf(num);

  if (index > -1) {
    selectedNumbers.splice(index, 1);
    btn.classList.remove('selected');
  } else {
    if (selectedNumbers.length >= 6) {
      showToast('⚠️ Você já selecionou 6 números', 'warning');
      return;
    }
    selectedNumbers.push(num);
    btn.classList.add('selected');
  }

  displaySelectedNumbers();
}

function handleClearSelection() {
  selectedNumbers = [];
  displaySelectedNumbers();
  loadNumberGrid();
}

async function handleConfirmSelection() {
  if (selectedNumbers.length !== 6) {
    showToast('⚠️ Você deve selecionar exatamente 6 números', 'warning');
    return;
  }

  try {
    showLoading(true);
    await api.selectNumbers(selectedNumbers);
    showToast('✅ Números salvos com sucesso!', 'success');
    document.getElementById('manualSelectionArea').style.display = 'none';
  } catch (error) {
    showToast('❌ Erro ao salvar números', 'error');
  } finally {
    showLoading(false);
  }
}

function displaySelectedNumbers() {
  const list = document.getElementById('selectedNumbersList');

  if (selectedNumbers.length === 0) {
    list.innerHTML = '<p class="text-muted">Nenhum número selecionado ainda</p>';
    return;
  }

  const sorted = [...selectedNumbers].sort((a, b) => a - b);
  list.innerHTML = sorted.map(n =>
    `<span class="selected-number-badge">${n}</span>`
  ).join('');
}

async function loadMySelections() {
  try {
    const response = await api.getMySelections();
    if (response.success && response.numbers && response.numbers.length > 0) {
      selectedNumbers = response.numbers;
      displaySelectedNumbers();
    }
  } catch (error) {
    console.error('Error loading selections:', error);
  }
}

/* ================= DATA ================= */

async function loadBolaoInfo() {
  try {
    await api.getBolaoInfo();
  } catch {}
}

async function loadParticipants() {
  try {
    const response = await api.getBolaoParticipants();

    if (!response.success || !response.participants) {
      throw new Error('Failed to load participants');
    }

    const participants = response.participants;
    const tbody = document.getElementById('participantsBody');

    if (participants.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Nenhum participante ainda</td></tr>';
      return;
    }

    tbody.innerHTML = participants.map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>
          <span class="quota-badge">
            ${p.quotaQuantity || 1} ${p.quotaQuantity > 1 ? 'cotas' : 'cota'}
          </span>
        </td>
        <td>
          <span class="status-badge status-${p.paymentStatus}">
            ${getStatusLabel(p.paymentStatus)}
          </span>
        </td>
        <td>
          ${p.selectedNumbersCount > 0
            ? `<details>
                <summary>${p.selectedNumbersCount} números</summary>
                <div class="numbers-preview">
                  ${p.selectedNumbers.join(', ')}
                </div>
              </details>`
            : '<span class="empty-text">Nenhum</span>'
          }
        </td>
        <td>${formatDate(p.joinedAt)}</td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Error loading participants:', error);
  }
}

function getStatusLabel(status) {
  const labels = {
    'pending': '⏳ Pendente',
    'claimed': '💬 Aguardando',
    'confirmed': '✅ Confirmado'
  };
  return labels[status] || status;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function refreshData() {
  await loadPaymentStatus();
  await loadMySelections();
  await loadParticipants();
}

/* ================= UTILS ================= */

function updateTotalAmount() {
  const qty = parseInt(document.getElementById('quotaQuantity').value) || 1;
  const unit = 10;
  document.getElementById('totalAmount').textContent =
    (qty * unit).toFixed(2).replace('.', ',');
}

function showLoading(show) {
  document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.style.display = 'block';
  setTimeout(() => (toast.style.display = 'none'), 3000);
}

window.addEventListener('beforeunload', () => {
  if (refreshInterval) clearInterval(refreshInterval);
});
