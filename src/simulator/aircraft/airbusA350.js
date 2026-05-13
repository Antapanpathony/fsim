import * as THREE from 'three';

export const AirbusA350Config = {
  name: 'Airbus A350-900',
  key: 'airbusA350',
  description: 'Long-haul wide-body airliner. Twin Rolls-Royce Trent XWB engines. Mach 0.89.',
  color: 0xf5f5f5,

  mass: 150000,
  wingSpan: 64.75,
  wingArea: 443,
  maxThrust: 748000,  // 2× 374 kN Trent XWB
  maxSpeed: 295,
  stallSpeed: 68,
  stallAngle: 12,
  engineCount: 2,
  hasPropTorque: false,
  hasAfterburner: false,
  hasVTOL: false,
  isHelicopter: false,
  hasWeapons: false,

  rollRate: 0.35,
  pitchRate: 0.25,
  yawRate: 0.15,

  weapons: [],
  cockpitOffset: new THREE.Vector3(0, 3.5, -16),

  buildMesh(group) {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const accentMat = new THREE.MeshLambertMaterial({ color: 0x003087 });  // Air France-ish blue
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x88aacc, transparent: true, opacity: 0.5 });

    // Main fuselage
    const fuseGeo = new THREE.CylinderGeometry(3.0, 2.8, 60, 16);
    fuseGeo.rotateX(Math.PI / 2);
    const fuse = new THREE.Mesh(fuseGeo, bodyMat);
    group.add(fuse);

    // Nose cone
    const noseGeo = new THREE.ConeGeometry(3.0, 8, 16);
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.z = -34;
    group.add(nose);

    // Tail cone
    const tailGeo = new THREE.ConeGeometry(2.8, 6, 16);
    tailGeo.rotateX(-Math.PI / 2);
    const tail = new THREE.Mesh(tailGeo, bodyMat);
    tail.position.z = 33;
    group.add(tail);

    // Swept wings (under-wing mounted engines)
    buildA350Wing(group, -1, bodyMat);
    buildA350Wing(group, 1, bodyMat);

    // Under-wing engines (Trent XWB — large nacelles)
    for (const side of [-1, 1]) {
      const nacGeo = new THREE.CylinderGeometry(1.6, 1.5, 8, 12);
      nacGeo.rotateX(Math.PI / 2);
      const nac = new THREE.Mesh(nacGeo, darkMat);
      nac.position.set(side * 15, -3.5, -2);
      group.add(nac);

      // Intake lip
      const intakeGeo = new THREE.CylinderGeometry(1.7, 1.6, 0.5, 12);
      intakeGeo.rotateX(Math.PI / 2);
      const intake = new THREE.Mesh(intakeGeo, darkMat);
      intake.position.set(side * 15, -3.5, -6.3);
      group.add(intake);

      // Exhaust
      const exhGeo = new THREE.CylinderGeometry(1.3, 1.0, 0.4, 12);
      exhGeo.rotateX(Math.PI / 2);
      const exhMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
      const exh = new THREE.Mesh(exhGeo, exhMat);
      exh.position.set(side * 15, -3.5, 2.3);
      group.add(exh);

      // Pylon connecting nacelle to wing
      const pylonGeo = new THREE.BoxGeometry(0.6, 2.2, 3);
      const pylon = new THREE.Mesh(pylonGeo, bodyMat);
      pylon.position.set(side * 15, -2.0, -1.5);
      group.add(pylon);
    }

    // Horizontal stabilizer
    const hStabGeo = new THREE.BoxGeometry(22, 0.18, 5);
    const hStab = new THREE.Mesh(hStabGeo, bodyMat);
    hStab.position.set(0, 0.5, 26);
    group.add(hStab);

    // Vertical stabilizer (tall, curved)
    const vStabGeo = new THREE.BoxGeometry(0.18, 10, 7);
    const vStab = new THREE.Mesh(vStabGeo, bodyMat);
    vStab.position.set(0, 6, 24);
    group.add(vStab);

    // Winglets (upswept)
    for (const side of [-1, 1]) {
      const wletGeo = new THREE.BoxGeometry(0.15, 3.5, 2.5);
      const wlet = new THREE.Mesh(wletGeo, bodyMat);
      wlet.position.set(side * 32, 1.5, 2);
      wlet.rotation.z = side * 0.4;
      group.add(wlet);
    }

    // Blue cheatline stripe
    const cheatGeo = new THREE.BoxGeometry(3.02, 0.5, 56);
    const cheat = new THREE.Mesh(cheatGeo, accentMat);
    cheat.position.set(0, 1.2, 0);
    group.add(cheat);

    // Cockpit windows
    for (let i = 0; i < 4; i++) {
      const winGeo = new THREE.PlaneGeometry(0.8, 0.55);
      const win = new THREE.Mesh(winGeo, glassMat);
      win.position.set(3.01, 1.8, -24 + i * 0.9);
      win.rotation.y = Math.PI / 2;
      group.add(win);
      const win2 = win.clone();
      win2.position.x = -3.01;
      win2.rotation.y = -Math.PI / 2;
      group.add(win2);
    }

    // Main landing gear (2 bogies)
    const gearMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    for (const side of [-1, 1]) {
      const legGeo = new THREE.CylinderGeometry(0.18, 0.18, 5);
      const leg = new THREE.Mesh(legGeo, gearMat);
      leg.position.set(side * 6, -5, 4);
      group.add(leg);

      for (const fw of [-1, 0, 1]) {
        for (const rw of [-0.4, 0.4]) {
          const wGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.45, 12);
          wGeo.rotateX(Math.PI / 2);
          const wMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
          const w = new THREE.Mesh(wGeo, wMat);
          w.position.set(side * 6 + rw, -7.7, 4 + fw * 1.1);
          group.add(w);
        }
      }
    }

    // Nose gear
    const nLegGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.5);
    const nLeg = new THREE.Mesh(nLegGeo, gearMat);
    nLeg.position.set(0, -4.5, -18);
    group.add(nLeg);
    for (const rw of [-0.4, 0.4]) {
      const nwGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.35, 12);
      nwGeo.rotateX(Math.PI / 2);
      const nwMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
      const nw = new THREE.Mesh(nwGeo, nwMat);
      nw.position.set(rw, -6.3, -18);
      group.add(nw);
    }
  },
};

function buildA350Wing(group, side, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(side * 33, side * 7);   // swept leading edge
  shape.lineTo(side * 33, side * 7 + 3.5);
  shape.lineTo(0, 5.5);
  shape.closePath();

  const extrudeSettings = { depth: 0.22, bevelEnabled: false };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, -0.11, 0);
  group.add(mesh);
  return mesh;
}
