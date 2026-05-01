# PERSONAS.md — iaedu-adapter

## Utilizador Primário: Professor/Formador

**Perfil:** Professor ou formador que usa o OpenWebUI como interface principal para interagir com o agente de IA da iaedu.pt.

**Necessidades:**
- Aceder ao agente iaedu.pt atraves do OpenWebUI sem configuraçao técnica
- Conversar em português com contexto mantido dentro de uma sessao
- Ver respostas em stream (tempo real)

**Dor atual:**
- Nao consegue conectar o OpenWebUI diretamente à API iaedu.pt
- Soluçao manual seria complexa (webhooks, proxies, scripts)

**Como usa o adapter:**
1. O professor abre o OpenWebUI
2. Seleciona o modelo `iaedu-custom`
3. Envia uma pergunta
4. Recebe a resposta do agente iaedu.pt em stream

---

## Operador (Admin de Sistema)

**Perfil:** Pessoa responsavel por manter o servidor onde o adapter corre.

**Necessidades:**
- Instalar e configurar o adapter com menos de 10 minutos de trabalho
- Injetar a API key de forma segura (nao em ficheiros de código)
- Monitorizar se o servico está ativo
- Ver logs de erros
- Reiniciar automaticamente em caso de falha

**Como usa o adapter:**
1. Copia o ficheiro `adapter-server.mjs` para `/opt/iaedu-adapter`
2. Cria o servico systemd (instruçoes no README)
3. Define `IAEDU_API_KEY` como variável de ambiente
4. O servico arranca e fica a correr

**Nota de segurança:** O operador TEM a API key — é um utilizador de confianca, nao um público.