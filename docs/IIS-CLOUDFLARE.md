# Frontend no IIS com API pública configurável

A configuração continua em `public/config.json` / `APP_CONFIG`, carregada no
bootstrap. Não foram criados environments paralelos e nenhum service recebe URL
hardcoded. Tudo nesse JSON é público: ele não pode conter secrets.

O script `scripts/publish-local-iis.ps1` do repositório backend aceita
`SGE_PUBLIC_FRONTEND_ORIGIN` e `SGE_PUBLIC_BACKEND_ORIGIN` (ou parâmetros
`-PublicFrontendOrigin` e `-PublicBackendOrigin`). Depois de fornecer **origens
HTTPS reais**, ele gera no diretório publicado:

- `apiBaseUrl`: origem pública da API seguida de `/api`;
- `localApiBaseUrl`: `/api`, utilizada apenas se a página estiver em loopback;
- `sessionExpiryWarningSeconds`: preservado da configuração existente.

Sem as duas origens, o script mantém a publicação local com `/api`. O JSON
versionado permanece local. O build de produção é o mesmo; a origem da API é
configuração de publicação, não segredo nem constante compilada. Uma configuração
explicitamente insegura (HTTP público, credenciais embutidas, query/fragmento,
destino loopback de página pública) é recusada antes de enviar credenciais.

O IIS gerado permite ler `config.json`, desabilita seu cache e o do HTML, aplica
CSP permitindo conexão somente à própria origem e à API escolhida e mantém
`/login` por SPA fallback. O proxy local `/api` continua em `localhost:9080`; no
hostname público do frontend, a API é acessada pelo hostname próprio.

O interceptor de autenticação compara origem e limite do caminho da API. Não
envia Bearer a recursos estáticos, URLs semelhantes ou outras origens. Tokens
continuam somente em memória; login, refresh single-flight, logout e 401/403
preservam o fluxo existente. Não foram adicionados cookies ou `withCredentials`.
O backend permite CORS somente da origem pública configurada e expõe
`Retry-After`/`X-Correlation-ID`. A API precisa conservar o sufixo `/api` no JSON.

Os nomes `app.sistema-gerenciador-empresarial` e
`app.sistema-gerenciador-empresarial-backend` **não são domínios públicos válidos
para o Tunnel pretendido**, pois os últimos labels não são TLDs delegados na
[IANA](https://data.iana.org/TLD/tlds-alpha-by-domain.txt). Não foram substituídos
por domínios inventados. Defina as duas variáveis com FQDNs reais posteriormente.

O guia completo de CORS, IIS in-process, bindings loopback, confiança nos headers,
HTTPS, cache e campos manuais do Cloudflare está em
`docs/iis-cloudflare-deployment.md` no repositório backend. O Tunnel aponta para
`http://localhost:9080` e `http://localhost:9081`, sem caminhos. Nenhum token do
Tunnel é recebido pela aplicação.

Validações: `npm run build:prod`, `npm run test:ci` (57 testes ChromeHeadless) e
`npm run lint`. Build de produção sem source maps. A publicação atual no IIS
não foi substituída; a validação pública depende da configuração externa real.
