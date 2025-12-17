/**
 * Frontend Configuration
 */

const CONFIG = {
  // 🔐 Pagamentos
  PIX_KEY: 'b853b083-72c3-444b-9224-7cb0d6e7a724',
  QR_CODE_SIZE: 200,

  // 🌐 Backend API (produção)
  API_URL: 'http://104.131.181.151:4001'
};

// Exportar para uso global
window.APP_CONFIG = CONFIG;
