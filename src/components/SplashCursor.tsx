'use client';
import { useEffect, useRef } from 'react';

export default function SplashCursor({
  SIM_RESOLUTION = 128,
  DYE_RESOLUTION = 1440,
  DENSITY_DISSIPATION = 3.5,
  VELOCITY_DISSIPATION = 2,
  PRESSURE = 0.1,
  PRESSURE_ITERATIONS = 20,
  CURL = 3,
  SPLAT_RADIUS = 0.2,
  SPLAT_FORCE = 6000,
  SHADING = true,
  COLOR_UPDATE_SPEED = 10,
  BACK_COLOR = { r: 0.5, g: 0, b: 0 },
  TRANSPARENT = true,
  RAINBOW_MODE = false,
  COLOR = '#ff1a24',
}: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let isActive = true;

    function pointerPrototype(this: any) {
      this.id = -1; this.texcoordX = 0; this.texcoordY = 0;
      this.prevTexcoordX = 0; this.prevTexcoordY = 0;
      this.deltaX = 0; this.deltaY = 0;
      this.down = false; this.moved = false; this.color = [0, 0, 0];
    }

    const config = { SIM_RESOLUTION, DYE_RESOLUTION, DENSITY_DISSIPATION, VELOCITY_DISSIPATION, PRESSURE, PRESSURE_ITERATIONS, CURL, SPLAT_RADIUS, SPLAT_FORCE, SHADING, COLOR_UPDATE_SPEED, PAUSED: false, BACK_COLOR, TRANSPARENT, RAINBOW_MODE, COLOR };
    let pointers: any[] = [new (pointerPrototype as any)()];

    const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
    let gl: any = canvas.getContext('webgl2', params);
    const isWebGL2 = !!gl;
    if (!isWebGL2) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);

    let halfFloat: any, supportLinearFiltering: any;
    if (isWebGL2) { gl.getExtension('EXT_color_buffer_float'); supportLinearFiltering = gl.getExtension('OES_texture_float_linear'); }
    else { halfFloat = gl.getExtension('OES_texture_half_float'); supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear'); }
    gl.clearColor(0, 0, 0, 1);

    const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat?.HALF_FLOAT_OES;

    function getSupportedFormat(internalFormat: number, format: number, type: number): any {
      if (!supportRenderTextureFormat(internalFormat, format, type)) {
        if (internalFormat === gl.R16F) return getSupportedFormat(gl.RG16F, gl.RG, type);
        if (internalFormat === gl.RG16F) return getSupportedFormat(gl.RGBA16F, gl.RGBA, type);
        return null;
      }
      return { internalFormat, format };
    }

    function supportRenderTextureFormat(inF: number, f: number, t: number) {
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, inF, 4, 4, 0, f, t, null);
      const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }

    let formatRGBA: any, formatRG: any, formatR: any;
    if (isWebGL2) {
      formatRGBA = getSupportedFormat(gl.RGBA16F, gl.RGBA, halfFloatTexType);
      formatRG = getSupportedFormat(gl.RG16F, gl.RG, halfFloatTexType);
      formatR = getSupportedFormat(gl.R16F, gl.RED, halfFloatTexType);
    } else {
      formatRGBA = getSupportedFormat(gl.RGBA, gl.RGBA, halfFloatTexType);
      formatRG = formatRGBA; formatR = formatRGBA;
    }

    if (!supportLinearFiltering) { config.DYE_RESOLUTION = 256; config.SHADING = false; }

    function compileShader(type: number, source: string, keywords?: string[]) {
      let src = keywords ? keywords.map(k => `#define ${k}\n`).join('') + source : source;
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s;
    }

    function createProgram(vs: any, fs: any) {
      const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p); return p;
    }

    function getUniforms(p: any) {
      const u: any = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
      return u;
    }

    const vert = compileShader(gl.VERTEX_SHADER, `precision highp float;attribute vec2 aPosition;varying vec2 vUv,vL,vR,vT,vB;uniform vec2 texelSize;void main(){vUv=aPosition*0.5+0.5;vL=vUv-vec2(texelSize.x,0.);vR=vUv+vec2(texelSize.x,0.);vT=vUv+vec2(0.,texelSize.y);vB=vUv-vec2(0.,texelSize.y);gl_Position=vec4(aPosition,0.,1.);}`);
    const copySh = compileShader(gl.FRAGMENT_SHADER, `precision mediump float;precision mediump sampler2D;varying highp vec2 vUv;uniform sampler2D uTexture;void main(){gl_FragColor=texture2D(uTexture,vUv);}`);
    const clearSh = compileShader(gl.FRAGMENT_SHADER, `precision mediump float;precision mediump sampler2D;varying highp vec2 vUv;uniform sampler2D uTexture;uniform float value;void main(){gl_FragColor=value*texture2D(uTexture,vUv);}`);
    const splatSh = compileShader(gl.FRAGMENT_SHADER, `precision highp float;precision highp sampler2D;varying vec2 vUv;uniform sampler2D uTarget;uniform float aspectRatio;uniform vec3 color;uniform vec2 point;uniform float radius;void main(){vec2 p=vUv-point;p.x*=aspectRatio;vec3 splat=exp(-dot(p,p)/radius)*color;gl_FragColor=vec4(texture2D(uTarget,vUv).xyz+splat,1.);}`);
    const advSh = compileShader(gl.FRAGMENT_SHADER, `precision highp float;precision highp sampler2D;varying vec2 vUv;uniform sampler2D uVelocity,uSource;uniform vec2 texelSize,dyeTexelSize;uniform float dt,dissipation;vec4 bilerp(sampler2D s,vec2 uv,vec2 t){vec2 st=uv/t-0.5;vec2 iuv=floor(st);vec2 fuv=fract(st);vec4 a=texture2D(s,(iuv+vec2(.5,.5))*t);vec4 b=texture2D(s,(iuv+vec2(1.5,.5))*t);vec4 c=texture2D(s,(iuv+vec2(.5,1.5))*t);vec4 d=texture2D(s,(iuv+vec2(1.5,1.5))*t);return mix(mix(a,b,fuv.x),mix(c,d,fuv.x),fuv.y);}void main(){vec2 coord=vUv-dt*texture2D(uVelocity,vUv).xy*texelSize;gl_FragColor=texture2D(uSource,coord)/(1.+dissipation*dt);}`, supportLinearFiltering ? undefined : ['MANUAL_FILTERING']);
    const divSh = compileShader(gl.FRAGMENT_SHADER, `precision mediump float;precision mediump sampler2D;varying highp vec2 vUv,vL,vR,vT,vB;uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).x,R=texture2D(uVelocity,vR).x,T=texture2D(uVelocity,vT).y,B=texture2D(uVelocity,vB).y;vec2 C=texture2D(uVelocity,vUv).xy;if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;gl_FragColor=vec4(.5*(R-L+T-B),0.,0.,1.);}`);
    const curlSh = compileShader(gl.FRAGMENT_SHADER, `precision mediump float;precision mediump sampler2D;varying highp vec2 vUv,vL,vR,vT,vB;uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).y,R=texture2D(uVelocity,vR).y,T=texture2D(uVelocity,vT).x,B=texture2D(uVelocity,vB).x;gl_FragColor=vec4(.5*(R-L-T+B),0.,0.,1.);}`);
    const vortSh = compileShader(gl.FRAGMENT_SHADER, `precision highp float;precision highp sampler2D;varying vec2 vUv,vL,vR,vT,vB;uniform sampler2D uVelocity,uCurl;uniform float curl,dt;void main(){float L=texture2D(uCurl,vL).x,R=texture2D(uCurl,vR).x,T=texture2D(uCurl,vT).x,B=texture2D(uCurl,vB).x,C=texture2D(uCurl,vUv).x;vec2 force=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));force/=length(force)+.0001;force*=curl*C;force.y*=-1.;vec2 vel=texture2D(uVelocity,vUv).xy+force*dt;gl_FragColor=vec4(clamp(vel,-1e3,1e3),0.,1.);}`);
    const pressSh = compileShader(gl.FRAGMENT_SHADER, `precision mediump float;precision mediump sampler2D;varying highp vec2 vUv,vL,vR,vT,vB;uniform sampler2D uPressure,uDivergence;void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x,div=texture2D(uDivergence,vUv).x;gl_FragColor=vec4((L+R+B+T-div)*.25,0.,0.,1.);}`);
    const gradSh = compileShader(gl.FRAGMENT_SHADER, `precision mediump float;precision mediump sampler2D;varying highp vec2 vUv,vL,vR,vT,vB;uniform sampler2D uPressure,uVelocity;void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;vec2 vel=texture2D(uVelocity,vUv).xy-vec2(R-L,T-B);gl_FragColor=vec4(vel,0.,1.);}`);
    const dispSh = compileShader(gl.FRAGMENT_SHADER, `precision highp float;precision highp sampler2D;varying vec2 vUv,vL,vR,vT,vB;uniform sampler2D uTexture;uniform vec2 texelSize;void main(){vec3 c=texture2D(uTexture,vUv).rgb;float a=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c,a);}`, config.SHADING ? ['SHADING'] : []);

    const copyP = createProgram(vert, copySh); const copyU = getUniforms(copyP);
    const clearP = createProgram(vert, clearSh); const clearU = getUniforms(clearP);
    const splatP = createProgram(vert, splatSh); const splatU = getUniforms(splatP);
    const advP = createProgram(vert, advSh); const advU = getUniforms(advP);
    const divP = createProgram(vert, divSh); const divU = getUniforms(divP);
    const curlP = createProgram(vert, curlSh); const curlU = getUniforms(curlP);
    const vortP = createProgram(vert, vortSh); const vortU = getUniforms(vortP);
    const pressP = createProgram(vert, pressSh); const pressU = getUniforms(pressP);
    const gradP = createProgram(vert, gradSh); const gradU = getUniforms(gradP);
    const dispP = createProgram(vert, dispSh); const dispU = getUniforms(dispP);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,-1,1,1,1,1,-1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2,0,2,3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);

    const blit = (target: any, clear = false) => {
      if (target == null) { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
      else { gl.viewport(0, 0, target.width, target.height); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); }
      if (clear) { gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };

    const createFBO = (w: number, h: number, iF: number, f: number, t: number, p: number) => {
      gl.activeTexture(gl.TEXTURE0);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, p); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, p);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, iF, w, h, 0, f, t, null);
      const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0,0,w,h); gl.clear(gl.COLOR_BUFFER_BIT);
      return { texture: tex, fbo, width: w, height: h, texelSizeX: 1/w, texelSizeY: 1/h, attach(id: number) { gl.activeTexture(gl.TEXTURE0+id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; } };
    };

    const createDFBO = (w: number, h: number, iF: number, f: number, t: number, p: number) => {
      let f1 = createFBO(w,h,iF,f,t,p), f2 = createFBO(w,h,iF,f,t,p);
      return { width:w, height:h, texelSizeX:f1.texelSizeX, texelSizeY:f1.texelSizeY, get read(){return f1;}, set read(v){f1=v;}, get write(){return f2;}, set write(v){f2=v;}, swap(){const tmp=f1;f1=f2;f2=tmp;} };
    };

    const getRes = (r: number) => {
      let ar = gl.drawingBufferWidth/gl.drawingBufferHeight; if(ar<1) ar=1/ar;
      const min=Math.round(r), max=Math.round(r*ar);
      return gl.drawingBufferWidth>gl.drawingBufferHeight?{width:max,height:min}:{width:min,height:max};
    };

    let dye: any, velocity: any, divergence: any, curlFBO: any, pressure: any;
    const initFBOs = () => {
      const sr = getRes(config.SIM_RESOLUTION), dr = getRes(config.DYE_RESOLUTION);
      const tt = halfFloatTexType, flt = supportLinearFiltering?gl.LINEAR:gl.NEAREST;
      gl.disable(gl.BLEND);
      dye = createDFBO(dr.width,dr.height,formatRGBA.internalFormat,formatRGBA.format,tt,flt);
      velocity = createDFBO(sr.width,sr.height,formatRG.internalFormat,formatRG.format,tt,flt);
      divergence = createFBO(sr.width,sr.height,formatR.internalFormat,formatR.format,tt,gl.NEAREST);
      curlFBO = createFBO(sr.width,sr.height,formatR.internalFormat,formatR.format,tt,gl.NEAREST);
      pressure = createDFBO(sr.width,sr.height,formatR.internalFormat,formatR.format,tt,gl.NEAREST);
    };

    function HSVtoRGB(h: number, s: number, v: number) {
      const i=Math.floor(h*6), f=h*6-i, p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
      const m=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];
      return {r:m[0],g:m[1],b:m[2]};
    }

    const hexToRGB = (hex: string) => {
      const v = hex.replace('#','');
      return { r: parseInt(v.slice(0,2),16)/255*0.15, g: parseInt(v.slice(2,4),16)/255*0.15, b: parseInt(v.slice(4,6),16)/255*0.15 };
    };

    const generateColor = () => config.RAINBOW_MODE ? (() => { const c=HSVtoRGB(Math.random(),1,1); return {r:c.r*.15,g:c.g*.15,b:c.b*.15}; })() : hexToRGB(config.COLOR);

    const scaleByPR = (v: number) => Math.floor(v*(window.devicePixelRatio||1));

    const updatePointerMove = (ptr: any, x: number, y: number) => {
      ptr.prevTexcoordX=ptr.texcoordX; ptr.prevTexcoordY=ptr.texcoordY;
      ptr.texcoordX=x/canvas.width; ptr.texcoordY=1-(y/canvas.height);
      const ar=canvas.width/canvas.height;
      ptr.deltaX=(ptr.texcoordX-ptr.prevTexcoordX)*(ar<1?ar:1);
      ptr.deltaY=(ptr.texcoordY-ptr.prevTexcoordY)*(ar>1?1/ar:1);
      ptr.moved=Math.abs(ptr.deltaX)>0||Math.abs(ptr.deltaY)>0;
    };

    const splat = (x: number, y: number, dx: number, dy: number, color: any) => {
      gl.useProgram(splatP);
      gl.uniform1i(splatU.uTarget, velocity.read.attach(0));
      gl.uniform1f(splatU.aspectRatio, canvas.width/canvas.height);
      gl.uniform2f(splatU.point, x, y); gl.uniform3f(splatU.color, dx, dy, 0);
      const r = config.SPLAT_RADIUS/100*(canvas.width/canvas.height>1?canvas.width/canvas.height:1);
      gl.uniform1f(splatU.radius, r); blit(velocity.write); velocity.swap();
      gl.uniform1i(splatU.uTarget, dye.read.attach(0));
      gl.uniform3f(splatU.color, color.r, color.g, color.b); blit(dye.write); dye.swap();
    };

    let lastTime = Date.now(), colorTimer = 0;

    const step = (dt: number) => {
      gl.disable(gl.BLEND);
      gl.useProgram(curlP); gl.uniform2f(curlU.texelSize,velocity.texelSizeX,velocity.texelSizeY); gl.uniform1i(curlU.uVelocity,velocity.read.attach(0)); blit(curlFBO);
      gl.useProgram(vortP); gl.uniform2f(vortU.texelSize,velocity.texelSizeX,velocity.texelSizeY); gl.uniform1i(vortU.uVelocity,velocity.read.attach(0)); gl.uniform1i(vortU.uCurl,curlFBO.attach(1)); gl.uniform1f(vortU.curl,config.CURL); gl.uniform1f(vortU.dt,dt); blit(velocity.write); velocity.swap();
      gl.useProgram(divP); gl.uniform2f(divU.texelSize,velocity.texelSizeX,velocity.texelSizeY); gl.uniform1i(divU.uVelocity,velocity.read.attach(0)); blit(divergence);
      gl.useProgram(clearP); gl.uniform1i(clearU.uTexture,pressure.read.attach(0)); gl.uniform1f(clearU.value,config.PRESSURE); blit(pressure.write); pressure.swap();
      gl.useProgram(pressP); gl.uniform2f(pressU.texelSize,velocity.texelSizeX,velocity.texelSizeY); gl.uniform1i(pressU.uDivergence,divergence.attach(0));
      for(let i=0;i<config.PRESSURE_ITERATIONS;i++){gl.uniform1i(pressU.uPressure,pressure.read.attach(1));blit(pressure.write);pressure.swap();}
      gl.useProgram(gradP); gl.uniform2f(gradU.texelSize,velocity.texelSizeX,velocity.texelSizeY); gl.uniform1i(gradU.uPressure,pressure.read.attach(0)); gl.uniform1i(gradU.uVelocity,velocity.read.attach(1)); blit(velocity.write); velocity.swap();
      gl.useProgram(advP); gl.uniform2f(advU.texelSize,velocity.texelSizeX,velocity.texelSizeY);
      if(!supportLinearFiltering) gl.uniform2f(advU.dyeTexelSize,velocity.texelSizeX,velocity.texelSizeY);
      const vi=velocity.read.attach(0); gl.uniform1i(advU.uVelocity,vi); gl.uniform1i(advU.uSource,vi); gl.uniform1f(advU.dt,dt); gl.uniform1f(advU.dissipation,config.VELOCITY_DISSIPATION); blit(velocity.write); velocity.swap();
      if(!supportLinearFiltering) gl.uniform2f(advU.dyeTexelSize,dye.texelSizeX,dye.texelSizeY);
      gl.uniform1i(advU.uVelocity,velocity.read.attach(0)); gl.uniform1i(advU.uSource,dye.read.attach(1)); gl.uniform1f(advU.dissipation,config.DENSITY_DISSIPATION); blit(dye.write); dye.swap();
    };

    const frame = () => {
      if(!isActive) return;
      const now=Date.now(), dt=Math.min((now-lastTime)/1000,0.016666); lastTime=now;
      const W=scaleByPR(canvas.clientWidth), H=scaleByPR(canvas.clientHeight);
      if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;initFBOs();}
      colorTimer+=dt*config.COLOR_UPDATE_SPEED;
      if(colorTimer>=1){colorTimer=0;pointers.forEach(p=>{p.color=generateColor();});}
      pointers.forEach(p=>{if(p.moved){p.moved=false;splat(p.texcoordX,p.texcoordY,p.deltaX*config.SPLAT_FORCE,p.deltaY*config.SPLAT_FORCE,p.color);}});
      step(dt);
      gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.BLEND);
      gl.useProgram(dispP); if(config.SHADING)gl.uniform2f(dispU.texelSize,1/gl.drawingBufferWidth,1/gl.drawingBufferHeight); gl.uniform1i(dispU.uTexture,dye.read.attach(0)); blit(null);
      animId.current = requestAnimationFrame(frame);
    };

    const onMouseMove = (e: MouseEvent) => { const p=pointers[0]; if(!p.down){p.color=generateColor();} updatePointerMove(p,scaleByPR(e.clientX),scaleByPR(e.clientY)); };
    const onMouseDown = (e: MouseEvent) => { const p=pointers[0]; p.down=true; p.color=generateColor(); updatePointerMove(p,scaleByPR(e.clientX),scaleByPR(e.clientY)); const c=generateColor();c.r*=10;c.g*=10;c.b*=10;splat(p.texcoordX,p.texcoordY,10*(Math.random()-.5),30*(Math.random()-.5),c); };
    const onMouseUp = () => { pointers[0].down=false; };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    initFBOs();
    frame();

    return () => {
      isActive=false;
      if(animId.current) cancelAnimationFrame(animId.current);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div style={{position:'fixed',top:0,left:0,zIndex:50,pointerEvents:'none',width:'100%',height:'100%'}}>
      <canvas ref={canvasRef} style={{width:'100vw',height:'100vh',display:'block'}} />
    </div>
  );
}
