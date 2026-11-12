/* =========================================================
   LucroCerto – lógica do aplicativo
   ========================================================= */

// Nome da "gaveta" onde os dados ficam guardados no navegador
const CHAVE_STORAGE = 'lucrocerto.produtos.v1';

// Lista de produtos em memória (carregada do navegador ao abrir a página)
let produtos = carregarProdutos();

// Atalho para pegar elementos da página pelo id
const $ = (id) => document.getElementById(id);

const form = $('formProduto');
const campos = {
  id: $('produtoId'),
  nome: $('nome'),
  marketplace: $('marketplace'),
  custo: $('custo'),
  preco: $('preco'),
  taxa: $('taxa'),
  frete: $('frete'),
  outras: $('outras'),
};

/* ---------------------------------------------------------
   1. FORMATAÇÃO E LEITURA DE NÚMEROS
   --------------------------------------------------------- */

const formatadorReais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatadorNumero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatarReais(valor) {
  return formatadorReais.format(valor);
}

function formatarPercentual(valor) {
  return formatadorNumero.format(valor) + '%';
}

// Converte o texto digitado em número.
// Aceita "1.234,56", "1234,56", "1.000" (mil) e "12.5". Campo vazio vira 0.
// Retorna NaN se o texto não for um número válido.
function lerNumero(texto) {
  let t = String(texto).trim().replace(/\s|R\$|%/g, '');
  if (t === '') return 0;
  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.'); // padrão brasileiro
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, ''); // "1.000" ou "1.250.000" = separador de milhar
  }
  if (!/^-?\d*\.?\d+$/.test(t)) return NaN;
  return Number(t);
}

// Arredonda para centavos (evita resultados como 0,30000000000000004)
function arredondar(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/* ---------------------------------------------------------
   2. CÁLCULO DO LUCRO (o "coração" do app)
   --------------------------------------------------------- */
//   Valor da taxa  = preço × taxa% ÷ 100
//   Lucro líquido  = preço − custo − valor da taxa − frete − outras despesas
//   Margem (%)     = lucro ÷ preço × 100
function calcular({ custo, preco, taxa, frete, outras }) {
  const valorTaxa = arredondar(preco * taxa / 100);
  const lucro = arredondar(preco - custo - valorTaxa - frete - outras);
  const margem = preco > 0 ? (lucro / preco) * 100 : 0;
  return { valorTaxa, lucro, margem };
}

/* ---------------------------------------------------------
   3. SALVAR E CARREGAR NO NAVEGADOR (localStorage)
   --------------------------------------------------------- */

function carregarProdutos() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_STORAGE) || '[]');
    return Array.isArray(dados) ? dados : [];
  } catch (erro) {
    console.error('Não foi possível ler os dados salvos:', erro);
    return [];
  }
}

function salvarProdutos() {
  try {
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(produtos));
    return true;
  } catch (erro) {
    console.error('Não foi possível salvar:', erro);
    mostrarAviso('Erro ao salvar: o navegador bloqueou ou o espaço acabou.');
    return false;
  }
}

/* ---------------------------------------------------------
   4. LER E VALIDAR O FORMULÁRIO
   --------------------------------------------------------- */

function lerFormulario() {
  return {
    nome: campos.nome.value.trim(),
    marketplace: campos.marketplace.value,
    custo: lerNumero(campos.custo.value),
    preco: lerNumero(campos.preco.value),
    taxa: lerNumero(campos.taxa.value),
    frete: lerNumero(campos.frete.value),
    outras: lerNumero(campos.outras.value),
  };
}

// Devolve uma lista de erros. Lista vazia = tudo certo.
function validar(dados) {
  const erros = [];
  const marcar = (campo, msg) => { campos[campo].classList.add('invalid'); erros.push(msg); };

  Object.values(campos).forEach((c) => c.classList.remove('invalid'));

  if (!dados.nome) marcar('nome', 'Informe o nome do produto.');
  if (isNaN(dados.custo) || dados.custo < 0) marcar('custo', 'Custo inválido.');
  if (isNaN(dados.preco) || dados.preco <= 0) marcar('preco', 'O preço de venda deve ser maior que zero.');
  if (isNaN(dados.taxa) || dados.taxa < 0 || dados.taxa > 100) marcar('taxa', 'A taxa deve estar entre 0% e 100%.');
  if (isNaN(dados.frete) || dados.frete < 0) marcar('frete', 'Frete inválido.');
  if (isNaN(dados.outras) || dados.outras < 0) marcar('outras', 'Outras despesas inválidas.');

  return erros;
}

/* ---------------------------------------------------------
   5. PRÉVIA EM TEMPO REAL (enquanto digita)
   --------------------------------------------------------- */

function atualizarPrevia() {
  const d = lerFormulario();
  // Para a prévia, valores inválidos contam como zero
  const n = (v) => (isNaN(v) ? 0 : v);
  const valores = { custo: n(d.custo), preco: n(d.preco), taxa: n(d.taxa), frete: n(d.frete), outras: n(d.outras) };
  const r = calcular(valores);

  $('pvPreco').textContent = formatarReais(valores.preco);
  $('pvCusto').textContent = formatarReais(valores.custo);
  $('pvTaxa').textContent = formatarReais(r.valorTaxa) + ` (${formatarPercentual(valores.taxa)})`;
  $('pvFrete').textContent = formatarReais(valores.frete);
  $('pvOutras').textContent = formatarReais(valores.outras);

  const classe = r.lucro < 0 ? 'negativo' : (r.lucro > 0 ? 'positivo' : '');
  $('pvLucro').textContent = formatarReais(r.lucro);
  $('pvLucro').className = classe;
  $('pvMargem').textContent = formatarPercentual(r.margem);
  $('pvMargem').className = classe;
}

/* ---------------------------------------------------------
   6. CADASTRAR / EDITAR / EXCLUIR
   --------------------------------------------------------- */

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

form.addEventListener('submit', (evento) => {
  evento.preventDefault(); // impede a página de recarregar

  const dados = lerFormulario();
  const erros = validar(dados);
  $('formErro').textContent = erros.join(' ');
  if (erros.length) return;

  const idEditando = campos.id.value;

  if (idEditando) {
    const indice = produtos.findIndex((p) => p.id === idEditando);
    if (indice !== -1) produtos[indice] = { ...produtos[indice], ...dados, atualizadoEm: new Date().toISOString() };
  } else {
    produtos.unshift({ id: gerarId(), ...dados, criadoEm: new Date().toISOString() });
  }

  if (salvarProdutos()) {
    mostrarAviso(idEditando ? 'Produto atualizado.' : 'Produto cadastrado.');
    limparFormulario();
    renderizar();
  }
});

function editarProduto(id) {
  const p = produtos.find((item) => item.id === id);
  if (!p) return;

  campos.id.value = p.id;
  campos.nome.value = p.nome;
  campos.marketplace.value = p.marketplace || 'Outro';
  campos.custo.value = formatadorNumero.format(p.custo);
  campos.preco.value = formatadorNumero.format(p.preco);
  campos.taxa.value = formatadorNumero.format(p.taxa);
  campos.frete.value = formatadorNumero.format(p.frete);
  campos.outras.value = formatadorNumero.format(p.outras);

  $('tituloForm').textContent = 'Editar produto';
  $('btnSalvar').textContent = 'Salvar alterações';
  $('btnCancelar').hidden = false;
  $('formErro').textContent = '';

  atualizarPrevia();
  renderizar();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  campos.nome.focus({ preventScroll: true });
}

function excluirProduto(id) {
  const p = produtos.find((item) => item.id === id);
  if (!p) return;
  if (!confirm(`Excluir o produto "${p.nome}"? Esta ação não pode ser desfeita.`)) return;

  produtos = produtos.filter((item) => item.id !== id);
  if (campos.id.value === id) limparFormulario();
  if (salvarProdutos()) mostrarAviso('Produto excluído.');
  renderizar();
}

function limparFormulario() {
  form.reset();
  campos.id.value = '';
  Object.values(campos).forEach((c) => c.classList.remove('invalid'));
  $('tituloForm').textContent = 'Novo produto';
  $('btnSalvar').textContent = 'Cadastrar produto';
  $('btnCancelar').hidden = true;
  $('formErro').textContent = '';
  atualizarPrevia();
  renderizar();
}

$('btnCancelar').addEventListener('click', limparFormulario);

/* ---------------------------------------------------------
   7. DESENHAR A LISTA E O RESUMO NA TELA
   --------------------------------------------------------- */

// Protege contra textos com caracteres especiais de HTML (ex.: <, >)
function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function classeBadge(marketplace) {
  if (marketplace === 'Mercado Livre') return 'badge badge--ml';
  if (marketplace === 'Shopee') return 'badge badge--shopee';
  return 'badge';
}

function renderizar() {
  const termo = $('busca').value.trim().toLowerCase();
  const visiveis = produtos.filter((p) => p.nome.toLowerCase().includes(termo));
  const idEditando = campos.id.value;

  $('listaProdutos').innerHTML = visiveis.map((p) => {
    const r = calcular(p);
    const classe = r.lucro < 0 ? 'negativo' : 'positivo';
    return `
      <tr class="${p.id === idEditando ? 'editando' : ''}">
        <td class="produto-cel">
          <div class="produto-nome">${escaparHtml(p.nome)}</div>
          <span class="${classeBadge(p.marketplace)}">${escaparHtml(p.marketplace || 'Outro')}</span>
        </td>
        <td class="num" data-label="Custo">${formatarReais(p.custo)}</td>
        <td class="num" data-label="Preço">${formatarReais(p.preco)}</td>
        <td class="num ${classe}" data-label="Lucro"><strong>${formatarReais(r.lucro)}</strong></td>
        <td class="num" data-label="Margem"><span class="margem-pill ${classe}">${formatarPercentual(r.margem)}</span></td>
        <td>
          <div class="acoes">
            <button type="button" class="icon-btn" data-acao="editar" data-id="${p.id}">Editar</button>
            <button type="button" class="icon-btn icon-btn--danger" data-acao="excluir" data-id="${p.id}">Excluir</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Mensagem de lista vazia
  const vazio = $('vazio');
  vazio.hidden = visiveis.length > 0;
  vazio.innerHTML = produtos.length === 0
    ? '<div class="empty__icon" aria-hidden="true">📦</div><p><strong>Nenhum produto ainda.</strong></p><p>Cadastre seu primeiro produto no formulário.</p>'
    : '<div class="empty__icon" aria-hidden="true">🔍</div><p><strong>Nenhum produto encontrado.</strong></p><p>Tente outro termo de busca.</p>';

  atualizarResumo();
}

function atualizarResumo() {
  const total = produtos.length;
  const resultados = produtos.map(calcular);
  const somaLucro = resultados.reduce((s, r) => s + r.lucro, 0);
  const somaMargem = resultados.reduce((s, r) => s + r.margem, 0);
  const comPrejuizo = resultados.filter((r) => r.lucro < 0).length;

  // Valores potenciais: soma considerando 1 unidade de cada produto
  const somaCusto = produtos.reduce((s, p) => s + p.custo, 0);
  const somaVenda = produtos.reduce((s, p) => s + p.preco, 0);
  $('statCustoTotal').textContent = formatarReais(arredondar(somaCusto));
  $('statVendaTotal').textContent = formatarReais(arredondar(somaVenda));
  $('statLucroTotal').textContent = formatarReais(arredondar(somaLucro));
  $('statLucroTotal').parentElement.classList.toggle('prejuizo', somaLucro < 0);

  $('statTotal').textContent = total;
  $('statLucroMedio').textContent = formatarReais(total ? somaLucro / total : 0);
  $('statMargemMedia').textContent = formatarPercentual(total ? somaMargem / total : 0);
  $('statPrejuizo').textContent = comPrejuizo;
  $('statPrejuizo').className = 'stat__value' + (comPrejuizo > 0 ? ' negativo' : '');
}

// Um único "ouvinte" para todos os botões Editar/Excluir da lista
$('listaProdutos').addEventListener('click', (evento) => {
  const botao = evento.target.closest('button[data-acao]');
  if (!botao) return;
  if (botao.dataset.acao === 'editar') editarProduto(botao.dataset.id);
  if (botao.dataset.acao === 'excluir') excluirProduto(botao.dataset.id);
});

$('busca').addEventListener('input', renderizar);

/* ---------------------------------------------------------
   8. AVISO RÁPIDO (toast)
   --------------------------------------------------------- */
let temporizadorAviso;
function mostrarAviso(mensagem) {
  const toast = $('toast');
  toast.textContent = mensagem;
  toast.classList.add('show');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => toast.classList.remove('show'), 2500);
}

/* ---------------------------------------------------------
   9. ABAS DO MENU LATERAL
   --------------------------------------------------------- */
// Cada link do menu tem data-aba="nome" e mostra a <section id="aba-nome">.
// O endereço ganha "#nome", então recarregar a página mantém a aba aberta.
const linksAbas = document.querySelectorAll('.nav__item[data-aba]');

function abrirAba(nome) {
  const existe = [...linksAbas].some((link) => link.dataset.aba === nome);
  if (!existe) nome = linksAbas[0].dataset.aba; // aba desconhecida → primeira

  linksAbas.forEach((link) => {
    const ativo = link.dataset.aba === nome;
    link.classList.toggle('ativo', ativo);
    if (ativo) {
      link.setAttribute('aria-current', 'page');
      $('tituloPagina').textContent = link.dataset.titulo;
      document.title = `${link.dataset.titulo} – LucroCerto`;
    } else {
      link.removeAttribute('aria-current');
    }
  });
  document.querySelectorAll('.aba').forEach((secao) => {
    secao.hidden = secao.id !== `aba-${nome}`;
  });
  fecharMenu();
}

// Menu "gaveta" no celular
function fecharMenu() {
  document.body.classList.remove('menu-aberto');
  $('menuBtn').setAttribute('aria-expanded', 'false');
}
$('menuBtn').addEventListener('click', () => {
  const aberto = document.body.classList.toggle('menu-aberto');
  $('menuBtn').setAttribute('aria-expanded', String(aberto));
});
$('sidebarOverlay').addEventListener('click', fecharMenu);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenu(); });

window.addEventListener('hashchange', () => abrirAba(location.hash.slice(1)));

/* ---------------------------------------------------------
   10. INÍCIO
   --------------------------------------------------------- */
abrirAba(location.hash.slice(1));
form.addEventListener('input', atualizarPrevia);
atualizarPrevia();
renderizar();
