import React, { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { mountReply } from '../../client/web';
import { draftKey, readQuote, type Target, type Attachment } from '../../client/model';
import { fakeHost } from '../helpers';

const h = fakeHost();
Object.assign(h.state.drafts, JSON.parse(localStorage.getItem('fixture-drafts') || '{}'));
const save = h.state.saveDraftInput.bind(h.state);
h.state.saveDraftInput = (input) => { save(input); localStorage.setItem('fixture-drafts', JSON.stringify(h.state.drafts)); };
const empty = { text: '', attachments: [] };
function select(selector: string) {
  const node = document.querySelector(selector)!;
  const range = document.createRange(); range.selectNodeContents(node);
  const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
}
function Message(props: Target) {
  return <article data-testid="agent-chat-scroll"><div data-message-id={'message-' + props.agentId}>
    <div data-testid="assistant-message"><p id="sentence">Keep the existing draft when you add a reply.</p>
      <p>The comment can be empty. You can collect several quotes before sending.</p>
      <pre id="code">{'function greet(name) {\n  return `Hello, ${name}`;\n}'}</pre>
    </div></div></article>;
}
function Pill(props: Target & { attachment: Attachment }) {
  const q = readQuote(props.attachment)!;
  const remove = () => { void h.bridge.change(q, 'remove', q); };
  return <span><button className="pill" data-testid="composer-plugin-resource-attachment-pill">{props.attachment.item.title}</button><button aria-label={'Remove ' + q.id} onClick={remove}>×</button></span>;
}
function App(props: Target) {
  const draft = useSyncExternalStore(h.module.useDraftStore.subscribe, () => h.state.getDraftInput(draftKey(props)) || empty);
  const [sent, setSent] = useState('');
  const [fail, setFail] = useState(false);
  function send() {
    setSent(JSON.stringify({ text: draft.text, attachments: draft.attachments.map(a => (a as Attachment).item.text) }, null, 2));
    h.state.saveDraftInput({ draftKey: draftKey(props), draft: { text: '', attachments: [] } });
  }
  return <><Message {...props}/><div><button onClick={() => select('#sentence')}>Select first sentence</button><button onClick={() => select('#code')}>Select code</button>
    <button onClick={() => { h.setFailFlush(!fail); setFail(!fail); }}>Persistence: {fail ? 'failing' : 'working'}</button></div>
    <section className="composer" data-testid="message-input-root">
      <div className="pills">{draft.attachments.map(a => <Pill key={(a as Attachment).item.id} {...props} attachment={a as Attachment}/>)}</div>
      <textarea aria-label="Main draft" value={draft.text} onChange={e => h.state.saveDraftInput({ draftKey: draftKey(props), draft: { ...draft, text: e.target.value } })} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}/>
      <button onClick={send} disabled={!draft.text && !draft.attachments.length}>Send draft (fixture)</button>
    </section><output aria-label="Sent payload">{sent}</output></>;
}
function Root() {
  const [chat, setChat] = useState('a');
  return <main><h1>Selected Reply</h1><small>Browser test fixture: real plugin UI and React fibers; mock Paseo draft storage and sending.</small>
    <nav><button className={chat === 'a' ? 'active' : ''} onClick={() => setChat('a')}>Chat A</button><button className={chat === 'b' ? 'active' : ''} onClick={() => setChat('b')}>Chat B</button></nav>
    <App key={chat} serverId="host-a" agentId={'chat-' + chat}/></main>;
}
createRoot(document.getElementById('root')!).render(<Root/>);
mountReply(document, h.bridge);
