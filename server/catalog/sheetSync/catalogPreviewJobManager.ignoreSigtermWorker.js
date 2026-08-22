process.on('message', (message) => {
  if (message?.type !== 'START') return;
  process.on('SIGTERM', () => {});
  setInterval(() => {}, 1000);
});
