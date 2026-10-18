// Explicit, reviewable source exceptions to the approved main baseline.
import { parse } from '@babel/parser';
export const WEBSITE_REF = 'dc7735f10cf24e34d31c590dfb0a651945dc00a7';
export const ROADMAP_REF = WEBSITE_REF;
const commentSection = `
  {v.dlg.hasComments && (
    <section aria-labelledby="rm-comments-title" data-idea-comments="" style={{marginTop: 22}}>
      <h3 id="rm-comments-title" style={{fontSize: 20, fontWeight: 600}}>Comments</h3>
      <p role="note" style={{marginTop: 8, color: "#CFC2DB", fontSize: 14, lineHeight: 1.6}}>
        Sample discussion: these comments are examples, not submitted feedback.
      </p>
      {v.dlg.commentThread.length ? (
        <ol style={{listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 12}}>
          {v.dlg.commentThread.map(comment => (
            <li key={comment.id} data-idea-comment={comment.id} style={{padding: "16px 18px", border: "1px solid #ffffff26", borderRadius: 16, background: "#ffffff05", overflowWrap: "anywhere"}}>
              <p style={{color: "#D4B7EC", fontSize: 13, fontWeight: 600}}>{comment.author}</p>
              <p style={{marginTop: 8, color: "#F6F1FA", fontSize: 16, lineHeight: 1.6}}>{comment.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p style={{marginTop: 16, color: "#CFC2DB", fontSize: 16, lineHeight: 1.6}}>No comments to show yet.</p>
      )}
    </section>
  )}
`;

export function followupSource(file, source) {
  if (file === 'CaseStudy.jsx') {
    source = source.replace('const study = CASE_STUDIES[project.slug];', 'const candidate = CASE_STUDIES[project.slug];\n  const study = candidate?.approved || candidate?.sample ? candidate : null;');
    source = source.replace('<SampleNote />', '{study.sample && <SampleNote />}');
    source = source.replace('<small>Sample figure</small>', '{study.sample && <small>Sample figure</small>}');
    source = source.replace('<code>Prototype audit</code>', '<code>{study.sample ? "Prototype audit" : "Technical audit"}</code>');
  }
  if (file === 'purchase-payment.js') source = source.replace(/(name|description|guidance): ("[^"]*"),/g, 'get $1() { return $2; },');
  if (file === 'PaymentDetails.jsx') {
    source = source.replace('"Only the example test details are accepted."', 'invalidTestDetails()');
    source += '\nfunction invalidTestDetails() { return "Only the example test details are accepted."; }\n';
    for (const [i, value] of ['4242 4242 4242 4242','5555 5555 5555 4444','12/30','123'].entries()) {
      source = source.replace(`<strong>${value}</strong>`, `<strong>{"{${i}}"}</strong>`).replace(`<strong>{"${value}"}</strong>`, `<strong>{"{${i}}"}</strong>`);
    }
  }
  return source;
}

export function restoredRoadmap(source) {
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const edits = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === 'JSXElement') {
      const name = node.openingElement.name.name;
      const text = source.slice(node.start, node.end);
      if (name === 'div' && node.children.some(child => child.type === 'JSXElement' && child.openingElement.attributes.some(attribute => attribute.name?.name === 'style' && source.slice(attribute.start, attribute.end).includes('v.boardCols')))) {
        edits.push({start:node.openingElement.end-1,end:node.openingElement.end-1,text:' className="roadmap-board-scroll" tabIndex={0}'});
      }
      if (name === 'span' && text.includes('Frontend preview · nothing is sent.')) edits.push({start:node.start,end:node.end,text:''});
      if (name === 'div' && node.children.some(child=>child.type==='JSXElement' && source.slice(child.start,child.end).includes('Frontend preview · nothing is sent.'))) {
        const style=node.openingElement.attributes.find(attribute=>attribute.name?.name==='style')?.value?.expression;
        const justify=style?.properties?.find(property=>property.key?.name==='justifyContent');
        if (justify) edits.push({start:justify.value.start,end:justify.value.end,text:'"flex-end"'});
      }
      if (name === 'button' && node.openingElement.attributes.some(attribute=>attribute.name?.name==='type' && attribute.value?.expression?.value==='submit')) {
        edits.push({start:node.openingElement.end-1,end:node.openingElement.end-1,text:' disabled={v.ideaSending} aria-busy={v.ideaSending ? "true" : "false"}'});
      }
      if (name === 'div' && node.children.some(child => child.type === 'JSXExpressionContainer' && source.slice(child.start, child.end).includes('v.dlg.facts'))) {
        edits.push({start: node.start, end: node.start, text: commentSection});
      }
      if (name === 'div' && /ref=\{v\.rootRef\}/.test(source.slice(node.openingElement.start, node.openingElement.end))) {
        for (const child of node.children) {
          if (child.type === 'JSXElement' && source.slice(child.start, child.end).includes('<header')) edits.push({start: child.start, end: child.end, text: '<SiteHeader />'});
          if (child.type === 'JSXExpressionContainer' && /^\{v\.menuOpen &&/.test(source.slice(child.start, child.end))) edits.push({start: child.start, end: child.end, text: ''});
        }
      }
      if (name === 'main') {
        const first = node.children.find(c => c.type === 'JSXElement' && c.openingElement.name.name === 'section');
        edits.push({start: first.start, end: first.end, text: `<section className="purchase-surface" style={{paddingTop: 136, paddingBottom: 24, paddingInline: "max(clamp(20px,4.4vw,64px), calc((100% - 1312px) / 2))"}}>
          <div className="commerce-intro"><h1>Product roadmap</h1>
          <p>Explore the timeline, browse ideas, and suggest what could come next.</p></div>
          <p role="note" style={{maxWidth: 760, lineHeight: 1.7}}>Sample roadmap: updates, votes, and comment counts are examples. Voting stays in this page's local preview.</p>
        </section>`});
      }
    }
    for (const [k, value] of Object.entries(node)) if (k !== 'loc' && value && typeof value === 'object') walk(value);
  };
  walk(ast.program);
  for (const e of edits.sort((a,b) => b.start-a.start)) source = source.slice(0,e.start)+e.text+source.slice(e.end);
  source = source.replace('kind: "c",', 'kind: "c", id: x.id,');
  source = source.replace('ideaSent: false,', 'ideaSent: false, ideaSending: false,');
  source = source.replace('ideaErr: s.ideaErr,', 'ideaErr: s.ideaErr, ideaSending: s.ideaSending,');
  source = source.replace('e.preventDefault();\n        const f = new FormData(e.currentTarget)', 'e.preventDefault();\n        if (this.state.ideaSending) return;\n        const f = new FormData(e.currentTarget)');
  source = source.replace('Your idea is on the preview map. Nothing was sent — this form shows how a suggestion reaches the team.', 'Your idea has been sent to our team for review. It will appear on the roadmap only after approval.');
  source = source.replace('Votes update only in this browser session. Comments and suggestions are demonstration content; nothing is sent or stored.', 'Votes stay in this browser session. Comments are examples. Submitted ideas go to our team for review.');
  source = source.replace(/x\.body\s*\+\s*" Commenting remains a local frontend preview; no information is transmitted or stored\."/, 'x.body');
  source = source.replace('body: A.body,', 'body: A.body, hasComments: A.kind === "c", commentThread: content.IDEA_COMMENTS(A.id),');
  // Drop the unused hero copy: extraction describes only the sections now rendered.
  source = source.replace('label: p,', 'label: p, pressed: on,');
  source = source.replace('onClick={pr.pick}', 'onClick={pr.pick} aria-pressed={pr.pressed}');
  source = source.replace(/    hero = \{[\s\S]*?\n    \};\n    page =/, '    page =');
  source = source.replace('    this._prev = this.state;', `    this._prev = this.state;
    if (ps.active !== this.state.active) {
      if (this.state.active) {
        this.dialogReturn = document.activeElement;
        requestAnimationFrame(() => this.rootRef.current?.querySelector('[role="dialog"] button')?.focus());
      } else this.dialogReturn?.focus();
    }`);
  source = source.replace('  onKey = (e) => {', `  onKey = (e) => {
    if (e.key === "Tab" && this.state.active) {
      const elements = [...this.rootRef.current.querySelector('[role="dialog"]').querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')];
      const first = elements[0], last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) {e.preventDefault();last?.focus();}
      else if (!e.shiftKey && document.activeElement === last) {e.preventDefault();first?.focus();}
    }`);
  source = source.replace('fontFamily: "Montserrat, sans-serif"', 'fontFamily: \'"OrgTik Arabic",Montserrat, sans-serif\'');
  return 'import { SiteHeader } from "./SiteHeader";\n' + source;
}
