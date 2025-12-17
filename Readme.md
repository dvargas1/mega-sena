# Bolão Mega da Virada 2026

Sistema inteligente de gerenciamento de bolão para a Mega da Virada, com algoritmo anti-padrão, autenticação com PIX e geração automática de números.

## Características

- **Autenticação com PIX**: Login seguro usando nome + chave PIX para identificação de ganhadores
- **Sistema Anti-Padrão**: Algoritmo que evita números populares e padrões humanos
- **Múltiplas Cotas**: Permite compra de 1-10 cotas por participante
- **Geração Automática**: Números gerados com base em frequência histórica e popularidade invertida
- **Pagamento PIX**: QR Code e chave PIX integrados
- **Painel Admin**: Confirmação de pagamentos e encerramento do bolão
- **Hash Criptográfico**: Auditoria transparente com hash SHA-256

## Tecnologias

### Backend
- Node.js + Express
- Supabase (PostgreSQL)
- Express-session
- Crypto (SHA-256)

### Frontend
- HTML5 + CSS3
- JavaScript vanilla
- Design responsivo

## Pré-requisitos

- Node.js 18+
- Conta Supabase (gratuita)
- Git

## Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/bolao-mega-virada.git
cd bolao-mega-virada
```

### 2. Configure o Supabase

1. Crie uma conta em [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Execute o schema SQL:
   - Vá em SQL Editor no painel do Supabase
   - Execute o conteúdo de `backend/schema.sql`

### 3. Configure as variáveis de ambiente

```bash
cd backend
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
# Supabase Configuration
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon-aqui

# Server Configuration
PORT=3001
NODE_ENV=development

# Session Security
SESSION_SECRET=gere-um-secret-seguro-aqui
```

Para gerar um SESSION_SECRET seguro:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Configure a chave PIX

Edite `frontend/js/config.js` e adicione sua chave PIX:

```javascript
const CONFIG = {
  PIX_KEY: 'sua-chave-pix-aqui',
  QR_CODE_SIZE: 200
};
```

### 5. Instale as dependências

```bash
cd backend
npm install
```

### 6. Execute o servidor

```bash
npm start
```

O servidor estará disponível em `http://localhost:3001`

## Uso

### Primeiro Acesso (Admin)

1. Acesse `http://localhost:3001`
2. Cadastre-se com o nome "Carlos" (primeiro usuário é admin)
3. Use sua chave PIX pessoal

### Criar um Bolão

Execute o script de criação:

```bash
cd backend
node scripts/createBolao.js
```

### Fluxo do Participante

1. **Cadastro/Login**: Nome + Chave PIX
2. **Participação**: Escolher quantidade de cotas (R$ 10,00 cada)
3. **Pagamento**: Pagar via PIX usando QR Code
4. **Confirmação**: Aguardar confirmação do admin
5. **Seleção**: Escolher 6 números (manual ou automático)

### Fluxo do Admin

1. Acessar painel admin (`/admin.html`)
2. Confirmar pagamentos dos participantes
3. Quando todos confirmados, encerrar o bolão
4. Sistema gera apostas finais automaticamente

## Segurança

- ✅ Variáveis sensíveis em `.env` (não commitadas)
- ✅ Session secrets gerados aleatoriamente
- ✅ Hash SHA-256 para auditoria
- ✅ Validação de entrada em todos endpoints
- ✅ Autenticação com PIX para identificação

## Licença

MIT

---

**Nota**: Este é um projeto educacional. Certifique-se de estar em conformidade com as leis locais sobre jogos e loterias.
