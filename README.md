# Radar Comp — App Pessoal de Oportunidades

App pessoal para coletar **editais, bolsas de pesquisa, artigos, hackathons e vagas** de Engenharia de Computação e enviar notificações direto para o celular.

## Estrutura

- `backend/` — Coletor em Python que busca oportunidades, filtra por palavras-chave, evita duplicatas e envia notificações push via [ntfy.sh](https://ntfy.sh).
- `mobile/` — App simples em React Native (Expo) para visualizar as oportunidades salvas.

## Como começar rápido (Backend + Notificações)

1. Instale o app **ntfy** no seu celular (Android/iOS) e inscreva-se em um tópico único (ex.: `radar-comp-seu-nome`).
2. Edite `backend/config.py` com o seu tópico do `ntfy` e suas palavras-chave.
3. Instale as dependências e rode o coletor:

```bash
cd backend
pip install -r requirements.txt
python collector.py
```

## Como rodar o App no celular (Expo)

```bash
cd mobile
npm install
npx expo start
```

Escaneie o QR Code com o app **Expo Go** no seu celular.
