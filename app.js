// motor da cápsula — parte do "motor" do site, não precisa mexer aqui nunca
// (a ÚNICA exceção é a linha RESPOSTAS_URL logo abaixo, que se configura uma vez só).
// quem edita o conteúdo do dia a dia é o arquivo MENSAGEM-DA-SEMANA.txt
// (e, se quiser áudio, um arquivo audio.mp3).
(function(){
  "use strict";

  // ATENÇÃO — configuração de UMA VEZ SÓ (não é o arquivo que você edita toda semana):
  // depois de criar o "Apps Script" que guarda as respostas dela (passo do LEIA-ME.txt),
  // cola a URL dele aqui no lugar do texto entre aspas. Enquanto estiver assim, com
  // "COLE_AQUI...", as perguntas funcionam normalmente na tela, só não salvam em lugar
  // nenhum (então nada quebra se você ainda não configurou isso).
  var RESPOSTAS_URL = "https://script.google.com/macros/s/AKfycbyifaxrX30thKXoWR7VdQx87nBDrND0vSo-vELmPl9en4GhyUP59CPDzt8peU0BNksJ/exec";

  function $(sel, root){ return (root||document).querySelector(sel); }
  function el(tag, cls, html){
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s){
    return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function fmtTime(sec){
    if (!isFinite(sec)) return "0:00";
    var m = Math.floor(sec/60), s = Math.floor(sec%60);
    return m + ":" + (s<10?"0":"") + s;
  }

  // formato do MENSAGEM-DA-SEMANA.txt: linhas "CHAVE: valor". linhas em branco ou
  // começando com # são ignoradas. só a primeira ":" da linha conta como separador,
  // então o texto da mensagem (ou de uma pergunta) pode ter ":" à vontade.
  var CHAVES = ["NOME","MENSAGEM","AUDIO",
    "PERGUNTA1","OPCOES1","PERGUNTA2","OPCOES2","PERGUNTA3","OPCOES3","PERGUNTA4","OPCOES4"];

  function parseContent(text){
    var data = { NOME:"", MENSAGEM:"", AUDIO:"nao" };
    CHAVES.forEach(function(k){ if (!(k in data)) data[k] = ""; });
    String(text||"").split(/\r?\n/).forEach(function(line){
      var t = line.trim();
      if (!t || t.charAt(0) === "#") return;
      var idx = t.indexOf(":");
      if (idx === -1) return;
      var key = t.slice(0, idx).trim().toUpperCase();
      var val = t.slice(idx + 1).trim();
      if (CHAVES.indexOf(key) !== -1) data[key] = val;
    });
    data.MENSAGEM = data.MENSAGEM.replace(/\\n/g, "\n");
    return data;
  }

  // monta a lista de perguntas da semana a partir de PERGUNTA1..4 / OPCOES1..4.
  // pergunta em branco = aquele número não é usado nesta semana.
  // opções em branco = pergunta de resposta livre (texto).
  function buildQuestions(d){
    var qs = [];
    for (var i=1;i<=4;i++){
      var text = (d["PERGUNTA"+i] || "").trim();
      if (!text) continue;
      var optsRaw = (d["OPCOES"+i] || "").trim();
      var options = null;
      if (optsRaw){
        options = optsRaw.split(",").map(function(s){ return s.trim(); }).filter(Boolean);
        if (!options.length) options = null;
      }
      qs.push({ text: text, options: options });
    }
    return qs;
  }

  // envia uma resposta pro "Apps Script" (que guarda numa planilha só sua).
  // sempre "dispara e esquece": não trava a experiência dela esperando confirmação,
  // e se RESPOSTAS_URL ainda não foi configurada, simplesmente não faz nada.
  function sendAnswer(pergunta, resposta){
    if (!RESPOSTAS_URL || RESPOSTAS_URL.indexOf("COLE_AQUI") !== -1) return;
    try{
      fetch(RESPOSTAS_URL, {
        method: "POST",
        body: JSON.stringify({ pergunta: pergunta, resposta: resposta })
      }).catch(function(){});
    }catch(e){}
  }

  var state = { herName:"", message:"Toque para abrir sua mensagem.", hasAudio:false, questions:[] };
  var currentScreen = null;

  var app = document.getElementById("app");
  var audioEl = document.createElement("audio");
  audioEl.preload = "none";
  audioEl.playsInline = true;
  document.body.appendChild(audioEl);
  var audioBound = false;

  function stage(children){
    var s = el("div","stage");
    var c = el("div","capsule");
    (children||[]).forEach(function(ch){ if (ch) c.appendChild(ch); });
    s.appendChild(c);
    return {stage:s, capsule:c};
  }

  function renderCover(){
    currentScreen = "cover";
    app.innerHTML = "";
    var eyebrow = el("div","eyebrow");
    eyebrow.innerHTML = '<span class="dot"></span>' + (state.herName ? esc(state.herName) : "uma coisa pequena");
    var seal = el("button","seal-btn");
    seal.setAttribute("aria-label","Abrir");
    seal.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#16121f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3 3 7 6.5 7 10.5A7 7 0 0 1 5 13.5C5 9.5 9 6 12 3Z"/></svg>';
    var title = el("div","cover-title serif","toque para abrir");
    var hint = el("div","cover-hint","toque na tela");

    var built = stage([]);
    var s = built.stage, c = built.capsule;
    c.classList.add("cover-wrap");
    c.appendChild(eyebrow); c.appendChild(seal); c.appendChild(title); c.appendChild(hint);
    app.appendChild(s);

    seal.addEventListener("click", function(){
      c.classList.add("sealing");
      setTimeout(renderMessage, 220);
    });
  }

  function buildAudioCard(){
    var card = el("div","audio-card");
    var playBtn = el("button","play-btn");
    playBtn.setAttribute("aria-label","reproduzir áudio");
    var iconPlay = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    var iconPause = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
    playBtn.innerHTML = audioEl.paused ? iconPlay : iconPause;

    var track = el("div","track");
    var bar = el("div","bar");
    var fill = el("div","bar-fill");
    bar.appendChild(fill);
    var timeRow = el("div","time-row");
    var cur = el("span","", "0:00");
    var dur = el("span","", "0:00");
    timeRow.appendChild(cur); timeRow.appendChild(dur);
    track.appendChild(bar); track.appendChild(timeRow);

    card.appendChild(playBtn); card.appendChild(track);

    if (!audioBound){
      audioEl.addEventListener("timeupdate", function(){
        var d = audioEl.duration || 0;
        var pct = d ? (audioEl.currentTime/d)*100 : 0;
        var f = $(".audio-card .bar-fill");
        if (f) f.style.width = pct + "%";
        var c1 = $(".audio-card .time-row span:first-child");
        var c2 = $(".audio-card .time-row span:last-child");
        if (c1) c1.textContent = fmtTime(audioEl.currentTime);
        if (c2) c2.textContent = fmtTime(d);
      });
      audioEl.addEventListener("play", function(){
        var b = $(".audio-card .play-btn"); if (b) b.innerHTML = iconPause;
      });
      audioEl.addEventListener("pause", function(){
        var b = $(".audio-card .play-btn"); if (b) b.innerHTML = iconPlay;
      });
      audioBound = true;
    }
    playBtn.addEventListener("click", function(){
      if (audioEl.paused){ var p = audioEl.play(); if (p && p.catch) p.catch(function(){}); }
      else audioEl.pause();
    });
    bar.addEventListener("click", function(evt){
      var rect = bar.getBoundingClientRect();
      var ratio = (evt.clientX - rect.left) / rect.width;
      if (audioEl.duration) audioEl.currentTime = ratio * audioEl.duration;
    });
    return card;
  }

  function renderMessage(){
    currentScreen = "message";
    app.innerHTML = "";
    var built = stage([]);
    var s = built.stage, c = built.capsule;
    var eyebrow = el("div","eyebrow"); eyebrow.innerHTML = '<span class="dot"></span>mensagem desta semana';
    c.appendChild(eyebrow);

    var p = el("p","msg-text");
    var words = String(state.message || "").split(/(\s+)/);
    var wi = 0;
    words.forEach(function(w){
      if (!w.trim()){
        if (w.indexOf("\n") !== -1) p.appendChild(document.createElement("br"));
        else p.appendChild(document.createTextNode(w));
        return;
      }
      var span = el("span","w", esc(w));
      span.style.animationDelay = Math.min(wi*22, 900) + "ms";
      p.appendChild(span);
      wi++;
    });
    c.appendChild(p);

    // o áudio (quando tem) fica reservado pra última tela — aqui só decide
    // qual botão leva pra lá: "responder" (quando tem pergunta) ou "continuar"
    // (quando não tem pergunta mas tem áudio).
    if (state.questions && state.questions.length){
      var askWrap = el("div","ask-prompt");
      var askText = el("div","ask-text","tenho uma perguntinha pra você essa semana");
      var askBtn = el("button","btn btn-primary btn-block","responder");
      askBtn.addEventListener("click", function(){ renderQuestion(0); });
      askWrap.appendChild(askText);
      askWrap.appendChild(askBtn);
      c.appendChild(askWrap);
    } else if (state.hasAudio){
      var contWrap = el("div","ask-prompt");
      var contText = el("div","ask-text","gravei uma coisa pra você essa semana");
      var contBtn = el("button","btn btn-primary btn-block","ouvir");
      contBtn.addEventListener("click", function(){ renderThanks(); });
      contWrap.appendChild(contText);
      contWrap.appendChild(contBtn);
      c.appendChild(contWrap);
    }

    app.appendChild(s);
  }

  function dotsRow(activeIdx){
    var row = el("div","q-progress");
    state.questions.forEach(function(_, i){
      row.appendChild(el("span","q-dot" + (i===activeIdx ? " active":"")));
    });
    return row;
  }

  function renderQuestion(idx){
    currentScreen = "question";
    app.innerHTML = "";
    var built = stage([]);
    var s = built.stage, c = built.capsule;
    var q = state.questions[idx];
    var isLast = idx === state.questions.length - 1;

    var eyebrow = el("div","eyebrow");
    eyebrow.innerHTML = '<span class="dot"></span>pergunta ' + (idx+1) + ' de ' + state.questions.length;
    c.appendChild(eyebrow);

    var qText = el("p","msg-text q-text", esc(q.text));
    c.appendChild(qText);

    if (q.options){
      var wrap = el("div","q-options");
      q.options.forEach(function(opt){
        var b = el("button","opt-btn", esc(opt));
        b.addEventListener("click", function(){
          if (wrap.classList.contains("answered")) return;
          wrap.classList.add("answered");
          b.classList.add("selected");
          sendAnswer(q.text, opt);
          setTimeout(function(){
            if (isLast) renderThanks(); else renderQuestion(idx+1);
          }, 380);
        });
        wrap.appendChild(b);
      });
      c.appendChild(wrap);
    } else {
      var ta = document.createElement("textarea");
      ta.className = "q-textarea";
      ta.rows = 3;
      ta.placeholder = "escreve aqui...";
      c.appendChild(ta);
      var submitBtn = el("button","btn btn-primary btn-block", isLast ? "Enviar" : "Próxima");
      submitBtn.addEventListener("click", function(){
        if (submitBtn.disabled) return;
        submitBtn.disabled = true;
        sendAnswer(q.text, ta.value.trim());
        if (isLast) renderThanks(); else renderQuestion(idx+1);
      });
      c.appendChild(submitBtn);
    }

    if (state.questions.length > 1) c.appendChild(dotsRow(idx));
    app.appendChild(s);
  }

  // tela final — sempre a última coisa que ela vê. Se teve pergunta, fecha
  // agradecendo por ter respondido; se não teve, é só o fechamento da semana.
  // e é aqui, só aqui, que o áudio (quando tem) aparece.
  function renderThanks(){
    currentScreen = "thanks";
    app.innerHTML = "";
    var hadQuestions = state.questions && state.questions.length;
    var built = stage([]);
    var s = built.stage, c = built.capsule;
    c.classList.add("cover-wrap");
    var eyebrow = el("div","eyebrow");
    eyebrow.innerHTML = '<span class="dot"></span>' + (hadQuestions ? "enviado" : "pra você");
    c.appendChild(eyebrow);
    if (hadQuestions){
      c.appendChild(el("div","cover-title serif","obrigado por responder"));
    }
    if (state.hasAudio) c.appendChild(buildAudioCard());
    c.appendChild(el("div","cover-hint","até a próxima semana"));
    app.appendChild(s);
  }

  // ---------------- ambient particles ----------------
  (function initFx(){
    var canvas = document.getElementById("fx");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var ctx = canvas.getContext("2d");
    var W, H, particles = [];
    var DPR = Math.min(window.devicePixelRatio || 1, 2);

    function resize(){
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR,0,0,DPR,0,0);
    }
    function seed(){
      particles = [];
      var n = window.innerWidth < 480 ? 16 : 26;
      for (var i=0;i<n;i++){
        particles.push({
          x: Math.random()*W, y: Math.random()*H,
          r: 0.6 + Math.random()*1.8,
          vy: -(0.06 + Math.random()*0.14),
          vx: (Math.random()-0.5)*0.05,
          phase: Math.random()*Math.PI*2,
          hue: Math.random() > 0.5 ? "232,162,76" : "243,236,223"
        });
      }
    }
    resize(); seed();
    window.addEventListener("resize", function(){ resize(); });

    var t = 0;
    function frame(){
      t += 1;
      ctx.clearRect(0,0,W,H);
      for (var i=0;i<particles.length;i++){
        var p = particles[i];
        p.y += p.vy;
        p.x += p.vx + Math.sin((t*0.01)+p.phase)*0.08;
        if (p.y < -10){ p.y = H+10; p.x = Math.random()*W; }
        var flicker = 0.35 + 0.35*Math.sin((t*0.03)+p.phase);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fillStyle = "rgba(" + p.hue + "," + Math.max(0.08,flicker) + ")";
        ctx.fill();
      }
      if (!reduce) requestAnimationFrame(frame);
    }
    if (!reduce){
      requestAnimationFrame(frame);
      document.addEventListener("visibilitychange", function(){
        if (!document.hidden) requestAnimationFrame(frame);
      });
    } else {
      frame();
    }
  })();

  // ---------------- carregar conteúdo ----------------
  function markAudio(ok){
    state.hasAudio = ok;
    if (currentScreen === "message") renderMessage();
  }

  fetch("MENSAGEM-DA-SEMANA.txt?t=" + Date.now(), {cache:"no-store"})
    .then(function(r){ if (!r.ok) throw new Error("no content file"); return r.text(); })
    .then(function(text){
      var d = parseContent(text);
      state.herName = d.NOME || "";
      state.message = d.MENSAGEM || "Toque para abrir sua mensagem.";
      state.questions = buildQuestions(d);
      var wantsAudio = /^s/i.test((d.AUDIO || "").trim());
      renderCover();
      if (wantsAudio){
        audioEl.addEventListener("loadedmetadata", function(){ markAudio(true); }, {once:true});
        audioEl.addEventListener("error", function(){ markAudio(false); }, {once:true});
        audioEl.src = "audio.mp3?t=" + Date.now();
        audioEl.load();
      }
    })
    .catch(function(){
      state.message = "não consegui carregar o conteúdo agora — tenta recarregar a página.";
      renderCover();
    });
})();
