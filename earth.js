/* Orthographic Earth: Natural Earth geography, a slow rotation, and no tile requests. */
(() => {
  const canvas = document.getElementById("earth-canvas");
  if (!canvas || !window.d3 || !window.topojson || !window.COMMON_WORLD) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const world = window.COMMON_WORLD;
  const land = topojson.feature(world, world.objects.land || world.objects.countries);
  const borders = world.objects.countries
    ? topojson.mesh(world, world.objects.countries, (a, b) => a !== b)
    : null;
  const graticule = d3.geoGraticule().step([15, 15])();
  const projection = d3.geoOrthographic().clipAngle(90).precision(0.5);
  const path = d3.geoPath(projection, ctx);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const button = document.getElementById("motion-toggle");
  let width = 0,
    height = 0,
    rotation = 79,
    lastTime = 0,
    frame = 0,
    visible = true,
    paused = reduced.matches;
  function resize() {
    const box = canvas.getBoundingClientRect();
    width = box.width;
    height = box.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    projection
      .scale(Math.min(height * 0.58, width * 0.57))
      .translate([width * 0.54, height * 0.51]);
    draw();
  }
  function draw() {
    if (!width || !height) return;
    projection.rotate([rotation, -17, -9]);
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = "#1c5041";
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.clip();
    ctx.beginPath();
    path(graticule);
    ctx.strokeStyle = "#a6c69a24";
    ctx.lineWidth = 0.65;
    ctx.stroke();
    ctx.beginPath();
    path(land);
    ctx.fillStyle = "#77a06a";
    ctx.globalAlpha = 0.63;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#a0bd833d";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    if (borders) {
      ctx.beginPath();
      path(borders);
      ctx.strokeStyle = "#244e3e66";
      ctx.lineWidth = 0.45;
      ctx.stroke();
    }
    const center = projection.invert([width * 0.54, height * 0.51]);
    const local = [-84.0713, 34.0515];
    if (d3.geoDistance(local, center) < Math.PI / 2) {
      const [x, y] = projection(local);
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.strokeStyle = "#daef9a66";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#e6f4b9";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.strokeStyle = "#daef9a26";
      ctx.stroke();
    }
    const shade = ctx.createRadialGradient(
      width * 0.42,
      height * 0.34,
      20,
      width * 0.54,
      height * 0.51,
      projection.scale(),
    );
    shade.addColorStop(0, "#123e3500");
    shade.addColorStop(0.65, "#123e3510");
    shade.addColorStop(1, "#082a267a");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.strokeStyle = "#a2c58b45";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.save();
    ctx.translate(width * 0.54, height * 0.51);
    ctx.rotate(-0.2);
    ctx.beginPath();
    ctx.ellipse(0, 0, projection.scale() * 1.11, projection.scale() * 0.25, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#a8c58d24";
    ctx.lineWidth = 0.7;
    ctx.setLineDash([3, 8]);
    ctx.stroke();
    ctx.restore();
  }
  function tick(time) {
    frame = 0;
    if (paused || !visible || document.hidden) {
      lastTime = 0;
      return;
    }
    if (lastTime) rotation += (Math.min(time - lastTime, 100) / 1000) * 1.45;
    lastTime = time;
    draw();
    frame = requestAnimationFrame(tick);
  }
  function start() {
    cancelAnimationFrame(frame);
    lastTime = 0;
    if (!paused && visible && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function updateButton() {
    button.setAttribute("aria-pressed", String(paused));
    button.innerHTML = `<span class="pause-glyph" aria-hidden="true">${paused ? "▷" : "Ⅱ"}</span><span>${paused ? "Resume motion" : "Pause motion"}</span>`;
  }
  button?.addEventListener("click", () => {
    paused = !paused;
    updateButton();
    start();
  });
  reduced.addEventListener("change", (event) => {
    paused = event.matches;
    updateButton();
    start();
  });
  document.addEventListener("visibilitychange", start);
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    start();
  }).observe(canvas);
  resize();
  updateButton();
  start();
})();
