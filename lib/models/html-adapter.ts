import { feasibilitySource } from "./feasibility-source";

export function feasibilityDocument(modelId: string, instanceId: string, parentOrigin: string) {
  const config = JSON.stringify({ modelId, instanceId, origin: parentOrigin, schemaVersion: 1 }).replace(/</g, "\\u003c");
  const bridge = `<script>
(() => {
  const config = ${config};
  const send = (type, requestId, payload) => parent.postMessage({...config, type, requestId, payload}, config.origin);
  const snapshot = () => ({state: structuredClone(state), results: calculate()});
  const valid = (value) => value && ['fields','gst','tax','finance'].every(key => value[key] && typeof value[key] === 'object') && Array.isArray(value.costs);
  const adapter = {
    async getState() { return snapshot(); },
    async validateState(value) { return valid(value.state); },
    async setState(value) {
      if (!valid(value.state)) throw new Error('Invalid model state');
      const previous = structuredClone(state);
      state = structuredClone(value.state); renderInputs(); renderCosts(); update();
      const computed = calculate();
      if (value.results) for (const [key, expected] of Object.entries(value.results)) {
        if (typeof expected === 'number' && (!Number.isFinite(computed[key]) || Math.abs(computed[key] - expected) > Math.max(1e-7, Math.abs(expected) * 1e-12))) { state = previous; renderInputs(); renderCosts(); update(); throw new Error('Restored calculation mismatch: ' + key); }
      }
    },
    async getPrintData() { return {state: structuredClone(state), results: calculate(), sensitivity: [.9,.95,1,1.05,1.1].map(factor => { const price = Math.round(num(state.fields.price)*factor/1000)*1000; return {price, ...calculate(price)}; })}; }
  };
  window.addEventListener('message', async event => {
    const msg = event.data;
    if (event.source !== parent || event.origin !== config.origin || !msg || msg.modelId !== config.modelId || msg.instanceId !== config.instanceId || msg.schemaVersion !== 1 || typeof msg.requestId !== 'string' || !['GET_STATE','SET_STATE','VALIDATE_STATE','GET_PRINT_DATA','RESET'].includes(msg.type)) return;
    try {
      let payload;
      if (msg.type === 'GET_STATE') payload = await adapter.getState();
      if (msg.type === 'SET_STATE') { await adapter.setState(msg.payload); payload = snapshot(); }
      if (msg.type === 'VALIDATE_STATE') payload = await adapter.validateState(msg.payload);
      if (msg.type === 'GET_PRINT_DATA') payload = await adapter.getPrintData();
      if (msg.type === 'RESET') { state = structuredClone(initial); renderInputs(); renderCosts(); update(); payload = snapshot(); }
      send('RESPONSE', msg.requestId, payload);
    } catch (error) { send('ERROR', msg.requestId, String(error.message || error)); }
  });
  // The original formulas and dynamic cost-row handlers are untouched.
  state = structuredClone(initial); renderInputs(); renderCosts(); update();
  const localPanel = document.getElementById('save').closest('section'); localPanel.style.display = 'none';
  let timer;
  function changed() { clearTimeout(timer); timer = setTimeout(() => send('CHANGED', null, snapshot()), 100); }
  document.addEventListener('input', changed); document.addEventListener('change', changed); document.addEventListener('click', event => { if (event.target.closest('#add, #reset, [data-remove]')) changed(); });
  new ResizeObserver(() => send('RESIZE', null, Math.ceil(document.documentElement.scrollHeight))).observe(document.body);
  send('READY', null, snapshot());
})();
</script>`;
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">`;
  return feasibilitySource.replace('<head>', '<head>' + csp).replace('</body>', bridge + '</body>');
}
