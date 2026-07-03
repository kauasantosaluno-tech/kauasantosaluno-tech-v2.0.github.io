# Acervo — GitHub Pages File Share

Site de acervo pessoal com upload direto via GitHub API.

## Estrutura

```
/
├── index.html          # Galeria pública
├── posts.json          # Manifesto de publicações (gerado automaticamente)
├── admin/
│   └── index.html      # Painel de gerenciamento
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── main.js     # Galeria pública
│       └── admin.js    # Lógica de upload
└── uploads/
    └── <pasta-do-trabalho>/   # Arquivos organizados por projeto
        └── arquivo.pdf
```

## Como usar

### 1. Configurar o repositório

Ative o GitHub Pages na aba **Settings → Pages** do repositório (branch `main`, pasta raiz `/`).

### 2. Criar um Personal Access Token (PAT)

1. Acesse [github.com/settings/tokens](https://github.com/settings/tokens)
2. Clique em **Generate new token (classic)**
3. Marque a permissão **`repo`** (Contents)
4. Copie o token gerado

### 3. Publicar arquivos

1. Abra `admin/index.html` no site publicado
2. Insira o token e o nome do repositório (`usuario/repositorio`)
3. Arraste os arquivos para a zona de upload
4. Preencha o título e a **pasta/projeto** (ex: `Estagio-2024`)
5. Clique em **Publicar no GitHub**

O site atualiza automaticamente — sem precisar fazer commit manual!

## Funcionalidades

- **Upload direto via GitHub API** — sem etapa manual de commit
- **Organização por pastas/projetos** — cada trabalho fica numa pasta separada
- **Galeria com filtros** — filtra por pasta/projeto
- **Visualização grid ou lista**
- **Modal de preview** — PDF, imagem e texto direto no browser
- **Múltiplos arquivos** — selecione vários de uma vez
- **Autocomplete de pastas** — sugere pastas existentes ao digitar

## Tecnologias

- GitHub Pages (hospedagem gratuita)
- GitHub Contents API (upload e gerenciamento)
- Vanilla JS — sem dependências externas
