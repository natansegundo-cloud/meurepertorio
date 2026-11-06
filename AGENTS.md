AGENTS.md — Meu Repertório
1. Papel deste arquivo
Este documento define o contexto permanente do projeto e as regras que devem ser seguidas por qualquer agente de programação que trabalhe nele.

Antes de executar uma tarefa, leia este arquivo e inspecione os arquivos diretamente relacionados à mudança. As instruções específicas do pedido atual complementam este documento, mas não autorizam quebrar as regras de preservação de funcionalidades descritas aqui.

O objetivo do projeto é evoluir visualmente sem perder estabilidade, simplicidade, funcionamento offline ou confiabilidade musical.
2. Visão do produto
Meu Repertório é um aplicativo pessoal de cifras e repertórios musicais, pensado principalmente para quem toca violão e precisa consultar músicas com rapidez, inclusive durante uma apresentação.

Não é para ser uma cópia do Cifra Club. A proposta é oferecer uma biblioteca pessoal de músicas, leitura confortável de cifras, transposição, diagramas opcionais e organização de repertórios, com uma experiência simples e confiável.

Princípios do produto:
- A letra e os acordes são o centro da experiência de leitura.
- A interface deve ser rápida, clara e confortável em celulares.
- Os controles devem ocupar pouco espaço e aparecer quando forem necessários.
- A aparência deve transmitir cuidado de produto finalizado, não de protótipo ou template.
- Recursos visuais só devem existir quando melhorarem a compreensão ou a utilização.
- O aplicativo deve continuar funcionando sem internet.
3. Arquitetura atual — preservar
Este projeto é um aplicativo web estático construído com HTML, CSS e JavaScript vanilla.

Não é um projeto React, Next.js, Vue ou outro framework de componentes. Não introduza essas tecnologias para implementar melhorias visuais.

Estrutura principal:
- index.html: estrutura das telas e estilos CSS principais.
- app.js: interface, navegação, estado da aplicação, biblioteca, repertórios, importação, backup e interações.
- engine.js: motor de cifras, leitura, transposição e diagramas de acordes.
- music-parser.js: interpretação e importação de cifras e letras.
- seed.js: músicas de exemplo.
- supabase-config.js e supabase-sync.js: configuração e sincronização opcional com Supabase.
- supabase/ e arquivos SQL: estrutura e políticas do banco remoto.
- sw.js: service worker e cache para funcionamento offline.
- manifest.webmanifest: configuração do aplicativo instalável (PWA).
- fonts/: fontes locais do projeto.
- icons/: ícones do aplicativo.
- vendor/: bibliotecas locais de terceiros, incluindo PDF.js e cliente Supabase.
- tests/: testes automatizados com Playwright.
O projeto é publicado como site estático. Conforme o README, não precisa de instalação de dependências nem de etapa de build para funcionar.

Não crie package.json, bundler, framework ou processo de compilação sem uma necessidade técnica concreta e sem explicar por que isso é indispensável.
4. Funcionalidades críticas — não quebrar
As funcionalidades abaixo já fazem parte do produto e devem ser preservadas durante qualquer redesign:
1. Importação de cifras coladas de fontes externas.
2. Interpretação de letras, acordes, seções e posicionamento dos acordes.
3. Preservação do alinhamento dos acordes com as respectivas letras.
4. Transposição de tom e preferência de notação com sustenidos ou bemóis.
5. Identificação e exibição de diagramas de acordes.
6. Preferência para exibir ou ocultar diagramas.
7. Rolagem automática e ajuste de velocidade.
8. Cadastro, edição, exclusão e pesquisa de músicas.
9. Criação e organização de repertórios.
10. Importação de PDF e TXT.
11. Backup e restauração de dados.
12. Armazenamento local com IndexedDB.
13. Sincronização opcional com Supabase.
14. Instalação como PWA e funcionamento offline.
Limites de alteração
- Não altere engine.js ou music-parser.js em uma tarefa exclusivamente visual.
- Não mude o formato dos dados armazenados nem os identificadores do IndexedDB sem uma necessidade explícita, análise de migração e testes.
- Não remova campos, ações ou caminhos de importação existentes.
- Não substitua uma implementação funcional por uma simulação visual.
- Não introduza dependência de internet para recursos essenciais.
- Não exponha chaves secretas ou credenciais do Supabase no navegador.
- Não altere políticas ou arquivos SQL sem solicitação específica.
- Se uma mudança visual exigir alteração de lógica, mantenha-a pequena, isolada e explique o motivo.
5. Direção visual
A direção desejada é minimalista, musical, contemporânea e refinada, com personalidade própria.

A referência de interação e acabamento é o site beUI, especialmente a forma como apresenta componentes pequenos, estados bem definidos e movimentos naturais.

O beUI é uma referência visual e de interação, não uma exigência para importar sua implementação ou suas dependências.
Paleta desejada
Usar como direção principal:
- Fundo: #0B110E
- Superfícies: #111B16
- Destaque dourado: #D9A85F
- Texto principal: #E8ECE8
- Texto secundário: tons suaves de cinza esverdeado
- Bordas: tons discretos derivados das superfícies
Centralize cores e decisões repetidas em variáveis CSS, evitando valores duplicados espalhados pelo projeto.

Preserve a possibilidade de tema claro/escuro se ela já estiver disponível. Não elimine uma preferência existente sem solicitação. A direção visual escura e verde-dourada deve ser aplicada com consistência, respeitando o comportamento de tema que o produto já oferece.
Como usar o dourado
O dourado deve funcionar como acento, não como cor dominante.

Usar principalmente em:
- Acordes.
- Tom selecionado.
- Indicadores de seleção.
- Ações primárias pontuais.
- Pequenos estados ativos.
Evitar pintar grandes áreas de dourado ou aplicar a cor em todos os ícones e textos.
Tipografia
- Preservar a fonte de interface local já incluída, salvo motivo concreto para substituí-la.
- Preservar a fonte monoespaçada na área de cifras, pois ela ajuda a manter o alinhamento.
- Manter boa legibilidade em telas pequenas.
- Evitar excesso de pesos tipográficos e tamanhos concorrentes.
Evitar aparência genérica de IA
Não usar automaticamente o mesmo padrão de cartão arredondado para cada elemento.

Evitar:
- Gradientes decorativos sem função.
- Brilhos, glows e sombras fortes.
- Bordas visíveis em todos os componentes.
- Excesso de superfícies dentro de outras superfícies.
- Grandes títulos e espaços vazios sem propósito.
- Ícones decorativos sem função.
- Animações constantes, exageradas ou elásticas.
- Efeitos de vidro, neon ou 3D sem justificativa.
Preferir:
- Hierarquia tipográfica clara.
- Espaçamento intencional.
- Alinhamentos precisos.
- Separadores discretos quando forem suficientes.
- Estados de interação bem desenhados.
- Animações curtas e naturais.
- Componentes compactos e funcionais.
- Consistência entre biblioteca, cifra, repertórios e configurações.
6. Princípios de experiência e componentes
Escolha componentes conforme a necessidade real de cada tela. Não implemente todos os padrões em todos os lugares.

Referências prioritárias do beUI:
Bottom Sheet
Usar para opções contextuais, ações secundárias, configurações de leitura e menus de uma música. Deve abrir e fechar naturalmente, respeitar áreas seguras do celular e permitir fechamento acessível.
Expandable Action Bar
Usar para agrupar ações secundárias na tela da cifra, mantendo inicialmente visíveis apenas os controles essenciais. Evitar duplicar ações que já estejam disponíveis no cabeçalho.
Tabs
Usar na alternância entre Músicas e Repertórios. O estado ativo deve ser evidente, com transição discreta e sem deslocamentos excessivos.
Switch
Usar em preferências booleanas, como exibição de diagramas e rolagem automática. O controle deve refletir o estado real e persistido da configuração.
Range Slider
Usar para ajustar a velocidade da rolagem automática, se isso se integrar bem ao controle já existente. Mostrar o valor ou uma indicação compreensível e preservar a preferência do usuário.
Toast
Usar para confirmações breves, como música importada, cifra copiada ou tom alterado. As mensagens não devem bloquear a interação nem substituir tratamento de erros importantes.
Regras de interação
- Toda ação visual deve funcionar de verdade.
- Não criar controles decorativos ou sem ação.
- Respeitar prefers-reduced-motion.
- Garantir áreas de toque confortáveis.
- Usar estados de foco visíveis e acessibilidade básica.
- Evitar que painéis e controles cubram a letra da cifra.
- Preservar o comportamento de voltar e fechar.
- Não introduzir animações que prejudiquem a leitura ou a performance.
7. Política de dependências e uso do beUI
Não instalar pacotes npm automaticamente.

Antes de considerar qualquer componente externo:
1. Verifique a tecnologia e a estrutura atuais do projeto.
2. Verifique se o componente do beUI depende de React, Framer Motion, Tailwind ou outra biblioteca.
3. Avalie se a dependência é compatível com a arquitetura vanilla existente.
4. Considere primeiro implementar o mesmo padrão de interação com HTML, CSS e JavaScript nativos.
5. Só proponha uma dependência quando ela trouxer benefício concreto que justifique o custo de tamanho, manutenção e compatibilidade.
6. Se uma dependência for realmente necessária, explique qual problema resolve, quais arquivos serão afetados e como será carregada no aplicativo offline.
Não copie comandos de instalação de componentes React para este projeto sem verificar compatibilidade. Não adicione uma biblioteca inteira apenas para reproduzir um switch, uma aba, um painel inferior ou uma notificação simples.

Se utilizar código ou conceito externo, adapte-o à arquitetura existente e respeite a licença e os requisitos de atribuição aplicáveis.
8. Regras para executar mudanças
Antes de editar:
1. Leia este AGENTS.md.
2. Inspecione a tela e os componentes envolvidos na tarefa.
3. Identifique onde termina a camada visual e onde começa a lógica de negócio.
4. Verifique se a funcionalidade já existe antes de criar outra implementação.
5. Planeje a menor alteração que resolva o pedido.
Durante a implementação:
- Faça mudanças pequenas e coerentes com a tarefa atual.
- Reutilize padrões e estilos existentes quando fizer sentido.
- Evite duplicar código, eventos, estilos e estados.
- Não reescreva arquivos inteiros quando uma alteração localizada for suficiente.
- Não altere funcionalidades fora do escopo.
- Não use dados fictícios para mascarar uma funcionalidade incompleta.
- Mantenha o código legível e compatível com os navegadores móveis atuais.
Depois de editar:
1. Revise o diff e confirme que não houve alterações não relacionadas.
2. Execute os testes disponíveis que sejam relevantes.
3. Verifique erros de sintaxe e carregamento.
4. Teste a interface em viewport móvel e desktop quando a mudança afetar layout.
5. Confira estados vazios, listas longas, textos extensos e nomes de músicas grandes.
6. Informe o que foi alterado, quais testes foram executados e qualquer limitação encontrada.
9. Testes e validação
O projeto possui testes em tests/ e configuração em playwright.config.js.

Consulte os testes existentes antes de alterar fluxos de importação, parser, repertórios ou navegação. Execute os testes relevantes quando o ambiente disponibilizar Playwright e os navegadores necessários.

Não afirme que os testes passaram se eles não foram executados.

Se não for possível executar os testes, faça as verificações possíveis e informe claramente o que ficou pendente.

Para mudanças visuais, validar pelo menos:
- Biblioteca com e sem músicas.
- Alternância entre Músicas e Repertórios.
- Pesquisa.
- Abertura de uma cifra.
- Leitura com diagramas ocultos e visíveis.
- Controles de tom.
- Uso em tela estreita.
- Comportamento de painéis, menus e notificações.
10. PWA, cache e funcionamento offline
O service worker lista explicitamente os arquivos armazenados em cache em sw.js.

Quando adicionar um novo arquivo local necessário para o aplicativo funcionar offline:
- Inclua-o na lista de arquivos do service worker, se aplicável.
- Incremente a constante VERSAO em sw.js para invalidar o cache antigo.
- Verifique que o aplicativo continua abrindo sem conexão depois de ter sido carregado uma vez.
Não incremente a versão do cache sem necessidade. Não remova arquivos existentes da lista sem verificar se continuam sendo utilizados.
11. Escopo das tarefas visuais
Quando receber uma solicitação de redesign, trabalhe somente na etapa solicitada.

Ordem de referência do projeto:
1. Sistema visual global.
2. Biblioteca.
3. Tela de leitura de cifras.
4. Componentes e microinterações.
5. Revisão final de consistência e responsividade.
Não antecipe as etapas seguintes por conta própria. Aguarde a validação do usuário entre etapas quando ele estiver conduzindo o trabalho por prompts separados.
12. Critério de qualidade
Uma mudança está pronta quando:
- Resolve o pedido sem prejudicar funções existentes.
- Parece pertencer ao mesmo produto e à mesma identidade visual.
- É clara e confortável de usar em celular.
- Não adiciona complexidade sem benefício.
- Funciona com os dados reais do usuário.
- Mantém o funcionamento offline quando aplicável.
- Não introduz dependências desnecessárias.
- Foi validada de forma honesta.
Regra principal: melhorar a experiência sem comprometer a confiabilidade do aplicativo.