/* =====================================================================
   Mini WebGL renderer (one per canvas)
   modes: 0 lit vertex colour · 1 flat vertex colour · 2 textured + normal map · 4 lit colour, see-through
   ===================================================================== */
class GLR {
  constructor(canvas, opt = {}){
    const gl = canvas.getContext('webgl', { antialias: !!opt.aa, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: !!opt.preserve });
    if (!gl) throw new Error('WebGL is not available in this browser.');
    this.gl = gl; gl.disable(gl.DITHER);
    const vs = `attribute vec3 aP;attribute vec3 aN;attribute vec3 aC;attribute vec2 aT;attribute vec3 aU;
      uniform mat4 uM;uniform mat3 uR;uniform float uSnap,uZB;uniform vec2 uOff;
      varying vec3 vN;varying vec3 vC;varying vec2 vT;varying vec3 vU;varying vec3 vA;
      void main(){vec4 p=uM*vec4(aP,1.0);
        if(uSnap>0.0){vec2 nd=p.xy/p.w;nd=floor(nd*uSnap+0.5)/uSnap;p.xy=nd*p.w;}
        p.z-=uZB*p.w;p.xy+=uOff*p.w;vN=uR*aN;vU=uR*aU;vC=aC;vT=aT;vA=vec3(aT*p.w,p.w);gl_Position=p;}`;
    const fs = `precision highp float;
      uniform int uMode;uniform vec3 uL;uniform float uAmb,uDif,uNStr,uSpec,uAffine,uAT;uniform vec4 uCol;
      uniform sampler2D uTex,uNMap;
      varying vec3 vN;varying vec3 vC;varying vec2 vT;varying vec3 vU;varying vec3 vA;
      void main(){
        if(uMode==1){gl_FragColor=vec4(vC,1.0);return;}
        vec3 N=normalize(vN);vec3 base=vC;float sp=0.0;
        if(uMode==2){vec2 uv=uAffine>0.5?vA.xy/vA.z:vT;vec4 tx=texture2D(uTex,uv);if(tx.a<uAT)discard;base=tx.rgb;
          if(uNStr>0.0){vec3 m=texture2D(uNMap,uv).xyz*2.0-1.0;m.xy*=uNStr;vec3 T=normalize(vU-N*dot(N,vU));vec3 B=cross(N,T);
            N=normalize(T*m.x+B*m.y+N*max(m.z,0.05));}
          sp=uSpec*pow(max(dot(N,normalize(uL+vec3(0.0,0.0,1.0))),0.0),28.0);}
        float s=uAmb+uDif*max(dot(N,uL),0.0);
        vec3 c=base*s+sp;
        gl_FragColor=uMode==4?vec4(c*uCol.a,uCol.a):vec4(c,1.0);}`;
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr); this.pr = pr;
    this.a = {}; ['aP','aN','aC','aT','aU'].forEach(n => this.a[n] = gl.getAttribLocation(pr, n));
    this.u = {}; ['uM','uR','uSnap','uZB','uOff','uMode','uL','uAmb','uDif','uNStr','uSpec','uAffine','uAT','uCol','uTex','uNMap'].forEach(n => this.u[n] = gl.getUniformLocation(pr, n));
    gl.uniform1i(this.u.uTex, 0); gl.uniform1i(this.u.uNMap, 1);
    gl.enable(gl.DEPTH_TEST);
    this.blank = this.tex(cnv(1,1));
  }
  // geometry: { P:[], N:[], C:[], T:[], U:[] } flat arrays; lines: true for gl.LINES
  mesh(g, lines){
    const gl = this.gl, m = { n: g.P.length/3, lines: !!lines, b: {} };
    const put = (k, arr, sz) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); m.b[k] = { b, sz }; };
    put('aP', g.P, 3); put('aN', g.N && g.N.length ? g.N : new Array(m.n*3).fill(0), 3); put('aC', g.C && g.C.length ? g.C : new Array(m.n*3).fill(1), 3);
    put('aT', g.T && g.T.length ? g.T : new Array(m.n*2).fill(0), 2); put('aU', g.U && g.U.length ? g.U : new Array(m.n*3).fill(0), 3);
    return m;
  }
  free(m){ if (!m) return; Object.values(m.b).forEach(x => this.gl.deleteBuffer(x.b)); }
  tex(src, o = {}){
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, o.nearest ? gl.NEAREST : gl.LINEAR);
    if (o.mip){ gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, o.nearest ? gl.NEAREST_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, o.nearest ? gl.NEAREST : gl.LINEAR);
    return t;
  }
  draw(m, U){
    if (!m || !m.n) return;
    const gl = this.gl, u = this.u;
    for (const k in m.b){ const loc = this.a[k]; if (loc < 0) continue; gl.bindBuffer(gl.ARRAY_BUFFER, m.b[k].b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, m.b[k].sz, gl.FLOAT, false, 0, 0); }
    gl.uniformMatrix4fv(u.uM, false, U.M); gl.uniformMatrix3fv(u.uR, false, U.R || new Float32Array([1,0,0,0,1,0,0,0,1]));
    gl.uniform1i(u.uMode, U.mode || 0); gl.uniform3fv(u.uL, U.L || LIGHT); gl.uniform1f(u.uAmb, U.amb ?? AMB); gl.uniform1f(u.uDif, U.dif ?? DIF);
    gl.uniform1f(u.uNStr, U.nstr || 0); gl.uniform1f(u.uSpec, U.spec || 0); gl.uniform1f(u.uAffine, U.affine || 0); gl.uniform1f(u.uAT, U.at || 0); gl.uniform1f(u.uSnap, U.snap || 0); gl.uniform1f(u.uZB, U.zb || 0); gl.uniform2fv(u.uOff, U.off || [0,0]);
    gl.uniform4fv(u.uCol, U.col || [1,1,1,1]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, U.tex || this.blank);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, U.nmap || this.blank);
    gl.drawArrays(m.lines ? gl.LINES : gl.TRIANGLES, 0, m.n);
  }
}
// Reference lighting (camera space). The bake divides it back out, so keep it soft.
const LIGHT = norm([-0.3, 0.65, 0.7]);
const AMB = 0.72, DIF = 0.3;
const shadeOf = nv => AMB + DIF*Math.max(0, dot(nv, LIGHT));

// Geometry builders
const c01 = c => c.map(v => v/255);
function pushTri(g, a, b, c, n, col){ for (const p of [a,b,c]){ g.P.push(...p); g.N.push(...n); g.C.push(...col); } }
function pushPoly(g, V, n, col){ for (let i=1;i<V.length-1;i++) pushTri(g, V[0], V[i], V[i+1], n, col); }
function pushLine(g, a, b, col){ g.P.push(...a, ...b); g.C.push(...col, ...col); }
const G = () => ({ P:[], N:[], C:[], T:[], U:[] });

/* The scale figure: a classic blocky R6-style person (legs, torso, arms, head), 5.2 studs = 1.8 m tall, facing +z */
function avatarGeo(x0, z0){
  const g = G(), s = AV_H/5.2, C = { skin:[245,205,48], shirt:[13,105,172], pants:[75,151,75], ink:[30,27,22] };
  const box = (a, b, col) => { const [x1,y1,z1] = a.map(v => v*s), [x2,y2,z2] = b.map(v => v*s), X = x => x0 + x, Z = z => z0 + z, c = c01(col);
    const P = [[[X(x1),y1,Z(z2)],[X(x2),y1,Z(z2)],[X(x2),y2,Z(z2)],[X(x1),y2,Z(z2)],[0,0,1]], [[X(x2),y1,Z(z1)],[X(x1),y1,Z(z1)],[X(x1),y2,Z(z1)],[X(x2),y2,Z(z1)],[0,0,-1]],
      [[X(x2),y1,Z(z2)],[X(x2),y1,Z(z1)],[X(x2),y2,Z(z1)],[X(x2),y2,Z(z2)],[1,0,0]], [[X(x1),y1,Z(z1)],[X(x1),y1,Z(z2)],[X(x1),y2,Z(z2)],[X(x1),y2,Z(z1)],[-1,0,0]],
      [[X(x1),y2,Z(z2)],[X(x2),y2,Z(z2)],[X(x2),y2,Z(z1)],[X(x1),y2,Z(z1)],[0,1,0]], [[X(x1),y1,Z(z1)],[X(x2),y1,Z(z1)],[X(x2),y1,Z(z2)],[X(x1),y1,Z(z2)],[0,-1,0]]];
    P.forEach(q => pushPoly(g, q.slice(0,4), q[4], c)); };
  box([-1,0,-0.5],[0,2,0.5], C.pants); box([0,0,-0.5],[1,2,0.5], C.pants);
  box([-1,2,-0.5],[1,4,0.5], C.shirt); box([-2,2,-0.5],[-1,4,0.5], C.skin); box([1,2,-0.5],[2,4,0.5], C.skin);
  box([-0.6,4,-0.6],[0.6,5.2,0.6], C.skin);
  box([-0.32,4.62,0.6],[-0.16,4.82,0.62], C.ink); box([0.16,4.62,0.6],[0.32,4.82,0.62], C.ink); box([-0.25,4.3,0.6],[0.25,4.38,0.62], C.ink);
  return g;
}
const AV_H = 1.8;

/* The scale figure wearing a real Grug character: the visitor's active saved outfit (GrugOutfits, on grugdigital.com),
   else Grug, the site's default character. A character .glb is R6 blocks in studs, facing -Z, origin at the torso centre:
   it's turned to face +Z (the building's front), scaled to AV_H tall and stood on the ground. */
async function loadFigure(r3, buf){
  const u8 = new Uint8Array(buf), dv = new DataView(buf), jl = dv.getUint32(12, true);
  const J = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jl))), bin = u8.subarray(28 + jl);
  const view = i => { const v = J.bufferViews[i]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
  const acc = i => { const a = J.accessors[i], v = J.bufferViews[a.bufferView], n = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4 }[a.type], C = { 5126:Float32Array, 5125:Uint32Array, 5123:Uint16Array, 5121:Uint8Array }[a.componentType];
    const off = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || n*C.BYTES_PER_ELEMENT, out = new Float32Array(a.count*n), dvb = new DataView(bin.buffer, bin.byteOffset + off);
    const rd = { 5126:(o) => dvb.getFloat32(o, true), 5125:(o) => dvb.getUint32(o, true), 5123:(o) => dvb.getUint16(o, true), 5121:(o) => dvb.getUint8(o) }[a.componentType];
    for (let k=0;k<a.count;k++) for (let c=0;c<n;c++) out[k*n+c] = rd(k*stride + c*C.BYTES_PER_ELEMENT); return out; };
  const parent = {}; J.nodes.forEach((n, i) => (n.children || []).forEach(c => parent[c] = i));
  const local = n => { const t = n.translation || [0,0,0], s = n.scale || [1,1,1], [x,y,z,w] = n.rotation || [0,0,0,1];
    const r = [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]];
    return p => [r[0][0]*p[0]*s[0] + r[0][1]*p[1]*s[1] + r[0][2]*p[2]*s[2] + t[0], r[1][0]*p[0]*s[0] + r[1][1]*p[1]*s[1] + r[1][2]*p[2]*s[2] + t[1], r[2][0]*p[0]*s[0] + r[2][1]*p[1]*s[1] + r[2][2]*p[2]*s[2] + t[2]]; };
  const world = i => { const fs = []; for (let k=i; k!=null; k=parent[k]) fs.push(local(J.nodes[k])); return p => fs.reduce((q, f) => f(q), p); };
  const texCache = {};
  const tex = async ti => { if (ti == null) return null; if (texCache[ti]) return texCache[ti]; const im = J.images[J.textures[ti].source];
    const img = await new Promise((res, rej) => { const e = new Image(); e.onload = () => res(e); e.onerror = rej; e.src = URL.createObjectURL(new Blob([view(im.bufferView)], { type: im.mimeType })); });
    return texCache[ti] = r3.tex(img); };
  const parts = []; let minY = 1e9, maxY = -1e9;
  for (let ni=0; ni<J.nodes.length; ni++){
    const nd = J.nodes[ni]; if (nd.mesh == null || /HumanoidRootPart/i.test(nd.name || '')) continue; const W = world(ni);
    for (const pr of J.meshes[nd.mesh].primitives){
      const P = acc(pr.attributes.POSITION), N = pr.attributes.NORMAL != null ? acc(pr.attributes.NORMAL) : null, T = pr.attributes.TEXCOORD_0 != null ? acc(pr.attributes.TEXCOORD_0) : null;
      const I = pr.indices != null ? acc(pr.indices) : Array.from({ length: P.length/3 }, (_, k) => k);
      const m = J.materials && pr.material != null ? J.materials[pr.material] : {}, pbr = m.pbrMetallicRoughness || {}, f = pbr.baseColorFactor || [1,1,1,1];
      if (f[3] < 0.05 && !pbr.baseColorTexture) continue;
      const g = { P:[], N:[], C:[], T:[], U:[] }, o0 = W([0,0,0]);
      for (const k of I){ const p = W([P[k*3], P[k*3+1], P[k*3+2]]); g.P.push(-p[0], p[1], -p[2]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
        const n = N ? sub(W([N[k*3], N[k*3+1], N[k*3+2]]), o0) : [0,1,0]; g.N.push(-n[0], n[1], -n[2]);
        g.C.push(f[0], f[1], f[2]); g.T.push(T ? T[k*2] : 0, T ? T[k*2+1] : 0); g.U.push(1,0,0); }
      parts.push({ g, tex: pbr.baseColorTexture ? await tex(pbr.baseColorTexture.index) : null, at: m.alphaMode === 'MASK' ? (m.alphaCutoff ?? 0.5) : m.alphaMode === 'BLEND' ? 0.5 : 0 });
    }
  }
  if (!parts.length) return null;
  const s = AV_H/5.2;   // studs → metres, the same as the blocky figure (hair may add a little on top)
  return parts.map(p => { const P = p.g.P; for (let k=0;k<P.length;k+=3){ P[k] *= s; P[k+1] = (P[k+1] - minY)*s; P[k+2] *= s; } return { mesh: r3.mesh(p.g), tex: p.tex, at: p.at }; });
}
async function figureGLB(){
  try { if (window.GrugOutfits){ const r = await GrugOutfits.activeRecord(); if (r && r.glb) return await r.glb.arrayBuffer(); } } catch (e) {}
  try { const r = await fetch('/arcade/outfits/grug.glb'); if (r.ok) return await r.arrayBuffer(); } catch (e) {}
  return null;
}
function drawFigure(r3, fig, M, R, at){
  const T = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, at[0],0,at[2],1]), MM = m4mul(M, T);
  fig.forEach(p => r3.draw(p.mesh, p.tex ? { M:MM, R, mode:2, tex:p.tex, at:p.at, amb:0.62, dif:0.48 } : { M:MM, R, mode:0, amb:0.62, dif:0.48 }));
}
