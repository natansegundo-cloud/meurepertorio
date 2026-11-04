MEU REPERTÓRIO (uso pessoal)
============================

Um app pessoal para guardar cifras de violão no navegador. Os dados ficam no
próprio aparelho, com suporte a transposição, diagramas de acordes, rolagem
automática, importação de PDF/TXT e backup em arquivo.

COMO PUBLICAR NA VERCEL
- Use esta pasta como o Root Directory do projeto:
  caderno-de-cifras
- Não é necessário instalar dependências nem configurar comando de build.
- Publique como site estático, mantendo index.html na raiz publicada.
- O endereço HTTPS da Vercel habilita a instalação como app e o modo offline.

COMO INSTALAR NO CELULAR
- Android (Chrome): abra o endereço, menu de três pontos > "Instalar app".
- iPhone (Safari): Compartilhar > "Adicionar à Tela de Início".
- Abra uma vez com internet para o cache offline ser criado.

COMO ADICIONAR MÚSICAS
- Cole a cifra completa, confira a prévia e toque em Salvar.
- Importe um PDF ou TXT; o PDF original fica guardado junto da cifra.
- Para vários arquivos, escolha todos de uma vez.

DADOS E BACKUP
As cifras ficam no aparelho (IndexedDB). Celular e computador não sincronizam
sozinhos até você entrar na nuvem. Use Menu > Sincronizar na nuvem para entrar
com o link enviado por e-mail. O backup manual continua disponível em Menu.

CONFIGURAÇÃO DA NUVEM
1. No Supabase, abra o SQL Editor e execute supabase/schema.sql.
2. Em Authentication > URL Configuration, adicione o endereço publicado na Vercel.
3. No app, abra Menu > Sincronizar na nuvem e entre com seu e-mail.
4. Nunca coloque uma secret/service_role key no navegador; o app usa somente a
   publishable key e as políticas RLS da tabela.

QUANDO MEXER NOS ARQUIVOS
Se editar qualquer arquivo, incremente VERSAO em sw.js para os aparelhos
buscarem a versão nova do app.

ARQUIVOS
index.html  tela e estilos
app.js      telas, importação e backup
engine.js   leitura, transposição e diagramas de acorde
seed.js     cifras de exemplo
sw.js       cache offline
manifest.webmanifest  instalação como PWA
vendor/     leitor de PDF (pdf.js)
fonts/ e icons/        identidade visual e ícones
