const busyWork = (milliseconds) => {
  const until = Date.now() + milliseconds;
  let value = 0;
  while (Date.now() < until) value = (value + 17) % 97;
  return value;
};

process.on('message', (message) => {
  if (message?.type !== 'START') return;
  if (message.mode === 'legacy') {
    process.send?.({ type: 'ERROR', jobId: message.jobId, code: 'CATALOG_PREVIEW_FAILED', message: 'Synthetic preview failure.' });
    setImmediate(() => process.exit(0));
    return;
  }
  if (message.mode === 'quick') {
    setTimeout(() => process.exit(0), 1_000);
    return;
  }
  process.send?.({ type: 'STAGE', jobId: message.jobId, stage: 'PARSING' });
  busyWork(250);
  process.send?.({ type: 'RESULT', jobId: message.jobId, batch: { id: 'batch-test-1', status: 'READY_FOR_REVIEW', summary: { products: 1, variants: 1 } } });
  setTimeout(() => process.exit(0), 10);
});
