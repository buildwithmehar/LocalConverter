import { FASTElement, css, html, nullableNumberConverter } from '@microsoft/fast-element';

// FAST is loaded only for a real, numeric job-progress signal. No timer invents progress.
class LocalConversionProgress extends FASTElement {
  constructor() {
    super();
    this.value = 0;
  }
  get fraction() {
    return Math.max(0, Math.min(100, this.value || 0)) / 100;
  }
}

if (!customElements.get('local-conversion-progress'))
  LocalConversionProgress.define({
    name: 'local-conversion-progress',
    attributes: [{ property: 'value', converter: nullableNumberConverter }],
    template: html`<span class="track"
      ><span class="fill" style="${(x) => `transform:scaleX(${x.fraction})`}"></span
    ></span>`,
    styles: css`
      :host {
        display: block;
        width: 100%;
        height: 4px;
      }
      :host([hidden]) {
        display: none;
      }
      .track {
        display: block;
        height: 100%;
        overflow: hidden;
        border-radius: 4px;
        background: var(--line, #ddd);
      }
      .fill {
        display: block;
        height: 100%;
        background: var(--red, #b93634);
        transform-origin: left center;
        transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      @media (prefers-reduced-motion: reduce) {
        .fill {
          transition: none;
        }
      }
      :host-context([data-page-hidden]) .fill {
        transition: none;
      }
    `,
  });
