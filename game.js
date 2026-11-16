/* O Gabinete do Escrivão — protótipo do capítulo piloto.
   Jogo educativo sobre Bitcoin: por que uma chave segura nasce do acaso. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var SAVE = 'gabinete_v1';
  var NOMES = { m: 'Dado de marfim', o: 'Dado de osso', e: 'Dado de ébano' };
  var TERMOS = {
    t1: ['O que eu escolho, outro adivinha.', 'Segredos escolhidos por pessoas são previsíveis.'],
    t2: ['Cada bit dobra o trabalho de quem ataca.', 'Entropia: a quantidade de acaso de um segredo, medida em bits.'],
    t3: ['Acaso ruim parece acaso.', 'A qualidade da fonte de aleatoriedade importa tanto quanto a quantidade.'],
    t4: ['A ordem faz parte do segredo.', 'Frase de recuperação: 12 palavras, com verificação embutida na última.'],
    t5: ['Guardar não é mostrar.', 'Autocustódia: cópia física, fora de qualquer rede e de qualquer terceiro.']
  };
  var OBJETIVOS = {
    pistas: 'Descubra como o Falsário abriu o selo. Procure pistas pela sala e teste no selo quebrado.',
    segredo: 'Crie um segredo novo para o cofre. De onde ele vai sair?',
    medir: 'Encha a balança de acaso na mesa de jogos.',
    dados: 'A balança encheu. Leve o segredo ao cofre.',
    dados2: 'Algo nos dados ajudou o Falsário. Examine-os na bancada.',
    roda: 'Transforme o acaso em palavras na roda.',
    guardar: 'Guarde as 12 palavras. Escolha um lugar na parede do fundo.',
    fim: 'O cofre está seguro.'
  };
  var DICAS = {
    segredo: ['t1', 'O que sai da minha cabeça, outro adivinha. Há algo nesta sala que não escolhe?', 'mesa'],
    medir: ['t2', 'Cada lançamento dobra e redobra o trabalho dele. A balança precisa encher.', 'mesa'],
    dados: ['t3', 'Um dado que prefere um lado não é acaso. A bancada mostra.', 'bancada'],
    roda: ['t4', 'Palavra por palavra, na ordem em que a roda entregou.', 'roda'],
    guardar: ['t5', 'Quem guarda por mim pode abrir por mim. E a gaveta é onde todos procuram.', 'pedra']
  };

  // ---------- estado ----------
  function novoEstado() {
    return {
      v: 1, etapa: 'pistas', intro: false,
      pistas: { data: false, lema: false, nome: false },
      bits: 0, lances: 0, ultimo: null,
      viciado: ['m', 'o', 'e'][Math.floor(Math.random() * 3)],
      descartado: null, testados: {}, avisoDados: false,
      palavras: null, grupos: null, giradas: 0,
      erros: { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0 },
      feitas: [], inicio: Date.now(), fim: null
    };
  }
  var S = novoEstado();
  function salvar() { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) { /* sem armazenamento: segue sem salvar */ } }
  function carregar() {
    try {
      var t = localStorage.getItem(SAVE);
      if (!t) return false;
      var o = JSON.parse(t);
      if (!o || o.v !== 1 || !o.erros || !o.pistas) return false;
      S = o; return true;
    } catch (e) { return false; }
  }

  // ---------- utilidades ----------
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var toastT = null;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 3200);
  }
  function fmtGrande(n) {
    function um(x) { return (x < 10 ? Math.round(x * 10) / 10 : Math.round(x)).toString().replace('.', ','); }
    if (n < 1000) return um(n);
    if (n < 1e6) return um(n / 1e3) + ' mil';
    if (n < 1e9) return um(n / 1e6) + ' milhões de';
    if (n < 1e12) return um(n / 1e9) + ' bilhões de';
    if (n < 1e15) return um(n / 1e12) + ' trilhões de';
    return '10 elevado a ' + Math.floor(Math.log(n) / Math.LN10);
  }
  // tempo para testar todas as combinações, a um trilhão de tentativas por segundo
  function tempo(bits) {
    var s = Math.pow(2, Math.floor(bits)) / 1e12;
    if (s < 1) return 'menos de um segundo';
    if (s < 60) return Math.round(s) === 1 ? '1 segundo' : Math.round(s) + ' segundos';
    if (s < 3600) return Math.round(s / 60) + ' minutos';
    if (s < 86400) return Math.round(s / 3600) + ' horas';
    if (s < 31557600) return Math.round(s / 86400) + ' dias';
    var anos = s / 31557600;
    if (anos < 1.38e10) return fmtGrande(anos) + ' anos';
    return fmtGrande(anos / 1.38e10) + ' vezes a idade do universo';
  }
  function estrelas(t) { var e = S.erros[t]; return e === 0 ? 3 : (e === 1 ? 2 : 1); }
  function txtEstrelas(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }
  function concluir(t) { if (S.feitas.indexOf(t) < 0) S.feitas.push(t); }
  function erro(t) { S.erros[t]++; salvar(); atualizarHud(); }

  // ---------- SHA-256 (para a verificação da frase) ----------
  var K = [], H0 = [];
  (function () {
    function frac(x) { return ((x - Math.floor(x)) * 4294967296) | 0; }
    var n = 2, c = 0;
    while (c < 64) {
      var p = true;
      for (var i = 2; i * i <= n; i++) if (n % i === 0) { p = false; break; }
      if (p) { if (c < 8) H0[c] = frac(Math.pow(n, 1 / 2)); K[c] = frac(Math.pow(n, 1 / 3)); c++; }
      n++;
    }
  })();
  function sha256(bytes) {
    var l = bytes.length, total = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(total), i, j;
    m.set(bytes); m[l] = 0x80;
    var bl = l * 8; m[total - 4] = bl >>> 24; m[total - 3] = (bl >>> 16) & 255; m[total - 2] = (bl >>> 8) & 255; m[total - 1] = bl & 255;
    var h = H0.slice(), w = new Int32Array(64);
    function r(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (i = 0; i < total; i += 64) {
      for (j = 0; j < 16; j++) w[j] = (m[i + j * 4] << 24) | (m[i + j * 4 + 1] << 16) | (m[i + j * 4 + 2] << 8) | m[i + j * 4 + 3];
      for (j = 16; j < 64; j++) {
        var s0 = r(w[j - 15], 7) ^ r(w[j - 15], 18) ^ (w[j - 15] >>> 3), s1 = r(w[j - 2], 17) ^ r(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (j = 0; j < 64; j++) {
        var S1 = r(e, 6) ^ r(e, 11) ^ r(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K[j] + w[j]) | 0;
        var S0 = r(a, 2) ^ r(a, 13) ^ r(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    var out = new Uint8Array(32);
    for (i = 0; i < 8; i++) { out[i * 4] = h[i] >>> 24; out[i * 4 + 1] = (h[i] >>> 16) & 255; out[i * 4 + 2] = (h[i] >>> 8) & 255; out[i * 4 + 3] = h[i] & 255; }
    return out;
  }
  // 128 bits de entropia + 4 de verificação = 12 grupos de 11 bits (BIP-39)
  function frase(ent) {
    var bits = '', i;
    for (i = 0; i < ent.length; i++) bits += ('00000000' + ent[i].toString(2)).slice(-8);
    bits += ('00000000' + sha256(ent)[0].toString(2)).slice(-8).slice(0, ent.length / 4);
    var grupos = [], palavras = [];
    for (i = 0; i < bits.length; i += 11) { var g = bits.slice(i, i + 11); grupos.push(g); palavras.push(window.PALAVRAS[parseInt(g, 2)]); }
    return { grupos: grupos, palavras: palavras };
  }
  function gerarFrase() {
    var ent = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(ent);
    else for (var i = 0; i < 16; i++) ent[i] = Math.floor(Math.random() * 256);
    var f = frase(ent); S.palavras = f.palavras; S.grupos = f.grupos; S.giradas = 0;
  }

  // ---------- painel ----------
  var acoes = {};
  function abrir(html) { $('painel').innerHTML = html; $('veu').classList.add('on'); $('painel').scrollTop = 0; }
  function fechar() { $('veu').classList.remove('on'); }
  function aberto() { return $('veu').classList.contains('on') || $('cena').classList.contains('on'); }
  function bt(acao, txt, cls, extra) { return '<button class="bt ' + (cls || '') + '" data-a="' + acao + '" ' + (extra || '') + '>' + txt + '</button>'; }
  var FECHAR = bt('fechar', 'Fechar', 'fecha');
  function clique(ev) {
    var el = ev.target;
    while (el && el !== ev.currentTarget && !(el.getAttribute && el.getAttribute('data-a'))) el = el.parentNode;
    if (!el || el === ev.currentTarget || el.disabled) return;
    var a = el.getAttribute('data-a');
    if (acoes[a]) acoes[a](el.getAttribute('data-v'), el);
  }
  acoes.fechar = function () { fechar(); };

  // ---------- cena do Falsário ----------
  var cenaT = null;
  function cena(o) {
    var c = $('cena');
    c.innerHTML = '<div class="vulto"></div><h2>' + esc(o.titulo) + '</h2><div class="palp" id="cPalp"></div><div class="cont" id="cCont"></div><div id="cTxt"></div>';
    c.classList.add('on'); fechar();
    var i = 0, lista = o.palpites || [];
    clearInterval(cenaT);
    function fim() {
      clearInterval(cenaT);
      $('cPalp').textContent = lista.slice(-3).join('\n');
      $('cCont').textContent = o.cont || '';
      $('cTxt').innerHTML = o.texto.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + bt('cenaOk', esc(o.botao || 'Tentar de novo'), 'pri');
    }
    acoes.cenaOk = function () { c.classList.remove('on'); if (o.depois) o.depois(); };
    if (!lista.length) { fim(); return; }
    cenaT = setInterval(function () {
      i++;
      $('cPalp').textContent = lista.slice(Math.max(0, i - 3), i).join('\n');
      if (i >= lista.length) fim();
    }, 330);
  }

  // ---------- HUD e caderno ----------
  function objetivoAtual() { return OBJETIVOS[S.etapa === 'dados' && S.avisoDados ? 'dados2' : S.etapa]; }
  function dicaAtual() { var d = DICAS[S.etapa]; return d && S.erros[d[0]] >= 2 ? d : null; }
  function alvoBrilho() { var d = DICAS[S.etapa]; return d && S.erros[d[0]] >= 3 ? d[2] : null; }
  function atualizarHud() {
    $('objTxt').textContent = objetivoAtual();
    $('btnCad').classList.toggle('chama', !!dicaAtual());
  }
  function linhasHtml() {
    if (!S.feitas.length) return '<p class="nota">Nenhuma página escrita ainda.</p>';
    return '<ul class="cad">' + S.feitas.map(function (t) {
      return '<li><b>' + esc(TERMOS[t][0]) + '</b><br><span class="nota">' + esc(TERMOS[t][1]) + '</span> <span class="estrelas">' + txtEstrelas(estrelas(t)) + '</span></li>';
    }).join('') + '</ul>';
  }
  function pCaderno(confirma) {
    var d = dicaAtual();
    abrir('<h2>Caderno do aprendiz</h2><p><b>Agora:</b> ' + esc(objetivoAtual()) + '</p>' +
      (d ? '<div class="dica">' + esc(d[1]) + '</div>' : '') +
      '<p><b>Páginas escritas</b></p>' + linhasHtml() +
      '<p class="nota">Toque no chão para andar. Toque nos objetos para investigar.</p>' +
      (confirma ? bt('zerar', 'Apagar tudo e recomeçar', 'pri') : bt('pedirZerar', 'Recomeçar do zero')) + FECHAR);
  }
  acoes.pedirZerar = function () { pCaderno(true); };
  acoes.zerar = function () { S = novoEstado(); S.intro = true; salvar(); atualizarHud(); fechar(); posicionarInicio(); toast('Tudo de novo, do começo.'); };

  // ---------- tarefa 1: selo e segredo ----------
  var PISTAS = {
    data: ['12·3·1642', 'data de fundação, gravada sobre a porta'],
    lema: ['Palavra dada, conta fechada', 'lema da vila, no estandarte'],
    nome: ['Tomé', 'filho do Escrivão, no retrato']
  };
  function pSelo(msg) {
    var h = '<h2>Selo quebrado</h2><p>O selo do Escrivão validava cada página do Livro. Alguém descobriu o segredo que o protegia. Teste aqui as pistas que você anotar pela sala.</p>';
    ['data', 'lema', 'nome'].forEach(function (k) {
      h += S.pistas[k] ? bt('testar', 'Testar: ' + esc(PISTAS[k][0]) + '<br><span class="nota">' + esc(PISTAS[k][1]) + '</span>', '', 'data-v="' + k + '"')
        : bt('nada', '??? <span class="nota">pista ainda não encontrada</span>', '', 'disabled');
    });
    abrir(h + (msg ? '<p><b>' + esc(msg) + '</b></p>' : '') + FECHAR);
  }
  acoes.testar = function (k) {
    if (k !== 'data') { pSelo('O selo não se mexe com isso.'); return; }
    S.etapa = 'segredo'; salvar(); atualizarHud();
    abrir('<h2>O selo cede</h2><p>O segredo do Escrivão era a data de fundação da vila, gravada sobre a porta, à vista de todos.</p><p>Foi assim que o Falsário entrou e adulterou o Livro. Agora o cofre com a carteira herdada precisa de um segredo novo, antes que ele volte.</p>' + bt('fechar', 'Ir ao cofre', 'pri'));
  };
  function pCofreSegredo() {
    abrir('<h2>Cofre</h2><p>O cofre guarda a carteira herdada. Ele aceita o segredo que você escolher.</p>' +
      bt('humano', 'Minha data de nascimento', '', 'data-v="d"') + bt('humano', 'O nome de quem eu mais amo', '', 'data-v="n"') + bt('humano', 'O lema da vila com um número no fim', '', 'data-v="l"') +
      '<p class="nota">Ou feche e procure pela sala outra coisa de onde tirar um segredo.</p>' + FECHAR);
  }
  acoes.humano = function (v) {
    erro('t1');
    var lista = { d: ['12031642', '01011600', '25121615', '07091622', '...', 'sua data'], n: ['Tomé', 'Maria', 'José', 'Ana', '...', 'o nome'], l: ['PalavraDada1', 'PalavraDada7', 'ContaFechada12', '...', 'o lema + número'] }[v];
    cena({ titulo: 'O Falsário abriu o cofre', palpites: lista, cont: 'Aberto em poucas tentativas.', texto: ['Datas, nomes e lemas estão na lista de qualquer invasor. Ele testou os palpites óbvios primeiro, como fez com o Escrivão.'] });
  };

  // ---------- tarefa 2: mesa de jogos ----------
  function rolar(d) { return d === S.viciado && Math.random() < 0.55 ? 6 : 1 + Math.floor(Math.random() * 6); }
  function dadosAtivos() { return ['m', 'o', 'e'].filter(function (d) { return d !== S.descartado; }); }
  function pMesa() {
    var cheio = S.bits >= 128, b = Math.min(128, Math.floor(S.bits));
    var h = '<h2>Mesa de jogos</h2><p>Moedas e dados não escolhem nada. Cada moeda lançada soma 1 bit de acaso; cada dado, cerca de 2,6.</p>' +
      '<div class="medidor"><i style="width:' + (b / 128 * 100) + '%"></i></div><p><b>' + b + ' de 128 bits</b> na balança</p>';
    if (S.ultimo) {
      h += '<div class="lance">' + S.ultimo.m.map(function (x) { return x ? '●' : '○'; }).join(' ') + '</div><div>' +
        S.ultimo.d.map(function (x) { return '<span class="dado ' + x[0] + '">' + x[1] + '</span>'; }).join('') + '</div>';
    }
    if (!cheio) {
      h += bt('lancar', 'Lançar um punhado', 'pri');
      if (S.bits > 0) h += bt('cedo', 'Levar ao cofre assim mesmo');
    } else {
      h += '<p><b>Balança cheia.</b>' + (S.descartado ? '' : ' Curioso: um dos dados parece cair demais no mesmo número.') + '</p>';
    }
    abrir(h + FECHAR);
  }
  acoes.lancar = function () {
    var ds = dadosAtivos(), u = { m: [], d: [] }, i;
    for (i = 0; i < 4; i++) u.m.push(Math.random() < 0.5 ? 1 : 0);
    ds.forEach(function (d) { u.d.push([d, rolar(d)]); });
    S.ultimo = u; S.lances++; S.bits += 4 + ds.length * 2.585;
    if (S.bits >= 128) {
      concluir('t2');
      if (S.descartado) { concluir('t3'); S.etapa = 'roda'; toast('Balança cheia, com dados limpos. Página nova no caderno.'); }
      else { S.etapa = 'dados'; toast('Balança cheia. Página nova no caderno.'); }
    }
    salvar(); atualizarHud(); pMesa();
  };
  function ataqueCedo() {
    erro('t2');
    var b = Math.floor(S.bits);
    cena({ titulo: 'O Falsário abriu o cofre', palpites: ['0000…0001', '0000…0010', '0000…0011', '…', 'achou'], cont: b + ' bits: ' + tempo(b) + '.', texto: ['A um trilhão de tentativas por segundo, foi esse o tempo que ele levou para testar todas as combinações.', 'Cada bit a mais dobra o trabalho dele. A balança ainda não encheu.'] });
  }
  acoes.cedo = ataqueCedo;

  // ---------- tarefa 3: bancada ----------
  function pBancada(msg) {
    var h = '<h2>Bancada de teste</h2><p>Um dado honesto não tem preferência. Lance cada um muitas vezes e compare as colunas.</p>';
    dadosAtivos().forEach(function (d) {
      var c = S.testados[d];
      h += '<div class="cartao"><h3>' + NOMES[d] + '</h3>';
      if (c) {
        var mx = Math.max.apply(null, c);
        h += '<div class="hist">' + c.map(function (n, i) { return '<div style="height:' + Math.max(3, n / mx * 100) + '%"><span>' + (i + 1) + '</span></div>'; }).join('') + '</div>';
      }
      h += '<div class="linha2">' + bt('testarDado', c ? 'Lançar de novo' : 'Lançar 60 vezes', 'pri', 'data-v="' + d + '"') + bt('descartar', 'Descartar', '', 'data-v="' + d + '"') + '</div></div>';
    });
    abrir(h + (msg ? '<p><b>' + esc(msg) + '</b></p>' : '') + FECHAR);
  }
  acoes.testarDado = function (d) {
    var c = [0, 0, 0, 0, 0, 0];
    for (var i = 0; i < 60; i++) c[rolar(d) - 1]++;
    S.testados[d] = c; salvar(); pBancada();
  };
  acoes.descartar = function (d) {
    if (d !== S.viciado) { pBancada(NOMES[d] + ' rolava direito. O viciado continua na mesa.'); return; }
    S.descartado = d;
    if (S.etapa === 'dados') {
      concluir('t3'); S.etapa = 'roda'; S.bits = 128; salvar(); atualizarHud();
      abrir('<h2>Era esse</h2><p>O ' + NOMES[d].toLowerCase() + ' caía no 6 em mais da metade das vezes. Você o tira da mesa e relança o que faltava com os dados limpos.</p><p>A balança volta a marcar 128 bits, agora de acaso de verdade.</p>' + bt('fechar', 'Ir à roda de palavras', 'pri'));
    } else {
      S.bits = 0; S.ultimo = null; salvar(); atualizarHud();
      abrir('<h2>Era esse</h2><p>O ' + NOMES[d].toLowerCase() + ' caía no 6 em mais da metade das vezes. Você o tira da mesa antes que ele estrague o segredo.</p><p>A contagem da balança recomeça, só com dados limpos.</p>' + bt('fechar', 'Voltar à mesa de jogos', 'pri'));
    }
  };
  function ataqueViciado() {
    erro('t3'); S.avisoDados = true; salvar(); atualizarHud();
    cena({ titulo: 'O Falsário abriu o cofre', palpites: ['6 6 3 6', '6 1 6 6', '6 6 6 2', '…', 'achou'], cont: 'A balança marcava 128 bits.', texto: ['Mas um dos dados caía no mesmo número em mais da metade dos lançamentos, e o Falsário contou com isso para cortar caminho.', 'Acaso que tem preferência vale menos do que parece.'] });
  }

  // ---------- tarefa 4: roda de palavras ----------
  var copia = [], ordemChips = [];
  var AVISO = '<div class="aviso">Frase de demonstração, criada dentro de um jogo. Nunca use estas palavras numa carteira de verdade.</div>';
  function pRoda() {
    if (!S.palavras) { gerarFrase(); salvar(); }
    var h = '<h2>Roda de palavras</h2><p>Cada volta lê 11 bits da balança e entrega uma palavra, de uma lista de 2.048.</p><div class="roda">';
    for (var i = 0; i < S.giradas; i++) h += '<div><span class="n">' + (i + 1) + '</span>' + esc(S.palavras[i]) + '<div class="bits">' + S.grupos[i] + '</div></div>';
    h += '</div>';
    if (S.giradas < 12) {
      h += bt('girar', 'Girar a roda', 'pri');
      if (S.giradas >= 3) h += bt('girarTudo', 'Girar até o fim');
    } else {
      h += '<p>Os 4 últimos bits da 12ª palavra são uma verificação: se algo for trocado, ela denuncia.</p>' + bt('copiar', 'Copiar no caderno, de memória', 'pri');
    }
    abrir(h + AVISO + FECHAR);
  }
  acoes.girar = function () { S.giradas++; salvar(); pRoda(); };
  acoes.girarTudo = function () { S.giradas = 12; salvar(); pRoda(); };
  acoes.copiar = function () {
    copia = []; ordemChips = S.palavras.slice();
    for (var i = ordemChips.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = ordemChips[i]; ordemChips[i] = ordemChips[j]; ordemChips[j] = t; }
    pCopia();
  };
  function pCopia(msg) {
    var h = '<h2>Copiar no caderno</h2><p>Toque nas palavras na ordem em que a roda entregou.</p><div class="roda">';
    for (var i = 0; i < 12; i++) h += '<div><span class="n">' + (i + 1) + '</span>' + (copia[i] ? esc(copia[i]) : '·····') + '</div>';
    h += '</div><div class="chips">';
    ordemChips.forEach(function (p, i) { h += '<span class="chip' + (copia.indexOf(p) >= 0 ? ' usado' : '') + '" data-a="chip" data-v="' + i + '">' + esc(p) + '</span>'; });
    abrir(h + '</div>' + (msg ? '<p><b>' + esc(msg) + '</b></p>' : '') + bt('verRoda', 'Ver a roda de novo') + FECHAR);
  }
  acoes.verRoda = function () { pRoda(); };
  acoes.chip = function (v) {
    var p = ordemChips[+v];
    if (copia.indexOf(p) >= 0) return;
    if (p !== S.palavras[copia.length]) {
      erro('t4'); copia = [];
      pCopia('O cofre recusa. A verificação da última palavra não fecha: a ordem faz parte do segredo. Recomece.');
      return;
    }
    copia.push(p);
    if (copia.length < 12) { pCopia(); return; }
    concluir('t4'); S.etapa = 'guardar'; salvar(); atualizarHud();
    abrir('<h2>As 12 palavras</h2><p>O cofre aceita. Estas palavras, nesta ordem, são o segredo inteiro: quem as tiver abre a carteira.</p><p>Falta decidir onde elas vão ficar.</p>' + AVISO + bt('fechar', 'Ir à parede do fundo', 'pri'));
  };

  // ---------- tarefa 5: guardar ----------
  function guardar(onde) {
    if (onde === 'guarda') {
      erro('t5');
      cena({ titulo: 'O Falsário levou a cópia', palpites: ['…uma bolsa de moedas muda de mão…'], cont: 'Nenhum palpite foi necessário.', texto: ['A Casa de Guarda prometeu cuidar de tudo. O Falsário não adivinhou nada: pagou ao guarda.', 'Quem guarda por você pode abrir por você.'] });
    } else if (onde === 'gaveta') {
      erro('t5');
      cena({ titulo: 'O Falsário achou o papel', palpites: ['…gavetas reviradas…'], cont: 'Foi o primeiro lugar em que ele olhou.', texto: ['Um papel na gaveta está guardado só de quem não procura.'] });
    } else {
      concluir('t5'); S.etapa = 'fim'; S.fim = Date.now(); salvar(); atualizarHud();
      cena({
        titulo: 'O Falsário desistiu', palpites: ['0000…0001', '0000…0010', '0000…0011', '…', '…', '…'], cont: '128 bits: ' + tempo(128) + '.',
        texto: ['As palavras estão gravadas em metal, atrás de uma pedra que só você conhece. Nenhuma rede, nenhum guarda.', 'A um trilhão de tentativas por segundo, adivinhar levaria esse tempo.'], botao: 'Abrir o caderno', depois: pFinal
      });
    }
  }
  function pFinal() {
    var tot = 0; ['t1', 't2', 't3', 't4', 't5'].forEach(function (t) { tot += estrelas(t); });
    var min = Math.max(1, Math.round(((S.fim || Date.now()) - S.inicio) / 60000));
    abrir('<h2>Capítulo 1 concluído</h2><p class="estrelas">' + tot + ' de 15 ★</p><p class="nota">Tempo: cerca de ' + min + ' min.</p>' + linhasHtml() +
      '<p><b>A chave está segura. Mas a vila continua parada.</b> Sem o selo do Escrivão, como provar que uma ordem de pagamento é sua, sem mostrar o segredo a ninguém?</p>' +
      '<p class="nota">Capítulo 2, O Selo: em construção. O apelido no ranking e o aviso de novos capítulos chegam numa próxima versão.</p>' + AVISO +
      bt('zerar', 'Jogar de novo', 'pri') + FECHAR);
  }

  // ---------- uso dos objetos ----------
  function usar(id) {
    var e = S.etapa;
    if (id === 'porta' || id === 'estandarte' || id === 'retrato') {
      var k = { porta: 'data', estandarte: 'lema', retrato: 'nome' }[id];
      var novo = !S.pistas[k]; S.pistas[k] = true; salvar();
      toast((novo ? 'Pista anotada: ' : '') + PISTAS[k][0] + ' — ' + PISTAS[k][1] + '.');
    } else if (id === 'selo') {
      if (e === 'pistas') pSelo(); else toast('O selo quebrado. O segredo dele era uma data à vista de todos.');
    } else if (id === 'cofre') {
      if (e === 'pistas') toast('Trancado. Antes, preciso entender como o selo foi aberto.');
      else if (e === 'segredo') pCofreSegredo();
      else if (e === 'medir') { if (S.bits > 0) ataqueCedo(); else toast('O cofre espera um segredo. A balança ainda está vazia.'); }
      else if (e === 'dados') ataqueViciado();
      else if (e === 'roda') toast('O cofre espera as palavras da roda.');
      else toast('O cofre está fechado com as 12 palavras.');
    } else if (id === 'mesa') {
      if (e === 'pistas') toast('Moedas e dados do Escrivão. Ainda não sei para que servem.');
      else if (e === 'segredo') { concluir('t1'); S.etapa = 'medir'; salvar(); atualizarHud(); pMesa(); }
      else if (e === 'medir' || e === 'dados') pMesa();
      else toast('A balança marca 128 bits de acaso.');
    } else if (id === 'bancada') {
      if (e === 'medir' || e === 'dados') { if (S.descartado) toast('O dado viciado já saiu da mesa.'); else pBancada(); }
      else if (e === 'pistas' || e === 'segredo') toast('Uma bancada com réguas de contagem. Serve para testar alguma coisa.');
      else toast('Os dados que ficaram são honestos.');
    } else if (id === 'roda') {
      if (e === 'roda') pRoda();
      else if (e === 'guardar' || e === 'fim') toast('A roda já entregou as 12 palavras.');
      else toast('Uma roda com milhares de palavras. Ela espera um segredo pronto.');
    } else if (id === 'guarda' || id === 'gaveta' || id === 'pedra') {
      if (e === 'guardar') guardar(id);
      else if (e === 'fim') toast(id === 'pedra' ? 'A placa de metal está atrás da pedra.' : 'Vazio.');
      else toast({ guarda: 'Guichê da Casa de Guarda: “cuidamos de tudo por você”.', gaveta: 'Uma gaveta comum.', pedra: 'Uma pedra solta na parede.' }[id]);
    }
  }

  // ---------- mundo 3D ----------
  var THREE = window.THREE, renderer, scene, camera, heroi, chao, vulto, rodaMesh;
  var alvo = null, pendente = null, interativos = [], clicaveis = [];
  var LX = 1.6, ZMIN = -13.7, ZMAX = 1.2;
  function mat(c) { return new THREE.MeshLambertMaterial({ color: c }); }
  function bx(w, h, d, c, x, y, z, pai) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z); (pai || scene).add(m); return m;
  }
  function interativo(id, rotulo, grupo, ax, az, ly) {
    grupo.userData.id = id; scene.add(grupo); clicaveis.push(grupo);
    var el = document.createElement('div'); el.className = 'lbl'; el.textContent = rotulo; $('labels').appendChild(el);
    interativos.push({ id: id, g: grupo, ax: ax, az: az, el: el, ly: ly });
  }
  function montar() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x120d16); scene.fog = new THREE.Fog(0x120d16, 14, 30);
    camera = new THREE.PerspectiveCamera(55, 1, 0.1, 60);
    scene.add(new THREE.AmbientLight(0xffe7c4, 0.72));
    var sol = new THREE.DirectionalLight(0xfff0d0, 0.75); sol.position.set(3, 9, 5); scene.add(sol);
    var vela = new THREE.PointLight(0xf08a24, 0.7, 14); vela.position.set(0, 3.2, -6); scene.add(vela);
    // chão e paredes
    chao = bx(6.4, 0.2, 17, 0x8a6a45, 0, -0.1, -6.5);
    for (var i = 0; i < 9; i++) bx(6.4, 0.02, 0.06, 0x6f5335, 0, 0.011, 1.5 - i * 2);
    bx(0.3, 5, 17, 0x5d4a57, -3.35, 2.5, -6.5); bx(0.3, 5, 17, 0x5d4a57, 3.35, 2.5, -6.5);
    bx(7, 5, 0.3, 0x6a5563, 0, 2.5, -15.15);
    // janela com o vulto
    bx(2.2, 1.7, 0.1, 0x25304a, 0, 3.4, -14.98); bx(2.4, 0.12, 0.16, 0x3b2a1c, 0, 4.3, -14.95); bx(2.4, 0.12, 0.16, 0x3b2a1c, 0, 2.5, -14.95);
    vulto = new THREE.Group();
    bx(0.8, 1.1, 0.05, 0x07050a, 0, 0, 0, vulto); bx(0.5, 0.5, 0.05, 0x07050a, 0, 0.75, 0, vulto);
    bx(0.09, 0.05, 0.03, 0xf08a24, -0.11, 0.78, 0.04, vulto); bx(0.09, 0.05, 0.03, 0xf08a24, 0.11, 0.78, 0.04, vulto);
    vulto.position.set(0, 3.0, -14.9); scene.add(vulto);
    var g;
    // porta (pista: data)
    g = new THREE.Group(); bx(0.12, 2.6, 1.5, 0x4a2f1b, 0, 1.3, 0, g); bx(0.14, 0.5, 1.9, 0xd9a441, 0.02, 2.95, 0, g); bx(0.1, 0.12, 0.12, 0xd9a441, 0.1, 1.3, 0.5, g);
    g.position.set(-3.15, 0, -1.5); interativo('porta', 'Porta', g, -LX, -1.5, 3.4);
    // estandarte (pista: lema)
    g = new THREE.Group(); bx(0.08, 1.9, 1.2, 0xa23b2a, 0, 2.3, 0, g); bx(0.1, 0.1, 1.4, 0xd9a441, 0, 3.3, 0, g); bx(0.09, 0.25, 0.7, 0xf1e4c6, -0.02, 2.4, 0, g);
    g.position.set(3.15, 0, -2.2); interativo('estandarte', 'Estandarte', g, LX, -2.2, 3.6);
    // retrato (pista: nome)
    g = new THREE.Group(); bx(0.1, 1.2, 1.0, 0xd9a441, 0, 2.3, 0, g); bx(0.11, 0.95, 0.75, 0x33414f, -0.02, 2.3, 0, g); bx(0.12, 0.35, 0.3, 0xe3b48f, -0.04, 2.4, 0, g);
    g.position.set(3.15, 0, -4.6); interativo('retrato', 'Retrato', g, LX, -4.6, 3.1);
    // escrivaninha com selo e cofre
    bx(1.2, 0.9, 3.0, 0x5b3a22, -2.55, 0.45, -5.2); bx(1.3, 0.1, 3.1, 0x74492b, -2.55, 0.95, -5.2);
    g = new THREE.Group(); bx(0.5, 0.14, 0.5, 0xb5432f, 0, 0, -0.14, g); bx(0.5, 0.14, 0.5, 0xb5432f, 0.06, 0, 0.42, g).rotation.y = 0.5;
    g.position.set(-2.5, 1.08, -6.0); interativo('selo', 'Selo quebrado', g, -LX, -6.0, 1.7);
    g = new THREE.Group(); bx(0.8, 0.8, 0.8, 0x3d4650, 0, 0.4, 0, g); bx(0.1, 0.25, 0.25, 0xd9a441, 0.42, 0.4, 0, g);
    g.position.set(-2.55, 1.0, -4.4); interativo('cofre', 'Cofre', g, -LX, -4.4, 2.3);
    // mesa de jogos
    g = new THREE.Group(); bx(1.2, 0.12, 1.7, 0x2f6b4a, 0, 0.85, 0, g); bx(1.0, 0.8, 1.4, 0x5b3a22, 0, 0.4, 0, g);
    bx(0.22, 0.22, 0.22, 0xfffdf5, -0.2, 1.03, -0.4, g); bx(0.22, 0.22, 0.22, 0xe9dcc0, 0.1, 1.03, 0, g); bx(0.22, 0.22, 0.22, 0x3a2f3f, -0.25, 1.03, 0.35, g);
    bx(0.3, 0.04, 0.3, 0xd9a441, 0.25, 0.94, 0.5, g);
    g.position.set(2.55, 0, -7.2); interativo('mesa', 'Mesa de jogos', g, LX, -7.2, 1.9);
    // bancada
    g = new THREE.Group(); bx(1.1, 0.9, 2.2, 0x6b5a48, 0, 0.45, 0, g);
    for (i = 0; i < 6; i++) bx(0.14, 0.2 + (i % 3) * 0.18, 0.14, 0x2a1f14, -0.2, 1.0 + (i % 3) * 0.09, -0.75 + i * 0.3, g);
    g.position.set(-2.6, 0, -9.6); interativo('bancada', 'Bancada', g, -LX, -9.6, 2.0);
    // roda de palavras
    g = new THREE.Group(); bx(0.5, 1.1, 0.5, 0x5b3a22, 0, 0.55, 0, g);
    rodaMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.3, 12), mat(0xf1e4c6)); rodaMesh.rotation.z = Math.PI / 2; rodaMesh.position.set(-0.15, 1.75, 0); g.add(rodaMesh);
    bx(0.34, 0.25, 0.25, 0xd9a441, -0.15, 1.75, 0, g);
    g.position.set(2.7, 0, -11.2); interativo('roda', 'Roda de palavras', g, LX, -11.2, 3.0);
    // parede do fundo: três destinos
    g = new THREE.Group(); bx(1.3, 1.5, 0.3, 0x3b2a1c, 0, 1.25, 0, g); bx(1.0, 0.7, 0.1, 0x161019, 0, 1.45, 0.16, g); bx(1.4, 0.2, 0.5, 0xd9a441, 0, 0.9, 0.12, g);
    g.position.set(-2.1, 0, -14.85); interativo('guarda', 'Casa de Guarda', g, -1.5, -13.6, 2.4);
    g = new THREE.Group(); bx(1.1, 0.9, 0.7, 0x74492b, 0, 0.45, 0, g); bx(0.9, 0.25, 0.08, 0x5b3a22, 0, 0.6, 0.38, g); bx(0.16, 0.08, 0.08, 0xd9a441, 0, 0.6, 0.44, g);
    g.position.set(0, 0, -14.6); interativo('gaveta', 'Gaveta', g, 0, -13.6, 1.4);
    g = new THREE.Group(); bx(0.75, 0.5, 0.12, 0x8d7a86, 0, 0.75, 0, g);
    g.position.set(2.1, 0, -15.0); interativo('pedra', 'Pedra solta', g, 1.5, -13.6, 1.5);
    // aprendiz
    heroi = new THREE.Group();
    bx(0.55, 0.75, 0.38, 0x2f6f8f, 0, 0.95, 0, heroi); bx(0.4, 0.4, 0.4, 0xe3b48f, 0, 1.55, 0, heroi); bx(0.44, 0.16, 0.44, 0x6b3b1e, 0, 1.8, 0, heroi);
    heroi.userData.pe = [bx(0.2, 0.55, 0.24, 0x3b2a1c, -0.15, 0.28, 0, heroi), bx(0.2, 0.55, 0.24, 0x3b2a1c, 0.15, 0.28, 0, heroi)];
    bx(0.3, 0.36, 0.12, 0xd9a441, 0, 0.95, -0.25, heroi);
    scene.add(heroi);
  }
  function posicionarInicio() { heroi.position.set(0, 0, 0.6); heroi.rotation.y = Math.PI; alvo = null; pendente = null; }
  function redimensionar() {
    var w = window.innerWidth, h = window.innerHeight, k = 2.2;
    renderer.setSize(Math.max(1, Math.ceil(w / k)), Math.max(1, Math.ceil(h / k)), false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  var raio, pd = null;
  function toque(x, y) {
    if (aberto()) return;
    var v = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raio.setFromCamera(v, camera);
    var hit = raio.intersectObjects(clicaveis, true);
    if (hit.length) {
      var o = hit[0].object; while (o && !o.userData.id) o = o.parent;
      for (var i = 0; i < interativos.length; i++) if (interativos[i].id === o.userData.id) { alvo = { x: interativos[i].ax, z: interativos[i].az }; pendente = interativos[i].id; return; }
    }
    hit = raio.intersectObject(chao, false);
    if (hit.length) { alvo = { x: Math.max(-LX, Math.min(LX, hit[0].point.x)), z: Math.max(ZMIN, Math.min(ZMAX, hit[0].point.z)) }; pendente = null; }
  }
  var tAnt = 0, pv = null;
  function quadro(t) {
    requestAnimationFrame(quadro);
    var dt = Math.min(0.05, (t - tAnt) / 1000 || 0); tAnt = t;
    var andando = false;
    if (alvo && !aberto()) {
      var dx = alvo.x - heroi.position.x, dz = alvo.z - heroi.position.z, d = Math.sqrt(dx * dx + dz * dz), passo = 4.6 * dt;
      if (d <= Math.max(passo, 0.05)) {
        heroi.position.x = alvo.x; heroi.position.z = alvo.z; alvo = null;
        if (pendente) {
          var id = pendente; pendente = null;
          for (var i = 0; i < interativos.length; i++) if (interativos[i].id === id) heroi.rotation.y = Math.atan2(interativos[i].g.position.x - heroi.position.x, interativos[i].g.position.z - heroi.position.z);
          usar(id);
        }
      } else { heroi.position.x += dx / d * passo; heroi.position.z += dz / d * passo; heroi.rotation.y = Math.atan2(dx, dz); andando = true; }
    }
    var f = andando ? Math.sin(t / 70) * 0.5 : 0;
    heroi.userData.pe[0].rotation.x = f; heroi.userData.pe[1].rotation.x = -f;
    vulto.position.y = 3.0 + Math.sin(t / 900) * 0.08;
    vulto.visible = S.etapa !== 'fim';
    if (S.etapa === 'roda') rodaMesh.rotation.x += dt * 0.8;
    var cx = heroi.position.x * 0.7, cz = heroi.position.z;
    camera.position.set(cx, 8.6, cz + 7.4); camera.lookAt(cx, 1.0, cz - 2.6);
    renderer.render(scene, camera);
    // rótulos
    var brilho = alvoBrilho(), w = window.innerWidth, h = window.innerHeight;
    if (!pv) pv = new THREE.Vector3();
    for (var j = 0; j < interativos.length; j++) {
      var it = interativos[j];
      pv.set(it.g.position.x * 0.9, it.ly, it.g.position.z).project(camera);
      var perto = Math.abs(it.g.position.z - heroi.position.z + 2.5) < 6.5 && pv.z < 1 && Math.abs(pv.x) < 1.05 && Math.abs(pv.y) < 1.05;
      it.el.style.display = perto ? 'block' : 'none';
      if (perto) { it.el.style.left = ((pv.x + 1) / 2 * w) + 'px'; it.el.style.top = ((1 - pv.y) / 2 * h) + 'px'; }
      it.el.classList.toggle('glow', it.id === brilho);
    }
  }

  // ---------- início ----------
  function intro() {
    abrir('<h2>O Gabinete do Escrivão</h2><p>A Vila do Livro acordou com o Livro-Razão adulterado. O Escrivão, único guardião das contas de todos, sumiu.</p>' +
      '<p>Você, aprendiz, herdou uma carteira trancada e um caderno inacabado. O gabinete revirado é o primeiro lugar a investigar. Alguém observa da janela.</p>' +
      '<p class="nota">Toque no chão para andar. Toque nos objetos para investigar. Protótipo do capítulo 1.</p>' + bt('comecar', 'Entrar no gabinete', 'pri'));
  }
  acoes.comecar = function () { S.intro = true; S.inicio = Date.now(); salvar(); fechar(); };
  function iniciar() {
    if (!THREE || !window.PALAVRAS) { $('semgl').style.display = 'flex'; return; }
    try { renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: false }); } catch (e) { $('semgl').style.display = 'flex'; return; }
    renderer.setPixelRatio(1);
    raio = new THREE.Raycaster();
    montar(); posicionarInicio(); redimensionar();
    window.addEventListener('resize', redimensionar);
    var cv = $('c');
    cv.addEventListener('pointerdown', function (e) { pd = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener('pointerup', function (e) { if (pd && Math.abs(e.clientX - pd.x) + Math.abs(e.clientY - pd.y) < 24) toque(e.clientX, e.clientY); pd = null; });
    $('painel').addEventListener('click', clique); $('cena').addEventListener('click', clique);
    $('btnCad').addEventListener('click', function () { if (!$('cena').classList.contains('on')) pCaderno(); });
    var tinha = carregar();
    atualizarHud();
    if (!tinha || !S.intro) intro(); else if (S.etapa === 'fim') pFinal(); else toast('Progresso retomado.');
    requestAnimationFrame(quadro);
  }
  window.__jogo = { estado: function () { return S; }, usar: usar, acoes: acoes, sha256: sha256, frase: frase, tempo: tempo, ir: function (id) { for (var i = 0; i < interativos.length; i++) if (interativos[i].id === id) { heroi.position.x = interativos[i].ax; heroi.position.z = interativos[i].az; } } };
  if (typeof document !== 'undefined' && document.getElementById) iniciar();
})();
