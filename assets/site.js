/* Seaflare Market site — shared behavior across every page. */
(function(){
  // ---- mobile nav ------------------------------------------------------
  var toggle = document.querySelector('.nav-toggle');
  var mobileNav = document.querySelector('.mobile-nav');
  var scrim = document.querySelector('.nav-scrim');
  if (toggle && mobileNav && scrim) {
    function closeNav(){ mobileNav.classList.remove('open'); scrim.classList.remove('open'); }
    toggle.addEventListener('click', function(){
      mobileNav.classList.toggle('open');
      scrim.classList.toggle('open');
    });
    scrim.addEventListener('click', closeNav);
    mobileNav.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', closeNav); });
  }

  // ---- reveal-on-scroll --------------------------------------------------
  var els = document.querySelectorAll('.reveal');
  if (els.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, {threshold:.12});
    els.forEach(function(el){ io.observe(el); });
  } else {
    els.forEach(function(el){ el.classList.add('in'); });
  }

  // ---- single-open accordion ------------------------------------------
  var items = document.querySelectorAll('details.acc-item');
  items.forEach(function(d){
    d.addEventListener('toggle', function(){
      if (d.open) { items.forEach(function(o){ if (o !== d) o.open = false; }); }
    });
  });

  // ---- table-of-contents scroll-spy (beta.html / feature pages) -------
  var tocLinks = document.querySelectorAll('.toc a[href^="#"]');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var targets = [];
    tocLinks.forEach(function(a){
      var id = a.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (target) targets.push({link: a, el: target});
    });
    var spy = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        var match = targets.find(function(t){ return t.el === entry.target; });
        if (!match) return;
        if (entry.isIntersecting) {
          tocLinks.forEach(function(a){ a.classList.remove('active'); });
          match.link.classList.add('active');
        }
      });
    }, {rootMargin:'-15% 0px -70% 0px'});
    targets.forEach(function(t){ spy.observe(t.el); });
  }

  // ---- shader background ----------------------------------------------
  var canvas = document.getElementById('shader-bg');
  if (!canvas) return;
  var gl = canvas.getContext('webgl2', {antialias:false, alpha:false, powerPreference:'low-power'});

  function heroEl(){ return document.querySelector('.hero'); }

  function sizeCanvas(){
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    var hero = heroEl();
    var h = hero ? hero.offsetHeight : window.innerHeight;
    canvas.style.height = h + 'px';
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(h * dpr);
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
  }

  if (!gl) {
    canvas.style.background =
      'radial-gradient(ellipse at 50% 34%, rgba(255,194,74,.35), rgba(255,138,61,.08) 30%, transparent 55%),' +
      'linear-gradient(to bottom, #050b12 0%, #0a1826 42%, #0c2233 55%, #071119 100%)';
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);
    return;
  }

  var vertSrc = '#version 300 es\n' +
    'void main(){\n' +
    '  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);\n' +
    '  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);\n' +
    '}';

  // Ported from the client's own title-screen background.frag (a flare
  // rising over open sea) so every page and the client look like the same
  // product. Geometry/constants match the version verified in-client.
  var fragSrc = '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform float u_time;\n' +
    'uniform vec2 u_resolution;\n' +
    'out vec4 outColor;\n' +
    'const float HORIZON = 0.42;\n' +
    'const float SUN_R = 0.105;\n' +
    'const vec3 SKY_HIGH = vec3(0.020, 0.055, 0.140);\n' +
    'const vec3 SKY_LOW = vec3(0.085, 0.300, 0.430);\n' +
    'const vec3 FLARE = vec3(1.000, 0.640, 0.240);\n' +
    'const vec3 FLARE_HOT = vec3(1.000, 0.880, 0.560);\n' +
    'const vec3 SEA_NEAR = vec3(0.055, 0.135, 0.250);\n' +
    'const vec3 SEA_FAR = vec3(0.075, 0.300, 0.400);\n' +
    'const vec3 SEA_FLOOR = vec3(0.020, 0.058, 0.118);\n' +
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
    'float noise(vec2 p){\n' +
    '  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);\n' +
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),\n' +
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);\n' +
    '}\n' +
    'float fbm(vec2 p){\n' +
    '  float v = 0.0; float a = 0.5;\n' +
    '  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }\n' +
    '  return v;\n' +
    '}\n' +
    'vec3 sky(vec2 uv, vec2 p, float sunDist){\n' +
    '  float h = (uv.y - HORIZON) / (1.0 - HORIZON);\n' +
    '  vec3 col = mix(SKY_LOW, SKY_HIGH, smoothstep(0.0, 0.85, h));\n' +
    '  float band = exp(-h * 5.0);\n' +
    '  float lateral = exp(-abs(p.x) * 1.15);\n' +
    '  col += FLARE * band * (0.20 + 0.55 * lateral);\n' +
    '  float cloud = fbm(vec2(p.x * 1.1 + u_time * 0.02, h * 4.5 - u_time * 0.006));\n' +
    '  cloud = smoothstep(0.48, 0.95, cloud) * smoothstep(0.02, 0.35, h) * (1.0 - h * 0.6);\n' +
    '  col = mix(col, mix(vec3(0.30, 0.42, 0.55), FLARE, lateral * 0.6), cloud * 0.35);\n' +
    '  col += FLARE * exp(-sunDist * 7.0) * 0.85;\n' +
    '  col += FLARE_HOT * exp(-sunDist * 22.0) * 0.9;\n' +
    '  float ang = atan(p.y - 0.015, p.x);\n' +
    '  float rays = 0.5 + 0.5 * sin(ang * 9.0 + u_time * 0.08);\n' +
    '  rays *= 0.5 + 0.5 * sin(ang * 5.0 - u_time * 0.05);\n' +
    '  col += FLARE * rays * exp(-sunDist * 4.5) * 0.20;\n' +
    '  return col;\n' +
    '}\n' +
    'vec3 sea(vec2 uv, vec2 p){\n' +
    '  float depth = HORIZON - uv.y;\n' +
    '  float persp = 1.0 / (depth * 6.0 + 0.075);\n' +
    '  vec2 wp = vec2(p.x * persp * 0.42, persp * 0.34 + u_time * 0.10);\n' +
    '  float swell = fbm(wp);\n' +
    '  float chop = fbm(wp * 3.4 + vec2(u_time * 0.22, u_time * 0.36));\n' +
    '  vec3 col = mix(SEA_FAR, SEA_NEAR, smoothstep(0.0, 0.42, depth));\n' +
    '  col += vec3(0.05, 0.12, 0.17) * exp(-depth * 3.0) * 0.6;\n' +
    '  float wave = (swell - 0.5) + (chop - 0.5) * 0.6;\n' +
    '  col += vec3(0.07, 0.15, 0.20) * wave * (0.7 + smoothstep(0.0, 0.32, depth) * 1.0);\n' +
    '  col += vec3(0.10, 0.20, 0.26) * smoothstep(0.62, 0.86, swell) * 0.5;\n' +
    '  float near = fbm(vec2(p.x * 3.0, depth * 6.0 - u_time * 0.12));\n' +
    '  col += vec3(0.05, 0.10, 0.14) * (near - 0.5) * smoothstep(0.05, 0.34, depth);\n' +
    '  col = max(col, SEA_FLOOR);\n' +
    '  float wedge = exp(-abs(p.x) * (2.0 + depth * 8.0));\n' +
    '  float glint = smoothstep(0.50, 0.78, chop) * smoothstep(0.42, 0.72, swell);\n' +
    '  col += FLARE * wedge * (0.14 + glint * 1.70);\n' +
    '  col += FLARE_HOT * wedge * glint * 0.50 * smoothstep(0.22, 0.0, depth);\n' +
    '  col = mix(col, SEA_FAR + FLARE * 0.35 * exp(-abs(p.x) * 1.2), smoothstep(0.035, 0.0, depth));\n' +
    '  return col;\n' +
    '}\n' +
    'void main(){\n' +
    '  vec2 uv = gl_FragCoord.xy / u_resolution.xy;\n' +
    '  float aspect = u_resolution.x / u_resolution.y;\n' +
    '  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - HORIZON);\n' +
    '  float sunDist = length(p - vec2(0.0, 0.015));\n' +
    '  vec3 col = mix(sea(uv, p), sky(uv, p, sunDist), smoothstep(HORIZON - 0.004, HORIZON + 0.004, uv.y));\n' +
    '  float disc = smoothstep(SUN_R, SUN_R - 0.008, sunDist) * step(HORIZON - 0.002, uv.y);\n' +
    '  col = mix(col, mix(FLARE, FLARE_HOT, smoothstep(SUN_R, 0.0, sunDist)), disc);\n' +
    '  float vig = 1.0 - 0.32 * pow(length((uv - 0.5) * vec2(aspect, 1.0)) * 0.85, 2.0);\n' +
    '  col *= vig;\n' +
    '  col += (hash(uv * u_resolution.xy + u_time) - 0.5) * 0.012;\n' +
    '  outColor = vec4(max(col, vec3(0.0)), 1.0);\n' +
    '}';

  function compile(type, src){
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('shader compile failed', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, vertSrc);
  var fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  var prog = null;
  if (vs && fs) {
    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('program link failed', gl.getProgramInfoLog(prog));
      prog = null;
    }
  }

  if (!prog) {
    canvas.style.background = 'linear-gradient(to bottom, #050b12, #0c2233)';
    return;
  }

  gl.useProgram(prog);
  var uTime = gl.getUniformLocation(prog, 'u_time');
  var uRes = gl.getUniformLocation(prog, 'u_resolution');

  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  var start = performance.now();
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lastFrame = 0;

  function frame(now){
    requestAnimationFrame(frame);
    if (now - lastFrame < 33) return; // cap ~30fps - ambient background, not gameplay
    lastFrame = now;
    var t = reduceMotion ? 6.0 : (now - start) / 1000 * 0.55;
    gl.uniform1f(uTime, t);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  requestAnimationFrame(frame);
})();
