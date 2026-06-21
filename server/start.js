import { spawn } from 'child_process';

const startHico = () => {
  console.log('[Launcher] Starting HICO Backend...');
  const hico = spawn('node', ['hicoBackend.js'], { stdio: 'inherit' });
  hico.on('close', (code) => {
    console.log(`[Launcher] HICO Backend exited with code ${code}`);
    process.exit(code);
  });
};

const startWm = () => {
  console.log('[Launcher] Starting Worldmove Simulator...');
  const wm = spawn('node', ['mockWorldmove.js'], { stdio: 'inherit' });
  wm.on('close', (code) => {
    console.log(`[Launcher] Worldmove Simulator exited with code ${code}`);
    process.exit(code);
  });
};

startHico();
startWm();
