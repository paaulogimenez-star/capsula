// motor da cápsula — parte do "motor" do site, não precisa mexer aqui nunca.
// quem edita o conteúdo é o arquivo MENSAGEM-DA-SEMANA.txt (e, se quiser áudio, um arquivo audio.mp3).
(function(){
  "use strict";

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
  // então o texto da mensagem pode ter ":" à vontade.
  function parseContent(text){
    var data = { NOME:"", MENSAGEM:"", AUDIO:"nao", FORM:"" };
    String(text||"").split(/\r?\n/).forEach(function(line){
      var t = line.trim();
      if (!t || t.charAt(0) === "#") return;
      var idx = t.indexOf(":");
      if (idx === -1) return;
      var key = t.slice(0, idx).trim().toUpperCase();
      var val = t.slice(idx + 1).trim();
      if (key === "NOME" || key === "MENSAGEM" || key === "AUDIO" || key === "FORM") data[key] = val;
    });
    data.MENSAGEM = data.MENSAGEM.replace(/\\n/g, "\n");
    return data;
  }

  var state = { herName:"", message:"Toque para abrir sua mensagem.", hasAudio:false, formUrl:"" };
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
      if (state.hasAudio){
        try{
          audioEl.currentTime = 0;
          var p = audioEl.play();
          if (p && p.catch) p.catch(function(){});
        }catch(e){}
      }
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

    if (state.hasAudio) c.appendChild(buildAudioCard());

    if (state.formUrl){
      var btn = el("button","btn btn-primary btn-block","responder as perguntas →");
      var note = el("div","","abre numa aba nova — pode fechar quando terminar de responder.");
      note.style.cssText = "text-align:center;font-size:12px;color:var(--paper-dimmer);";
      note.hidden = true;
      btn.addEventListener("click", function(){
        window.open(state.formUrl, "_blank", "noopener");
        note.hidden = false;
      });
      c.appendChild(btn);
      c.appendChild(note);
    }

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
      state.formUrl = (d.FORM || "").trim();
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
