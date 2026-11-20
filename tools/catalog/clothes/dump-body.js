(async()=>{const G=window.GrugCatalog,s=G.sandy,b=s.n3.body; const g=b.geometry; const enc=a=>{const u=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let str='';for(let i=0;i<u.length;i+=32768)str+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(str)};
const out={name:b.name, type:b.type, count:g.attributes.position.count, attrs:Object.keys(g.attributes), pos:enc(new Float32Array(g.attributes.position.array)), nor:enc(new Float32Array(g.attributes.normal.array)), si:enc(new Float32Array(Array.from(g.attributes.skinIndex.array))), sw:enc(new Float32Array(g.attributes.skinWeight.array)), idx:enc(new Uint32Array(g.index.array)), bones:b.skeleton.bones.map(x=>x.name), inv:b.skeleton.boneInverses.map(m=>m.elements.slice()), bind:b.bindMatrix.elements.slice(), mw:b.matrixWorld.elements.slice(), parent:b.parent&&b.parent.name, bindMode:b.bindMode};
// rest positions of the bones in world now, too
s.object3d.updateMatrixWorld(true); out.boneWorld=b.skeleton.bones.map(x=>x.matrixWorld.elements.slice()); 
g.computeBoundingBox(); out.box=[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()];
return JSON.stringify(out)})()
