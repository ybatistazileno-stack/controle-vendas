# Atacadão do Sono — Controle de Vendas

App de controle de vendas e comissões para uso no celular ou computador.

## Como subir no Cloudflare Pages

### 1. Colocar no GitHub

1. Crie um repositório novo em [github.com](https://github.com) (pode ser privado)
2. Faça upload de todos os arquivos desta pasta:
   - `index.html`
   - `_headers`
   - `_redirects`
   - `README.md`

**Pelo site do GitHub (sem precisar de git):**
- Abra o repositório → clique em **Add file** → **Upload files**
- Arraste todos os arquivos → clique em **Commit changes**

---

### 2. Conectar ao Cloudflare Pages

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com)
2. Menu lateral → **Workers & Pages** → **Create** → **Pages**
3. Clique em **Connect to Git** → autorize o GitHub → selecione o repositório
4. Em **Build settings**:
   - **Framework preset:** `None`
   - **Build command:** *(deixe vazio)*
   - **Build output directory:** `/` *(barra sozinha)*
5. Clique em **Save and Deploy**

Pronto. Em 1 minuto seu site estará no ar com URL do tipo:  
`https://atacadao-sono.pages.dev`

---

### Atualizar o site depois

Basta fazer upload do novo `index.html` no GitHub.  
O Cloudflare detecta automaticamente e republica em ~30 segundos.
