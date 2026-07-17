"use client";

import { useEffect, useRef } from "react";

const vertexSource = `#version 300 es
precision highp float;
in vec4 position;
void main() { gl_Position = position; }
`;

const fragmentSource = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 resolution;
uniform float time;
uniform float scrollProgress;
#define FC gl_FragCoord.xy
#define T time
#define R resolution
#define MN min(R.x,R.y)

float rnd(vec2 p) {
  p=fract(p*vec2(12.9898,78.233));
  p+=dot(p,p+34.56);
  return fract(p.x*p.y);
}

float noise(in vec2 p) {
  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
  float a=rnd(i), b=rnd(i+vec2(1,0)), c=rnd(i+vec2(0,1)), d=rnd(i+1.);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}

float fbm(vec2 p) {
  float t=.0, a=1.;
  mat2 m=mat2(1.,-.5,.2,1.2);
  for (int i=0; i<5; i++) {
    t+=a*noise(p);
    p*=2.*m;
    a*=.5;
  }
  return t;
}

float clouds(vec2 p) {
  float d=1., t=.0;
  for (float i=.0; i<3.; i++) {
    float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);
    t=mix(t,d,a);
    d=a;
    p*=2./(i+1.);
  }
  return t;
}

void main(void) {
  vec2 uv=(FC-.5*R)/MN, st=uv*vec2(2,1);
  vec3 col=vec3(0);
  float bg=clouds(vec2(st.x+T*.18,-st.y));
  uv*=1.-.16*(sin(T*.16)*.5+.5);

  vec3 blueDeep=vec3(.004,.045,.12);
  vec3 blueGlow=vec3(.035,.52,.92);
  vec3 deep=blueDeep;
  vec3 glow=blueGlow;

  for (float i=1.; i<12.; i++) {
    uv+=.1*cos(i*vec2(.1+.01*i,.8)+i*i+T*.32+.1*uv.x);
    vec2 p=uv;
    float d=max(length(p),.015);
    float line=.0021/d;
    float b=noise(i+p+bg*1.731);
    col+=line*(glow*(.72+.38*cos(i))+.11);
    col+=.002*b/length(max(abs(p),vec2(max(b*abs(p.x)*.02,.006),max(abs(p.y),.006))))*glow;
    col=mix(col,deep+glow*bg*.27,smoothstep(.0,1.25,d));
  }

  float horizon=1.-smoothstep(-.48,.18,st.y);
  col+=glow*horizon*.3;
  col=mix(col,deep,.1);
  O=vec4(col,1.);
}
`;

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const starsCanvas = starsRef.current;
    if (!canvas || !starsCanvas) return;
    const starsCtx = starsCanvas.getContext("2d");
    if (!starsCtx) return;

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, "resolution");
    const time = gl.getUniformLocation(program, "time");
    let frame = 0;
    type Star = { x: number; y: number; size: number; alpha: number; phase: number; speed: number; depth: number; length: number };
    let stars: Star[] = [];

    const seedStars = () => {
      const count = 5;
      stars = Array.from({ length: count }, (_, index) => ({
        x: Math.random(),
        y: .08 + Math.random() * .78,
        size: .7 + Math.random() * 1.6,
        alpha: .3 + Math.random() * .55,
        phase: Math.random() * Math.PI * 2,
        speed: .018 + Math.random() * .035,
        depth: .45 + Math.random() * .85,
        length: 32 + Math.random() * 115 + (index % 7 === 0 ? 45 : 0),
      }));
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      starsCanvas.width = Math.floor(window.innerWidth * dpr);
      starsCanvas.height = Math.floor(window.innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      starsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedStars();
    };

    const render = (now: number) => {
      gl.useProgram(program);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, now * .001);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        const width = window.innerWidth;
        const height = window.innerHeight;
        starsCtx.clearRect(0, 0, width, height);
        starsCtx.globalCompositeOperation = "lighter";
        for (const star of stars) {
          const t = now * star.speed + star.phase;
          const twinkle = .68 + .32 * Math.sin(t) + .08 * Math.sin(t * .37 + star.phase);
          const x = ((star.x * width + now * star.speed * star.depth) % (width + star.length)) - star.length;
          const y = star.y * height;
          const radius = star.size * (.9 + .1 * Math.sin(t * .61));
          const alpha = Math.max(.08, Math.min(1, star.alpha * twinkle));
          const trail = starsCtx.createLinearGradient(x - star.length, y, x, y);
          trail.addColorStop(0, "rgba(108, 203, 255, 0)");
          trail.addColorStop(.7, `rgba(108, 203, 255, ${alpha * .16})`);
          trail.addColorStop(1, `rgba(226, 247, 255, ${alpha})`);
          starsCtx.strokeStyle = trail;
          starsCtx.lineWidth = radius;
          starsCtx.lineCap = "round";
          starsCtx.beginPath();
          starsCtx.moveTo(x - star.length, y);
          starsCtx.lineTo(x, y);
          starsCtx.stroke();
          starsCtx.shadowColor = `rgba(117, 211, 255, ${alpha})`;
          starsCtx.shadowBlur = 10 + radius * 4;
          starsCtx.fillStyle = `rgba(232, 250, 255, ${alpha})`;
          starsCtx.beginPath();
          starsCtx.arc(x, y, radius * 1.25, 0, Math.PI * 2);
          starsCtx.fill();
          starsCtx.shadowBlur = 0;
        }
        starsCtx.globalCompositeOperation = "source-over";
      frame = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="shader-background"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none" }}
        aria-hidden
      />
      <canvas
        ref={starsRef}
        className="starfield-layer"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none" }}
        aria-hidden
      />
    </>
  );
}
