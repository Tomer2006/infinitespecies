#!/usr/bin/env node
/**
 * Split a large taxonomy JSON into chunked files for lazy loading.
 *
 * Usage:
 *   node tools/split-taxonomy.js --input big.json --outDir data --baseUrl /data \
 *     --topFile root.json --split-levels Kingdom,Phylum,Class,Order,Family,Genus --pretty
 */

const fs = require('fs/promises');
const path = require('path');

// Depth-based levels; no hardcoded rank names required
function levelNameAtDepth(d){ return `Level ${d}`; }

function parseArgs(argv){
  const out={ input:null,outDir:'data',baseUrl:'/data',topFile:'root.json',splitLevels:['Kingdom','Phylum','Class','Order','Family','Genus'],pretty:false };
  for(let i=2;i<argv.length;i++){
    const a=argv[i];
    if(a==='--input') out.input=argv[++i];
    else if(a==='--outDir') out.outDir=argv[++i];
    else if(a==='--baseUrl') out.baseUrl=argv[++i];
    else if(a==='--topFile') out.topFile=argv[++i];
    else if(a==='--split-levels') out.splitLevels=argv[++i].split(',').map(s=>s.trim()).filter(Boolean);
    else if(a==='--pretty') out.pretty=true;
    else if(a==='--help'||a==='-h'){
      console.log('Usage: node tools/split-taxonomy.js --input big.json [--outDir data] [--baseUrl /data] [--topFile root.json] [--split-levels Kingdom,Phylum,...] [--pretty]');
      process.exit(0);
    }
  }
  if(!out.input){ console.error('Missing --input <file.json>'); process.exit(1); }
  return out;
}

function slugify(name){
  return String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .toLowerCase()
    .slice(0,48);
}

function mapToChildren(obj){
  const out=[]; if(!obj||typeof obj!=='object') return out;
  for(const [key,val] of Object.entries(obj)){
    const node={ name:String(key) };
    if(val && typeof val==='object' && Object.keys(val).length){ node.children=mapToChildren(val); }
    else { node.children=[]; }
    out.push(node);
  }
  return out;
}

function normalizeTree(rootLike){
  if(Array.isArray(rootLike)) return { name:'Life', level:'Life', children:rootLike };
  if(typeof rootLike!=='object' || rootLike===null) throw new Error('Top-level JSON must be an object or array');
  const hasStructured = Object.prototype.hasOwnProperty.call(rootLike,'name') || Object.prototype.hasOwnProperty.call(rootLike,'children');
  if(!hasStructured){
    const keys=Object.keys(rootLike);
    if(keys.length===1){ const rootName=keys[0]; return { name:String(rootName), children:mapToChildren(rootLike[rootName]) }; }
    return { name:'Life', level:'Life', children:mapToChildren(rootLike) };
  }
  if(!Array.isArray(rootLike.children)) rootLike.children = rootLike.children ? [].concat(rootLike.children) : [];
  return rootLike;
}

function inferLevelByDepth(depth){ return levelNameAtDepth(depth); }

function fillLevels(node, depth=0, parent=null){
  node.name = String(node.name ?? 'Unnamed');
  node.level = node.level || inferLevelByDepth(depth);
  node.parent = parent;
  if(!Array.isArray(node.children)) node.children = node.children ? [].concat(node.children) : [];
  for(const c of node.children) fillLevels(c, depth+1, node);
  return node;
}

let globalId=1;
function assignIds(node){ node._id=globalId++; for(const c of node.children||[]) assignIds(c); }

async function ensureDir(dir){ await fs.mkdir(dir,{recursive:true}); }
async function writeJSON(filePath, data, pretty){ await ensureDir(path.dirname(filePath)); await fs.writeFile(filePath, JSON.stringify(data,null,pretty?2:0)); }

function planFileName(node){ const slug=slugify(node.name)||'node'; return `${node._id}-${slug}.json`; }

function getDepthFromLevel(levelStr){
  const m = /^Level\s+(\d+)/i.exec(String(levelStr||''));
  return m ? parseInt(m[1], 10) : undefined;
}

function shouldSplit(node, splitSet){
  const levelName = String(node.level || '');
  const d = getDepthFromLevel(levelName);
  return splitSet.has(levelName) || (d != null && splitSet.has(String(d)));
}

function buildChunk(node, splitSet, baseUrl){
  const here = { name: node.name, level: node.level, children: [] };
  for(const child of node.children||[]){
    if(shouldSplit(child, splitSet)){
      const fileName = planFileName(child);
      const url = path.posix.join(baseUrl.replace(/\\/g,'/'), fileName);
      here.children.push({ name: child.name, level: child.level, childrenUrl: url.startsWith('/')?url:'/'+url });
    } else {
      const embedded = buildChunk(child, splitSet, baseUrl).doc;
      here.children.push(embedded);
    }
  }
  return { doc: here };
}

async function writeSubtree(node, splitSet, outDir, baseUrl, pretty){
  const { doc } = buildChunk(node, splitSet, baseUrl);
  const fileName = planFileName(node);
  await writeJSON(path.join(outDir, fileName), doc, pretty);
  for(const child of node.children||[]){ if(splitSet.has(child.level)) await writeSubtree(child, splitSet, outDir, baseUrl, pretty); }
  return fileName;
}

async function main(){
  const opts = parseArgs(process.argv);
  const pretty = !!opts.pretty;
  const raw = await fs.readFile(opts.input,'utf8');
  const parsed = JSON.parse(raw);
  const root = fillLevels(normalizeTree(parsed));
  assignIds(root);
  await ensureDir(opts.outDir);
  const splitSet = new Set(opts.splitLevels.map(x=>String(x)));

  const rootDoc = buildChunk(root, splitSet, opts.baseUrl).doc;
  await writeJSON(path.join(opts.outDir, opts.topFile), rootDoc, pretty);
  async function walkAndWrite(node){
    for(const child of node.children||[]){
      if(shouldSplit(child, splitSet)){
        await writeSubtree(child, splitSet, opts.outDir, opts.baseUrl, pretty);
      } else {
        await walkAndWrite(child);
      }
    }
  }
  await walkAndWrite(root);
  console.log(`Done. Root: ${path.join(opts.outDir, opts.topFile)}  Base URL: ${opts.baseUrl}`);
}

main().catch(err=>{ console.error(err); process.exit(1); });


