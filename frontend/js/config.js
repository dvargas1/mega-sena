/**
 * Frontend Configuration
 */

const CONFIG = {
  // 🔐 Pagamentos
  PIX_KEY: 'b18f7ec7-198d-459c-b5c3-1ac660ce0c8f',
  PIX_RECIPIENT_NAME: 'Daniel de Abreu Vargas',
  PIX_RECIPIENT_BANK: 'Itaú',
  CONTACT_NUMBER: '(21) 99641-7541',
  QUOTA_VALUE: 20.00,
  QR_CODE_SIZE: 200,

  // 🌐 API Configuration
  API_URL: 'http://201.23.19.195:4001'
};

// Exportar para uso global
window.APP_CONFIG = CONFIG;
