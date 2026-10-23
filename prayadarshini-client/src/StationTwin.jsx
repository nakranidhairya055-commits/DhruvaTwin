import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/* ═══ FALLBACK ═══ */
const Fallback = () => (
  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'#7dd3c0', fontFamily:'monospace', background:'#050912' }}>
    <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
    <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>3D VIEWER UNAVAILABLE</div>
    <button onClick={() => window.location.reload()} style={{ padding:'10px 24px', border:'1px solid #7dd3c0', background:'transparent', color:'#7dd3c0', fontWeight:700, cursor:'pointer', fontFamily:'monospace' }}>RELOAD</button>
  </div>
);

/* ═══ POP-UP TEXT SPRITE (No HTML, No Mirror, No Crash) ═══ */
function PopUpText({ text, position, isNear, baseColor = '#7dd3c0', nearColor = '#ff00ff' }) {
  const spriteRef = useRef();
  
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(10, 20, 32, 0.9)';
    ctx.fillRect(10, 10, 492, 108);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 492, 108);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [text]);

  useFrame(() => {
    if (spriteRef.current) {
      const targetScale = isNear ? 2.5 : 1.5;
      spriteRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale * 0.25, 1), 0.1);
      if (spriteRef.current.material) {
        spriteRef.current.material.color.lerp(new THREE.Color(isNear ? nearColor : baseColor), 0.1);
      }
    }
  });

  return (
    <sprite ref={spriteRef} position={position} scale={[1.5, 0.375, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

/* ═══ CHARACTER ═══ */
function Character({ playerRef, color='#e63946', label, isNPC=false, gender='M' }) {
  const g = useRef(), la = useRef(), ra = useRef(), ll = useRef(), rl = useRef(), ph = useRef(0);
  const F = gender === 'F';
  useFrame((_, d) => {
    const s = playerRef.current;
    if (g.current && !isNPC) {
      g.current.position.lerp(new THREE.Vector3(s.x, s.y||0, s.z), 1 - Math.exp(-15*d));
      let df = (s.yaw||0) - g.current.rotation.y;
      while (df < -Math.PI) df += Math.PI*2;
      while (df > Math.PI) df -= Math.PI*2;
      g.current.rotation.y += df * (1 - Math.exp(-15*d));
    }
    ph.current += d * (s.walking ? 12 : 2);
    const sw = s.walking ? Math.sin(ph.current) * 0.8 : 0;
    if (ll.current) ll.current.rotation.x = sw;
    if (rl.current) rl.current.rotation.x = -sw;
    if (la.current) la.current.rotation.x = -sw * 0.8;
    if (ra.current) ra.current.rotation.x = sw * 0.8;
  });
  return (
    <group ref={g}>
      <mesh position={[0,1.6,0]}><sphereGeometry args={[0.22,16,12]} /><meshStandardMaterial color="#ffd1b3" roughness={0.7} /></mesh>
      <mesh position={[0,1.7,-0.02]}><sphereGeometry args={[0.24,16,12,0,Math.PI*2,0,Math.PI/1.5]} /><meshStandardMaterial color={F?'#2a1a2e':'#1a1a2e'} roughness={0.8} /></mesh>
      {F && (<>
        <mesh position={[0,1.35,-0.16]}><capsuleGeometry args={[0.15,0.4,4,12]} /><meshStandardMaterial color="#2a1a2e" roughness={0.85} /></mesh>
        <mesh position={[-0.17,1.52,-0.02]}><boxGeometry args={[0.06,0.28,0.18]} /><meshStandardMaterial color="#2a1a2e" roughness={0.85} /></mesh>
        <mesh position={[0.17,1.52,-0.02]}><boxGeometry args={[0.06,0.28,0.18]} /><meshStandardMaterial color="#2a1a2e" roughness={0.85} /></mesh>
      </>)}
      <mesh position={[0,1.1,0]}><cylinderGeometry args={F?[0.2,0.24,0.6,16]:[0.23,0.26,0.6,16]} /><meshStandardMaterial color={color} roughness={0.65} /></mesh>
      <mesh position={[0,1.4,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.2,0.06,16,24]} /><meshStandardMaterial color={F?'#fff':'#e8eef4'} roughness={0.8} /></mesh>
      <group ref={la} position={[-0.28,1.35,0]}><mesh position={[0,-0.25,0]}><capsuleGeometry args={[F?0.07:0.08,0.4,8,12]} /><meshStandardMaterial color={color} roughness={0.65} /></mesh></group>
      <group ref={ra} position={[0.28,1.35,0]}><mesh position={[0,-0.25,0]}><capsuleGeometry args={[F?0.07:0.08,0.4,8,12]} /><meshStandardMaterial color={color} roughness={0.65} /></mesh></group>
      <group ref={ll} position={[-0.12,0.75,0]}><mesh position={[0,-0.35,0]}><capsuleGeometry args={[0.1,0.5,8,12]} /><meshStandardMaterial color="#1d3557" roughness={0.8} /></mesh></group>
      <group ref={rl} position={[0.12,0.75,0]}><mesh position={[0,-0.35,0]}><capsuleGeometry args={[0.1,0.5,8,12]} /><meshStandardMaterial color="#1d3557" roughness={0.8} /></mesh></group>
      {label && <PopUpText text={label} position={[0, 2.1, 0]} isNear={false} baseColor="#7dd3c0" />}
    </group>
  );
}

/* ═══ NPC ═══ */
function NPC({ name, gender='M', color, range=18, onRemove, hidden, speed=1.4, playerRef }) {
  const r = useRef({ pos:new THREE.Vector3((Math.random()-0.5)*range*2,0,(Math.random()-0.5)*1.5), target:new THREE.Vector3((Math.random()-0.5)*range*2,0,(Math.random()-0.5)*1.5), yaw:0, walking:true, waitUntil:0 });
  const g = useRef();
  const [hovered, setHovered] = useState(false);
  const [isNear, setIsNear] = useState(false);

  useFrame((_, d) => {
    if (hidden) return;
    const s = r.current, now = performance.now()/1000;
    if (now < s.waitUntil) s.walking = false;
    else {
      if (s.pos.distanceTo(s.target) < 0.3) {
        s.waitUntil = now + 0.8 + Math.random()*2.5;
        s.target.set((Math.random()-0.5)*range*2, 0, (Math.random()-0.5)*1.5);
      } else {
        const dir = s.target.clone().sub(s.pos).normalize();
        s.pos.addScaledVector(dir, speed*d);
        s.yaw = Math.atan2(dir.x, dir.z);
        s.walking = true;
      }
    }
    if (g.current) {
      g.current.position.copy(s.pos);
      let df = s.yaw - g.current.rotation.y;
      while (df < -Math.PI) df += Math.PI*2;
      while (df > Math.PI) df -= Math.PI*2;
      g.current.rotation.y += df * (1 - Math.exp(-10*d));
    }
    if (playerRef && playerRef.current && g.current) {
      const distToPlayer = s.pos.distanceTo(new THREE.Vector3(playerRef.current.x, playerRef.current.y, playerRef.current.z));
      const nearNow = distToPlayer < 6.5;
      if (nearNow !== isNear) setIsNear(nearNow);
    }
  });

  if (hidden) return null;
  return (
    <group ref={g}>
      <group
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor='pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor='default'; }}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
      >
        <Character playerRef={{ current:{ x:0,y:0,z:0,yaw:0,walking:r.current.walking } }} color={hovered ? '#ff8c1a' : (isNear ? '#ff00ff' : color)} gender={gender} isNPC />
      </group>
      <PopUpText
        text={name}
        position={[0, 2.2 + (isNear ? 0.5 : 0), 0]}
        isNear={isNear}
        baseColor="#7dd3c0"
        nearColor="#ff00ff"
      />
      <mesh position={[0,2.4,0]}>
        <circleGeometry args={[0.08,12]} />
        <meshBasicMaterial color={hovered ? '#ff8c1a' : '#dc2626'} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function Penguin({ position, range=3, hidden }) {
  const g = useRef(), t = useRef(0);
  useFrame((_, d) => {
    if (!g.current || hidden) return;
    t.current += d;
    g.current.position.x = position[0] + Math.sin(t.current*0.8)*range;
    g.current.rotation.y = Math.cos(t.current*0.8) > 0 ? Math.PI/2 : -Math.PI/2;
  });
  if (hidden) return null;
  return (
    <group ref={g} position={[position[0],0,position[2]]}>
      <mesh position={[0,0.55,0]}><capsuleGeometry args={[0.28,0.55,8,12]} /><meshStandardMaterial color="#1a1a2e" roughness={0.75} /></mesh>
      <mesh position={[0,0.5,0.16]}><sphereGeometry args={[0.25,12,10]} /><meshStandardMaterial color="#f0f4f8" roughness={0.6} /></mesh>
      <mesh position={[0,1.15,0]}><sphereGeometry args={[0.22,12,10]} /><meshStandardMaterial color="#1a1a2e" roughness={0.75} /></mesh>
      <mesh position={[0,1.12,0.22]} rotation={[Math.PI/2,0,0]}><coneGeometry args={[0.05,0.18,8]} /><meshStandardMaterial color="#ff9500" roughness={0.6} /></mesh>
    </group>
  );
}

function Seal({ position, hidden }) {
  const g = useRef();
  useFrame((_, d) => { if (!hidden && g.current) g.current.rotation.y = Math.sin(d*0.5)*0.3; });
  if (hidden) return null;
  return (
    <group ref={g} position={position}>
      <mesh position={[0,0.4,0]} rotation={[0,0,Math.PI/2]}><capsuleGeometry args={[0.4,0.8,8,12]} /><meshStandardMaterial color="#a89080" roughness={0.85} /></mesh>
      <mesh position={[0.6,0.5,0]}><sphereGeometry args={[0.25,12,10]} /><meshStandardMaterial color="#a89080" roughness={0.85} /></mesh>
    </group>
  );
}

/* ═══ FURNITURE ═══ */
const Bed = ({ position }) => (
  <group position={position}>
    <mesh position={[0,0.35,0]}><boxGeometry args={[1.05,0.22,2.0]} /><meshStandardMaterial color="#5a4030" roughness={0.7} /></mesh>
    <mesh position={[0,0.55,0]}><boxGeometry args={[1.0,0.18,1.9]} /><meshStandardMaterial color="#e8eef4" roughness={0.9} /></mesh>
    <mesh position={[0,0.68,0.4]}><boxGeometry args={[1.0,0.08,1.0]} /><meshStandardMaterial color="#3b82c9" roughness={0.85} /></mesh>
  </group>
);
const Desk = ({ position }) => (
  <group position={position}>
    <mesh position={[0,0.75,0]}><boxGeometry args={[1.5,0.05,0.75]} /><meshStandardMaterial color="#8b6f47" roughness={0.75} /></mesh>
    {[[-0.65,-0.28],[0.65,-0.28],[-0.65,0.28],[0.65,0.28]].map(([x,z],i) => (
      <mesh key={i} position={[x,0.37,z]}><boxGeometry args={[0.07,0.75,0.07]} /><meshStandardMaterial color="#333" metalness={0.5} /></mesh>
    ))}
  </group>
);
const Monitor = ({ position, color='#00d9ff' }) => (
  <group position={position}>
    <mesh><boxGeometry args={[0.55,0.38,0.04]} /><meshStandardMaterial color="#151515" metalness={0.6} /></mesh>
    <mesh position={[0,0,0.025]}><planeGeometry args={[0.5,0.33]} /><meshBasicMaterial color={color} /></mesh>
    <mesh position={[0,-0.22,0]}><cylinderGeometry args={[0.015,0.015,0.15,8]} /><meshStandardMaterial color="#333" /></mesh>
  </group>
);
const Chair = ({ position, rotation=[0,0,0] }) => (
  <group position={position} rotation={rotation}>
    <mesh position={[0,0.45,0]}><boxGeometry args={[0.48,0.06,0.48]} /><meshStandardMaterial color="#4a5568" roughness={0.7} /></mesh>
    <mesh position={[0,0.78,-0.2]}><boxGeometry args={[0.48,0.6,0.06]} /><meshStandardMaterial color="#4a5568" roughness={0.7} /></mesh>
  </group>
);

function RoomContent({ type }) {
  switch (type) {
    case 'control': return (<><Desk position={[0,0,-1]} /><Monitor position={[-0.4,1.1,-1.3]} color="#00d9ff" /><Monitor position={[0.4,1.1,-1.3]} color="#27c93f" /><Chair position={[0,0,-0.3]} rotation={[0,Math.PI,0]} /></>);
    case 'lab': return (<><Desk position={[-1,0,-1.5]} /><Desk position={[1,0,-1.5]} /><Monitor position={[-1,1.1,-1.8]} color="#ffab00" /><Chair position={[-1,0,-0.5]} /></>);
    case 'medical': return (<><Bed position={[-1,0,0]} /><mesh position={[1.5,0.8,-1.5]}><boxGeometry args={[0.7,1.5,0.55]} /><meshStandardMaterial color="#f0f0f0" /></mesh></>);
    case 'crew': return <><Bed position={[-1.1,0,0]} /><Bed position={[1.1,0,0]} /></>;
    case 'meeting': return (<><Desk position={[0,0,0]} /><Chair position={[-1,0,-1]} /><Chair position={[1,0,-1]} /></>);
    case 'library': return (<><mesh position={[-2,1,0]}><boxGeometry args={[0.3,2,2.5]} /><meshStandardMaterial color="#5a4030" /></mesh><mesh position={[2,1,0]}><boxGeometry args={[0.3,2,2.5]} /><meshStandardMaterial color="#5a4030" /></mesh><Desk position={[0,0,0]} /></>);
    case 'server': return (<>{[-1,0,1].map((x,i) => <mesh key={i} position={[x,1,0]}><boxGeometry args={[0.8,2,0.8]} /><meshStandardMaterial color="#1a2030" metalness={0.7} /></mesh>)}</>);
    case 'storage': return (<>{[-1.5,1.5].map((x,i) => <mesh key={i} position={[x,1,0]}><boxGeometry args={[0.8,2,3]} /><meshStandardMaterial color="#7a6a5a" /></mesh>)}</>);
    case 'gen': return (<>{[-1.3,1.3].map((x,i) => <mesh key={i} position={[x,0.7,0]}><boxGeometry args={[1.8,1.3,1.3]} /><meshStandardMaterial color="#e8b529" metalness={0.5} /></mesh>)}</>);
    case 'pump': return (<>{[-1.2,0,1.2].map((x,i) => <mesh key={i} position={[x,0.5,0]}><cylinderGeometry args={[0.42,0.42,1,16]} /><meshStandardMaterial color="#e8b529" metalness={0.5} /></mesh>)}</>);
    case 'comms': return (<><Desk position={[0,0,-1.5]} /><Monitor position={[-0.4,1.1,-1.8]} color="#27c93f" /></>);
    case 'weather': return (<><Desk position={[0,0,-1.5]} /><Monitor position={[0.4,1.1,-1.8]} color="#a855f7" /></>);
    case 'coldstorage': return <mesh position={[0,1,-1.5]}><boxGeometry args={[2.5,2,1]} /><meshStandardMaterial color="#dce8f2" /></mesh>;
    case 'mess': return (<>{[-1.3,1.3].map((x,i) => <mesh key={i} position={[x,0.75,0]}><boxGeometry args={[1.2,0.1,2.5]} /><meshStandardMaterial color="#c8a878" /></mesh>)}</>);
    case 'galley': return <mesh position={[0,0.45,-1.5]}><boxGeometry args={[3.5,0.9,0.7]} /><meshStandardMaterial color="#a0a8b0" /></mesh>;
    case 'rec': return (<><mesh position={[-1.5,0.35,0]}><boxGeometry args={[2.1,0.5,0.9]} /><meshStandardMaterial color="#c1272d" /></mesh><mesh position={[1.8,1.6,0]}><boxGeometry args={[0.06,1.2,1.8]} /><meshStandardMaterial color="#111" /></mesh></>);
    case 'observation': return <mesh position={[0,1.6,-1.9]}><boxGeometry args={[4.2,1.7,0.06]} /><meshStandardMaterial color="#7ec8ff" transparent opacity={0.4} /></mesh>;
    case 'shelter': return (<>{[-1.2,1.2].map((x,i) => <mesh key={i} position={[x,0.4,0]}><boxGeometry args={[0.95,0.8,2]} /><meshStandardMaterial color="#8b7a5a" /></mesh>)}</>);
    case 'fuel': return <mesh position={[0,0.85,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.75,0.75,3.5,20]} /><meshStandardMaterial color="#c94b0f" metalness={0.5} /></mesh>;
    case 'gym': return (<>{[-1.3,0,1.3].map((x,i) => <mesh key={i} position={[x,0.15,0]}><boxGeometry args={[0.7,0.2,1.7]} /><meshStandardMaterial color="#2d3748" /></mesh>)}</>);
    case 'arcade': return (<>{[-1.4,-0.5,0.5,1.4].map((x,i) => <mesh key={i} position={[x,0.6,-0.5]}><boxGeometry args={[0.75,1.2,0.75]} /><meshStandardMaterial color={['#c1272d','#1e5a8a','#e8b529','#7c3aed'][i]} /></mesh>)}</>);
    case 'hydroponics': return (<>{[-1.3,0,1.3].map((x,i) => <group key={i} position={[x,0.8,0]}><mesh><boxGeometry args={[1.2,0.1,0.6]} /><meshStandardMaterial color="#4a5568" /></mesh>{[-0.35,0,0.35].map((sx,j) => <mesh key={j} position={[sx,0.2,0]}><sphereGeometry args={[0.15,10,8]} /><meshStandardMaterial color="#27c93f" /></mesh>)}</group>)}</>);
    case 'washroom': return (<>{[-1.2,0,1.2].map((x,i) => <mesh key={i} position={[x,0.85,-1.2]}><boxGeometry args={[0.6,0.15,0.5]} /><meshStandardMaterial color="#e8eef4" /></mesh>)}</>);
    default: return <Desk position={[0,0,-1]} />;
  }
}

/* ═══ ROOM ═══ */
function Room({ side, at, type, name, halfW, H, playerRef }) {
  const w = 6, d = 4.5;
  const cx = side==='left' ? -halfW-w/2 : halfW+w/2;
  const doorRef = useRef();
  const [isNear, setIsNear] = useState(false);

  useFrame(() => {
    if (!playerRef?.current) return;
    const p = playerRef.current;
    const dist = Math.sqrt((p.x-cx) ** 2 + (p.z-at) ** 2);
    const nearNow = dist < 9.5;
    if (nearNow !== isNear) setIsNear(nearNow);
    if (doorRef.current) {
      doorRef.current.rotation.y += ((dist < 2.5 ? Math.PI/2.2 : 0) - doorRef.current.rotation.y) * 0.15;
    }
  });

  return (
    <group position={[cx,0,at]}>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.01,0]}><planeGeometry args={[w,d]} /><meshStandardMaterial color="#2a3040" roughness={0.85} /></mesh>
      <mesh position={[side==='left'?-w/2:w/2,H/2,0]}><boxGeometry args={[0.15,H,d]} /><meshStandardMaterial color="#e0e6ee" roughness={0.9} /></mesh>
      <mesh position={[0,H/2,-d/2]}><boxGeometry args={[w,H,0.15]} /><meshStandardMaterial color="#e0e6ee" roughness={0.9} /></mesh>
      <mesh position={[0,H/2,d/2]}><boxGeometry args={[w,H,0.15]} /><meshStandardMaterial color="#e0e6ee" roughness={0.9} /></mesh>
      <mesh rotation={[Math.PI/2,0,0]} position={[0,H,0]}><planeGeometry args={[w,d]} /><meshStandardMaterial color="#f5f7fa" roughness={0.95} /></mesh>
      <pointLight position={[0, H/2, 0]} intensity={isNear ? 8 : 1.5} distance={isNear ? 25 : 12} color={isNear ? '#00ffcc' : '#ffaa44'} />
      <RoomContent type={type} />
      <group position={[side==='left'?w/2-0.05:-w/2+0.05,0,0]}>
        <group ref={doorRef}><mesh position={[side==='left'?0.5:-0.5,1.1,0]}><boxGeometry args={[0.9,2.1,0.06]} /><meshStandardMaterial color="#8b6f47" /></mesh></group>
      </group>
      <PopUpText text={name} position={[side==='left'?w/2-0.15:-w/2+0.15, H+0.8, 0]} isNear={isNear} baseColor="#aaddff" nearColor="#ffaa00" />
    </group>
  );
}

/* ═══ FLOOR DATA — MAITRI ═══ */
const MAITRI_FLOORS = [
  { id:0, name:'Ground Floor', L:44, W:4, H:3.5,
    npcs:[
      { name:'Dr. Nyasha Shah', gender:'F', color:'#e76f51', range:18 },
      { name:'Dr. Dhairya Nakrani', gender:'M', color:'#3a8b3a', range:18 },
      { name:'Dr. Harsh Lehri', gender:'M', color:'#3b82c9', range:18 },
      { name:'Dr. Dev Khandheliya', gender:'M', color:'#7c3aed', range:18 },
      { name:'Dr. Dhavan Tankeriya', gender:'M', color:'#f4a261', range:18 },
    ],
    wildlife:[{ type:'penguin', position:[-6,0,-1], range:2 }],
    rooms:[
      { id:'gen', name:'Generator', type:'gen', side:'left', at:-18 },
      { id:'pump', name:'Pump Room', type:'pump', side:'left', at:-11 },
      { id:'srv', name:'Server', type:'server', side:'left', at:-4 },
      { id:'ctrl', name:'Control', type:'control', side:'left', at:3 },
      { id:'mtg', name:'Meeting', type:'meeting', side:'left', at:10 },
      { id:'lib', name:'Library', type:'library', side:'left', at:17 },
      { id:'fuel', name:'Fuel', type:'fuel', side:'right', at:-18 },
      { id:'com', name:'Comms', type:'comms', side:'right', at:-11 },
      { id:'med', name:'Medical', type:'medical', side:'right', at:-4 },
      { id:'c1', name:'Cabin A', type:'crew', side:'right', at:3 },
      { id:'wash', name:'Washroom', type:'washroom', side:'right', at:10 },
      { id:'stor', name:'Storage', type:'storage', side:'right', at:17 },
    ],
  },
  { id:1, name:'Upper Floor', L:40, W:4, H:3.5,
    npcs:[
      { name:'Dr. Krish Tank', gender:'M', color:'#3a8b3a', range:16 },
      { name:'Dr. Rushi Virda', gender:'F', color:'#c1272d', range:16 },
      { name:'Dr. Jatin Hemnani', gender:'M', color:'#f4a261', range:16 },
      { name:'Dr. Om Kadam', gender:'M', color:'#e8b529', range:16 },
    ],
    wildlife:[{ type:'seal', position:[-8,0,1.5] }],
    rooms:[
      { id:'geo', name:'Geology', type:'lab', side:'left', at:-15 },
      { id:'bio', name:'Biology', type:'lab', side:'left', at:-8 },
      { id:'wx', name:'Weather', type:'weather', side:'left', at:-1 },
      { id:'cold', name:'Cold Store', type:'coldstorage', side:'left', at:6 },
      { id:'c2', name:'Cabin B', type:'crew', side:'left', at:13 },
      { id:'mess', name:'Mess Hall', type:'mess', side:'right', at:-15 },
      { id:'gal', name:'Galley', type:'galley', side:'right', at:-8 },
      { id:'rec', name:'Rec Room', type:'rec', side:'right', at:-1 },
      { id:'obs', name:'Observation', type:'observation', side:'right', at:6 },
      { id:'shl', name:'Shelter', type:'shelter', side:'right', at:13 },
    ],
  },
  { id:2, name:'Sub-Level', L:44, W:4, H:3.5,
    npcs:[
      { name:'Dr. Akshay Patel', gender:'M', color:'#7c3aed', range:18 },
      { name:'Dr. Smith Solanki', gender:'M', color:'#3a8b3a', range:18 },
      { name:'Dr. Prem Tilva', gender:'M', color:'#f4a261', range:18 },
      { name:'Dr. Parv Bhalodi', gender:'M', color:'#3b82c9', range:18 },
    ],
    wildlife:[],
    rooms:[
      { id:'gym', name:'Gymnasium', type:'gym', side:'left', at:-15 },
      { id:'arc', name:'Arcade', type:'arcade', side:'left', at:-7 },
      { id:'hyd', name:'Hydroponics', type:'hydroponics', side:'left', at:1 },
      { id:'adv', name:'Advanced Lab', type:'lab', side:'left', at:9 },
      { id:'srv2', name:'Server B', type:'server', side:'left', at:17 },
      { id:'st2', name:'Storage C', type:'storage', side:'right', at:-15 },
      { id:'med2', name:'Medical Store', type:'medical', side:'right', at:-7 },
      { id:'c3', name:'Cabin C', type:'crew', side:'right', at:1 },
      { id:'r2', name:'Rec B', type:'rec', side:'right', at:9 },
    ],
  },
];

/* ═══ NEW BHARATI UPPER DECK STAFF ═══ */
const NEW_BHARATI_UPPER_STAFF = [
  { name:'Dr. Darshana Patel',      gender:'F', color:'#e76f51', range:20 },
  { name:'Dr. Komil Vora',          gender:'M', color:'#3a8b3a', range:20 },
  { name:'Prof. Darshan Upadhyay',  gender:'M', color:'#3b82c9', range:20 },
  { name:'Prof. Vijay Vyas',        gender:'M', color:'#7c3aed', range:20 },
  { name:'Prof. Dishita Mashru',    gender:'F', color:'#f4a261', range:20 },
  { name:'Prof. Prashant Chauhan',  gender:'M', color:'#e8b529', range:20 },
  { name:'Prof. Aditiba Jadeja',    gender:'F', color:'#c1272d', range:20 },
  { name:'Prof. Soniya Aghera',     gender:'F', color:'#457b9d', range:20 },
  { name:'Prof. Sweetu Sureja',     gender:'F', color:'#e76f51', range:20 },
  { name:'Prof. Chetan Chauhan',    gender:'M', color:'#3a8b3a', range:20 },
  { name:'Prof. Mit Dave',          gender:'M', color:'#3b82c9', range:20 },
  { name:'Prof. Devang Karavadiya', gender:'M', color:'#7c3aed', range:20 },
  { name:'Prof. Hemangi Joshi',     gender:'F', color:'#f4a261', range:20 },
  { name:'Prof. Vira Bhalodiya',    gender:'F', color:'#e8b529', range:20 },
  { name:'Prof. Nehal Karelia',     gender:'F', color:'#c1272d', range:20 },
  { name:'Prof. Jil Bhatti',        gender:'F', color:'#457b9d', range:20 },
  { name:'Prof. Priyanka Dabhi',    gender:'F', color:'#e76f51', range:20 },
  { name:'Prof. Yashvi Trivedi',    gender:'F', color:'#3a8b3a', range:20 },
];

/* Helper: removes from Bharati first floor any name that appears on the second floor */
const dedupeBharatiFirstFloor = (floors) => {
  if (!Array.isArray(floors) || floors.length < 2) return floors || [];
  const firstFloor = floors[0];
  const secondFloor = floors[1];
  if (!firstFloor || !Array.isArray(firstFloor.npcs)) return floors;
  if (!secondFloor || !Array.isArray(secondFloor.npcs)) return floors;

  const secondFloorNames = new Set(
    secondFloor.npcs
      .filter((n) => n && typeof n.name === 'string')
      .map((n) => n.name.trim().toLowerCase().replace(/\s+/g, ' '))
  );

  const cleanedFirstFloor = firstFloor.npcs.filter((n) => {
    if (!n || typeof n.name !== 'string') return true;
    return !secondFloorNames.has(n.name.trim().toLowerCase().replace(/\s+/g, ' '));
  });

  return [
    { ...firstFloor, npcs: cleanedFirstFloor },
    ...floors.slice(1),
  ];
};

/* ═══ FLOOR DATA — BHARATI ═══ */
const BHARATI_FLOORS = dedupeBharatiFirstFloor([
  { id:0, name:'Bharati Main Deck', L:52, W:5.5, H:3.8,
    npcs:[
      { name:'Dr. Bhavesh Rawal',     gender:'M', color:'#3b82c9', range:22 },
      { name:'Dr. Akash Chavda',      gender:'M', color:'#7c3aed', range:22 },
      { name:'Dr. Anup Bhudrani',     gender:'M', color:'#7c3aed', range:22 },
      { name:'Dr. Pooja Dhokia',      gender:'F', color:'#c1272d', range:22 },
      { name:'Dr. Sheron Christy',    gender:'F', color:'#457b9d', range:22 },
      { name:'Ltd. Dr Vishal Nimavat',gender:'M', color:'#3a8b3a', range:22 },
      { name:'Dr. Zarana Mehta',      gender:'F', color:'#c1272d', range:22 },
    ],
    wildlife:[{ type:'seal', position:[0,0,2] }],
    rooms:[
      { id:'ctrl', name:'Control', type:'control', side:'left', at:-22 },
      { id:'com', name:'Comms', type:'comms', side:'left', at:-15 },
      { id:'srv', name:'Server', type:'server', side:'left', at:-8 },
      { id:'lab1', name:'Lab A', type:'lab', side:'left', at:-1 },
      { id:'med', name:'Medical', type:'medical', side:'left', at:6 },
      { id:'mtg', name:'Conference', type:'meeting', side:'left', at:13 },
      { id:'lib', name:'Library', type:'library', side:'left', at:20 },
      { id:'gen', name:'Generator', type:'gen', side:'right', at:-22 },
      { id:'pump', name:'Pump Room', type:'pump', side:'right', at:-15 },
      { id:'fuel', name:'Fuel Store', type:'fuel', side:'right', at:-8 },
      { id:'wx', name:'Weather', type:'weather', side:'right', at:-1 },
      { id:'crew', name:'Cabins', type:'crew', side:'right', at:6 },
      { id:'mess', name:'Mess Hall', type:'mess', side:'right', at:13 },
      { id:'obs', name:'Observation', type:'observation', side:'right', at:20 },
    ],
  },
  { id:1, name:'Bharati Upper Deck', L:46, W:5.5, H:3.8,
    // ── FIXED: npcs array restored here ──
    npcs:[
      // Existing upper-deck staff (from original data)
      { name:'Dr. Pooja Dhokia', gender:'F', color:'#3b82c9', range:20 },
      { name:'Dr. Soniya Aghera', gender:'F', color:'#7c3aed', range:20 },
      { name:'Dr. Jeel Bhatti', gender:'F', color:'#c1272d', range:20 },
      { name:'Dr. Aditi Jadeja', gender:'F', color:'#e76f51', range:20 },
      { name:'Dr. Mit Dave', gender:'M', color:'#3a8b3a', range:20 },
      { name:'Dr. Anup Bhudrani', gender:'M', color:'#457b9d', range:20 },
      // Newly added staff
      ...NEW_BHARATI_UPPER_STAFF,
    ],
    wildlife:[],
    rooms:[
      { id:'lab2', name:'Lab B', type:'lab', side:'left', at:-18 },
      { id:'cold', name:'Cold Store', type:'coldstorage', side:'left', at:-10 },
      { id:'adv', name:'Adv Lab', type:'lab', side:'left', at:-2 },
      { id:'hyd', name:'Hydroponics', type:'hydroponics', side:'left', at:6 },
      { id:'crew2', name:'Cabins', type:'crew', side:'left', at:14 },
      { id:'gym', name:'Gymnasium', type:'gym', side:'right', at:-18 },
      { id:'rec', name:'Recreation', type:'rec', side:'right', at:-10 },
      { id:'arc', name:'Arcade', type:'arcade', side:'right', at:-2 },
      { id:'gal', name:'Galley', type:'galley', side:'right', at:6 },
      { id:'shl', name:'Shelter', type:'shelter', side:'right', at:14 },
    ],
  },
]);

/* ═══ INTERIOR FLOOR ═══ */
function InteriorFloor({ floor, playerRef, onStairs, removedNPCs, onRemoveNPC }) {
  const { L, W, H, rooms } = floor;
  const halfL = L/2, halfW = W/2;
  const ready = useRef(true);

  // ── FIXED: safely fall back to empty arrays ──
  const npcs = Array.isArray(floor?.npcs) ? floor.npcs : [];
  const wildlife = Array.isArray(floor?.wildlife) ? floor.wildlife : [];
  const safeRooms = Array.isArray(rooms) ? rooms : [];

  useFrame(() => {
    if (!ready.current || !playerRef.current) return;
    const p = playerRef.current;
    if (p.z < -halfL + 3.5 && Math.abs(p.x) < 2.5) {
      ready.current = false;
      onStairs(p.x < 0 ? 'up' : 'down');
      setTimeout(() => { ready.current = true; }, 900);
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[W,L]} /><meshStandardMaterial color="#2a3040" roughness={0.7} metalness={0.2} /></mesh>
      <mesh rotation={[Math.PI/2,0,0]} position={[0,H,0]}><planeGeometry args={[W,L]} /><meshStandardMaterial color="#1a2030" roughness={0.9} /></mesh>
      {[-1,1].map((side,si) => {
        const x = side * halfW;
        const sideRooms = safeRooms.filter(r => r.side === (side===-1?'left':'right')).sort((a,b) => a.at - b.at);
        const segs = []; let cursor = -halfL;
        sideRooms.forEach(room => { const ds = room.at-0.65, de = room.at+0.65; if (ds > cursor) segs.push({ from:cursor, to:ds }); cursor = de; });
        if (cursor < halfL) segs.push({ from:cursor, to:halfL });
        return <React.Fragment key={si}>{segs.map((s,i) => <mesh key={i} position={[x,H/2,(s.from+s.to)/2]}><boxGeometry args={[0.15,H,s.to-s.from]} /><meshStandardMaterial color="#334155" roughness={0.9} /></mesh>)}</React.Fragment>;
      })}
      <mesh position={[0,H/2,-halfL]}><boxGeometry args={[W,H,0.15]} /><meshStandardMaterial color="#334155" /></mesh>
      <mesh position={[0,H/2,halfL]}><boxGeometry args={[W,H,0.15]} /><meshStandardMaterial color="#334155" /></mesh>

      {[-L/3, 0, L/3].map((z,i) => (
        <group key={i} position={[0,H-0.05,z]}>
          <mesh><boxGeometry args={[1.4,0.08,0.5]} /><meshStandardMaterial color="#ffffff" emissive="#fff8e0" emissiveIntensity={4} /></mesh>
          <pointLight position={[0,-0.4,0]} intensity={3} distance={30} color="#fff8e0" />
        </group>
      ))}

      {safeRooms.map(room => <Room key={room.id} side={room.side} at={room.at} type={room.type} name={room.name} halfW={halfW} H={H} playerRef={playerRef} />)}

      {/* Stairs UP */}
      <group position={[-2,0,-halfL+2]}>
        <mesh position={[0,0.2,0]}><boxGeometry args={[2,0.4,0.8]} /><meshStandardMaterial color="#4a5568" metalness={0.4} /></mesh>
        <mesh position={[0,0.6,0.8]}><boxGeometry args={[2,0.8,0.8]} /><meshStandardMaterial color="#4a5568" metalness={0.4} /></mesh>
        <PopUpText text="↑ UP" position={[0, 2.5, 0.4]} isNear={false} baseColor="#7dd3c0" />
      </group>
      {/* Stairs DOWN */}
      <group position={[2,0,-halfL+2]}>
        <mesh position={[0,0.2,0]}><boxGeometry args={[2,0.4,0.8]} /><meshStandardMaterial color="#c94b0f" metalness={0.4} /></mesh>
        <mesh position={[0,0.6,0.8]}><boxGeometry args={[2,0.8,0.8]} /><meshStandardMaterial color="#c94b0f" metalness={0.4} /></mesh>
        <PopUpText text="↓ DOWN" position={[0, 2.5, 0.4]} isNear={false} baseColor="#ff6b6b" />
      </group>

      {/* ── FIXED: safe iteration over npcs ── */}
      {npcs.map((n,i) => {
        const key = `${floor.id}-${n.name}`;
        return <NPC key={i} name={n.name} gender={n.gender} color={n.color} range={n.range} hidden={!!removedNPCs[key]} onRemove={() => onRemoveNPC(key)} playerRef={playerRef} />;
      })}

      {/* ── FIXED: safe iteration over wildlife ── */}
      {wildlife.map((w,i) => {
        const key = `${floor.id}-wildlife-${i}`;
        const hidden = !!removedNPCs[key];
        if (w.type === 'penguin') return <Penguin key={i} position={w.position} range={w.range||2} hidden={hidden} />;
        if (w.type === 'seal') return <Seal key={i} position={w.position} hidden={hidden} />;
        return null;
      })}
    </group>
  );
}

/* ═══ PLAYER CONTROLLER ═══ */
function PlayerController({ playerRef, floor, cameraMode, isTransitioning }) {
  const { camera } = useThree();
  const keys = useRef({});
  const s = useRef({ yaw:Math.PI, pitch:0.15, vy:0, jumping:false });
  const tp = useRef(new THREE.Vector3()), tl = useRef(new THREE.Vector3()), cl = useRef(new THREE.Vector3(0,1.55,18));
  useEffect(() => {
    const c = document.querySelector('canvas');
    if (!c) return;
    const oc = () => { if (document.pointerLockElement !== c) c.requestPointerLock(); };
    const om = e => { if (document.pointerLockElement !== c || isTransitioning) return; s.current.yaw -= e.movementX*0.0025; s.current.pitch = Math.max(-0.6, Math.min(1.2, s.current.pitch + e.movementY*0.0025)); };
    const kd = e => { keys.current[e.code] = true; if (e.code === 'Space') e.preventDefault(); };
    const ku = e => { keys.current[e.code] = false; };
    c.addEventListener('click', oc); document.addEventListener('mousemove', om);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { c.removeEventListener('click', oc); document.removeEventListener('mousemove', om); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [isTransitioning]);
  useFrame((_, d) => {
    if (isTransitioning) return;
    const st = s.current, p = playerRef.current;
    const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
    let dx = 0, dz = 0;
    if (keys.current['KeyW'] || keys.current['ArrowUp']) { dx += fx; dz += fz; }
    if (keys.current['KeyS'] || keys.current['ArrowDown']) { dx -= fx; dz -= fz; }
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) { dx -= rx; dz -= rz; }
    if (keys.current['KeyD'] || keys.current['ArrowRight']) { dx += rx; dz += rz; }
    const len = Math.sqrt(dx*dx + dz*dz);
    p.walking = len > 0.01;
    if (p.walking) { dx /= len; dz /= len; }
    let nx = p.x + dx*4.2*d, nz = p.z + dz*4.2*d, ny = p.y;
    if (keys.current['Space'] && !st.jumping && ny <= 0.01) { st.vy = 5.5; st.jumping = true; }
    if (st.jumping) { st.vy -= 15*d; ny += st.vy*d; if (ny <= 0) { ny = 0; st.vy = 0; st.jumping = false; } }
    const halfL = floor.L/2 - 0.6, halfW = floor.W/2 + 6;
    nx = Math.max(-halfW, Math.min(halfW, nx));
    nz = Math.max(-halfL, Math.min(halfL, nz));
    p.x = nx; p.y = ny; p.z = nz; p.yaw = st.yaw;
    if (cameraMode === 'FPP') {
      tp.current.set(nx, ny+1.55, nz);
      tl.current.set(nx + fx*Math.cos(st.pitch), ny+1.55+Math.sin(st.pitch), nz + fz*Math.cos(st.pitch));
    } else {
      tp.current.set(nx - fx*5*Math.cos(st.pitch), ny+2.5+5*Math.sin(st.pitch), nz - fz*5*Math.cos(st.pitch));
      tl.current.set(nx, ny+1.2, nz);
    }
    camera.position.lerp(tp.current, 1 - Math.exp(-25*d));
    cl.current.lerp(tl.current, 1 - Math.exp(-25*d));
    const m = new THREE.Matrix4(); m.lookAt(camera.position, cl.current, camera.up);
    camera.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(m), 1 - Math.exp(-20*d));
  });
  return null;
}

/* ═══ EXTERIOR PIECES ═══ */
const Stars = () => {
  const geo = useMemo(() => {
    const arr = new Float32Array(600);
    for (let i = 0; i < 200; i++) {
      arr[i*3] = (Math.random()-0.5)*300;
      arr[i*3+1] = Math.random()*80+10;
      arr[i*3+2] = (Math.random()-0.5)*300;
    }
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[geo, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.8} sizeAttenuation />
    </points>
  );
};

function LongContainer({ position, rotation=[0,0,0], onClick, label }) {
  const [hovered, setHovered] = useState(false);
  const w=6, h=0.95, d=1.1;
  return (
    <group position={position} rotation={rotation}>
      <mesh
        onClick={onClick}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor='pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor='default'; }}
      >
        <boxGeometry args={[w,h,d]} />
        <meshStandardMaterial color={hovered ? '#e0e8f0' : '#eef0f2'} roughness={0.55} metalness={0.3} />
      </mesh>
      <mesh position={[0,h/2+0.03,0]}>
        <boxGeometry args={[w+0.08,0.06,d+0.08]} />
        <meshStandardMaterial color="#b8c0c8" metalness={0.4} />
      </mesh>
      <mesh position={[0,h*0.2,d/2+0.008]}>
        <planeGeometry args={[w*0.85,h*0.35]} />
        <meshStandardMaterial color="#2a4a6a" emissive="#4a9fd4" emissiveIntensity={0.5} metalness={0.7} roughness={0.15} />
      </mesh>
      <mesh position={[w*0.3,0,d/2+0.01]}>
        <boxGeometry args={[0.8,h*0.85,0.02]} />
        <meshStandardMaterial color="#4a5058" metalness={0.3} />
      </mesh>
      {label && (
        <PopUpText text={label} position={[0, h/2 + 0.5, 0]} isNear={hovered} baseColor="#7dd3c0" nearColor="#ffaa00" />
      )}
    </group>
  );
}

function OrangeBox({ position, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <mesh
      position={position}
      onClick={onClick}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor='pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor='default'; }}
    >
      <boxGeometry args={[0.9,0.65,0.7]} />
      <meshStandardMaterial color={hovered ? '#ff8c1a' : '#e8681a'} roughness={0.5} metalness={0.2} />
    </mesh>
  );
}

function MaitriExterior({ onEnter }) {
  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.01,0]}><planeGeometry args={[120,120]} /><meshStandardMaterial color="#3a2a1a" roughness={0.95} /></mesh>
      {[[-20,10,8],[15,-5,6],[30,20,10],[-30,-15,7],[10,30,9]].map(([x,z,r],i) => (
        <mesh key={`snow-${i}`} rotation={[-Math.PI/2,0,0]} position={[x,0.005,z]}><circleGeometry args={[r,16]} /><meshStandardMaterial color="#dce8f2" roughness={0.8} /></mesh>
      ))}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.02,-35]}><circleGeometry args={[35,64]} /><meshStandardMaterial color="#0a1a2e" roughness={0.1} metalness={0.9} emissive="#0a2a4a" emissiveIntensity={0.3} /></mesh>
      <LongContainer position={[-5.5,0.5,3.5]} onClick={onEnter} label="BLOCK A" />
      <LongContainer position={[0.5,0.5,3.5]} onClick={onEnter} label="BLOCK B" />
      <LongContainer position={[6.5,0.5,3.5]} onClick={onEnter} label="BLOCK C" />
      <group rotation={[0,Math.PI/2,0]}>
        <LongContainer position={[-3.5,0.5,-5.5]} onClick={onEnter} />
        <LongContainer position={[2.5,0.5,-5.5]} onClick={onEnter} />
      </group>
      {[[-9,0.33,0],[-10,0.33,0.9],[-7.5,0.33,-0.5],[10,0.33,1],[11,0.33,2],[-3,0.33,-3],[3.5,0.33,-4]].map((p,i) => <OrangeBox key={i} position={p} onClick={onEnter} />)}
      <pointLight position={[-5.5,2,-2]} intensity={2} distance={15} color="#ffaa44" />
      <pointLight position={[5.5,2,-2]} intensity={2} distance={15} color="#ffaa44" />
      <pointLight position={[0,2,5]} intensity={1.5} distance={20} color="#44aaff" />
      <Penguin position={[-15, 0, -20]} range={4} />
      <Penguin position={[-10, 0, -25]} range={3} />
      <Penguin position={[-20, 0, -15]} range={5} />
      <Seal position={[10, 0, -28]} />
      <Seal position={[-5, 0, -30]} />
    </group>
  );
}

function BharatiExterior({ onEnter }) {
  const [hov, setHov] = useState(false);
  const W=18, D=9, H=2.6, st=1.4;
  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.01,0]}><planeGeometry args={[120,120]} /><meshStandardMaterial color="#4a3a2a" roughness={0.95} /></mesh>
      {[[-15,8,6],[20,-10,8],[-25,-5,10],[15,25,7],[-10,30,5]].map(([x,z,r],i) => (
        <mesh key={`snow-${i}`} rotation={[-Math.PI/2,0,0]} position={[x,0.005,z]}><circleGeometry args={[r,16]} /><meshStandardMaterial color="#dce8f2" roughness={0.8} /></mesh>
      ))}
      <mesh rotation={[-Math.PI/2,0,0]} position={[15,0.02,-40]}><circleGeometry args={[30,64]} /><meshStandardMaterial color="#0a1a2e" roughness={0.1} metalness={0.9} emissive="#0a2a4a" emissiveIntensity={0.3} /></mesh>
      <group
        onPointerOver={e => { e.stopPropagation(); setHov(true); document.body.style.cursor='pointer'; }}
        onPointerOut={() => { setHov(false); document.body.style.cursor='default'; }}
        onClick={e => { e.stopPropagation(); onEnter(); }}
      >
        {[-W/2+0.8,-W/4,0,W/4,W/2-0.8].map((x,i) =>
          [-D/2+0.6,D/2-0.6].map((z,j) => (
            <mesh key={`${i}-${j}`} position={[x,st/2,z]}><cylinderGeometry args={[0.13,0.16,st,12]} /><meshStandardMaterial color="#5a6068" metalness={0.4} /></mesh>
          ))
        )}
        <mesh position={[0,st+H/2,0]}><boxGeometry args={[W,H,D]} /><meshStandardMaterial color={hov?'#c8d4e0':'#a0a8b0'} metalness={0.3} roughness={0.55} /></mesh>
        <mesh position={[0,st+H*0.5,D/2+0.006]}><planeGeometry args={[W*0.9,H*0.5]} /><meshStandardMaterial color="#1a2a3a" emissive="#3a6a9a" emissiveIntensity={0.6} metalness={0.75} roughness={0.15} /></mesh>
        {Array.from({length:8}).map((_,i) =>
          Array.from({length:4}).map((_,j) => (
            <mesh key={`${i}-${j}`} position={[-W/2+1.2+i*2.1, st+H+0.06, -D/2+1.4+j*1.9]}>
              <boxGeometry args={[1.9,0.06,1.7]} />
              <meshStandardMaterial color="#1a3a6a" metalness={0.8} roughness={0.2} emissive="#2a5a9a" emissiveIntensity={0.1} />
            </mesh>
          ))
        )}
        <mesh position={[0,st+H+0.85,0]}><boxGeometry args={[4.5,1.4,3.5]} /><meshStandardMaterial color="#c8d0d8" metalness={0.3} /></mesh>
        <mesh position={[0,st+H+1.6,0]}><boxGeometry args={[4.7,0.1,3.7]} /><meshStandardMaterial color="#4a5058" metalness={0.5} /></mesh>
      </group>
      <PopUpText text="BHARATI · CLICK" position={[0, st+H+2.6, 0]} isNear={hov} baseColor="#7dd3c0" nearColor="#ffaa00" />
      <mesh position={[12,0.6,3]}><boxGeometry args={[3.5,1.2,2]} /><meshStandardMaterial color="#2d5a8a" roughness={0.7} metalness={0.2} /></mesh>
      <mesh position={[15,0.6,3.5]}><boxGeometry args={[2.5,1.2,2]} /><meshStandardMaterial color="#a83a2e" roughness={0.7} metalness={0.2} /></mesh>
      <pointLight position={[0,st+H+1,0]} intensity={3} distance={25} color="#88ccff" />
      <pointLight position={[12,2,3]} intensity={1.5} distance={15} color="#ffaa44" />
      <Penguin position={[25, 0, -30]} range={6} />
      <Penguin position={[20, 0, -25]} range={4} />
      <Penguin position={[30, 0, -20]} range={5} />
      <Seal position={[-10, 0, -35]} />
    </group>
  );
}

/* ═══ MAIN ═══ */
export default function StationTwin({ station='maitri', onStationChange }) {
  const [inside, setInside] = useState(false);
  const [cameraMode, setCameraMode] = useState('FPP');
  const [floorId, setFloorId] = useState(0);
  const [removedNPCs, setRemovedNPCs] = useState({});
  const [transitioning, setTransitioning] = useState(false);
  const [webglOk] = useState(() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch { return false; } });
  const playerRef = useRef({ x:0, y:0, z:18, yaw:Math.PI, walking:false });

  const floors = station === 'bharati' ? BHARATI_FLOORS : MAITRI_FLOORS;
  const safeFloorId = Math.min(floorId, floors.length - 1);
  const floor = floors[safeFloorId] || floors[0];

  useEffect(() => {
    setFloorId(0);
    setRemovedNPCs({});
    playerRef.current.x = 0;
    playerRef.current.y = 0;
    playerRef.current.z = 18;
    playerRef.current.yaw = Math.PI;
  }, [station]);

  useEffect(() => {
    const h = e => { if (e.code === 'KeyV' && inside) setCameraMode(m => m === 'FPP' ? 'TPP' : 'FPP'); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [inside]);

  const handleEnter = () => {
    setTransitioning(true);
    setTimeout(() => {
      setInside(true);
      setFloorId(0);
      playerRef.current.z = 18; playerRef.current.x = 0; playerRef.current.yaw = Math.PI;
      setTransitioning(false);
    }, 400);
  };

  const handleExit = () => {
    setTransitioning(true);
    setTimeout(() => {
      setInside(false);
      setTransitioning(false);
    }, 400);
  };

  const handleStairs = dir => {
    setTransitioning(true);
    setTimeout(() => {
      setFloorId(id => dir === 'up' ? Math.min(id + 1, floors.length - 1) : Math.max(id - 1, 0));
      playerRef.current.z = 18; playerRef.current.x = 0; playerRef.current.yaw = Math.PI;
      setTransitioning(false);
    }, 350);
  };

  if (!webglOk) return <Fallback />;

  const camPos = station === 'bharati' ? [18,10,18] : [14,10,14];

  return (
    <div style={{ position:'relative', width:'100%', height:620, borderRadius:16, overflow:'hidden', background:'#050912', border:'1px solid #1e3a52', fontFamily:'JetBrains Mono, monospace' }}>
      <div style={{ position:'absolute', inset:0, background:'#000', opacity: transitioning?1:0, transition:'opacity 0.4s ease-in-out', zIndex:1000, pointerEvents: transitioning?'auto':'none' }} />

      <div style={{ position:'absolute', inset:0 }}>
        <Canvas
          shadows={false}
          dpr={1}
          camera={{ position: inside ? [0,1.55,18] : camPos, fov: inside ? 75 : 42 }}
          gl={{ antialias: true, powerPreference: 'default' }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); window.location.reload(); });
          }}
        >
          {inside ? (
            <group key={`i-${station}-${safeFloorId}`}>
              <color attach="background" args={['#0a101a']} />
              <ambientLight intensity={0.6} />
              <hemisphereLight args={['#4a6a8a', '#1a2a3a', 0.8]} />
              <InteriorFloor
                floor={floor}
                playerRef={playerRef}
                onStairs={handleStairs}
                removedNPCs={removedNPCs}
                onRemoveNPC={k => setRemovedNPCs(p => ({ ...p, [k]:true }))}
              />
              {cameraMode === 'TPP' && !transitioning && <Character playerRef={playerRef} color="#e63946" gender="M" label="YOU" />}
              <PlayerController playerRef={playerRef} floor={floor} cameraMode={cameraMode} isTransitioning={transitioning} />
            </group>
          ) : (
            <group key={`e-${station}`}>
              <color attach="background" args={['#050810']} />
              <ambientLight intensity={0.15} />
              <directionalLight position={[20,30,10]} intensity={0.4} color="#aaccff" />
              <hemisphereLight args={['#1a2a3a', '#000000', 0.3]} />
              <Stars />
              {station === 'bharati' ? <BharatiExterior onEnter={handleEnter} /> : <MaitriExterior onEnter={handleEnter} />}
              <OrbitControls enableZoom enablePan minDistance={6} maxDistance={60} target={[0,1.5,0]} enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI/2.1} />
            </group>
          )}
        </Canvas>
      </div>

      {!inside && (
        <>
          <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:6, zIndex:20, padding:4, background:'rgba(10,20,32,0.85)', border:'1px solid #1e3a52', borderRadius:6 }}>
            <button onClick={handleEnter} style={{ padding:'6px 10px', background:'transparent', border:'none', color:'#7dd3c0', fontSize:10.5, fontWeight:600, cursor:'pointer', fontFamily:'monospace' }}>⚡ WALK THE SITE</button>
          </div>
          <div style={{ position:'absolute', top:12, right:12, padding:'10px 12px', background:'rgba(10,20,32,0.85)', border:'1px solid #1e3a52', borderLeft:'2px solid #7dd3c0', borderRadius:6, zIndex:20, fontFamily:'monospace' }}>
            <div style={{ color:'#7dd3c0', fontSize:10, fontWeight:700, marginBottom:4 }}>◈ VSAT NOMINAL</div>
            <div style={{ color:'#e8eef4', fontSize:10 }}>drop in 26 min · 80.5% conf</div>
          </div>
          <div style={{ position:'absolute', bottom:30, left:24, padding:'8px 14px', background:'rgba(10,20,32,0.85)', border:'1px solid #1e3a52', borderRadius:4, color:'#e8eef4', fontSize:14, fontWeight:700, zIndex:20, fontFamily:'monospace' }}>100 m radius</div>
          <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'6px 14px', background:'rgba(5,9,18,0.9)', borderTop:'1px solid #1e3a52', color:'rgba(125,211,192,0.7)', fontSize:9.5, display:'flex', gap:8, alignItems:'center', zIndex:20, fontFamily:'monospace' }}>
            <span>◈ {station.toUpperCase()}</span><span>·</span><span>CLICK CONTAINER TO ENTER</span>
            <button onClick={() => window.location.reload()} style={{ marginLeft:'auto', padding:'2px 10px', background:'transparent', border:'1px solid #2a4d47', borderRadius:3, color:'#7dd3c0', fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'monospace' }}>⟳ RELOAD</button>
          </div>
          <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6, zIndex:20 }}>
            <button onClick={() => onStationChange && onStationChange('maitri')} style={{ padding:'5px 12px', borderRadius:4, border: station==='maitri'?'1px solid #7dd3c0':'1px solid #1e3a52', background: station==='maitri'?'rgba(125,211,192,0.15)':'rgba(10,20,32,0.85)', color: station==='maitri'?'#7dd3c0':'rgba(255,255,255,0.5)', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'monospace' }}>MAITRI</button>
            <button onClick={() => onStationChange && onStationChange('bharati')} style={{ padding:'5px 12px', borderRadius:4, border: station==='bharati'?'1px solid #7dd3c0':'1px solid #1e3a52', background: station==='bharati'?'rgba(125,211,192,0.15)':'rgba(10,20,32,0.85)', color: station==='bharati'?'#7dd3c0':'rgba(255,255,255,0.5)', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'monospace' }}>BHARATI</button>
          </div>
        </>
      )}

      {inside && (
        <>
          <div style={{ position:'absolute', top:12, left:12, padding:10, background:'rgba(10,20,32,0.9)', border:'1px solid #1e3a52', borderLeft:'2px solid #7dd3c0', borderRadius:6, zIndex:20, minWidth:200, width:'fit-content' }}>
            <div style={{ color:'#7dd3c0', fontSize:10, fontWeight:700, letterSpacing:1, marginBottom:8, fontFamily:'monospace', whiteSpace:'nowrap' }}>
              {floor.name.toUpperCase()}
            </div>
            <div style={{ color:'#e8eef4', fontSize:9, marginBottom:8, fontFamily:'monospace' }}>{(floor.npcs || []).length} staff · Floor {safeFloorId+1}/{floors.length}</div>
            <button onClick={() => setCameraMode(m => m === 'FPP' ? 'TPP' : 'FPP')} style={{ display:'block', width:'100%', padding:'6px 10px', marginBottom:6, borderRadius:4, border:'1px solid #ffab00', background:'transparent', color:'#ffab00', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'monospace', textAlign:'left' }}>👁️ {cameraMode}</button>
            <button onClick={handleExit} style={{ display:'block', width:'100%', padding:'6px 10px', borderRadius:4, border:'1px solid #ff2965', background:'transparent', color:'#ff2965', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'monospace', textAlign:'left' }}>← EXIT</button>
          </div>
          <div style={{ position:'absolute', top:12, right:12, padding:'10px 14px', background:'rgba(10,20,32,0.9)', border:'1px solid #1e3a52', borderRadius:6, zIndex:20, fontFamily:'monospace' }}>
            <div style={{ color:'#7dd3c0', fontSize:10, fontWeight:700 }}>◈ VSAT NOMINAL</div>
            <div style={{ color:'rgba(255,255,255,0.55)', fontSize:9, marginTop:3 }}>Click NPC to remove</div>
          </div>
          {cameraMode === 'FPP' && <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', color:'#00ffcc', fontSize:18, pointerEvents:'none', zIndex:15 }}>+</div>}
          <div style={{ position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', padding:'8px 16px', borderRadius:999, background:'#00ffcc', border:'2px solid #000', color:'#000', fontSize:10, fontFamily:'monospace', fontWeight:700, whiteSpace:'nowrap', pointerEvents:'none', zIndex:15 }}>🖱️ CLICK · WASD · V TOGGLE · CLICK NPC TO REMOVE</div>
        </>
      )}
    </div>
  );
}