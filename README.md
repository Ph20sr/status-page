# status-page

[![CI](https://github.com/Ph20sr/status-page/actions/workflows/ci.yml/badge.svg)](https://github.com/Ph20sr/status-page/actions/workflows/ci.yml)
[![Status](https://github.com/Ph20sr/status-page/actions/workflows/status.yml/badge.svg)](https://ph20sr.github.io/status-page/)
![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

Página de status com **histórico de 90 dias** e **incidentes**, rodando 100% de graça no **GitHub Actions + GitHub Pages**. Não precisa de servidor, banco ou serviço pago.

**[Ver a página →](https://ph20sr.github.io/status-page/)**

## Como funciona

```
a cada 30 min (GitHub Actions)
  └─ scripts/run.js
       ├─ verifica cada endereço de sites.json (timeout, status esperado, latência)
       ├─ atualiza data/history.json (agregado por dia, incidentes)
       └─ gera site/index.html  ──►  GitHub Pages
```

- **Barra de 90 dias** por serviço: verde (≥ 99,9%), amarelo (≥ 95%), vermelho
- **Disponibilidade** em 90 e 7 dias, e latência média
- **Incidentes**: início, duração e erro (`HTTP 503`, `sem resposta em 10s`, `ENOTFOUND`...)
- O histórico fica **agregado por dia**, então o arquivo continua pequeno no git mesmo com uma verificação a cada 30 minutos
- APIs que exigem token são monitoradas pelo status esperado (ex.: `401` = no ar e protegida)
- Página estática sem JavaScript, com tema claro e escuro e responsiva

## Configurar

`sites.json`:

```json
{
  "title": "Status · Minha Empresa",
  "description": "Disponibilidade dos nossos sistemas.",
  "sites": [
    { "name": "Site", "url": "https://minhaempresa.com.br" },
    { "name": "API de pagamentos", "url": "https://api.asaas.com/v3/customers", "expect": [401] },
    { "name": "Painel", "url": "https://app.minhaempresa.com.br/health", "timeoutMs": 5000 }
  ]
}
```

Depois, ative o GitHub Pages em **Settings → Pages → Source: GitHub Actions**.

> Não coloque endereços internos ou administrativos num repositório público: a lista de URLs fica visível para qualquer pessoa.

## Desenvolvimento

```bash
npm test         # histórico, incidentes e página (node:test)
npm run check    # uma rodada real: atualiza data/ e gera site/index.html
```

## Licença

MIT
