(function () {
  const STORAGE_KEY = "mlSetsLanguage";
  const DEFAULT_LANG = navigator.language && navigator.language.toLowerCase().startsWith("pt") ? "pt" : "en";
  const LANGS = ["en", "pt"];

  const pt = {
    "Report": "Relatório",
    "Digital Notebook": "Caderno Digital",
    "BIOREGIONAL REPORT": "RELATÓRIO BIOREGIONAL",
    "Choose your language to continue.": "Escolha o idioma para continuar.",
    "Continue": "Continuar",
    "Choose your analytical lens.": "Escolha a perspetiva para analisar resultados.",
    "This workspace splits the story into bioregional totals and a farmer view.": "Este espaço organiza a história em totais bioregionais ou numa vista de agricultor.",
    "Environmental Tool": "Ferramenta Ambiental",
    "Environmental Tool | Choose view": "Ferramenta Ambiental | Escolher vista",
    "Choose how you want to explore the results.": "Escolha como quer explorar os resultados.",
    "Start with farmer-year results, explore bioregional patterns, or open a learning view designed to explain what the numbers mean.": "Comece pelos resultados agricultor-ano, explore padrões bioregionais, ou abra uma vista de aprendizagem criada para explicar o significado dos números.",
    "Beta build": "Versão beta",
    "Bioregional analysis": "Análise bioregional",
    "Explore total results, pivot tables, and LCA summaries across seasons and clusters.": "Explore resultados totais, tabelas dinâmicas e resumos de Análise de Ciclo de Vida por campanha e clusters de desempenho.",
    "Enter bioregional": "Entrar na análise bioregional",
    "Farmer view": "Vista do agricultor",
    "Select a farmer profile and review their metrics, season changes, and benchmark context.": "Selecione um perfil de agricultor e reveja métricas, variações por campanha e contexto de comparação.",
    "Select farmer": "Selecionar agricultor",
    "Farmers Environmental Analysis": "Análise Ambiental dos Agricultores",
    "Explore all farmer-year environmental results directly, without clustering, on a per-hectare or per-tonne basis.": "Explore todos os resultados ambientais agricultor-ano diretamente, sem clustering, por hectare ou por tonelada.",
    "Open farmers analysis": "Abrir análise dos agricultores",
    "Environmental Tool | Farmers Environmental Analysis": "Ferramenta Ambiental | Análise Ambiental dos Agricultores",
    "Farmer-year results without clustering.": "Resultados agricultor-ano sem clustering.",
    "Explore the cleaned input tables and environmental calculations for all farmer-year observations. Clustering is not used in this view.": "Explore as tabelas de entrada limpas e os cálculos ambientais para todas as observações agricultor-ano. O clustering não é usado nesta vista.",
    "DMU-level analysis": "Análise ao nível da DMU",
    "Input Tables": "Tabelas de Entrada",
    "Inspect the updated farm-operation inputs used by the cleaned calculations.": "Consulte as entradas atualizadas das operações agrícolas usadas nos cálculos limpos.",
    "Herbicide, fungicide, and insecticide applications by farmer-year, crop stage, target, and dose.": "Aplicações de herbicidas, fungicidas e inseticidas por agricultor-ano, fase da cultura, alvo e dose.",
    "Seed rates, varieties, sowing operations, equipment, and covered area by farmer-year.": "Doses de semente, variedades, operações de sementeira, equipamento e área coberta por agricultor-ano.",
    "N, P, and K rates by fertilisation operation, product, and farmer-year.": "Doses de N, P e K por operação de fertilização, produto e agricultor-ano.",
    "Machine operations, equipment type, repetitions, and total area worked.": "Operações de maquinaria, tipo de equipamento, repetições e área total trabalhada.",
    "Water use by farmer-year in m3 per hectare and m3 per tonne.": "Uso de água por agricultor-ano em m3 por hectare e m3 por tonelada.",
    "Open input table": "Abrir tabela de entrada",
    "Environmental Results": "Resultados Ambientais",
    "Open the DMU-level LCA outputs by input type, with hectare and tonne bases kept separate.": "Abra os resultados de ACV ao nível da DMU por tipo de entrada, mantendo separadas as bases por hectare e por tonelada.",
    "Environmental impacts from herbicide, fungicide, and insecticide active ingredients.": "Impactos ambientais dos ingredientes ativos de herbicidas, fungicidas e inseticidas.",
    "Seed impacts from sowing rates, calculated per hectare and per tonne.": "Impactos das sementes a partir das doses de sementeira, calculados por hectare e por tonelada.",
    "N, P, and K input impacts calculated from the original fertilisation table.": "Impactos das entradas de N, P e K calculados a partir da tabela original de fertilização.",
    "Equipment-specific operation impacts based on worked area.": "Impactos das operações por tipo de equipamento com base na área trabalhada.",
    "Water-use impacts from the corrected water factors and input table.": "Impactos do uso de água a partir dos fatores corrigidos e da tabela de entrada.",
    "Open results": "Abrir resultados",
    "Bioregional environmental analysis": "Análise ambiental bioregional",
    "Compare the study area across seasons, production systems, and clusters using aggregated environmental results.": "Compare a área de estudo por campanhas, sistemas de produção e clusters usando resultados ambientais agregados.",
    "Farmer learning view": "Vista de aprendizagem do agricultor",
    "Use guided explanations to understand impact drivers, trade-offs, and practical interpretation for farm decisions.": "Use explicações guiadas para compreender fatores de impacto, trade-offs e interpretação prática para decisões agrícolas.",
    "Open learning view": "Abrir vista de aprendizagem",
    "Back to overview": "Voltar atrás",
    "Bioregional results.": "Resultados bioregionais.",
    "This view consolidates the big picture. It will anchor the pivot tables, LCA summaries, and a clean set of impact factors used across the calculations.": "Esta vista consolida a visão geral. Reúne as tabelas dinâmicas, os resumos de Análise de Ciclo de Vida e ainda os fatores de impacto usados nos cálculos.",
    "Bioregional track": "Percurso bioregional",
    "Pivot tables": "Tabelas dinâmicas",
    "Filter inputs by season, operation, and cluster to spot patterns before modeling impacts.": "Filtre entradas por campanha, operação e cluster para identificar padrões antes de modelar impactos.",
    "Inputs": "Entradas",
    "Crop protection": "Proteção da cultura",
    "Summaries of herbicide, fungicide, and insecticide doses per cluster.": "Resumos das doses de herbicidas, fungicidas e inseticidas por cluster.",
    "Open pivot": "Abrir tabela",
    "Sowing": "Sementeira",
    "Seed rates, varieties, and season groupings for bioregional comparisons.": "Doses de semente, variedades e agrupamentos por campanha para comparações bioregionais.",
    "Fertilisation": "Fertilização",
    "Nutrient totals, blends, and unit rates across the region.": "Totais de nutrientes, formulações e taxas unitárias na região.",
    "Operations": "Operações",
    "Machinery": "Maquinaria",
    "Equipment intensity, repetitions, and worked area totals.": "Intensidade de equipamento, repetições e totais de área trabalhada.",
    "Resources": "Recursos",
    "Water": "Água",
    "Water use snapshots with seasonal and cluster rollups.": "Resumo do uso de água por campanha e cluster.",
    "Cluster results": "Resultados por cluster",
    "See how farmers group into management clusters and where they sit in PCA space.": "Veja como os agricultores se agrupam em clusters de gestão e a sua posição no espaço PCA.",
    "Clusters": "Clusters",
    "PCA + HCPC overview": "Resumo PCA + HCPC",
    "Explore cluster assignments, PCA scatter, and driver averages.": "Explore atribuições de cluster, dispersão PCA e médias dos fatores explicativos.",
    "Open clusters": "Abrir clusters",
    "Impacts": "Impactos",
    "Cluster impacts": "Impactos por cluster",
    "Characterisation impacts by category and source, per cluster.": "Impactos de caracterização por categoria e fonte, por cluster.",
    "Open impacts": "Abrir impactos",
    "Burden": "Carga",
    "Relative burdens": "Cargas relativas",
    "Percent difference versus cluster 2 by impact category.": "Diferença percentual face ao cluster 2 por categoria de impacto.",
    "Open relative": "Abrir relativo",
    "LCA and impacts": "ACV e impactos",
    "Aggregated life cycle metrics for the region, with clear breakouts by input type.": "Métricas agregadas de ciclo de vida para a região, discriminadas por tipo de entrada.",
    "Open LCA": "Abrir ACV",
    "Single score or characterisation impacts from herbicide, fungicide, and insecticide doses.": "Impactos de pontuação única ou caracterização a partir de doses de herbicidas, fungicidas e inseticidas.",
    "Seed rate impacts per hectare or per tonne, with category totals.": "Impactos da dose de semente por hectare ou por tonelada, com totais por categoria.",
    "N, P, and K factors applied to fertiliser rates with impact breakdowns.": "Fatores de N, P e K aplicados às doses de fertilizante, com discriminação de impactos.",
    "Equipment intensity impacts across operations, per hectare or per tonne.": "Impactos da intensidade de equipamento por operação, por hectare ou por tonelada.",
    "Water use impacts with single score and characterisation options.": "Impactos do uso de água com opções de pontuação única e caracterização.",
    "Raw impact factors per unit": "Fatores de impacto por unidade",
    "Reference library for the factors behind each input and unit used in the calculations.": "Biblioteca de referência para os fatores de cada entrada e unidade usados nos cálculos.",
    "Factors": "Fatores",
    "Impact factors": "Fatores de impacto",
    "Switch between single score and characterisation factors inside the same view.": "Alterne entre fatores de pontuação única e de caracterização na mesma vista.",
    "View factors": "Ver fatores",
    "Library": "Biblioteca",
    "Unit dictionary": "Dicionário de unidades",
    "Canonical names, units, and input mappings for consistent reporting.": "Nomes canónicos, unidades e mapeamentos de entradas para relatórios consistentes.",
    "View units": "Ver unidades",
    "Sections are placeholders while we wire the correct datasets.": "As secções estão preparadas enquanto ligamos os conjuntos de dados corretos.",

    "Select your farmer profile.": "Selecione o perfil do agricultor.",
    "Choose the farmer you represent to personalize the farmer dashboards. This selection will unlock the per-farmer metrics as the experience expands.": "Escolha o agricultor que representa para personalizar os painéis. Esta seleção ativa as métricas por agricultor à medida que a experiência evolui.",
    "Farmer mode": "Modo agricultor",
    "Farmer selection": "Seleção do agricultor",
    "Pick a farmer ID to set your farmer context. We will remember your choice.": "Escolha um ID de agricultor para definir o contexto. A sua escolha será guardada.",
    "Select": "Selecionar",
    "Which farmer are you?": "Que agricultor é?",
    "Choose from the available farmers (C1, C2, etc).": "Escolha entre os agricultores disponíveis (C1, C2, etc).",
    "Farmer ID": "ID do agricultor",
    "Save selection": "Guardar seleção",
    "Continue": "Continuar",
    "Status": "Estado",
    "Selection": "Seleção",
    "No farmer selected yet.": "Ainda não foi selecionado nenhum agricultor.",
    "Your choice will be stored locally for quick access when the farmer dashboards go live.": "A sua escolha será guardada localmente para acesso rápido aos painéis do agricultor.",
    "No farmers found": "Nenhum agricultor encontrado",

    "Back": "Voltar",
    "Choose your view mode.": "Escolha o modo de visualização.",
    "Select how you want to evaluate performance before opening the farmer dashboard.": "Selecione como quer avaliar o desempenho antes de abrir o painel do agricultor.",
    "View mode": "Modo de visualização",
    "Optimization lens": "Perspetiva de otimização",
    "Pick whether to focus on internal optimization, best-cluster benchmarking, or relative burdens.": "Escolha entre otimização interna, comparação com o melhor cluster ou cargas relativas.",
    "Internal": "Interno",
    "Optimization view": "Vista de otimização",
    "Track your own inputs against your historical averages and spot improvement areas.": "Compare as suas entradas com as suas médias históricas e identifique áreas de melhoria.",
    "Enter internal view": "Entrar na vista interna",
    "Compare": "Comparar",
    "Best cluster benchmark": "Comparação com o melhor cluster",
    "Benchmark your inputs against the best-performing cluster for each season.": "Compare as suas entradas com o cluster de melhor desempenho em cada campanha.",
    "Enter benchmark view": "Entrar na comparação",
    "Relative": "Relativo",
    "Compare your cluster burdens against another cluster and drill into categories.": "Compare as cargas do seu cluster com outro cluster e explore por categoria.",
    "Open relative burdens": "Abrir cargas relativas",

    "Filters": "Filtros",
    "Focus the view": "Focar a vista",
    "Scope": "Âmbito",
    "Reset": "Repor",
    "Year": "Ano",
    "Season": "Campanha",
    "Farmer": "Agricultor",
    "Operation category": "Categoria da operação",
    "Operation": "Operação",
    "Equipment": "Equipamento",
    "Search": "Pesquisar",
    "Impact basis": "Base do impacto",
    "Impact type": "Tipo de impacto",
    "Single score": "Pontuação única",
    "Characterisation": "Caracterização",
    "Per tonne": "Por tonelada",
    "Per hectare": "Por hectare",
    "Per tonne (m³/t)": "Por tonelada (m3/t)",
    "Per hectare (m³/ha)": "Por hectare (m3/ha)",
    "Overview": "Visão geral",
    "Snapshot": "Resumo da seleção",
    "Aggregates": "Agregados",
    "Pivot": "Tabela",
    "Detail": "Detalhe",
    "Raw rows": "Linhas originais",
    "Rows": "Linhas",
    "Download CSV": "Descarregar CSV",
    "About": "Sobre",
    "Water impacts": "Impactos da água",
    "Water × factor": "Água x fator",
    "Water by farmer-season": "Água por agricultor-campanha",
    "Machinery pivots": "Tabelas de maquinaria",
    "Equipment workload": "Carga de trabalho do equipamento",
    "Equipment summary": "Resumo do equipamento",
    "Crop protection pivots": "Tabelas de proteção da cultura",
    "Dose mix": "Mistura de doses",
    "Treatment summary": "Resumo dos tratamentos",
    "Fertilisation pivots": "Tabelas de fertilização",
    "Nutrient mix": "Mistura de nutrientes",
    "Nutrient summary": "Resumo dos nutrientes",
    "Sowing pivots": "Tabelas de sementeira",
    "Seed rate": "Dose de semente",
    "Seed summary": "Resumo da semente",
    "Impact category": "Categoria de impacto",
    "Unit": "Unidade",
    "Value": "Valor",
    "Product": "Produto",
    "Variety": "Variedade",
    "Date": "Data",
    "Area (ha)": "Área (ha)",
    "Area worked (ha)": "Área trabalhada (ha)",
    "Area per tonne (ha/t)": "Área por tonelada (ha/t)",
    "Productivity (t/ha)": "Produtividade (t/ha)",
    "Water (m³/ha)": "Água (m3/ha)",
    "Water (m³/t)": "Água (m3/t)",
    "Dose (kg/ha)": "Dose (kg/ha)",
    "Dose (kg/t)": "Dose (kg/t)",
    "Avg dose (kg/ha)": "Dose média (kg/ha)",
    "Avg dose (kg/t)": "Dose média (kg/t)",
    "Active substance": "Substância ativa",
    "Targets": "Alvos",
    "Products": "Produtos",
    "Stage": "Fase",
    "Ops": "Ops",
    "Mode": "Modo",
    "Efficient": "Eficiente",
    "Yes": "Sim",
    "No": "Não",
    "No data.": "Sem dados.",
    "No impacts to show.": "Sem impactos para apresentar.",
    "No operations match these filters.": "Nenhuma operação corresponde a estes filtros.",
    "Nothing to show. Broaden filters to see operations.": "Nada para apresentar. Alargue os filtros para ver operações.",
    "Nothing to show. Broaden filters to see data.": "Nada para apresentar. Alargue os filtros para ver dados.",
    "No DEA scores for this selection.": "Sem pontuações DEA para esta seleção.",
    "All records": "Todos os registos",
    "All years": "Todos os anos",
    "All seasons": "Todas as campanhas",
    "All farmers": "Todos os agricultores",
    "All clusters": "Todos os clusters",
    "All operations": "Todas as operações",
    "All equipments": "Todos os equipamentos",
    "All categories": "Todas as categorias",
    "All categorys": "Todas as categorias",
    "All products": "Todos os produtos",
    "All varieties": "Todas as variedades",
    "All sources": "Todas as fontes",
    "All modes": "Todos os modos",
    "Cluster impacts (characterisation)": "Impactos por cluster (caracterização)",
    "Compare per-cluster characterisation impacts by category and by input source. Results are shown per hectare or per tonne.": "Compare impactos de caracterização por cluster, categoria e fonte de entrada. Os resultados são apresentados por hectare ou por tonelada.",
    "Totals by cluster": "Totais por cluster",
    "By input source": "Por fonte de entrada",
    "Source rows": "Linhas por fonte",
    "Cluster relative burdens": "Cargas relativas por cluster",
    "Compare cluster-level characterisation impacts relative to cluster 2. Values show total means, ratios, and percent differences by category and basis.": "Compare impactos de caracterização ao nível do cluster relativamente ao cluster 2. Os valores mostram médias totais, racios e diferenças percentuais por categoria e base.",
    "Cluster comparison": "Comparação de clusters",
    "Percent difference vs cluster 2": "Diferença percentual face ao cluster 2",
    "Clustering of farmers": "Agrupamento de agricultores",
    "PCA + hierarchical clustering on four drivers per farmer-season: N rate, pesticide load, yield, and mechanisation.": "PCA + clustering hierárquico com quatro fatores por agricultor-campanha: dose de N, carga de pesticidas, produtividade e mecanização.",
    "About clustering": "Sobre o agrupamento",
    "HCPC clusters": "Clusters HCPC",
    "How to read the clustering": "Como ler o agrupamento",
    "Close": "Fechar",
    "PC1: Pesticide reliance vs. productive efficiency": "PC1: dependência de pesticidas vs. eficiência produtiva",
    "What it measures:": "O que mede:",
    "How much pesticide input is used relative to the yield obtained.": "Quanto pesticida e usado relativamente à produtividade obtida.",
    "High PC1 -> high pesticide load and lower yields.": "PC1 alto -> carga elevada de pesticidas e produtividades mais baixas.",
    "Low PC1 -> low pesticide load and higher yields.": "PC1 baixo -> baixa carga de pesticidas e produtividades mais altas.",
    "Interpretation:": "Interpretação:",
    "PC1 represents an environmental efficiency gradient. Lower values mean more efficient systems (less chemical use per tonne of rice); higher values reflect chemically intensive but less productive setups.": "O PC1 representa um gradiente de eficiência ambiental. Valores mais baixos indicam sistemas mais eficientes (menos uso químico por tonelada de arroz); valores mais altos refletem sistemas quimicamente intensivos e menos produtivos.",
    "PC2: Mechanisation and nutrient intensity": "PC2: mecanização e intensidade de nutrientes",
    "The level of mechanisation and nitrogen application, and how strongly these inputs relate to yield.": "O nível de mecanização e aplicação de azoto, e a relação destes fatores com a produtividade.",
    "High PC2 -> high mechanisation + higher N inputs + generally high yields.": "PC2 alto -> mecanização elevada + maiores entradas de N + produtividades geralmente altas.",
    "Low PC2 -> low mechanisation + lower N inputs + lower yields.": "PC2 baixo -> baixa mecanização + menores entradas de N + produtividades mais baixas.",
    "PC2 captures management intensity - how much machinery and nitrogen a system uses, and how effectively those inputs translate into productivity.": "O PC2 capta a intensidade de gestão: quanta maquinaria e azoto um sistema usa e quão eficazmente essas entradas se traduzem em produtividade.",
    "Cluster meaning": "Significado dos clusters",
    "Each cluster groups farmer-year observations with similar combinations of pesticide use, nitrogen intensity, machinery use, and yield performance. Clusters are management-performance archetypes, not fixed farmer identities.": "Cada cluster agrupa observações agricultor-ano com combinações semelhantes de uso de pesticidas, intensidade de azoto, uso de maquinaria e produtividade. Os clusters são arquétipos de gestão-desempenho, não identidades fixas de agricultores.",
    "Cluster 1 - Inefficient or stressed systems:": "Cluster 1 - sistemas ineficientes ou sob stress:",
    "Highest pesticide use and lowest yields; chemical pressure high but productivity low; mechanisation and N moderate.": "Maior uso de pesticidas e produtividades mais baixas; pressão química elevada mas baixa produtividade; mecanização e N moderados.",
    "Cluster 2 - High-efficiency systems:": "Cluster 2 - sistemas de alta eficiência:",
    "Low nitrogen, very low pesticide, good productivity; high resource-use efficiency and likely well-timed management.": "Baixo azoto, pesticidas muito baixos e boa produtividade; elevada eficiência no uso de recursos e gestão provavelmente bem temporizada.",
    "Cluster 3 - High-input, high-output regime systems:": "Cluster 3 - sistemas intensivos de alta entrada e alta produção:",
    "Conventional intensive style with high nitrogen, high mechanisation, and consistently high yields.": "Estilo convencional intensivo com azoto elevado, alta mecanização e produtividades consistentemente altas.",
    "Efficiency scores": "Pontuações de eficiência",
    "Projection": "Projeção",
    "PCA scatter (PC1 vs PC2)": "Dispersão PCA (PC1 vs PC2)",
    "Farm-year metrics": "Métricas agricultor-ano",
    "DEA theta": "Theta DEA",
    "N (kg/ha)": "N (kg/ha)",
    "Pest (kg/ha)": "Pesticidas (kg/ha)",
    "Yield (kg/ha)": "Produtividade (kg/ha)",
    "Mech ratio": "Racio de mecanização",

    "Crop protection pivots": "Tabelas de proteção da cultura",
    "Crop protection input table": "Tabela de entrada da proteção da cultura",
    "Filter by year, farmer, operation, or target to understand crop protection intensity.": "Filtre por ano, agricultor, operação ou alvo para compreender a intensidade da proteção da cultura.",
    "Interactive pivot & detail view": "Tabela interativa e vista detalhada",
    "Substance by operation": "Substância por operação",
    "Target": "Alvo",
    "Product, substance, variety, stage...": "Produto, substância, variedade, fase...",
    "Fertilisation pivots": "Tabelas de fertilização",
    "Fertilisation input table": "Tabela de entrada da fertilização",
    "Filter by year, farmer, operation, equipment, or product. Track nutrient rates in kg/ha and kg/t.": "Filtre por ano, agricultor, operação, equipamento ou produto. Acompanhe doses de nutrientes em kg/ha e kg/t.",
    "N, P, K, SO₄ overview": "Resumo de N, P, K, SO4",
    "Fertiliser product": "Produto fertilizante",
    "Product summary": "Resumo por produto",
    "Product, farmer, operation...": "Produto, agricultor, operação...",
    "Sowing pivots": "Tabelas de sementeira",
    "Sowing input table": "Tabela de entrada da sementeira",
    "Filter sowing events by year, farmer, variety, operation, or equipment. Track seed rates in kg/ha and kg/t.": "Filtre eventos de sementeira por ano, agricultor, variedade, operação ou equipamento. Acompanhe doses de semente em kg/ha e kg/t.",
    "Seed rates & coverage": "Doses de semente e cobertura",
    "Variety summary": "Resumo por variedade",
    "Variety, product, farmer...": "Variedade, produto, agricultor...",
    "Water pivots": "Tabelas de água",
    "Water input table": "Tabela de entrada da água",
    "Explore water use by year and farmer to compare intensity.": "Explore o uso de água por ano e agricultor para comparar intensidades.",
    "Farmer-year summary": "Resumo agricultor-ano",
    "Search farmer, season...": "Pesquisar agricultor, campanha...",
    "Machinery pivots": "Tabelas de maquinaria",
    "Machinery input table": "Tabela de entrada da maquinaria",
    "Browse operations by year, category, equipment, or farmer. Track repetitions and total area worked.": "Explore operações por ano, categoria, equipamento ou agricultor. Acompanhe repetições e área total trabalhada.",
    "Operation, equipment, farmer...": "Operação, equipamento, agricultor...",
    "Raw impact factors": "Fatores de impacto brutos",
    "Browse the exact factors used in the LCA calculations. Filter by product or impact category.": "Consulte os fatores exatos usados nos cálculos de ACV. Filtre por produto ou categoria de impacto.",
    "Per unit factors": "Fatores por unidade",
    "Factor set": "Conjunto de fatores",
    "Products": "Produtos",
    "Factor coverage": "Cobertura dos fatores",
    "Units": "Unidades",
    "Product, impact category...": "Produto, categoria de impacto...",

    "Farmer dashboard": "Painel do agricultor",
    "Season-by-season metrics for the selected farmer, including DEA efficiency and cluster placement.": "Métricas por campanha para o agricultor selecionado, incluindo eficiência DEA e colocação no cluster.",
    "Missing selection": "Seleção em falta",
    "Select a farmer first": "Selecione primeiro um agricultor",
    "Choose farmer": "Escolher agricultor",
    "We could not find a saved farmer selection. Pick a farmer to view their metrics.": "Não foi encontrada uma seleção de agricultor guardada. Escolha um agricultor para ver as métricas.",
    "Change farmer": "Alterar agricultor",
    "Metric focus": "Métrica em foco",
    "Crop protection (kg/ha)": "Proteção da cultura (kg/ha)",
    "N rate (kg/ha)": "Dose de N (kg/ha)",
    "Machinery ratio": "Racio de maquinaria",
    "Season averages": "Médias por campanha",
    "Best-cluster indication": "Indicação do melhor cluster",
    "How you compare this season": "Comparação nesta campanha",
    "Comparison": "Comparação",
    "Inputs vs cluster averages": "Entradas vs médias do cluster",
    "Trend": "Tendência",
    "Metric by season": "Métrica por campanha",
    "Season metrics": "Métricas por campanha",
    "Cluster-relative burdens for the selected farmer and season.": "Cargas relativas ao cluster para o agricultor e campanha selecionados.",
    "We could not find a saved farmer selection. Pick a farmer to view relative burdens.": "Não foi encontrada uma seleção de agricultor guardada. Escolha um agricultor para ver cargas relativas.",
    "Dashboard": "Painel",
    "Compare to cluster": "Comparar com cluster",
    "Cluster burden": "Carga do cluster",
    "Category rows": "Linhas por categoria",

    "Fertilisation impacts": "Impactos da fertilização",
    "Apply nutrient factors to N/P/K rates and compare by year or product.": "Aplique fatores de nutrientes às doses de N/P/K e compare por ano ou produto.",
    "NPK × factor": "NPK x fator",
    "Per hectare (kg/ha)": "Por hectare (kg/ha)",
    "Per tonne (kg/t)": "Por tonelada (kg/t)",
    "Totals by impact category": "Totais por categoria de impacto",
    "Machinery impacts": "Impactos da maquinaria",
    "Translate equipment intensity into impact totals by category.": "Converta a intensidade do equipamento em totais de impacto por categoria.",
    "Equipment × factor": "Equipamento x fator",
    "Per operation (area worked)": "Por operação (área trabalhada)",
    "Per tonne (area per tonne)": "Por tonelada (área por tonelada)",
    "Totals by equipment": "Totais por equipamento",
    "Seed impacts": "Impactos da semente",
    "Translate seed rates into single-score or characterisation impacts.": "Converta doses de semente em impactos de pontuação única ou caracterização.",
    "Seeds × factor": "Sementes x fator",
    "Convert water use into impact totals per hectare or per tonne.": "Converta o uso de água em totais de impacto por hectare ou por tonelada.",
    "Crop protection impacts": "Impactos da proteção da cultura",
    "Convert protection doses into impact totals by category.": "Converta doses de proteção em totais de impacto por categoria.",
    "Dose × factor": "Dose x fator",
    "Group": "Grupo",
    "All groups": "Todos os grupos",
    "IPCC Tier 1 methane and EF method details": "Detalhes do metano IPCC Tier 1 e do método EF",

    "ML Sets Report - Bioregional": "Relatório | Bioregional",
    "ML Sets Report | Choose lens": "Relatório | Escolher perspetiva",
    "ML Sets Report | Farmer view": "Relatório | Vista do agricultor",
    "ML Sets Report | Farmer view mode": "Relatório | Modo de vista do agricultor",
    "ML Sets Report | Farmer dashboard": "Relatório | Painel do agricultor",
    "ML Sets Report | Farmer relative burdens": "Relatório | Cargas relativas do agricultor",
    "ML Sets Report | Crop Protection": "Relatório | Proteção da cultura",
    "ML Sets Report | Fertilisation": "Relatório | Fertilização",
    "ML Sets Report | Sowing": "Relatório | Sementeira",
    "ML Sets Report | Machines": "Relatório | Máquinas",
    "ML Sets Report | Water": "Relatório | Água",
    "Digital Notebook | Crop Protection": "Caderno Digital | Proteção da cultura",
    "Digital Notebook | Fertilisation": "Caderno Digital | Fertilização",
    "Digital Notebook | Sowing": "Caderno Digital | Sementeira",
    "Digital Notebook | Machines": "Caderno Digital | Máquinas",
    "Digital Notebook | Water": "Caderno Digital | Água",
    "ML Sets Report | Clusters": "Relatório | Clusters",
    "ML Sets Report | Cluster impacts": "Relatório | Impactos por cluster",
    "ML Sets Report | Cluster relative burdens": "Relatório | Cargas relativas por cluster",
    "ML Sets Report | Impact Factors": "Relatório | Fatores de impacto",
    "ML Sets Report | LCA": "Relatório | ACV",
    "ML Sets Report | LCA - Crop protection": "Relatório | ACV - Proteção da cultura",
    "ML Sets Report | LCA - Sowing": "Relatório | ACV - Sementeira",
    "ML Sets Report | LCA - Fertilisation": "Relatório | ACV - Fertilização",
    "ML Sets Report | LCA - Machinery": "Relatório | ACV - Maquinaria",
    "ML Sets Report | LCA - Water": "Relatório | ACV - Água",
  };

  const patterns = [
    [/^Saved (.+)\.$/, "Guardado $1."],
    [/^You are viewing farmer data for (.+)\.$/, "Está a visualizar dados do agricultor $1."],
    [/^(\d+) records$/, "$1 registos"],
    [/^(\d+) rows$/, "$1 linhas"],
    [/^(\d+) groups$/, "$1 grupos"],
    [/^(\d+) categories$/, "$1 categorias"],
    [/^(\d+) operations$/, "$1 operações"],
    [/^(\d+) points$/, "$1 pontos"],
    [/^Cluster (\d+)$/, "Cluster $1"],
    [/^Impact \((.+)\)$/, "Impacto ($1)"],
    [/^Field impact \((.+)\)$/, "Impacto no campo ($1)"],
    [/^Total impact \((.+)\)$/, "Impacto total ($1)"],
  ];

  const nodeOriginals = new WeakMap();
  const originalTitle = document.title;

  function getLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(saved) ? saved : DEFAULT_LANG;
  }

  function translateText(text, lang) {
    if (lang === "en") return text;
    const trimmed = text.trim();
    if (!trimmed) return text;
    const leading = text.match(/^\s*/)[0];
    const trailing = text.match(/\s*$/)[0];
    const normalized = trimmed.replace(/\s+/g, " ");
    if (pt[normalized]) return `${leading}${pt[normalized]}${trailing}`;
    for (const [pattern, replacement] of patterns) {
      if (pattern.test(normalized)) return `${leading}${normalized.replace(pattern, replacement)}${trailing}`;
    }
    return text;
  }

  function translateAttribute(el, attr, lang) {
    if (!el.hasAttribute(attr)) return;
    const key = `i18nOriginal${attr[0].toUpperCase()}${attr.slice(1)}`;
    if (!el.dataset[key]) el.dataset[key] = el.getAttribute(attr);
    const next = translateText(el.dataset[key], lang);
    if (el.getAttribute(attr) !== next) el.setAttribute(attr, next);
  }

  function translateNode(node, lang) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!nodeOriginals.has(node)) nodeOriginals.set(node, node.nodeValue);
      const next = translateText(nodeOriginals.get(node), lang);
      if (node.nodeValue !== next) node.nodeValue = next;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches("script, style")) return;
    translateAttribute(node, "placeholder", lang);
    translateAttribute(node, "title", lang);
    node.childNodes.forEach((child) => translateNode(child, lang));
  }

  function translateDocument(lang = getLang()) {
    document.documentElement.lang = lang === "pt" ? "pt-PT" : "en";
    document.title = translateText(originalTitle, lang);
    translateNode(document.body, lang);
    updateSwitcher(lang);
    updateContinue();
  }

  function updateSwitcher(lang) {
    document.querySelectorAll("[data-lang]").forEach((button) => {
      const active = button.dataset.lang === lang;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setLang(lang) {
    if (!LANGS.includes(lang)) return;
    localStorage.setItem(STORAGE_KEY, lang);
    translateDocument(lang);
  }

  function continueFromLanguageGate() {
    window.location.href = "./choose-lens.html";
  }

  function updateContinue() {
    const button = document.querySelector("[data-language-continue]");
    if (!button) return;
    button.disabled = !localStorage.getItem(STORAGE_KEY);
  }

  function buildSwitcher() {
    if (document.querySelector(".language-switcher")) return;
    const switcher = document.createElement("div");
    switcher.className = "language-switcher";
    switcher.setAttribute("aria-label", "Language");
    switcher.innerHTML = `
      <button type="button" data-lang="en">EN</button>
      <button type="button" data-lang="pt">PT</button>
    `;
    document.body.appendChild(switcher);
  }

  function observe() {
    let pending = false;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        translateDocument(getLang());
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title"] });
  }

  window.mlI18n = { setLang, getLang, translateDocument, translateText };

  document.addEventListener("DOMContentLoaded", () => {
    buildSwitcher();
    document.body.addEventListener("click", (event) => {
      const button = event.target.closest("[data-lang]");
      if (button) setLang(button.dataset.lang);
      if (event.target.closest("[data-language-continue]")) continueFromLanguageGate();
    });
    translateDocument(getLang());
    observe();
  });
})();
