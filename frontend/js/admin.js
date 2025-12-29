/**
 * Admin Panel Logic
 * Handles participant management, payment confirmation, and bolão closure
 */

let currentUser = null;
let refreshInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize
  await init();

  // Set up event listeners
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('refreshBtn').addEventListener('click', loadAllData);
  document.getElementById('closeBolaoBtn').addEventListener('click', handleCloseBolao);

  // Auto-refresh every 15 seconds
  refreshInterval = setInterval(loadAllData, 15000);
});

/**
 * Initialize admin panel
 */
async function init() {
  try {
    showLoading(true);

    // Check authentication
    currentUser = await checkAuth();

    if (!currentUser) {
      window.location.href = '/';
      return;
    }

    // Must be admin
    if (!currentUser.isAdmin) {
      window.location.href = '/dashboard.html';
      return;
    }

    // Display user name
    document.getElementById('userName').textContent = `Admin: ${currentUser.name}`;

    // Load all data
    await loadAllData();

  } catch (error) {
    console.error('Initialization error:', error);
    showToast('Erro ao carregar painel administrativo', 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Check if user is authenticated
 * @returns {object|null} User object or null
 */
async function checkAuth() {
  try {
    const response = await api.getCurrentUser();
    return response.success ? response.user : null;
  } catch (error) {
    return null;
  }
}

/**
 * Load all admin data
 */
async function loadAllData() {
  await Promise.all([
    loadParticipants(),
    loadTotals()
  ]);
}

/**
 * Load and display participants
 */
async function loadParticipants() {
  try {
    const response = await api.getParticipants();

    if (!response.success || !response.participants) {
      throw new Error('Failed to load participants');
    }

    const participants = response.participants;
    const tbody = document.getElementById('participantsBody');

    if (participants.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Nenhum participante ainda</td></tr>';
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
        <td>
          ${p.paymentStatus === 'claimed'
            ? `<button onclick="confirmPayment('${p.participationId}')" class="btn btn-success btn-sm">
                ✓ Confirmar
              </button>`
            : p.paymentStatus === 'confirmed'
              ? '<span class="confirmed-text">✅ Confirmado</span>'
              : '<span class="pending-text">-</span>'
          }
        </td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Error loading participants:', error);
    showToast('Erro ao carregar participantes', 'error');
  }
}

/**
 * Load and display totals
 */
async function loadTotals() {
  try {
    const response = await api.getTotals();

    if (!response.success) {
      throw new Error('Failed to load totals');
    }

    // Update totals
    document.getElementById('totalFunds').textContent = `R$ ${response.totalFunds.toFixed(2)}`;
    document.getElementById('confirmedCount').textContent = response.confirmedCount;

    if (response.betLevel > 0) {
      // Extract bet info from breakdown for cleaner display
      const betLevelText = response.breakdown?.mainBet || `${response.betLevel} números`;
      const surplusText = response.breakdown?.surplus || `${response.surplusBets} apostas de 6`;

      document.getElementById('betLevel').textContent = betLevelText;
      document.getElementById('surplusBets').textContent = surplusText;
    } else {
      document.getElementById('betLevel').textContent = 'Insuficiente';
      document.getElementById('surplusBets').textContent = '-';
    }

    // Update breakdown
    if (response.breakdown) {
      const breakdownDiv = document.getElementById('breakdown');
      breakdownDiv.innerHTML = `
        <h4>Detalhamento:</h4>
        <ul>
          <li><strong>Aposta Principal:</strong> ${response.breakdown.mainBet}</li>
          <li><strong>Apostas Adicionais:</strong> ${response.breakdown.surplus}</li>
          <li><strong>Saldo Restante:</strong> ${response.breakdown.remaining}</li>
        </ul>
      `;
    }

  } catch (error) {
    console.error('Error loading totals:', error);
    showToast('Erro ao carregar totais', 'error');
  }
}

/**
 * Confirm a participant's payment
 * @param {string} participationId - Participation ID
 */
async function confirmPayment(participationId) {
  try {
    if (!confirm('Confirmar pagamento deste participante?')) {
      return;
    }

    showLoading(true);

    await api.confirmPayment(participationId);
    showToast('Pagamento confirmado com sucesso!', 'success');

    await loadAllData();

  } catch (error) {
    console.error('Error confirming payment:', error);
    showToast(error.message || 'Erro ao confirmar pagamento', 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Close the bolão
 */
async function handleCloseBolao() {
  const confirmed = confirm(
    'ATENÇÃO: Tem certeza que deseja encerrar o bolão?\n\n' +
    'Esta ação é IRREVERSÍVEL. Após o encerramento:\n' +
    '• Nenhuma alteração será possível\n' +
    '• Os números finais serão selecionados automaticamente\n' +
    '• Um hash criptográfico será gerado para auditoria\n\n' +
    'Deseja continuar?'
  );

  if (!confirmed) return;

  try {
    showLoading(true);

    const response = await api.closeBolao();

    if (!response.success) {
      throw new Error('Failed to close bolão');
    }

    // Hide close button
    document.getElementById('closeBolaoBtn').style.display = 'none';

    // Show closure result
    const resultDiv = document.getElementById('closureResult');
    resultDiv.style.display = 'block';

    // Display hash
    document.getElementById('closureHash').textContent = response.hash;

    // Display final bets
    const betsDiv = document.getElementById('finalBetsList');
    const numberToUsers = response.closureData.numberToUsers || {};

    betsDiv.innerHTML = response.finalBets.map((bet, index) => `
      <div class="final-bet">
        <h5>Aposta ${index + 1}: ${bet.type}</h5>
        <div class="bet-numbers">
          ${bet.numbers.map(n => {
            const users = numberToUsers[n];
            const tooltipContent = users && users.length > 0
              ? `<div class="tooltip tooltip-users">
                  <div class="tooltip-users-title">Escolhido por:</div>
                  <div class="tooltip-users-list">${users.map(u => `• ${u}`).join('<br>')}</div>
                </div>`
              : '';
            return `<span class="bet-number">${n}${tooltipContent}</span>`;
          }).join('')}
        </div>
      </div>
    `).join('');

    showToast('Bolão encerrado com sucesso!', 'success');

    // Stop auto-refresh
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }

  } catch (error) {
    console.error('Error closing bolão:', error);
    showToast(error.message || 'Erro ao encerrar bolão', 'error');
  } finally {
    showLoading(false);
  }
}

// Event Handlers

async function handleLogout() {
  try {
    await api.logout();
    window.location.href = '/';
  } catch (error) {
    console.error('Logout error:', error);
    window.location.href = '/';
  }
}

// Utility Functions

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

function showLoading(show) {
  document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.style.display = 'block';

  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}

// Make confirmPayment available globally for onclick handler
window.confirmPayment = confirmPayment;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
