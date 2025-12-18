/**
 * API Client - Wrapper for all backend API calls
 * Rota B: frontend chama /api/* na Vercel, que faz proxy para o backend
 */

// Base URL:
// - Se existir API_URL no config, usa
// - Senão, usa a própria origem (Vercel)
const API_BASE_URL = window.APP_CONFIG?.API_URL ?? window.location.origin;

class APIClient {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * Método genérico de request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    };

    const config = { ...defaultOptions, ...options };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    const text = await response.text();

    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error('Resposta não JSON:', text);
      throw new Error('Resposta inválida do servidor');
    }

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  }

  // ===== HTTP helpers =====

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data
    });
  }

  put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // ===== AUTH =====

  register(name, pixKey) {
    return this.post('/api/auth/register', {
      name,
      pix_key: pixKey
    });
  }

  login(name, pixKey) {
    return this.post('/api/auth/login', {
      name,
      pix_key: pixKey
    });
  }

  logout() {
    return this.post('/api/auth/logout');
  }

  getCurrentUser() {
    return this.get('/api/auth/me');
  }

  // ===== PAYMENTS =====

  joinBolao(quotaQuantity = 1) {
    return this.post('/api/payments/join', { quotaQuantity });
  }

  claimPaid() {
    return this.post('/api/payments/claim-paid');
  }

  getPaymentStatus() {
    return this.get('/api/payments/status');
  }

  // ===== NUMBERS =====

  getScores(recalculate = false) {
    const query = recalculate ? '?recalculate=true' : '';
    return this.get(`/api/numbers/scores${query}`);
  }

  selectNumbers(numbers) {
    return this.post('/api/numbers/select', { numbers });
  }

  getMySelections() {
    return this.get('/api/numbers/my-selections');
  }

  generateNumbers() {
    return this.get('/api/numbers/generate');
  }

  // ===== ADMIN =====

  getParticipants() {
    return this.get('/api/admin/participants');
  }

  confirmPayment(participationId) {
    return this.post('/api/admin/confirm-payment', { participationId });
  }

  getTotals() {
    return this.get('/api/admin/totals');
  }

  closeBolao() {
    return this.post('/api/admin/close-bolao');
  }

  // ===== BOLÃO =====

  getBolaoInfo() {
    return this.get('/api/bolao/info');
  }

  getClosureInfo() {
    return this.get('/api/bolao/closure');
  }
}

// 🌍 Instância global
window.api = new APIClient();
