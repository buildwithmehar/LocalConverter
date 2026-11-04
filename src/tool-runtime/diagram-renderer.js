import mermaid from 'mermaid';
let diagramId = 0;
export async function renderLocalDiagram(text, theme = 'default') {
  if (text.length > 30000) throw new Error('Diagrams accept up to 30,000 characters.');
  if (/%%\{|^\s*---|https?:|data:|<\s*(?:script|iframe|img|image)|\bclick\s/im.test(text))
    throw new Error(
      'External resources, HTML, click actions and configuration directives are disabled.',
    );
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme,
    htmlLabels: false,
    maxTextSize: 30000,
    maxEdges: 500,
    flowchart: { htmlLabels: false },
    fontFamily: 'Arial, sans-serif',
    suppressErrorRendering: true,
  });
  const { svg } = await mermaid.render('local-diagram-' + ++diagramId, text);
  return svg;
}
globalThis.renderLocalDiagram = renderLocalDiagram;
